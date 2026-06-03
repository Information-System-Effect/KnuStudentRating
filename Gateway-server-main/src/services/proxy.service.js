/**
 * @module ProxyService
 * @description Сервіс проксіювання. Пересилає стандартні HTTP-запити на бекенд, 
 * зберігаючи заголовки, тіло запиту та cookies.
 */

/**
 * Сервіс proxy-переадресації запитів на backend.
 *
 * Призначення:
 * - визначати базову адресу backend-сервера;
 * - копіювати допустимі заголовки вхідного запиту;
 * - зчитувати тіло запиту в безпечному форматі;
 * - пересилати HTTP-запит на backend;
 * - повертати статус, заголовки, тіло відповіді та cookies.
 *
 * Цей сервіс використовується як універсальний reverse proxy
 * для маршрутів, які шлюз не обробляє через власний текстовий протокол.
 */

const DEFAULT_BACKEND_BASE_URL = "http://localhost:8081";
const DEFAULT_BACKEND_TIMEOUT_MS = 15000;

/**
 * Набір HTTP-методів, для яких тіло запиту не пересилається.
 */
const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

/**
 * Заголовки, які не слід пересилати на backend напряму.
 *
 * Причини:
 * - host визначається для нового цільового сервера;
 * - connection є hop-by-hop заголовком;
 * - content-length буде перевизначений автоматично відповідно до нового body.
 */
const FORBIDDEN_FORWARD_HEADERS = new Set(["host", "connection", "content-length"]);

/**
 * Визначає базову адресу backend-сервера.
 *
 * Пріоритет:
 * 1. BACKEND_BASE_URL
 * 2. origin із BACKEND_URL
 * 3. DEFAULT_BACKEND_BASE_URL
 *
 * Якщо BACKEND_URL вказує на конкретний endpoint,
 * з нього береться лише origin, щоб далі можна було формувати
 * повний target URL на основі шляху вхідного запиту.
 *
 * @returns {string} Базова адреса backend-сервера.
 */
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

/**
 * Формує набір заголовків, які можна безпечно переслати на backend.
 *
 * Логіка:
 * - усі вхідні заголовки перебираються;
 * - заборонені заголовки пропускаються;
 * - решта переноситься в новий об'єкт headers.
 *
 * @param {object} req - Об'єкт HTTP-запиту Express.
 * @returns {object} Набір заголовків для пересилання на backend.
 */
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

/**
 * Зчитує тіло HTTP-запиту для подальшого proxy-пересилання.
 *
 * Логіка:
 * - для GET / HEAD тіло не використовується;
 * - якщо req.body уже є рядком — повертається як є;
 * - якщо req.body уже є Buffer — повертається як є;
 * - інакше тіло читається як потік і збирається в Buffer.
 *
 * @async
 * @param {object} req - Об'єкт HTTP-запиту Express.
 * @returns {Promise<string|Buffer|undefined>} Тіло запиту або undefined.
 */
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

/**
 * Пересилає HTTP-запит на backend у режимі proxy.
 *
 * Основна послідовність:
 * 1. Визначити базову адресу backend.
 * 2. Побудувати повний target URL на основі вхідного шляху та query-параметрів.
 * 3. Зібрати допустимі заголовки.
 * 4. За потреби додати службовий секрет шлюзу для /api/ маршрутів.
 * 5. Зчитати body запиту.
 * 6. Переслати запит на backend через fetch.
 * 7. Отримати відповідь backend і повернути її у структурованому вигляді.
 *
 * Особливість:
 * Для маршрутів, що починаються з /api/, gateway може додавати
 * службовий заголовок із секретом, щоб backend міг відрізнити
 * запит, який пройшов через шлюз, від прямого зовнішнього звернення.
 *
 * @async
 * @param {object} req - Об'єкт HTTP-запиту Express.
 * @returns {Promise<{
 *   statusCode: number,
 *   headers: Headers,
 *   body: Buffer,
 *   setCookies: string[]
 * }>} Структурована відповідь backend.
 */
async function proxyToBackend(req) {
  const backendBaseUrl = resolveBackendBaseUrl();

  /**
   * Формування повної адреси вхідного запиту на основі:
   * - протоколу
   * - host
   * - originalUrl
   */
  const incomingUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const sourceUrl = new URL(incomingUrl);

  /**
   * Побудова цільової адреси на backend:
   * - зберігається шлях;
   * - зберігаються query-параметри;
   * - змінюється лише backend-origin.
   */
  const targetUrl = new URL(
    sourceUrl.pathname + sourceUrl.search,
    backendBaseUrl
  );

  /**
   * Налаштування timeout для backend-запиту.
   */
  const timeoutMs = Number(
    process.env.BACKEND_TIMEOUT_MS || DEFAULT_BACKEND_TIMEOUT_MS
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  /**
   * Підготовка заголовків до пересилання.
   */
  const headers = getForwardHeaders(req);

  /**
   * Додавання службового секрету шлюзу лише для /api/ маршрутів.
   * Це дозволяє backend перевіряти, що запит дійсно пройшов через gateway.
   */
  const gatewaySecret = process.env.GATEWAY_SHARED_SECRET;
  const gatewaySecretHeader =
    process.env.GATEWAY_SECRET_HEADER || "X-Gateway-Secret";

  if (gatewaySecret && sourceUrl.pathname.startsWith("/api/")) {
    headers[gatewaySecretHeader] = gatewaySecret;
  }

  try {
    /**
     * Пересилання запиту на backend.
     *
     * redirect: "manual" означає, що редіректи не будуть автоматично
     * слідуватися на рівні fetch, а залишаться під контролем застосунку.
     */
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: await readRequestBody(req),
      signal: controller.signal,
      redirect: "manual",
    });

    /**
     * Зчитування тіла відповіді backend у форматі Buffer.
     * Це дозволяє прозоро передавати як текст, так і бінарні дані.
     */
    const bodyBuffer = Buffer.from(await response.arrayBuffer());

    /**
     * Якщо runtime підтримує getSetCookie(),
     * окремо зчитуються всі Set-Cookie заголовки.
     */
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    return {
      statusCode: response.status,
      headers: response.headers,
      body: bodyBuffer,
      setCookies,
    };
  } finally {
    /**
     * У будь-якому випадку очищається таймер timeout,
     * щоб уникнути витоків ресурсів.
     */
    clearTimeout(timer);
  }
}

module.exports = { proxyToBackend };