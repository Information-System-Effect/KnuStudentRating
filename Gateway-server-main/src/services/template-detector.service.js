const { ALLOWED_CATEGORIES } = require("../utils/constants");

function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized);
}

function detectGatewayTemplate(parsed) {
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (
    hasTargetUser &&
    (parsed.method === "GET" || parsed.method === "DELETE") &&
    isAllowedCategory(parsed.targetField)
  ) {
    return "rating";
  }

  if (
    hasTargetUser &&
    (parsed.method === "PUT" || parsed.method === "PATCH") &&
    Array.isArray(parsed.changes) &&
    parsed.changes.length > 0 &&
    parsed.changes.every((change) => isAllowedCategory(change.targetField))
  ) {
    return "rating";
  }

  return "general";
}

module.exports = { detectGatewayTemplate };