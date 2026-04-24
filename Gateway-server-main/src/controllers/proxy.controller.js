/**
 * Контролер проксі-запитів шлюзу.
 *
 * Призначення:
 * - визначати, чи має вхідний маршрут обслуговуватися через gateway proxy;
 * - пересилати допустимі HTTP-запити на backend;
 * - коректно передавати заголовки та cookies з backend-відповіді клієнту;
 * - повертати помилку, якщо маршрут не належить до зони відповідальності шлюзу
 *   або якщо backend недоступний.
 */

const { proxyToBackend } = require("../services/proxy.service");

/**
 * Набір префіксів маршрутів, які шлюз може проксіювати на backend.
 *
 * Наприклад:
 * - /api
 * - /site
 * - /assets
 * - /swagger-ui
 */
const PROXY_PREFIXES = Object.freeze([
  "/api",
  "/site",
  "/assets",
  "/css",
  "/js",
  "/images",
  "/uploads",
  "/swagger-ui",
  "/v3/api-docs",
]);

/**
 * Маршрути, які мають проксіюватися лише при точному збігу.
 */
const EXACT_PROXY_PATHS = new Set(["/", "/swagger-ui.html", "/favicon.ico"]);

/**
 * Заголовки відповіді backend, які не слід копіювати напряму.
 *
 * Причини:
 * - transfer-encoding і content-length можуть бути некоректними після повторної відправки;
 * - set-cookie обробляється окремо, щоб коректно передати масив cookie.
 */
const IGNORED_RESPONSE_HEADERS = new Set(["transfer-encoding", "content-length", "set-cookie"]);

/**
 * Перевіряє, чи повинен вказаний маршрут оброблятися через proxy.
 *
 * Логіка:
 * - якщо шлях входить до EXACT_PROXY_PATHS — повертається true;
 * - якщо шлях збігається з одним із префіксів або починається з нього — теж true;
 * - інакше маршрут не належить до proxy-зони шлюзу.
 *
 * @param {string} pathname - HTTP-шлях запиту.
 * @returns {boolean} true, якщо маршрут треба проксіювати; false — якщо ні.
 */
function shouldProxy(pathname) {
  if (EXACT_PROXY_PATHS.has(pathname)) {
    return true;
  }

  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Обробляє proxy-запит шлюзу.
 *
 * Основна послідовність:
 * 1. Отримати pathname із запиту.
 * 2. Перевірити, чи належить маршрут до proxy-маршрутів.
 * 3. Якщо маршрут не підтримується — повернути 404.
 * 4. Якщо маршрут підтримується — передати запит у proxy.service.
 * 5. Отримати відповідь backend і перенести її заголовки та тіло у відповідь клієнту.
 * 6. У разі помилки з боку backend повернути 502.
 *
 * @async
 * @function handleProxyRequest
 * @param {object} req - Об'єкт HTTP-запиту Express.
 * @param {string} req.path - Шлях запиту.
 * @param {object} res - Об'єкт HTTP-відповіді Express.
 * @returns {Promise<object|void>} Повертає відповідь клієнту.
 */
async function handleProxyRequest(req, res) {
  try {
    /**
     * Якщо req.path відсутній, вважаємо, що запит іде на кореневий маршрут.
     */
    const pathname = req.path || "/";

    /**
     * Якщо маршрут не належить до proxy-маршрутів,
     * шлюз повертає 404 і не передає запит на backend.
     */
    if (!shouldProxy(pathname)) {
      return res.status(404).json({
        ok: false,
        code: 404,
        error: {
          type: "NOT_FOUND",
          message: "Route is not handled by gateway",
        },
      });
    }

    /**
     * Передача вхідного HTTP-запиту на backend через proxy.service.
     * result містить:
     * - statusCode
     * - headers
     * - body
     * - setCookies
     */
    const result = await proxyToBackend(req);

    /**
     * Переносимо заголовки відповіді backend у відповідь клієнту,
     * окрім тих, що спеціально ігноруються.
     */
    for (const [name, value] of result.headers.entries()) {
      const lowered = name.toLowerCase();

      if (IGNORED_RESPONSE_HEADERS.has(lowered)) {
        continue;
      }

      res.setHeader(name, value);
    }

    /**
     * Set-Cookie обробляється окремо, оскільки backend
     * може повернути кілька cookie одночасно.
     */
    if (Array.isArray(result.setCookies) && result.setCookies.length > 0) {
      res.setHeader("Set-Cookie", result.setCookies);
    }

    /**
     * Повертаємо клієнту тіло відповіді backend
     * з оригінальним статус-кодом.
     */
    return res.status(result.statusCode).send(result.body);
  } catch (error) {
    /**
     * Якщо при проксіюванні виникла помилка (наприклад,
     * backend недоступний), повертаємо 502.
     */
    return res.status(502).json({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: `Proxy error: ${error.message}`,
      },
    });
  }
}

module.exports = { handleProxyRequest, shouldProxy };