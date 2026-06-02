jest.mock("../../src/services/proxy.service", () => ({
  proxyToBackend: jest.fn(),
}));

const { handleProxyRequest, shouldProxy } = require("../../src/controllers/proxy.controller");
const { proxyToBackend } = require("../../src/services/proxy.service");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
}

describe("Proxy Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("shouldProxy helper", () => {
    test("повертає true для точних маршрутів", () => {
      expect(shouldProxy("/")).toBe(true);
      expect(shouldProxy("/swagger-ui.html")).toBe(true);
    });

    test("повертає true для дозволених префіксів", () => {
      expect(shouldProxy("/api")).toBe(true);
      expect(shouldProxy("/api/users/1")).toBe(true);
      expect(shouldProxy("/assets/logo.png")).toBe(true);
    });

    test("повертає false для невідомих маршрутів", () => {
      expect(shouldProxy("/unknown-route")).toBe(false);
      expect(shouldProxy("/admin-panel")).toBe(false);
    });
  });

  describe("handleProxyRequest", () => {
    test("повертає 404, якщо маршрут не підтримується шлюзом", async () => {
      const req = { path: "/unsupported" };
      const res = createMockRes();

      await handleProxyRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        code: 404,
        error: {
          type: "NOT_FOUND",
          message: "Route is not handled by gateway",
        },
      });
      expect(proxyToBackend).not.toHaveBeenCalled();
    });

    test("успішно проксіює і передає заголовки, тіло та cookies", async () => {
      const req = { path: "/api/data" };
      const res = createMockRes();

      const mockHeaders = new Headers();
      mockHeaders.append("content-type", "application/json");
      mockHeaders.append("x-custom-header", "123");
      mockHeaders.append("content-length", "100"); // Має бути відфільтровано

      proxyToBackend.mockResolvedValue({
        statusCode: 200,
        headers: mockHeaders,
        body: Buffer.from('{"data":"ok"}'),
        setCookies: ["session_id=12345; HttpOnly"],
      });

      await handleProxyRequest(req, res);

      expect(proxyToBackend).toHaveBeenCalledWith(req);

      // Перевіряємо встановлення дозволених заголовків
      expect(res.setHeader).toHaveBeenCalledWith("content-type", "application/json");
      expect(res.setHeader).toHaveBeenCalledWith("x-custom-header", "123");

      // content-length ігнорується згідно з IGNORED_RESPONSE_HEADERS
      expect(res.setHeader).not.toHaveBeenCalledWith("content-length", "100");

      // Перевіряємо встановлення cookies
      expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["session_id=12345; HttpOnly"]);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(Buffer.from('{"data":"ok"}'));
    });

    test("повертає 502, якщо proxyToBackend викидає помилку", async () => {
      const req = { path: "/api/data" };
      const res = createMockRes();

      proxyToBackend.mockRejectedValue(new Error("ECONNREFUSED"));

      await handleProxyRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        code: 502,
        error: {
          type: "BACKEND_UNAVAILABLE",
          message: "Proxy error: ECONNREFUSED",
        },
      });
    });
  });
});