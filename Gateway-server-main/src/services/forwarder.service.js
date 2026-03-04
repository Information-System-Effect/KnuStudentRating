async function forwardToBackend(rawMessage, options = {}) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured");
  }

  const timeoutMs = Number(process.env.BACKEND_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
  };

  if (options.authorization) {
    headers.Authorization = options.authorization;
  }
  if (options.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  const gatewaySecret = process.env.GATEWAY_SHARED_SECRET;
  const gatewaySecretHeader = process.env.GATEWAY_SECRET_HEADER || "X-Gateway-Secret";
  if (gatewaySecret) {
    headers[gatewaySecretHeader] = gatewaySecret;
  }

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
