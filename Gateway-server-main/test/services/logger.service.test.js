/**
 * Тести для сервісу логування (logger.service.js)
 */
const fs = require("fs");
const { logEvent } = require("../../src/services/logger.service");

// Мокаємо вбудований модуль файлової системи
jest.mock("fs");

describe("Logger Service", () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Перехоплюємо виклики консолі, щоб вони не смітили у терміналі під час тестів
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    // Очищаємо моки перед кожним тестом
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Відновлюємо оригінальні функції консолі
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("повинен логувати INFO у console.log та записувати у файл", () => {
    const stage = "TEST_STAGE";
    const message = "Тестове повідомлення";
    const details = { key: "value" };

    logEvent("INFO", stage, message, details);

    // 1. Перевіряємо, чи викликався console.log
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Перевіряємо формат виводу (має бути валідний JSON)
    const loggedString = consoleLogSpy.mock.calls[0][0];
    const loggedObj = JSON.parse(loggedString);

    expect(loggedObj.level).toBe("INFO");
    expect(loggedObj.stage).toBe(stage);
    expect(loggedObj.message).toBe(message);
    expect(loggedObj.details).toEqual(details);
    expect(loggedObj.timestamp).toBeDefined();

    // 2. Перевіряємо, чи викликався fs.appendFile
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
    expect(fs.appendFile.mock.calls[0][0]).toMatch(/gateway\.log$/); // Шлях до файлу
    expect(fs.appendFile.mock.calls[0][1]).toContain(loggedString); // Дані для запису
  });

  test("повинен логувати ERROR у console.error та записувати у файл", () => {
    logEvent("ERROR", "CRITICAL_STAGE", "Помилка сервера");

    // 1. Перевіряємо, чи викликався саме console.error
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).not.toHaveBeenCalled();

    const loggedString = consoleErrorSpy.mock.calls[0][0];
    const loggedObj = JSON.parse(loggedString);

    expect(loggedObj.level).toBe("ERROR");
    expect(loggedObj.message).toBe("Помилка сервера");

    // 2. Перевіряємо запис у файл
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
  });
});