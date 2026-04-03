const { ALLOWED_CATEGORIES } = require("../utils/constants");

function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized);
}

function validateRatingTemplate(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (!hasTargetUser) {
    errors.push("Рейтинговий шаблон вимагає targetUserCode");
  }

  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isAllowedCategory(parsed.targetField)) {
      errors.push(`Невірна категорія: ${parsed.targetField}`);
    }
  }

  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isAllowedCategory(change.targetField)) {
        errors.push(`Невірна категорія: ${change.targetField}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateGeneralTemplate() {
  return {
    ok: true,
    errors: [],
  };
}

function validateTemplateMessage(parsed, templateType) {
  if (templateType === "rating") {
    return validateRatingTemplate(parsed);
  }

  return validateGeneralTemplate(parsed);
}

module.exports = { validateTemplateMessage };