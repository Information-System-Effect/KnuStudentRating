/**
 * Сервіс базової валідації gateway-повідомлення.
 *
 * Призначення:
 * - перевіряти загальну структуру внутрішнього текстового протоколу;
 * - відокремлювати базову перевірку формату від шаблонної бізнес-валідації;
 * - повертати список знайдених помилок без виконання маршрутизації чи перевірки прав доступу.
 *
 * Цей валідатор перевіряє лише спільні правила протоколу:
 * - senderCode
 * - targetUserCode
 * - method
 * - targetField
 * - opParams
 * - changeValue
 */

const { ALLOWED_OPERATIONS } = require("../utils/constants");

/**
 * Перевіряє коректність коду користувача.
 *
 * Дозволяються:
 * - латинські літери
 * - цифри
 * - символи "_" і "-"
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
 * Дозволяються:
 * - великі та малі латинські літери
 * - цифри
 * - символ "_"
 *
 * @param {string} value - Назва targetField.
 * @returns {boolean} true, якщо поле має допустимий формат.
 */
function isValidTargetField(value) {
  return /^[A-Z0-9_]+$/i.test((value || "").trim());
}

/**
 * Перевіряє коректність значення зміни для PUT/PATCH.
 *
 * Вимоги:
 * - лише ціле число зі знаком або без;
 * - значення має бути в межах від -20 до 20.
 *
 * @param {string} value - Значення changeValue.
 * @returns {boolean} true, якщо значення зміни коректне.
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
 * Підтримуваний формат:
 * key=value;key=value
 *
 * Порожній рядок також вважається допустимим.
 *
 * @param {string} value - Рядок параметрів opParams.
 * @returns {boolean} true, якщо формат параметрів коректний.
 */
function isValidQueryParams(value) {
  const trimmed = (value || "").trim();

  if (trimmed === "") {
    return true;
  }

  return /^([a-zA-Z0-9_]+=[^;#]*)(;[a-zA-Z0-9_]+=[^;#]*)*$/.test(trimmed);
}

/**
 * Виконує базову валідацію розпарсеного gateway-повідомлення.
 *
 * На цьому рівні перевіряються лише загальні правила структури протоколу,
 * незалежно від конкретного шаблону запиту.
 *
 * Перевіряються:
 * - senderCode
 * - targetUserCode (якщо він не дорівнює "_")
 * - method
 * - для GET/DELETE:
 *   - targetField
 *   - opParams
 * - для PUT/PATCH:
 *   - targetField у кожній зміні
 *   - changeValue у кожній зміні
 *
 * @param {object} parsed - Розпарсений об'єкт gateway-запиту.
 * @returns {{ok: boolean, errors: string[]}} Результат базової валідації.
 */
function validateBaseMessage(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  /**
   * Перевірка senderCode.
   */
  if (!isValidUserCode(parsed.senderCode)) {
    errors.push("Невірний senderCode");
  }

  /**
   * Перевірка targetUserCode виконується лише тоді,
   * коли запит справді містить цільового користувача.
   */
  if (hasTargetUser && !isValidUserCode(parsed.targetUserCode)) {
    errors.push("Невірний targetUserCode");
  }

  /**
   * Перевірка допустимості методу запиту.
   */
  if (!ALLOWED_OPERATIONS.includes(parsed.method)) {
    errors.push("Невірна операція");
  }

  /**
   * Перевірка структури GET / DELETE запитів.
   *
   * Для цих методів перевіряються:
   * - targetField
   * - opParams
   */
  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isValidTargetField(parsed.targetField)) {
      errors.push("Невірний TARGET_FIELD");
    }

    if (!isValidQueryParams(parsed.opParams)) {
      errors.push("Невірний формат параметрів запиту");
    }
  }

  /**
   * Перевірка структури PUT / PATCH запитів.
   *
   * Для кожної зміни перевіряються:
   * - targetField
   * - changeValue
   */
  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isValidTargetField(change.targetField)) {
        errors.push(`Невірний TARGET_FIELD: ${change.targetField}`);
      }

      if (!isValidChangeValue(change.changeValue)) {
        errors.push(`Невірний формат зміни: ${change.changeValue}`);
      }
    }
  }

  /**
   * Повертається результат валідації:
   * - ok = true, якщо помилок не знайдено;
   * - ok = false, якщо знайдено хоча б одну помилку.
   */
  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateBaseMessage };