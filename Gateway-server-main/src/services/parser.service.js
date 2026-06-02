/**
 * Сервіс парсингу gateway-повідомлень.
 *
 * Призначення:
 * - приймати сирий текстовий запит внутрішнього протоколу;
 * - перевіряти його базову структурну цілісність (наявність обов'язкових полів, парність параметрів);
 * - перетворювати текстове повідомлення у структурований DTO-об'єкт,
 * зручний для подальшої валідації, визначення шаблону та маршрутизації.
 *
 * Підтримувані шаблони (формати):
 *
 * Одинарний запит (GET / DELETE):
 * SENDER_CODE#TARGET_USER_CODE#METHOD#TARGET_FIELD#PARAMS
 *
 * Складений запит на масове оновлення (PUT / PATCH):
 * SENDER_CODE#TARGET_USER_CODE#METHOD#TARGET_FIELD#PARAMS[#TARGET_FIELD#PARAMS...]
 */

/**
 * Розбирає сире текстове повідомлення gateway-протоколу.
 *
 * @param {string} raw - Сирий текстовий запит (наприклад, "U1#U2#PUT#LANG_JAVA#+5")
 * @returns {object} Розпарсений об'єкт gateway-запиту.
 * @throws {Error} Якщо запит порожній або має порушену структуру (помилка формату 400).
 */
function parseGatewayMessage(raw) {
  // 1. Перевірка наявності запиту
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Порожній запит. Неможливо виконати парсинг.");
  }

  // 2. Розбиття повідомлення на блоки за розділювачем "#"
  const parts = raw.trim().split("#").map(part => part.trim());

  // 3. Перевірка базової мінімальної довжини (мінімум 5 полів за протоколом)
  if (parts.length < 5) {
    throw new Error("Недостатньо полів у запиті. Очікується мінімум 5 елементів.");
  }

  // 4. Виділення базової мета-інформації
  const [senderCode, targetUserCode, methodRaw, ...rest] = parts;

  if (!senderCode || !targetUserCode || !methodRaw) {
    throw new Error("Некоректна базова структура. Відсутній відправник, ціль або метод.");
  }

  const method = methodRaw.toUpperCase();

  // 5. Обробка методів читання/видалення (очікується рівно одна ціль та параметри)
  if (method === "GET" || method === "DELETE") {
    if (rest.length !== 2) {
      throw new Error(`Для методу "${method}" очікується рівно 5 полів (зайві або пропущені елементи).`);
    }

    const [targetField, opParams] = rest;

    return {
      senderCode,
      targetUserCode,
      method,
      mode: "single",
      targetField,
      opParams,
    };
  }

  // 6. Обробка методів оновлення (підтримка складених запитів)
  if (method === "PATCH" || method === "PUT") {
    // Перевірка парності (кожному TARGET_FIELD має відповідати свій PARAM)
    if (rest.length < 2 || rest.length % 2 !== 0) {
      throw new Error("Порушено парність параметрів для масового оновлення. Відсутнє значення для одного з полів.");
    }

    const changes = [];

    // Транзакційне формування масиву змін
    for (let i = 0; i < rest.length; i += 2) {
      if (!rest[i] || !rest[i + 1]) {
        throw new Error(`Порожнє поле або значення у парі на позиції ${i + 1}`);
      }
      changes.push({
        targetField: rest[i],
        changeValue: rest[i + 1],
      });
    }

    return {
      senderCode,
      targetUserCode,
      method,
      mode: changes.length === 1 ? "single" : "multi",
      changes,
    };
  }

  // 7. Якщо метод невідомий (наприклад, FETCH або POST, який ми не підтримуємо)
  // Повертаємо як "unknown", щоб семантичний валідатор заблокував його з правильною 400/403 помилкою.
  return {
    senderCode,
    targetUserCode,
    method,
    mode: "unknown",
    rawRest: rest,
  };
}

module.exports = { parseGatewayMessage };