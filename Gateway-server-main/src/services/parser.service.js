/**
 * Сервіс парсингу gateway-повідомлень.
 *
 * Призначення:
 * - приймати сирий текстовий запит внутрішнього протоколу;
 * - перевіряти його базову структурну цілісність;
 * - перетворювати текстове повідомлення у структурований об'єкт,
 *   зручний для подальшої валідації, визначення шаблону та маршрутизації.
 *
 * Підтримувані формати:
 *
 * GET / DELETE:
 * senderCode#targetUserCode#METHOD#targetField#opParams
 *
 * PUT / PATCH:
 * senderCode#targetUserCode#METHOD#targetField#changeValue[#targetField#changeValue...]
 */

/**
 * Розбирає сире текстове повідомлення gateway-протоколу.
 *
 * Логіка роботи:
 * 1. Перевіряє, що запит не порожній.
 * 2. Розбиває рядок за роздільником "#".
 * 3. Виділяє senderCode, targetUserCode, method та решту елементів.
 * 4. Для GET / DELETE формує об'єкт із targetField та opParams.
 * 5. Для PUT / PATCH формує масив змін changes.
 * 6. Якщо метод невідомий, повертає об'єкт у режимі "unknown",
 *    щоб подальшу помилку міг сформувати валідатор.
 *
 * @param {string} raw - Сирий текстовий запит внутрішнього протоколу.
 * @returns {object} Розпарсений об'єкт gateway-запиту.
 * @throws {Error} Якщо запит порожній або має некоректну кількість полів.
 */
function parseGatewayMessage(raw) {
  /**
   * Перевірка 1.
   * Запит повинен бути непорожнім рядком.
   */
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Порожній запит");
  }

  /**
   * Видаляємо пробіли з початку та кінця рядка,
   * після чого розбиваємо повідомлення на частини за символом "#".
   */
  const parts = raw.trim().split("#");

  /**
   * Перевірка 2.
   * Мінімальна кількість частин у коректному запиті — 5.
   */
  if (parts.length < 5) {
    throw new Error("Недостатньо полів у запиті");
  }

  /**
   * Перші три елементи завжди мають однакову структуру:
   * - senderCode
   * - targetUserCode
   * - method
   *
   * Усе, що після них, записується в масив rest.
   */
  const [senderCode, targetUserCode, methodRaw, ...rest] = parts;

  /**
   * Метод нормалізується до верхнього регістру,
   * щоб підтримувати однакове порівняння незалежно від написання.
   */
  const method = methodRaw.trim().toUpperCase();

  /**
   * Обробка GET / DELETE.
   *
   * Для цих методів після METHOD повинно бути рівно 2 поля:
   * - targetField
   * - opParams
   */
  if (method === "GET" || method === "DELETE") {
    if (rest.length !== 2) {
      throw new Error(`Для методу "${method}" очікується 5 полів`);
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

  /**
   * Обробка PATCH / PUT.
   *
   * Для цих методів після METHOD має бути парна кількість елементів,
   * які інтерпретуються як пари:
   * - targetField
   * - changeValue
   *
   * Якщо пар немає або кількість елементів непарна,
   * парсер повертає помилку.
   */
  if (method === "PATCH" || method === "PUT") {
    if (rest.length < 2 || rest.length % 2 !== 0) {
      throw new Error('Для методу "PATCH" або "PUT" після нього мають іти пари');
    }

    /**
     * Формування масиву змін.
     * Кожна пара targetField/changeValue перетворюється
     * на окремий об'єкт у масиві changes.
     */
    const changes = [];

    for (let i = 0; i < rest.length; i += 2) {
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

  /**
   * Якщо метод не належить до підтримуваних,
   * парсер не зупиняє обробку повністю, а повертає об'єкт
   * у режимі "unknown".
   *
   * Це дозволяє передати помилку далі на рівень валідатора,
   * який уже сформує відповідь про недопустиму операцію.
   */
  return {
    senderCode,
    targetUserCode,
    method,
    mode: "unknown",
    rawRest: rest,
  };
}

module.exports = { parseGatewayMessage };