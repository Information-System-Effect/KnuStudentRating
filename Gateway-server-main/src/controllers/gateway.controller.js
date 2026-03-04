const { parseGatewayMessage } = require("../services/parser.service");
const { validateParsedMessage } = require("../services/validator.service");
const { forwardToBackend } = require("../services/forwarder.service");

async function handleGatewayMessage(req, res) {
  const rawMessage = req.body;

  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "BAD_REQUEST",
        message: "Expected non-empty text/plain body",
      },
    });
  }

  let parsed;
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

  const validation = validateParsedMessage(parsed);
  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      code: 400,
      error: {
        type: "VALIDATION_ERROR",
        message: "Request did not pass gateway validation",
        details: validation.errors,
      },
    });
  }

  try {
    const backendResult = await forwardToBackend(parsed.rawMessage, {
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
        message: isTimeout ? "Backend request timed out" : `Failed to reach backend: ${error.message}`,
      },
    });
  }
}

module.exports = { handleGatewayMessage };
