const crypto = require("crypto");
const { forwardToBackend } = require("../../src/services/forwarder.service");

describe("forwardToBackend", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = jest.fn();

    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    jest.spyOn(crypto, "randomBytes").mockReturnValue(
      Buffer.from("1234567890abcdef1234567890abcdef", "hex")
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test("throws if BACKEND_RATING_URL is missing for rating template", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";
    delete process.env.BACKEND_RATING_URL;

    await expect(
      forwardToBackend("U1#U2#PATCH#LANG_JAVA#+10", {
        templateInfo: "rating",
      })
    ).rejects.toThrow("BACKEND_RATING_URL is not configured");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("throws if no main backend URL is configured for general template", async () => {
    delete process.env.BACKEND_MAIN_URL;
    delete process.env.BACKEND_URL;
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    await expect(
      forwardToBackend("U1#_#GET#STUDENTS#page=1", {
        templateInfo: "general",
      })
    ).rejects.toThrow("BACKEND_MAIN_URL or BACKEND_URL is not configured");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("throws if GATEWAY_SHARED_SECRET is missing", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    delete process.env.GATEWAY_SHARED_SECRET;

    await expect(
      forwardToBackend("U1#_#GET#STUDENTS#page=1", {
        templateInfo: "general",
      })
    ).rejects.toThrow("GATEWAY_SHARED_SECRET is not configured");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("uses BACKEND_RATING_URL when templateInfo is 'rating'", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.BACKEND_RATING_URL = "http://localhost:8082/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('{"ok":true}'),
    });

    await forwardToBackend("U1#U2#PATCH#TEAMWORK#+5", {
      templateInfo: "rating",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8082/api/execute",
      expect.objectContaining({
        method: "POST",
        body: "U1#U2#PATCH#TEAMWORK#+5",
      })
    );
  });

  test("uses BACKEND_RATING_URL when templateInfo.type is 'rating'", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.BACKEND_RATING_URL = "http://localhost:8082/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#U2#GET#TEAMWORK#", {
      templateInfo: { type: "rating", targetBackend: "rating" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8082/api/execute",
      expect.any(Object)
    );
  });

  test("uses BACKEND_MAIN_URL for non-rating template", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.BACKEND_RATING_URL = "http://localhost:8082/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8081/api/execute",
      expect.any(Object)
    );
  });

  test("falls back to BACKEND_URL if BACKEND_MAIN_URL is absent", async () => {
    delete process.env.BACKEND_MAIN_URL;
    process.env.BACKEND_URL = "http://localhost:8085/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8085/api/execute",
      expect.any(Object)
    );
  });

  test("sends required security headers, authorization and request id", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";
    process.env.GATEWAY_SECRET_HEADER = "X-Internal-Secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('{"ok":true}'),
    });

    const rawMessage = "U1#U2#PATCH#LANG_JAVA#+10";
    const requestId = "req-001";

    await forwardToBackend(rawMessage, {
      templateInfo: "general",
      authorization: "Bearer token-123",
      requestId,
    });

    const fetchCall = global.fetch.mock.calls[0];
    const headers = fetchCall[1].headers;

    const expectedNonce =
      "1234567890abcdef1234567890abcdef";

    const expectedPayload = [
      rawMessage,
      "1700000000000",
      expectedNonce,
      requestId,
    ].join("|");

    const expectedSignature = crypto
      .createHmac("sha256", "test-secret")
      .update(expectedPayload, "utf8")
      .digest("hex");

    expect(headers).toEqual(
      expect.objectContaining({
        "Content-Type": "text/plain; charset=utf-8",
        "X-Gateway-Timestamp": "1700000000000",
        "X-Gateway-Nonce": expectedNonce,
        "X-Gateway-Signature": expectedSignature,
        Authorization: "Bearer token-123",
        "X-Request-Id": "req-001",
        "X-Internal-Secret": "test-secret",
      })
    );

    expect(fetchCall[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: rawMessage,
        signal: expect.any(Object),
      })
    );
  });

  test("uses default secret header name when GATEWAY_SECRET_HEADER is absent", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";
    delete process.env.GATEWAY_SECRET_HEADER;

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    const headers = global.fetch.mock.calls[0][1].headers;

    expect(headers["X-Gateway-Secret"]).toBe("test-secret");
  });

  test("does not send Authorization when it is not provided", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    const headers = global.fetch.mock.calls[0][1].headers;

    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-Request-Id"]).toBeUndefined();
  });

  test("parses JSON response body", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 201,
      text: jest.fn().mockResolvedValue('{"ok":true,"message":"saved"}'),
    });

    const result = await forwardToBackend("U1#U2#PATCH#TEAMWORK#+5", {
      templateInfo: "general",
    });

    expect(result).toEqual({
      statusCode: 201,
      body: {
        ok: true,
        message: "saved",
      },
    });
  });

  test("returns plain text if backend response is not JSON", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("plain backend response"),
    });

    const result = await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    expect(result).toEqual({
      statusCode: 200,
      body: "plain backend response",
    });
  });

  test("returns empty object for empty backend response", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockResolvedValue({
      status: 204,
      text: jest.fn().mockResolvedValue(""),
    });

    const result = await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    expect(result).toEqual({
      statusCode: 204,
      body: {},
    });
  });

  test("uses default timeout value when BACKEND_TIMEOUT_MS is absent", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";
    delete process.env.BACKEND_TIMEOUT_MS;

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("ok"),
    });

    await forwardToBackend("U1#_#GET#STUDENTS#page=1", {
      templateInfo: "general",
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  test("propagates fetch error", async () => {
    process.env.BACKEND_MAIN_URL = "http://localhost:8081/api/execute";
    process.env.GATEWAY_SHARED_SECRET = "test-secret";

    global.fetch.mockRejectedValue(new Error("connection refused"));

    await expect(
      forwardToBackend("U1#_#GET#STUDENTS#page=1", {
        templateInfo: "general",
      })
    ).rejects.toThrow("connection refused");
  });
});