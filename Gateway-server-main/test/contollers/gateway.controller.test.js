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

jest.mock("../../src/services/forwarder.service", () => ({
  forwardToBackend: jest.fn(),
}));

const { handleGatewayMessage } = require("../../src/controllers/gateway.controller");
const { parseGatewayMessage } = require("../../src/services/parser.service");
const { validateBaseMessage } = require("../../src/services/base-validator.service");
const { detectGatewayTemplate } = require("../../src/services/template-detector.service");
const { validateTemplateMessage } = require("../../src/services/template-validator.service");
const { forwardToBackend } = require("../../src/services/forwarder.service");

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

describe("handleGatewayMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 400 if body is not a non-empty string", async () => {
    const req = createMockReq({ body: "" });
    const res = createMockRes();

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      error: {
        type: "BAD_REQUEST",
        message: "Очікується непорожній text/plain у body",
      },
    });

    expect(parseGatewayMessage).not.toHaveBeenCalled();
    expect(validateBaseMessage).not.toHaveBeenCalled();
    expect(detectGatewayTemplate).not.toHaveBeenCalled();
    expect(validateTemplateMessage).not.toHaveBeenCalled();
    expect(forwardToBackend).not.toHaveBeenCalled();
  });

  test("returns 400 on parsing error", async () => {
    const req = createMockReq({ body: "bad request" });
    const res = createMockRes();

    parseGatewayMessage.mockImplementation(() => {
      throw new Error("Порожній запит");
    });

    await handleGatewayMessage(req, res);

    expect(parseGatewayMessage).toHaveBeenCalledWith("bad request");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      error: {
        type: "PARSING_ERROR",
        message: "Порожній запит",
      },
    });

    expect(validateBaseMessage).not.toHaveBeenCalled();
    expect(detectGatewayTemplate).not.toHaveBeenCalled();
    expect(validateTemplateMessage).not.toHaveBeenCalled();
    expect(forwardToBackend).not.toHaveBeenCalled();
  });

  test("returns 400 on base validation error", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#TEAMWORK#+5" });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "TEAMWORK", changeValue: "+5" }],
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: false,
      errors: ["Невірний формат зміни: +50"],
    });

    await handleGatewayMessage(req, res);

    expect(parseGatewayMessage).toHaveBeenCalledWith("U1#U2#PATCH#TEAMWORK#+5");
    expect(validateBaseMessage).toHaveBeenCalledWith(parsed);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      error: {
        type: "VALIDATION_ERROR",
        message: "Запит не пройшов базову валідацію",
        details: ["Невірний формат зміни: +50"],
      },
    });

    expect(detectGatewayTemplate).not.toHaveBeenCalled();
    expect(validateTemplateMessage).not.toHaveBeenCalled();
    expect(forwardToBackend).not.toHaveBeenCalled();
  });

  test("returns 400 on template validation error", async () => {
    const req = createMockReq({ body: "U1#U2#PATCH#TEAMWORK#+5" });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "TEAMWORK", changeValue: "+5" }],
    };

    const templateInfo = {
      type: "rating",
      targetBackend: "rating",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: false,
      errors: ["Невірна категорія: TEAMWORK"],
    });

    await handleGatewayMessage(req, res);

    expect(detectGatewayTemplate).toHaveBeenCalledWith(parsed);
    expect(validateTemplateMessage).toHaveBeenCalledWith(parsed, templateInfo);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 400,
      error: {
        type: "TEMPLATE_VALIDATION_ERROR",
        message: "Запит не пройшов перевірку шаблону",
        details: ["Невірна категорія: TEAMWORK"],
      },
    });

    expect(forwardToBackend).not.toHaveBeenCalled();
  });

  test("forwards request and returns JSON backend response", async () => {
    const req = createMockReq({
      body: "U1#U2#PATCH#LANG_JAVA#+10",
      headers: {
        authorization: "Bearer token123",
        "x-request-id": "req-001",
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

    const templateInfo = {
      type: "rating",
      targetBackend: "rating",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    forwardToBackend.mockResolvedValue({
      statusCode: 200,
      body: { ok: true, result: "updated" },
    });

    await handleGatewayMessage(req, res);

    expect(forwardToBackend).toHaveBeenCalledWith(
      "U1#U2#PATCH#LANG_JAVA#+10",
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

  test("forwards request and returns string backend response via send", async () => {
    const req = createMockReq({
      body: "U1#_#GET#STUDENTS#page=1",
      headers: {
        authorization: "Bearer token123",
        "x-request-id": "req-002",
      },
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

    const templateInfo = {
      type: "general",
      targetBackend: "main",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    forwardToBackend.mockResolvedValue({
      statusCode: 200,
      body: "plain backend response",
    });

    await handleGatewayMessage(req, res);

    expect(forwardToBackend).toHaveBeenCalledWith(
      "U1#_#GET#STUDENTS#page=1",
      {
        parsed,
        templateInfo,
        authorization: "Bearer token123",
        requestId: "req-002",
      }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("plain backend response");
    expect(res.json).not.toHaveBeenCalled();
  });

  test("returns 502 on backend timeout", async () => {
    const req = createMockReq({
      body: "U1#U2#PATCH#TEAMWORK#+5",
      headers: {
        authorization: "Bearer token123",
        "x-request-id": "req-003",
      },
    });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "TEAMWORK", changeValue: "+5" }],
    };

    const templateInfo = {
      type: "rating",
      targetBackend: "rating",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: true,
      errors: [],
    });

    const timeoutError = new Error("timeout");
    timeoutError.name = "AbortError";
    forwardToBackend.mockRejectedValue(timeoutError);

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: "Backend request timed out",
      },
    });
  });

  test("returns 502 on generic backend error", async () => {
    const req = createMockReq({
      body: "U1#U2#PATCH#TEAMWORK#+5",
      headers: {
        authorization: "Bearer token123",
        "x-request-id": "req-004",
      },
    });
    const res = createMockRes();

    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [{ targetField: "TEAMWORK", changeValue: "+5" }],
    };

    const templateInfo = {
      type: "rating",
      targetBackend: "rating",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    forwardToBackend.mockRejectedValue(new Error("connection refused"));

    await handleGatewayMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: "Failed to reach backend: connection refused",
      },
    });
  });

  test("passes undefined headers to forwarder if request headers are absent", async () => {
    const req = createMockReq({
      body: "U1#_#GET#STUDENTS#page=1",
      headers: {},
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

    const templateInfo = {
      type: "general",
      targetBackend: "main",
    };

    parseGatewayMessage.mockReturnValue(parsed);
    validateBaseMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    detectGatewayTemplate.mockReturnValue(templateInfo);
    validateTemplateMessage.mockReturnValue({
      ok: true,
      errors: [],
    });
    forwardToBackend.mockResolvedValue({
      statusCode: 200,
      body: { ok: true },
    });

    await handleGatewayMessage(req, res);

    expect(forwardToBackend).toHaveBeenCalledWith(
      "U1#_#GET#STUDENTS#page=1",
      {
        parsed,
        templateInfo,
        authorization: undefined,
        requestId: undefined,
      }
    );
  });
});