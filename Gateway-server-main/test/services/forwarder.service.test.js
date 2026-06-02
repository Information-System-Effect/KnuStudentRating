const { forwardToBackend } = require("../../src/services/forwarder.service");

describe("Forwarder Service", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Очищаємо кеш модулів
    process.env = { ...OLD_ENV }; // Робимо копію ENV
    global.fetch = jest.fn(); // Мокаємо глобальний fetch
  });

  afterAll(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  test("викидає помилку, якщо не налаштовано BACKEND_RATING_URL для рейтингового шаблону", async () => {
    process.env.BACKEND_RATING_URL = "";

    await expect(
      forwardToBackend("test", { templateInfo: "rating" })
    ).rejects.toThrow("BACKEND_RATING_URL is not configured");
  });

  test("викидає помилку, якщо не налаштовано BACKEND_MAIN_URL для загального шаблону", async () => {
    process.env.BACKEND_MAIN_URL = "";
    process.env.BACKEND_URL = "";

    await expect(
      forwardToBackend("test", { templateInfo: "general" })
    ).rejects.toThrow("BACKEND_MAIN_URL is not configured");
  });

  test("успішно підписує та відправляє запит на RATING backend", async () => {
    process.env.BACKEND_RATING_URL = "http://rating-service/api";
    process.env.GATEWAY_SECRET_KEY = "test_secret"; // Налаштування секрету для констант

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ ok: true, data: "success" })),
    });

    const rawMessage = "U1#U2#GET#LANG_JAVA#";

    const result = await forwardToBackend(rawMessage, {
      templateInfo: "rating",
      requestId: "req-123",
      authorization: "Bearer token",
    });

    // Перевіряємо, що fetch був викликаний 1 раз
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Перевіряємо URL та базові параметри fetch
    const [calledUrl, options] = global.fetch.mock.calls[0];
    expect(calledUrl).toBe("http://rating-service/api");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(rawMessage);

    // Перевіряємо наявність службових заголовків безпеки
    expect(options.headers["X-Gateway-Timestamp"]).toBeDefined();
    expect(options.headers["X-Gateway-Nonce"]).toBeDefined();
    expect(options.headers["X-Gateway-Signature"]).toBeDefined();
    expect(options.headers["X-Request-Id"]).toBe("req-123");
    expect(options.headers["Authorization"]).toBe("Bearer token");

    // Перевіряємо, чи правильно розпарсилась відповідь
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ ok: true, data: "success" });
  });

  test("повертає сирий текст, якщо backend відповів не JSON форматом", async () => {
    process.env.BACKEND_MAIN_URL = "http://main-service/api";

    global.fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("Plain text response from backend"),
    });

    const result = await forwardToBackend("U1#_#GET#USERS#", {
      templateInfo: "general"
    });

    expect(result.body).toBe("Plain text response from backend");
  });
});