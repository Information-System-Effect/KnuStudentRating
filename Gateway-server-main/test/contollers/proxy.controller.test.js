jest.mock("../../src/services/proxy.service", () => ({
  proxyToBackend: jest.fn(),
}));

const {
  handleProxyRequest,
  shouldProxy,
} = require("../../src/controllers/proxy.controller");
const { proxyToBackend } = require("../../src/services/proxy.service");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
}

function createMockReq({ path = "/", ...rest } = {}) {
  return {
    path,
    ...rest,
  };
}

describe("shouldProxy", () => {
  test("returns true for exact proxy paths", () => {
    expect(shouldProxy("/")).toBe(true);
    expect(shouldProxy("/swagger-ui.html")).toBe(true);
    expect(shouldProxy("/favicon.ico")).toBe(true);
  });

  test("returns true for allowed prefixes", () => {
    expect(shouldProxy("/api")).toBe(true);
    expect(shouldProxy("/api/users")).toBe(true);
    expect(shouldProxy("/site")).toBe(true);
    expect(shouldProxy("/site/home")).toBe(true);
    expect(shouldProxy("/css/main.css")).toBe(true);
    expect(shouldProxy("/js/app.js")).toBe(true);
    expect(shouldProxy("/images/logo.png")).toBe(true);
    expect(shouldProxy("/uploads/file.pdf")).toBe(true);
    expect(shouldProxy("/swagger-ui/index.html")).toBe(true);
    expect(shouldProxy("/v3/api-docs")).toBe(true);
    expect(shouldProxy("/v3/api-docs/openapi.json")).toBe(true);
  });

  test("returns false for unsupported paths", () => {
    expect(shouldProxy("/admin")).toBe(false);
    expect(shouldProxy("/health")).toBe(false);
    expect(shouldProxy("/random/path")).toBe(false);
  });
});

describe("handleProxyRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 404 if route is not handled by gateway", async () => {
    const req = createMockReq({ path: "/admin" });
    const res = createMockRes();

    await handleProxyRequest(req, res);

    expect(proxyToBackend).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 404,
      error: {
        type: "NOT_FOUND",
        message: "Route is not handled by gateway",
      },
    });
  });

  test("calls proxyToBackend for proxied route", async () => {
    const req = createMockReq({ path: "/api/users" });
    const res = createMockRes();

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers: new Map(),
      body: Buffer.from("ok"),
      setCookies: [],
    });

    await handleProxyRequest(req, res);

    expect(proxyToBackend).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from("ok"));
  });

  test("forwards response headers except ignored ones", async () => {
    const req = createMockReq({ path: "/api/users" });
    const res = createMockRes();

    const headers = new Map([
      ["content-type", "application/json"],
      ["x-request-id", "req-123"],
      ["transfer-encoding", "chunked"],
      ["content-length", "100"],
      ["set-cookie", "ignored-here"],
    ]);

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers,
      body: Buffer.from('{"ok":true}'),
      setCookies: [],
    });

    await handleProxyRequest(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "content-type",
      "application/json"
    );
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "req-123");

    expect(res.setHeader).not.toHaveBeenCalledWith(
      "transfer-encoding",
      "chunked"
    );
    expect(res.setHeader).not.toHaveBeenCalledWith("content-length", "100");
    expect(res.setHeader).not.toHaveBeenCalledWith(
      "set-cookie",
      "ignored-here"
    );
  });

  test("sets Set-Cookie separately when backend returns cookies", async () => {
    const req = createMockReq({ path: "/api/auth/login" });
    const res = createMockRes();

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers: new Map([["content-type", "application/json"]]),
      body: Buffer.from('{"ok":true}'),
      setCookies: [
        "session=abc; Path=/; HttpOnly",
        "theme=dark; Path=/",
      ],
    });

    await handleProxyRequest(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      ["session=abc; Path=/; HttpOnly", "theme=dark; Path=/"]
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('{"ok":true}'));
  });

  test("does not set Set-Cookie when backend returned empty cookie array", async () => {
    const req = createMockReq({ path: "/api/auth/me" });
    const res = createMockRes();

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers: new Map([["content-type", "application/json"]]),
      body: Buffer.from('{"user":"U1"}'),
      setCookies: [],
    });

    await handleProxyRequest(req, res);

    expect(res.setHeader).not.toHaveBeenCalledWith(
      "Set-Cookie",
      expect.anything()
    );
  });

  test("uses '/' when req.path is missing", async () => {
    const req = {};
    const res = createMockRes();

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers: new Map(),
      body: Buffer.from("root"),
      setCookies: [],
    });

    await handleProxyRequest(req, res);

    expect(proxyToBackend).toHaveBeenCalledWith(req);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from("root"));
  });

  test("returns backend body as-is", async () => {
    const req = createMockReq({ path: "/site/home" });
    const res = createMockRes();

    const body = Buffer.from("<html>hello</html>");

    proxyToBackend.mockResolvedValue({
      statusCode: 200,
      headers: new Map([["content-type", "text/html"]]),
      body,
      setCookies: [],
    });

    await handleProxyRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(body);
  });

  test("returns 502 if proxyToBackend throws error", async () => {
    const req = createMockReq({ path: "/api/users" });
    const res = createMockRes();

    proxyToBackend.mockRejectedValue(new Error("connection refused"));

    await handleProxyRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: "Proxy error: connection refused",
      },
    });
  });
});