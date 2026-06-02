/**
 * Сервіс визначення контекстно-залежного шаблону gateway-запиту.
 *
 * Призначення:
 * - проаналізувати вже розпарсений запит;
 * - класифікувати його за бізнес-типом взаємодії ("rating" або "general");
 * - забезпечити основу для динамічної семантичної валідації (реалізація Розділу 2.1).
 */

const { AVAILABLE_SUBJECTS } = require("../utils/constants");

/**
 * Перевіряє, чи входить передане поле до списку дозволених категорій рейтингу.
 * Використовує глобальний масив доступних предметів (технічних та софт-скілів).
 *
 * @param {string} value - Назва поля (цілі), яку потрібно перевірити.
 * @returns {boolean} true, якщо категорія є рейтинговою.
 */
function isRatingCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return AVAILABLE_SUBJECTS.includes(normalized);
}

/**
 * Визначає логічний шаблон gateway-запиту.
 *
 * Логіка розпізнавання:
 * 1. Якщо запит адресований конкретному користувачу (targetUserCode !== "_").
 * 2. Якщо метод GET або DELETE і поле міститься у списку рейтингових.
 * 3. Якщо метод PUT або PATCH і ВСІ поля у складеному масиві змін (changes) 
 * належать до рейтингових категорій.
 * Якщо умови виконуються — повертається контекст "rating".
 * В іншому випадку — повертається "general" (наприклад, запит на список студентів).
 *
 * @param {object} parsed - Об'єкт запиту після роботи парсера.
 * @returns {string} Тип шаблону: "rating" або "general".
 */
function detectGatewayTemplate(parsed) {
  // Якщо запит системний (не на конкретного користувача), це точно не зміна рейтингу
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (!hasTargetUser) {
    return "general";
  }

  // Визначення шаблону для одинарних запитів (GET / DELETE)
  if (parsed.mode === "single" && (parsed.method === "GET" || parsed.method === "DELETE")) {
    if (isRatingCategory(parsed.targetField)) {
      return "rating";
    }
  }

  // Визначення шаблону для складених запитів (PUT / PATCH)
  if ((parsed.mode === "single" || parsed.mode === "multi") &&
    (parsed.method === "PUT" || parsed.method === "PATCH")) {

    // Перевіряємо, чи існує масив змін і чи всі вони стосуються рейтингу
    if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      const allChangesAreRating = parsed.changes.every((change) =>
        isRatingCategory(change.targetField)
      );

      if (allChangesAreRating) {
        return "rating";
      }
    }
  }

  // Всі інші типи взаємодії підпадають під загальний шаблон
  return "general";
}

module.exports = { detectGatewayTemplate };