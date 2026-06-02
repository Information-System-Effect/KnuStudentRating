const { proxyToBackend } = require("../../src/services/proxy.service");

describe("Proxy Service", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  // Мок для об'єкта запиту Express
  const createMockReq = (method, originalUrl, headers = {}, body = null) => ({
    method,
    originalUrl,
    headers,
    body,
    protocol: "http",
    get: jest.fn((header) => {
      if (header === "host") return "localhost:3000";
      return null;
    }),
  });

  test("успішно проксіює GET запит і відфільтровує заборонені заголовки", async () => {
    process.env.BACKEND_BASE_URL = "http://backend-server:8080";

    global.fetch.mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const req = createMockReq("GET", "/assets/style.css", {
      "host": "localhost:3000",
      "connection": "keep-alive",
      "accept": "text/css",
      "user-agent": "test-agent"
    });

    const result = await proxyToBackend(req);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = global.fetch.mock.calls[0];

    // 1. Перевіряємо URL
    expect(calledUrl.toString()).toBe("http://backend-server:8080/assets/style.css");

    // 2. Перевіряємо метод та відсутність body для GET
    expect(options.method).toBe("GET");
    expect(options.body).toBeUndefined();

    // 3. Перевіряємо фільтрацію заголовків
    expect(options.headers["accept"]).toBe("text/css");
    expect(options.headers["user-agent"]).toBe("test-agent");
    expect(options.headers["host"]).toBeUndefined(); // Має бути відфільтровано
    expect(options.headers["connection"]).toBeUndefined(); // Має бути відфільтровано

    // 4. Перевіряємо структуру результату
    expect(result.statusCode).toBe(200);
    expect(Buffer.isBuffer(result.body)).toBe(true);
  });

  test("додає X-Gateway-Secret для маршрутів, що починаються з /api/", async () => {
    process.env.BACKEND_BASE_URL = "http://backend-server:8080";
    process.env.GATEWAY_SHARED_SECRET = "super_secret_proxy_key";

    global.fetch.mockResolvedValue({
      status: 201,
      headers: new Headers(),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    });

    const req = createMockReq("POST", "/api/users/create", { "content-type": "application/json" }, '{"name":"Test"}');

    await proxyToBackend(req);

    const [calledUrl, options] = global.fetch.mock.calls[0];

    expect(calledUrl.toString()).toBe("http://backend-server:8080/api/users/create");
    expect(options.method).toBe("POST");
    expect(options.body).toBe('{"name":"Test"}');
    expect(options.headers["X-Gateway-Secret"]).toBe("super_secret_proxy_key");
  });
});