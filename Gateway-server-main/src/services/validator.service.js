const { ALLOWED_OPERATIONS, ALLOWED_CATEGORIES } = require("../utils/constants");

function isValidUserCode(value) {
  return /^[A-Za-z0-9_-]+$/.test((value || "").trim());
}

function isValidTargetField(value) {
  return /^[A-Z0-9_]+$/i.test((value || "").trim());
}

function isValidChangeValue(value) {
  const trimmed = (value || "").trim();

  // лише цілі числа зі знаком або без
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return false;
  }

  const num = Number(trimmed);

  // обмеження за старою логікою
  return num >= -20 && num <= 20;
}

function isValidQueryParams(value) {
  const trimmed = (value || "").trim();

  // допускаємо порожній рядок
  if (trimmed === "") {
    return true;
  }

  // формат: key=value;key=value
  return /^([a-zA-Z0-9_]+=[^;#]*)(;[a-zA-Z0-9_]+=[^;#]*)*$/.test(trimmed);
}

function isAllowedCategory(value) {
  const normalized = (value || "").trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized);
}

function validateParsedMessage(parsed) {
  const errors = [];
  const hasTargetUser = parsed.targetUserCode !== "_";

  if (!isValidUserCode(parsed.senderCode)) {
    errors.push("Невірний senderCode");
  }

  if (
    hasTargetUser !== "_" &&
    !isValidUserCode(parsed.targetUserCode)
  ) {
    errors.push("Невірний targetUserCode");
  }

  if (!ALLOWED_OPERATIONS.includes(parsed.method)) {
    errors.push("Невірна операція");
  }

  if (parsed.method === "GET" || parsed.method === "DELETE") {
    if (!isValidTargetField(parsed.targetField)) {
      errors.push("Невірний TARGET_FIELD");
    }

    if (!isValidQueryParams(parsed.opParams)) {
      errors.push("Невірний формат параметрів запиту");
    }

    if (
      hasTargetUser &&
      isValidTargetField(parsed.targetField) &&
      !isAllowedCategory(parsed.targetField)
    ) {
      errors.push(`Невірна категорія: ${parsed.targetField}`);
    }
  }

  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isValidTargetField(change.targetField)) {
        errors.push(`Невірний TARGET_FIELD: ${change.targetField}`);
      }

      if (hasTargetUser && !isAllowedCategory(change.targetField)) {
        errors.push(`Невірна категорія: ${change.targetField}`);
      }

      if (!isValidChangeValue(change.changeValue)) {
        errors.push(`Невірний формат зміни: ${change.changeValue}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateParsedMessage };