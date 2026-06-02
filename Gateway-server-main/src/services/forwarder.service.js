const crypto = require("crypto");
const { SECURITY } = require("../utils/constants");

/**
 * Генерує одноразовий nonce для внутрішнього gateway-запиту.
 * Використовується backend'ом для захисту від replay-атак.
 *
 * @returns {string} 16-байтний шістнадцятковий рядок
 */
function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Формує payload, який буде підписано через HMAC.
 * Порядок полів має бути однаковим і на gateway, і на backend.
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
 */
function signPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");
}

/**
 * Визначає, на який backend треба відправити запит,
 * залежно від типу шаблону (контекстна маршрутизація).
 */
function resolveBackendUrl(templateInfo) {
  const templateType = typeof templateInfo === "string" ? templateInfo : templateInfo?.type;

  if (templateType === "rating") {
    if (!process.env.BACKEND_RATING_URL) throw new Error("BACKEND_RATING_URL is not configured");
    return process.env.BACKEND_RATING_URL;
  }

  const mainBackendUrl = process.env.BACKEND_MAIN_URL || process.env.BACKEND_URL;
  if (!mainBackendUrl) throw new Error("BACKEND_MAIN_URL is not configured");

  return mainBackendUrl;
}

/**
 * Пересилає вже валідний gateway-запит на відповідний backend.
 * Додає службові заголовки безпеки, що унеможливлює прямий доступ до сервера.
 */
async function forwardToBackend(rawMessage, options = {}) {
  const backendUrl = resolveBackendUrl(options.templateInfo);
  const gatewaySecret = SECURITY.SECRET_KEY; // Беремо з централізованих констант

  const timeoutMs = Number(process.env.BACKEND_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestId = options.requestId || crypto.randomUUID();
  const timestamp = Date.now().toString();
  const nonce = generateNonce();

  const signaturePayload = buildSignaturePayload({ rawMessage, timestamp, nonce, requestId });
  const signature = signPayload(signaturePayload, gatewaySecret);

  // Формування захищених заголовків
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    [SECURITY.HEADER_TIMESTAMP]: timestamp,
    "X-Gateway-Nonce": nonce,
    [SECURITY.HEADER_SIGNATURE]: signature,
  };

  if (options.authorization) headers.Authorization = options.authorization;
  if (requestId) headers["X-Request-Id"] = requestId;

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: rawMessage,
      signal: controller.signal,
    });

    const text = await response.text();
    let body = text;
    try { body = text ? JSON.parse(text) : {}; } catch { body = text; }

    return { statusCode: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { forwardToBackend };