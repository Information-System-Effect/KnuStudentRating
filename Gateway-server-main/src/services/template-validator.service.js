/**
 * @module TemplateValidatorService
 * @description Сервіс шаблонної валідації. Застосовує специфічні правила перевірки
 * залежно від визначеного шаблону (наприклад, перевірка існування рейтингової категорії).
 */

/**
 * Сервіс шаблонної валідації gateway-запитів.
 *
 * Призначення:
 * - виконувати перевірку бізнес-правил після базової валідації структури;
 * - перевіряти, чи відповідає запит правилам конкретного шаблону;
 * - відокремлювати загальну валідацію протоколу від логіки окремих типів запитів.
 */

const { AVAILABLE_SUBJECTS } = require("../utils/constants");

/**
 * Перевіряє, чи входить значення до об'єднаного списку дозволених рейтингових категорій.
 *
 * @param {string} value - Назва категорії.
 * @returns {boolean} true, якщо категорія існує.
 */
function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return AVAILABLE_SUBJECTS.includes(normalized);
}

/**
 * Виконує валідацію рейтингового шаблону.
 *
 * @param {object} parsed - Розпарсений gateway-запит.
 * @returns {{ok: boolean, errors: string[]}} Результат шаблонної перевірки.
 */
function validateRatingTemplate(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (!hasTargetUser) {
    errors.push("Рейтинговий шаблон вимагає конкретний targetUserCode");
  }

  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isAllowedCategory(parsed.targetField)) {
      errors.push(`Невідома або недопустима рейтингова категорія: ${parsed.targetField}`);
    }
  }

  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isAllowedCategory(change.targetField)) {
        errors.push(`Невідома або недопустима рейтингова категорія: ${change.targetField}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Виконує валідацію загального шаблону.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateGeneralTemplate() {
  return {
    ok: true,
    errors: [],
  };
}

/**
 * Диспетчер шаблонних валідаторів.
 *
 * @param {object} parsed - Розпарсений gateway-запит.
 * @param {string} templateType - Тип шаблону, визначений детектором.
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateTemplateMessage(parsed, templateType) {
  if (templateType === "rating") {
    return validateRatingTemplate(parsed);
  }
  return validateGeneralTemplate(parsed);
}

module.exports = { validateTemplateMessage };