/**
 * Сервіс шаблонної валідації gateway-запитів.
 *
 * Призначення:
 * - виконувати перевірку бізнес-правил після базової валідації структури;
 * - перевіряти, чи відповідає запит правилам конкретного шаблону;
 * - відокремлювати загальну валідацію протоколу від логіки окремих типів запитів.
 *
 * Поточні шаблони:
 * - rating  — запити, пов’язані з рейтинговими категоріями;
 * - general — загальні запити без додаткових спеціальних обмежень.
 */

const { ALLOWED_CATEGORIES } = require("../utils/constants");

/**
 * Перевіряє, чи входить значення до списку дозволених рейтингових категорій.
 *
 * Перед порівнянням значення:
 * - очищується від пробілів з початку і кінця;
 * - переводиться у верхній регістр.
 *
 * @param {string} value - Назва категорії.
 * @returns {boolean} true, якщо категорія входить до ALLOWED_CATEGORIES.
 */
function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized);
}

/**
 * Виконує валідацію рейтингового шаблону.
 *
 * Основні правила:
 * - рейтинговий шаблон обов’язково повинен містити targetUserCode;
 * - для GET / DELETE targetField має бути дозволеною рейтинговою категорією;
 * - для PUT / PATCH усі targetField у changes мають бути дозволеними категоріями.
 *
 * @param {object} parsed - Розпарсений gateway-запит.
 * @returns {{ok: boolean, errors: string[]}} Результат шаблонної перевірки.
 */
function validateRatingTemplate(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  /**
   * Перевірка 1.
   * Рейтинговий шаблон повинен бути адресований конкретному користувачу.
   */
  if (!hasTargetUser) {
    errors.push("Рейтинговий шаблон вимагає targetUserCode");
  }

  /**
   * Перевірка 2.
   * Для GET / DELETE цільове поле повинно бути коректною рейтинговою категорією.
   */
  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isAllowedCategory(parsed.targetField)) {
      errors.push(`Невірна категорія: ${parsed.targetField}`);
    }
  }

  /**
   * Перевірка 3.
   * Для PUT / PATCH кожне поле в масиві changes
   * повинно належати до дозволених рейтингових категорій.
   */
  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isAllowedCategory(change.targetField)) {
        errors.push(`Невірна категорія: ${change.targetField}`);
      }
    }
  }

  /**
   * Повертається результат:
   * - ok = true, якщо порушень не знайдено;
   * - ok = false, якщо знайдено хоча б одну помилку.
   */
  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Виконує валідацію загального шаблону.
 *
 * Для шаблону "general" додаткових бізнес-обмежень
 * на поточному етапі не встановлено, тому перевірка
 * завжди вважається успішною.
 *
 * @returns {{ok: boolean, errors: string[]}} Результат шаблонної перевірки.
 */
function validateGeneralTemplate() {
  return {
    ok: true,
    errors: [],
  };
}

/**
 * Виконує шаблонну валідацію запиту залежно від типу шаблону.
 *
 * Логіка:
 * - якщо шаблон є "rating", застосовується validateRatingTemplate;
 * - для всіх інших шаблонів використовується validateGeneralTemplate.
 *
 * Таким чином ця функція є диспетчером шаблонних валідаторів.
 *
 * @param {object} parsed - Розпарсений gateway-запит.
 * @param {string} templateType - Тип шаблону, визначений детектором.
 * @returns {{ok: boolean, errors: string[]}} Результат шаблонної валідації.
 */
function validateTemplateMessage(parsed, templateType) {
  if (templateType === "rating") {
    return validateRatingTemplate(parsed);
  }

  return validateGeneralTemplate(parsed);
}

module.exports = { validateTemplateMessage };