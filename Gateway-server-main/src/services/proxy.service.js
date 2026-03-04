const DEFAULT_BACKEND_BASE_URL = "http://localhost:8081";
const DEFAULT_BACKEND_TIMEOUT_MS = 15000;
const NO_BODY_METHODS = new Set(["GET", "HEAD"]);
const FORBIDDEN_FORWARD_HEADERS = new Set(["host", "connection", "content-length"]);

function resolveBackendBaseUrl() {
  if (process.env.BACKEND_BASE_URL) {
    return process.env.BACKEND_BASE_URL;
  }

  if (process.env.BACKEND_URL) {
    const backendExecuteUrl = new URL(process.env.BACKEND_URL);
    return backendExecuteUrl.origin;
  }

  return DEFAULT_BACKEND_BASE_URL;
}

function getForwardHeaders(req) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const lowered = name.toLowerCase();
    if (FORBIDDEN_FORWARD_HEADERS.has(lowered)) {
      continue;
    }
    headers[name] = value;
  }
  return headers;
}

async function readRequestBody(req) {
  if (NO_BODY_METHODS.has(req.method)) {
    return undefined;
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function proxyToBackend(req) {
  const backendBaseUrl = resolveBackendBaseUrl();
  const incomingUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const sourceUrl = new URL(incomingUrl);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, backendBaseUrl);

  const timeoutMs = Number(process.env.BACKEND_TIMEOUT_MS || DEFAULT_BACKEND_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = getForwardHeaders(req);
  const gatewaySecret = process.env.GATEWAY_SHARED_SECRET;
  const gatewaySecretHeader = process.env.GATEWAY_SECRET_HEADER || "X-Gateway-Secret";
  if (gatewaySecret && sourceUrl.pathname.startsWith("/api/")) {
    headers[gatewaySecretHeader] = gatewaySecret;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: await readRequestBody(req),
      signal: controller.signal,
      redirect: "manual",
    });

    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];

    return {
      statusCode: response.status,
      headers: response.headers,
      body: bodyBuffer,
      setCookies,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { proxyToBackend };
