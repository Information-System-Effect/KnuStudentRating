const crypto = require("crypto");

/**
 * Генерує одноразовий nonce для внутрішнього gateway-запиту.
 * Використовується backend'ом для захисту від replay-атак.
 *
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Формує payload, який буде підписано через HMAC.
 * Порядок полів має бути однаковим і на gateway, і на backend.
 *
 * @param {Object} params
 * @param {string} params.rawMessage
 * @param {string|number} params.timestamp
 * @param {string} params.nonce
 * @param {string} params.requestId
 * @returns {string}
 */
function buildSignaturePayload({ rawMessage, timestamp, nonce, requestId }) {
  return [
    rawMessage ?? "",
    String(timestamp ?? ""),
    String(nonce ?? ""),
    String(requestId ?? ""),
  ].join("|");
}

/**
 * Обчислює HMAC-SHA256 підпис для внутрішнього запиту шлюзу.
 *
 * @param {string} payload
 * @param {string} secret
 * @returns {string}
 */
function signPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Визначає, на який backend треба відправити запит,
 * залежно від типу шаблону.
 *
 * Підтримувані типи:
 * - rating  -> BACKEND_RATING_URL
 * - general -> BACKEND_MAIN_URL або BACKEND_URL
 *
 * @param {string|Object} templateInfo
 * @returns {string}
 * @throws {Error}
 */
function resolveBackendUrl(templateInfo) {
  const templateType =
    typeof templateInfo === "string" ? templateInfo : templateInfo?.type;

  if (templateType === "rating") {
    if (!process.env.BACKEND_RATING_URL) {
      throw new Error("BACKEND_RATING_URL is not configured");
    }
    return process.env.BACKEND_RATING_URL;
  }

  const mainBackendUrl =
    process.env.BACKEND_MAIN_URL || process.env.BACKEND_URL;

  if (!mainBackendUrl) {
    throw new Error("BACKEND_MAIN_URL or BACKEND_URL is not configured");
  }

  return mainBackendUrl;
}

/**
 * Пересилає вже валідний gateway-запит на відповідний backend.
 *
 * На gateway виконується:
 * - вибір backend за templateInfo
 * - генерація timestamp
 * - генерація nonce
 * - побудова HMAC-підпису
 * - додавання службових security headers
 *
 * На backend ці дані вже перевіряються, зокрема:
 * - gateway secret
 * - signature
 * - timestamp
 * - nonce uniqueness через Redis
 *
 * @param {string} rawMessage
 * @param {Object} [options={}]
 * @param {Object|string} [options.templateInfo]
 * @param {Object} [options.parsed]
 * @param {string} [options.authorization]
 * @param {string} [options.requestId]
 * @returns {Promise<{statusCode:number, body:any}>}
 * @throws {Error}
 */
async function forwardToBackend(rawMessage, options = {}) {
  const backendUrl = resolveBackendUrl(options.templateInfo);

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