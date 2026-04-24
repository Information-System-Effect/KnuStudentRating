/**
 * Контролер шлюзу для обробки текстових запитів внутрішнього протоколу.
 *
 * Основна послідовність обробки:
 * 1. Отримання сирого текстового повідомлення з body.
 * 2. Парсинг повідомлення у структурований об'єкт.
 * 3. Базова валідація структури протоколу.
 * 4. Визначення шаблону запиту.
 * 5. Шаблонна валідація.
 * 6. Перевірка прав доступу.
 * 7. Пересилання запиту на відповідний backend.
 */

const { parseGatewayMessage } = require("../services/parser.service");
const { validateBaseMessage } = require("../services/base-validator.service");
const { detectGatewayTemplate } = require("../services/template-detector.service");
const { validateTemplateMessage } = require("../services/template-validator.service");
const { checkAccess } = require("../services/access-control.service");
const { forwardToBackend } = require("../services/forwarder.service");

/**
 * Обробляє вхідний gateway-запит у текстовому форматі.
 *
 * Функція:
 * - перевіряє наявність і коректність body;
 * - виконує парсинг і валідацію запиту;
 * - визначає тип шаблону;
 * - перевіряє права доступу користувача;
 * - пересилає валідний запит на потрібний backend.
 *
 * @async
 * @function handleGatewayMessage
 * @param {object} req - Об'єкт HTTP-запиту Express.
 * @param {string} req.body - Сирий текстовий запит у форматі шлюзу.
 * @param {Function} req.get - Метод читання HTTP-заголовків.
 * @param {object} res - Об'єкт HTTP-відповіді Express.
 * @returns {Promise<object|void>} Повертає HTTP-відповідь у форматі JSON або тексту.
 */
async function handleGatewayMessage(req, res) {
  const rawMessage = req.body;
  const authorization = req.get("authorization");
  const requestId = req.get("x-request-id");

  /**
   * Крок 0.
   * Перевірка, що body існує, є рядком і не є порожнім.
   * Якщо умова не виконується, повертається помилка 400.
   */
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "BAD_REQUEST",
        message: "Очікується непорожній text/plain у body",
      },
    });
  }

  let parsed;

  /**
   * Крок 1.
   * Парсинг сирого текстового повідомлення у структурований об'єкт.
   * Якщо парсер не зміг розпізнати формат, повертається помилка 400.
   */
  try {
    parsed = parseGatewayMessage(rawMessage);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "PARSING_ERROR",
        message: error.message,
      },
    });
  }

  /**
   * Крок 2.
   * Базова валідація структури протоколу.
   * Тут перевіряються загальні правила:
   * - senderCode
   * - targetUserCode
   * - method
   * - targetField / changes
   * - формат параметрів запиту
   */
  const baseValidation = validateBaseMessage(parsed);
  if (!baseValidation.ok) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "VALIDATION_ERROR",
        message: "Запит не пройшов базову валідацію",
        details: baseValidation.errors,
      },
    });
  }

  /**
   * Крок 3.
   * Визначення шаблону запиту.
   * Наприклад, шаблон може бути "rating" або "general".
   * Результат використовується для подальшої шаблонної валідації
   * та вибору backend-сервера.
   */
  const templateInfo = detectGatewayTemplate(parsed);

  /**
   * Крок 4.
   * Шаблонна валідація.
   * Перевіряються правила, які залежать від конкретного типу запиту.
   * Наприклад, для рейтингового шаблону — коректність категорій.
   */
  const templateValidation = validateTemplateMessage(parsed, templateInfo);
  if (!templateValidation.ok) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "TEMPLATE_VALIDATION_ERROR",
        message: "Запит не пройшов перевірку шаблону",
        details: templateValidation.errors,
      },
    });
  }

  /**
   * Крок 5.
   * Формування контексту користувача із заголовків запиту
   * та перевірка прав доступу.
   *
   * На цьому етапі перевіряється:
   * - роль користувача;
   * - код автентифікованого користувача;
   * - право виконувати конкретну операцію для визначеного шаблону.
   */
  const userContext = {
    role: req.get("x-user-role"),
    userCode: req.get("x-user-code"),
  };

  const accessResult = checkAccess({
    parsed,
    templateInfo,
    userContext,
  });

  if (!accessResult.ok) {
    return res.status(403).json({
      ok: false,
      code: 403,
      error: {
        type: "ACCESS_DENIED",
        message: "Користувач не має права виконувати цю операцію",
        details: accessResult.errors,
      },
    });
  }

  /**
   * Крок 6.
   * Пересилання валідного і дозволеного запиту на backend.
   *
   * У forwarder передаються:
   * - rawMessage — сирий текстовий запит;
   * - parsed — розпарсений об'єкт;
   * - templateInfo — інформація про шаблон;
   * - authorization — заголовок авторизації;
   * - requestId — ідентифікатор запиту для трасування.
   *
   * Якщо backend повертає текст — відповідь пересилається через send().
   * Якщо backend повертає JSON — відповідь пересилається через json().
   */
  try {
    const backendResult = await forwardToBackend(rawMessage, {
      parsed,
      templateInfo,
      authorization,
      requestId,
    });

    if (typeof backendResult.body === "string") {
      return res.status(backendResult.statusCode).send(backendResult.body);
    }

    return res.status(backendResult.statusCode).json(backendResult.body);
  } catch (error) {
    /**
     * Якщо backend недоступний або запит до нього завершився timeout,
     * шлюз повертає помилку 502.
     */
    const isTimeout = error && error.name === "AbortError";

    return res.status(502).json({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: isTimeout
          ? "Backend request timed out"
          : `Failed to reach backend: ${error.message}`,
      },
    });
  }
}

module.exports = { handleGatewayMessage };