export function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("uk-UA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PROJECT_STATUS_LABELS = {
  DRAFT: "Чернетка",
  PLANNED: "Заплановано",
  IN_PROGRESS: "У роботі",
  COMPLETED: "Завершено",
  ARCHIVED: "Архів",
};

const REQUEST_STATUS_LABELS = {
  PENDING: "Очікує розгляду",
  ON_REVIEW: "На розгляді",
  APPROVED: "Схвалено",
  REJECTED: "Відхилено",
  CANCELLED: "Скасовано",
};

const ROLE_LABELS = {
  STUDENT: "Студент",
  TEACHER: "Викладач",
  ADMIN: "Адміністратор",
  MODERATOR: "Модератор",
  OWNER: "Власник",
  MENTOR: "Ментор",
};

const DIMENSION_LABELS = {
  TECHNICAL: "Технічна",
  SUBJECTIVE: "Суб'єктивна",
};

const CATEGORY_LABELS = {
  LANG_JAVA: "Java",
  LANG_CPP_CSHARP: "C++ / C#",
  LANG_PYTHON: "Python",
  DB_MYSQL: "MySQL",
  DB_POSTGRESQL: "PostgreSQL",
  OS_WINDOWS: "Windows",
  OS_LINUX: "Linux",
  TESTING: "Тестування",
  PARADIGMS_ARCHITECTURE: "Парадигми та архітектура",
  TEAMWORK: "Командна робота",
  SYSTEM_DESIGN: "Проєктування складних систем",
  COMMUNICATION: "Комунікація",
  RESPONSIBILITY: "Відповідальність",
  INITIATIVE: "Ініціативність",
};

function normalizeEnumValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, "");
}

function labelFromMap(labels, value) {
  const normalized = normalizeEnumValue(value);
  if (!normalized) {
    return "-";
  }
  return labels[normalized] || normalized;
}

export function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
}

export function formatDelta(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric > 0 ? `+${numeric.toFixed(2)}` : numeric.toFixed(2);
}

export function parseCodeList(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function formatProjectStatus(value) {
  return labelFromMap(PROJECT_STATUS_LABELS, value);
}

export function formatRequestStatus(value) {
  return labelFromMap(REQUEST_STATUS_LABELS, value);
}

export function formatRoleLabel(value) {
  return labelFromMap(ROLE_LABELS, value);
}

export function formatDimensionLabel(value) {
  return labelFromMap(DIMENSION_LABELS, value);
}

function normalizeCategoryCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^(STUDENT|TEACHER)_/, "");
}

function humanizeCategoryCode(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(" ");
}

export function formatCategoryLabel(categoryCode, categoryName = "") {
  const normalizedCode = normalizeCategoryCode(categoryCode);
  if (CATEGORY_LABELS[normalizedCode]) {
    return CATEGORY_LABELS[normalizedCode];
  }
  if (categoryName && categoryName.trim()) {
    return categoryName.trim();
  }
  if (normalizedCode) {
    return humanizeCategoryCode(normalizedCode);
  }
  return "-";
}

export function profileLink(code) {
  return `/site/participants/profile/${encodeURIComponent(code)}`;
}

