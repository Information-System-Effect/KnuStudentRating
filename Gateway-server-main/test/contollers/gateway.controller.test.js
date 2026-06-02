jest.mock("../../src/services/parser.service", () => ({
  parseGatewayMessage: jest.fn(),
}));

jest.mock("../../src/services/base-validator.service", () => ({
  validateBaseMessage: jest.fn(),
}));

jest.mock("../../src/services/template-detector.service", () => ({
  detectGatewayTemplate: jest.fn(),
}));

jest.mock("../../src/services/template-validator.service", () => ({
  validateTemplateMessage: jest.fn(),
}));

jest.mock("../../src/services/access-control.service", () => ({
  checkAccess: jest.fn(),
}));

jest.mock("../../src/services/forwarder.service", () => ({
  forwardToBackend: jest.fn(),
}));

const { handleGatewayMessage } = require("../../src/controllers/gateway.controller");
const { parseGatewayMessage } = require("../../src/services/parser.service");
const { validateBaseMessage } = require("../../src/services/base-validator.service");
const { detectGatewayTemplate } = require("../../src/services/template-detector.service");
const { validateTemplateMessage } = require("../../src/services/template-validator.service");
const { checkAccess } = require("../../src/services/access-control.service");
const { forwardToBackend } = require("../../src/services/forwarder.service");
const { RESPONSE_CODES } = require("../../src/utils/constants");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

function createMockReq({ body, headers = {} } = {}) {
  return {
    body,
    get: jest.fn((name) => headers[name.toLowerCase()]),
  };
}

