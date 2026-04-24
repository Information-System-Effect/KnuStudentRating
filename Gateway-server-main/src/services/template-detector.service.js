/**
 * Сервіс визначення шаблону gateway-запиту.
 *
 * Призначення:
 * - проаналізувати вже розпарсений і базово валідний запит;
 * - визначити, до якого логічного шаблону він належить;
 * - підготувати основу для подальшої шаблонної валідації
 *   та маршрутизації на відповідний backend.
 *
 * Поточні підтримувані шаблони:
 * - "rating"  — запити, пов’язані з рейтинговими категоріями;
 * - "general" — усі інші запити.
 */

const { ALLOWED_CATEGORIES } = require("../utils/constants");

/**
 * Перевіряє, чи входить передане значення до списку дозволених категорій рейтингу.
 *
 * Перед порівнянням значення:
 * - очищується від пробілів на початку та в кінці;
 * - перетворюється до верхнього регістру.
 *
 * @param {string} value - Назва категорії, яку потрібно перевірити.
 * @returns {boolean} true, якщо категорія входить до списку ALLOWED_CATEGORIES.
 */
function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized);
}

/**
 * Визначає логічний шаблон gateway-запиту.
 *
 * Логіка:
 * - якщо запит адресований конкретному користувачу (`targetUserCode !== "_"`)
 *   і для GET / DELETE містить допустиму рейтингову категорію,
 *   то шаблон визначається як "rating";
 * - якщо запит адресований конкретному користувачу
 *   і для PUT / PATCH усі зміни належать до рейтингових категорій,
 *   то шаблон також визначається як "rating";
 * - в усіх інших випадках повертається "general".
 *
 * Таким чином, цей сервіс не перевіряє загальну коректність структури запиту,
 * а лише класифікує вже базово валідний запит за бізнес-типом.
 *
 * @param {object} parsed - Розпарсений gateway-запит.
 * @returns {string} Тип шаблону: "rating" або "general".
 */
function detectGatewayTemplate(parsed) {
  /**
   * Ознака того, що запит спрямований на конкретного користувача,
   * а не є загальним системним запитом.
   */
  const hasTargetUser = parsed.targetUserCode !== "_";

  /**
   * Визначення рейтингового шаблону для GET / DELETE.
   *
   * Умови:
   * - є targetUser;
   * - метод GET або DELETE;
   * - targetField є дозволеною рейтинговою категорією.
   */
  if (
    hasTargetUser &&
    (parsed.method === "GET" || parsed.method === "DELETE") &&
    isAllowedCategory(parsed.targetField)
  ) {
    return "rating";
  }

  /**
   * Визначення рейтингового шаблону для PUT / PATCH.
   *
   * Умови:
   * - є targetUser;
   * - метод PUT або PATCH;
   * - changes є непорожнім масивом;
   * - усі targetField у changes належать до дозволених рейтингових категорій.
   */
  if (
    hasTargetUser &&
    (parsed.method === "PUT" || parsed.method === "PATCH") &&
    Array.isArray(parsed.changes) &&
    parsed.changes.length > 0 &&
    parsed.changes.every((change) => isAllowedCategory(change.targetField))
  ) {
    return "rating";
  }

  /**
   * Усі інші запити відносяться до загального шаблону.
   */
  return "general";
}

module.exports = { detectGatewayTemplate };