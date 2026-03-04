const { ALLOWED_OPERATIONS } = require("../utils/constants");

const USER_CODE_RE = /^[UTP]\d+$/;
const FIELD_RE = /^[A-Za-z0-9_]+$/;
const LEGACY_NUMERIC_RE = /^[+-]?\d+(\.\d+)?$/;

function stripWrappingQuotes(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeLegacyNumeric(value) {
  const trimmed = stripWrappingQuotes(value);
  if (
    trimmed.length >= 4 &&
    (trimmed.startsWith('+"') || trimmed.startsWith('-"')) &&
    trimmed.endsWith('"')
  ) {
    return trimmed.charAt(0) + trimmed.slice(2, -1);
  }
  return trimmed;
}

function isValidUserCode(value) {
  return USER_CODE_RE.test((value || "").trim());
}

function isValidTargetField(value) {
  return FIELD_RE.test((value || "").trim());
}

function isValidChangeValue(rawValue) {
  const value = (rawValue || "").trim();
  if (!value) {
    return false;
  }

  const upper = value.toUpperCase();
  if (upper.startsWith("SET:") || upper.startsWith("ADD:")) {
    const rawNumber = value.slice(4);
    const normalized = normalizeLegacyNumeric(rawNumber);
    return LEGACY_NUMERIC_RE.test(normalized);
  }

  return LEGACY_NUMERIC_RE.test(normalizeLegacyNumeric(value));
}

function validateParsedMessage(parsed) {
  const errors = [];

  if (!isValidUserCode(parsed.senderCode)) {
    errors.push("Invalid senderCode: expected U<digits>, T<digits> or P<digits>");
  }

  if (parsed.targetUserCode !== "_" && !isValidUserCode(parsed.targetUserCode)) {
    errors.push("Invalid targetUserCode: expected U<digits>, T<digits>, P<digits> or _");
  }

  if (!ALLOWED_OPERATIONS.includes(parsed.method)) {
    errors.push("Unsupported action");
  }

  if (Array.isArray(parsed.pairs)) {
    for (const pair of parsed.pairs) {
      if (!isValidTargetField(pair.key)) {
        errors.push(`Invalid key: ${pair.key}`);
      }
    }
  }

  if (parsed.method === "PUT" || parsed.method === "PATCH") {
    for (const change of parsed.changes || []) {
      if (!isValidChangeValue(change.changeValue)) {
        errors.push(`Invalid change value: ${change.changeValue}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateParsedMessage };
