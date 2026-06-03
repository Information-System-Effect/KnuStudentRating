/**
 * @module BaseValidatorService
 * @description Сервіс первинної валідації. Перевіряє формат кодів користувачів, 
 * допустимість HTTP-методів та загальну структуру даних без прив'язки до бізнес-правил.
 */

/**
 * Виконує базову перевірку розпарсеного об'єкта.
 *
 * @param {Object} parsed - Об'єкт запиту після парсингу.
 * @returns {{ok: boolean, errors: string[]}} Результат валідації та масив помилок (якщо є).
 */
// function validateBaseMessage(parsed) { ... }

/**
 * Сервіс базової валідації gateway-повідомлення.
 *
 * Призначення:
 * - перевіряти загальну структуру внутрішнього текстового протоколу;
 * - відокремлювати базову перевірку формату від шаблонної бізнес-валідації;
 * - повертати список знайдених помилок формату без виконання маршрутизації чи перевірки прав доступу.
 */

const { ALLOWED_OPERATIONS } = require("../utils/constants");

/**
 * Перевіряє коректність коду користувача (відправника або цілі).
 *
 * @param {string} value - Значення senderCode або targetUserCode.
 * @returns {boolean} true, якщо код відповідає допустимому формату.
 */
function isValidUserCode(value) {
  return /^[A-Za-z0-9_-]+$/.test((value || "").trim());
}

/**
 * Перевіряє коректність імені цільового поля.
 *
 * @param {string} value - Назва targetField.
 * @returns {boolean} true, якщо поле має допустимий формат.
 */
function isValidTargetField(value) {
  return /^[A-Z0-9_]+$/i.test((value || "").trim());
}

/**
 * Перевіряє базовий формат значення зміни для PUT/PATCH.
 * Це лише базова перевірка протоколу (числа від -20 до 20).
 * Жорсткі рольові ліміти перевірятимуться в access-control.service.
 *
 * @param {string} value - Значення changeValue.
 * @returns {boolean} true, якщо значення зміни є коректним числом.
 */
function isValidChangeValue(value) {
  const trimmed = (value || "").trim();

  if (!/^[+-]?\d+$/.test(trimmed)) {
    return false;
  }

  const num = Number(trimmed);
  return num >= -20 && num <= 20;
}

/**
 * Перевіряє формат параметрів запиту для GET/DELETE.
 *
 * @param {string} value - Рядок параметрів opParams.
 * @returns {boolean} true, якщо формат параметрів коректний.
 */
function isValidQueryParams(value) {
  const trimmed = (value || "").trim();
  if (trimmed === "") return true;
  return /^([a-zA-Z0-9_]+=[^;#]*)(;[a-zA-Z0-9_]+=[^;#]*)*$/.test(trimmed);
}

/**
 * Виконує базову валідацію розпарсеного gateway-повідомлення.
 *
 * @param {object} parsed - Розпарсений об'єкт gateway-запиту.
 * @returns {{ok: boolean, errors: string[]}} Результат базової валідації.
 */
function validateBaseMessage(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (!isValidUserCode(parsed.senderCode)) {
    errors.push("Невірний формат senderCode");
  }

  if (hasTargetUser && !isValidUserCode(parsed.targetUserCode)) {
    errors.push("Невірний формат targetUserCode");
  }

  if (!ALLOWED_OPERATIONS.includes(parsed.method)) {
    errors.push(`Невідомий або недопустимий метод: ${parsed.method}`);
  }

  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isValidTargetField(parsed.targetField)) {
      errors.push(`Невірний формат TARGET_FIELD: ${parsed.targetField}`);
    }
    if (!isValidQueryParams(parsed.opParams)) {
      errors.push("Невірний формат параметрів запиту (очікується key=value)");
    }
  }

  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isValidTargetField(change.targetField)) {
        errors.push(`Невірний формат TARGET_FIELD: ${change.targetField}`);
      }
      if (!isValidChangeValue(change.changeValue)) {
        errors.push(`Невірний формат зміни (очікується число в межах базового протоколу): ${change.changeValue}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateBaseMessage };