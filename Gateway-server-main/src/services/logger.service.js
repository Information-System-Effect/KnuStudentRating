/**
 * @module LoggerService
 * @description Асинхронний сервіс протоколювання. Забезпечує аудит безпеки 
 * шляхом запису всіх етапів життєвого циклу запиту у файл журналу (gateway.log).
 */

/**
 * Записує структуровану подію у файл та виводить у консоль.
 *
 * @param {string} level - Рівень логування ("INFO", "WARN", "ERROR").
 * @param {string} stage - Етап обробки (наприклад, "RECEIVE", "VALIDATION_FAILED").
 * @param {string} message - Текстовий опис події.
 * @param {Object|null} [details=null] - Додатковий контекст (об'єкт запиту або помилки).
 */
// function logEvent(level, stage, message, details = null) { ... }

/**
 * Сервіс асинхронного журналювання подій шлюзу.
 * Відповідає вимогам курсової роботи щодо збереження логів у файл.
 */
const fs = require("fs");
const path = require("path");

// Шлях до файлу логів у корені проєкту
const LOG_FILE_PATH = path.join(__dirname, "../../gateway.log");

/**
 * Записує структуровану подію у файл журналу та дублює в консоль.
 *
 * @param {string} level - Рівень логування (INFO, WARN, ERROR)
 * @param {string} stage - Етап обробки (RECEIVE, PARSE, VALIDATION тощо)
 * @param {string} message - Текст повідомлення
 * @param {any} details - Додаткові дані (помилки, об'єкти)
 */
function logEvent(level, stage, message, details = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    stage,
    message,
    details
  };

  const logString = JSON.stringify(logEntry);

  // 1. Виведення в консоль (для зручності розробки)
  if (level === "ERROR") {
    console.error(logString);
  } else {
    console.log(logString);
  }

  // 2. Асинхронний запис у файл (як описано в курсовій)
  fs.appendFile(LOG_FILE_PATH, logString + "\n", (err) => {
    if (err) console.error("Помилка запису у файл логів:", err);
  });
}

module.exports = { logEvent };