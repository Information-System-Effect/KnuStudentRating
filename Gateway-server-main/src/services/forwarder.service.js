const crypto = require("crypto");

function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function buildSignaturePayload({ rawMessage, timestamp, nonce, requestId }) {
  return [
    rawMessage ?? "",
    String(timestamp ?? ""),
    String(nonce ?? ""),
    String(requestId ?? ""),
  ].join("|");
}

function signPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

async function forwardToBackend(rawMessage, options = {}) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured");
  }

  const gatewaySecret = process.env.GATEWAY_SHARED_SECRET;
  if (!gatewaySecret) {
    throw new Error("GATEWAY_SHARED_SECRET is not configured");
  }

  const timeoutMs = Number(process.env.BACKEND_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestId = options.requestId || "";
  const timestamp = Date.now().toString();
  const nonce = generateNonce();

  const signaturePayload = buildSignaturePayload({
    rawMessage,
    timestamp,
    nonce,
    requestId,
  });

  const signature = signPayload(signaturePayload, gatewaySecret);

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Gateway-Timestamp": timestamp,
    "X-Gateway-Nonce": nonce,
    "X-Gateway-Signature": signature,
  };

  if (options.authorization) {
    headers.Authorization = options.authorization;
  }

  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }

  const gatewaySecretHeader =
    process.env.GATEWAY_SECRET_HEADER || "X-Gateway-Secret";
  headers[gatewaySecretHeader] = gatewaySecret;

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: rawMessage,
      signal: controller.signal,
    });

    const text = await response.text();

    let body = text;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text;
    }

    return {
      statusCode: response.status,
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { forwardToBackend };