describe("handleGatewayMessage Controller", () => {
  // Фіксуємо час для передбачуваної генерації requestId
  const FIXED_TIMESTAMP = 1600000000000;

  beforeAll(() => {
    // Відключаємо реальне виведення логів у консоль під час тестів
    jest.spyOn(console, "log").mockImplementation(() => { });
    jest.spyOn(console, "error").mockImplementation(() => { });
    jest.spyOn(Date, "now").mockReturnValue(FIXED_TIMESTAMP);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("повертає 400, якщо body порожнє або не є рядком", async () => {
    const req = createMockReq({ body: "   " });
    const res = createMockRes();

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(RESPONSE_CODES.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      message: "Помилка структури запиту",
      error: "Очікується непорожній text/plain у body",
    });

    expect(parseGatewayMessage).not.toHaveBeenCalled();
  });

  test("повертає 400 у разі помилки парсингу", async () => {
    const req = createMockReq({ body: "bad request" });
    const res = createMockRes();

    parseGatewayMessage.mockImplementation(() => {
      throw new Error("Недостатньо полів у запиті. Очікується мінімум 5 елементів.");
    });

    await handleGatewayMessage(req, res);

    expect(parseGatewayMessage).toHaveBeenCalledWith("bad request");
    expect(res.status).toHaveBeenCalledWith(RESPONSE_CODES.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      message: "Помилка структури запиту",
      error: "Недостатньо полів у запиті. Очікується мінімум 5 елементів.",
    });

    expect(validateBaseMessage).not.toHaveBeenCalled();
  });

  test("повертає 400, якщо базова валідація не пройдена", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#TEAMWORK#+50" });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "TEAMWORK", changeValue: "+50" }],
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: false,
      errors: ["Невірний формат зміни: +50"],
    });

    await handleGatewayMessage(req, res);

    expect(validateBaseMessage).toHaveBeenCalledWith(parsed);
    expect(res.status).toHaveBeenCalledWith(RESPONSE_CODES.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      message: "Помилка формату",
      error: "Невірний формат зміни: +50",
    });

    expect(detectGatewayTemplate).not.toHaveBeenCalled();
  });

  test("повертає 400, якщо шаблонна семантична валідація не пройдена", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#INVALID_FIELD#+5" });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "INVALID_FIELD", changeValue: "+5" }],
    };

    const templateInfo = "rating";

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: false,
      errors: ["Невідома або недопустима рейтингова категорія: INVALID_FIELD"],
    });

    await handleGatewayMessage(req, res);

    expect(detectGatewayTemplate).toHaveBeenCalledWith(parsed);
    expect(validateTemplateMessage).toHaveBeenCalledWith(parsed, templateInfo);

    expect(res.status).toHaveBeenCalledWith(RESPONSE_CODES.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      message: "Помилка семантики",
      error: "Невідома або недопустима рейтингова категорія: INVALID_FIELD",
    });

    expect(checkAccess).not.toHaveBeenCalled();
  });

  test("повертає 403, якщо контроль ролей/лімітів відмовив у доступі", async () => {
    const req = createMockReq({
      body: "U1#U2#PATCH#LANG_JAVA#+10",
      headers: {
        "x-user-role": "STUDENT",
        "x-user-code": "U1",
      },
    });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+10" }],
    };

    const templateInfo = "rating";

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({ ok: true, errors: [] });

    checkAccess.mockReturnValue({
      ok: false,
      errors: ["Роль STUDENT не має права змінювати технічну категорію: LANG_JAVA"],
    });

    await handleGatewayMessage(req, res);

    expect(checkAccess).toHaveBeenCalledWith({
      parsed,
      templateInfo,
      userContext: { role: "STUDENT", userCode: "U1" },
    });

    expect(res.status).toHaveBeenCalledWith(RESPONSE_CODES.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 403,
      message: "Операція заборонена",
      error: "Роль STUDENT не має права змінювати технічну категорію: LANG_JAVA",
    });

    expect(forwardToBackend).not.toHaveBeenCalled();
  });

  test("успішно пересилає запит і повертає JSON-відповідь від сервера", async () => {
    const req = createMockReq({
      body: "L1#U2#PATCH#LANG_JAVA#+10",
      headers: {
        authorization: "Bearer token123",
        "x-request-id": "req-001",
        "x-user-role": "TEACHER",
        "x-user-code": "L1",
      },
    });
    const res = createMockRes();

    const parsed = {
      senderCode: "L1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+10" }],
    };

    const templateInfo = "rating";

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({ ok: true, errors: [] });
    checkAccess.mockReturnValue({ ok: true, errors: [] });
    forwardToBackend.mockResolvedValue({
      statusCode: 200,
      body: { ok: true, result: "updated" },
    });

    await handleGatewayMessage(req, res);

    expect(forwardToBackend).toHaveBeenCalledWith(
      "L1#U2#PATCH#LANG_JAVA#+10",
      {
        parsed,
        templateInfo,
        authorization: "Bearer token123",
        requestId: "req-001",
      }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: "updated",
    });
    expect(res.send).not.toHaveBeenCalled();
  });

  test("передає згенерований requestId, якщо його не було в заголовках", async () => {
    const req = createMockReq({
      body: "U1#_#GET#STUDENTS#page=1",
      headers: {}, // Порожні заголовки
    });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      mode: "single",
      targetField: "STUDENTS",
      opParams: "page=1",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue("general");
    validateTemplateMessage.mockReturnValue({ ok: true, errors: [] });
    checkAccess.mockReturnValue({ ok: true, errors: [] });
    forwardToBackend.mockResolvedValue({
      statusCode: 200,
      body: "plain text response",
    });

    await handleGatewayMessage(req, res);

    expect(forwardToBackend).toHaveBeenCalledWith(
      "U1#_#GET#STUDENTS#page=1",
      {
        parsed,
        templateInfo: "general",
        authorization: undefined,
        requestId: `REQ-${FIXED_TIMESTAMP}`, // Перевірка автоматичної генерації
      }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("plain text response");
  });

  test("повертає 502, якщо сервер не відповідає (timeout)", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#TEAMWORK#+5" });
    const res = createMockRes();

    parseGatewayMessage.mockReturnValue({});
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue("rating");
    validateTemplateMessage.mockReturnValue({ ok: true, errors: [] });
    checkAccess.mockReturnValue({ ok: true, errors: [] });

    const timeoutError = new Error("timeout");
    timeoutError.name = "AbortError";
    forwardToBackend.mockRejectedValue(timeoutError);

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 502,
      message: "Помилка сервера",
      error: "Backend request timed out",
    });
  });

  test("повертає 502 при загальній помилці з'єднання з backend", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#TEAMWORK#+5" });
    const res = createMockRes();

    parseGatewayMessage.mockReturnValue({});
    validateBaseMessage.mockReturnValue({ ok: true, errors: [] });
    detectGatewayTemplate.mockReturnValue("rating");
    validateTemplateMessage.mockReturnValue({ ok: true, errors: [] });
    checkAccess.mockReturnValue({ ok: true, errors: [] });

    forwardToBackend.mockRejectedValue(new Error("connection refused"));

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 502,
      message: "Помилка сервера",
      error: "Failed to reach backend: connection refused",
    });
  });
});