const { parseGatewayMessage } = require("../services/parser.service");
const { validateBaseMessage } = require("../services/base-validator.service");
const { detectGatewayTemplate } = require("../services/template-detector.service");
const { validateTemplateMessage } = require("../services/template-validator.service");
const { checkAccess } = require("../services/access-control.service");
const { forwardToBackend } = require("../services/forwarder.service");

async function handleGatewayMessage(req, res) {
  const rawMessage = req.body;

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

  // 1) Парсинг
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

  // 2) Базова валідація
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

  // 3) Визначення шаблону
  const templateInfo = detectGatewayTemplate(parsed);

  // 4) Валідація шаблону
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

  // 5) Access control
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

  // 6) Переадресація на backend
  try {
    const backendResult = await forwardToBackend(rawMessage, {
      parsed,
      templateInfo,
      authorization: req.get("authorization"),
      requestId: req.get("x-request-id"),
    });

    if (typeof backendResult.body === "string") {
      return res.status(backendResult.statusCode).send(backendResult.body);
    }

    return res.status(backendResult.statusCode).json(backendResult.body);
  } catch (error) {
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