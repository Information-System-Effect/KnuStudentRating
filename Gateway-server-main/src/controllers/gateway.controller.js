/**
 * @module GatewayController
 * @description Основний контролер шлюзу. Керує життєвим циклом вхідного текстового запиту,
 * об'єднуючи парсинг, валідацію, контроль доступу та маршрутизацію в єдиний пайплайн (Middleware Chain).
 */

/**
 * Обробляє вхідний gateway-запит, виконує всі етапи перевірки та повертає JSON-відповідь.
 *
 * @async
 * @param {import('express').Request} req - Об'єкт HTTP-запиту (тіло у форматі text/plain).
 * @param {import('express').Response} res - Об'єкт HTTP-відповіді.
 * @returns {Promise<void>}
 */
// async function handleGatewayMessage(req, res) { ... }

/**
 * Контролер шлюзу для обробки текстових запитів внутрішнього протоколу.
 */

const { parseGatewayMessage } = require("../services/parser.service");
const { validateBaseMessage } = require("../services/base-validator.service");
const { detectGatewayTemplate } = require("../services/template-detector.service");
const { validateTemplateMessage } = require("../services/template-validator.service");
const { checkAccess } = require("../services/access-control.service");
const { forwardToBackend } = require("../services/forwarder.service");
const { logEvent } = require("../services/logger.service");
const { RESPONSE_CODES } = require("../utils/constants");

/**
 * Обробляє вхідний gateway-запит у текстовому форматі.
 */
async function handleGatewayMessage(req, res) {
  const rawMessage = req.body;
  const authorization = req.get("authorization");
  const requestId = req.get("x-request-id") || `REQ-${Date.now()}`;

  logEvent("INFO", "RECEIVE", `Отримано запит [${requestId}]`);

  // 0. Перевірка наявності body
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    logEvent("ERROR", "VALIDATION", "Порожній запит");
    return res.status(RESPONSE_CODES.BAD_REQUEST).json({
      ok: false, code: RESPONSE_CODES.BAD_REQUEST,
      message: "Помилка структури запиту", error: "Очікується непорожній text/plain у body"
    });
  }

  let parsed;

  // 1. Парсинг
  try {
    parsed = parseGatewayMessage(rawMessage);
  } catch (error) {
    logEvent("ERROR", "PARSING", "Помилка парсингу", error.message);
    return res.status(RESPONSE_CODES.BAD_REQUEST).json({
      ok: false, code: RESPONSE_CODES.BAD_REQUEST,
      message: "Помилка структури запиту", error: error.message
    });
  }

  // 2. Базова валідація
  const baseValidation = validateBaseMessage(parsed);
  if (!baseValidation.ok) {
    logEvent("ERROR", "BASE_VALIDATION", "Не пройдено базову валідацію", baseValidation.errors);
    return res.status(RESPONSE_CODES.BAD_REQUEST).json({
      ok: false, code: RESPONSE_CODES.BAD_REQUEST,
      message: "Помилка формату", error: baseValidation.errors.join("; ")
    });
  }

  // 3. Визначення шаблону
  const templateInfo = detectGatewayTemplate(parsed);

  // 4. Шаблонна валідація
  const templateValidation = validateTemplateMessage(parsed, templateInfo);
  if (!templateValidation.ok) {
    logEvent("ERROR", "TEMPLATE_VALIDATION", `Помилка шаблону ${templateInfo}`, templateValidation.errors);
    return res.status(RESPONSE_CODES.BAD_REQUEST).json({
      ok: false, code: RESPONSE_CODES.BAD_REQUEST,
      message: "Помилка семантики", error: templateValidation.errors.join("; ")
    });
  }

  // 5. Контроль доступу та ролей
  const userContext = {
    role: req.get("x-user-role"),
    userCode: req.get("x-user-code"),
  };

  const accessResult = checkAccess({ parsed, templateInfo, userContext });
  if (!accessResult.ok) {
    logEvent("ERROR", "ACCESS_CONTROL", "Блокування за роллю/лімітом", accessResult.errors);
    return res.status(RESPONSE_CODES.FORBIDDEN).json({
      ok: false, code: RESPONSE_CODES.FORBIDDEN,
      message: "Операція заборонена", error: accessResult.errors.join("; ")
    });
  }

  // 6. Форвардинг на сервер
  try {
    const backendResult = await forwardToBackend(rawMessage, {
      parsed, templateInfo, authorization, requestId,
    });

    logEvent("INFO", "FORWARD_SUCCESS", `Запит [${requestId}] успішно оброблено сервером`);

    if (typeof backendResult.body === "string") {
      return res.status(backendResult.statusCode).send(backendResult.body);
    }
    return res.status(backendResult.statusCode).json(backendResult.body);

  } catch (error) {
    const isTimeout = error && error.name === "AbortError";
    logEvent("ERROR", "FORWARD_FAILED", "Сервер недоступний", error.message);

    return res.status(502).json({
      ok: false, code: 502,
      message: "Помилка сервера", error: isTimeout ? "Backend request timed out" : `Failed to reach backend: ${error.message}`
    });
  }
}

module.exports = { handleGatewayMessage };