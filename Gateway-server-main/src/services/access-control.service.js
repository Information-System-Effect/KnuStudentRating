const TEMPLATE_PERMISSIONS = {
  general: {
    GET: ["student", "teacher", "admin"],
    DELETE: ["admin"],
    PUT: ["admin"],
    PATCH: ["admin"],
  },
  rating: {
    GET: ["student", "teacher", "admin"],
    PATCH: ["teacher", "admin"],
    PUT: ["teacher", "admin"],
    DELETE: ["admin"],
  },
};

function normalizeTemplateType(templateInfo) {
  if (typeof templateInfo === "string") {
    return templateInfo;
  }

  return templateInfo?.type || "general";
}

function checkAccess({ parsed, templateInfo, userContext }) {
  const errors = [];
  const templateType = normalizeTemplateType(templateInfo);

  const role = userContext?.role;
  const authenticatedUserCode = userContext?.userCode;

  if (!role) {
    errors.push("Не вдалося визначити роль користувача");
  }

  const allowedRoles =
    TEMPLATE_PERMISSIONS[templateType]?.[parsed.method] || [];

  if (role && !allowedRoles.includes(role)) {
    errors.push(
      `Роль "${role}" не має доступу до операції ${parsed.method} для шаблону ${templateType}`
    );
  }

  // senderCode у запиті має відповідати автентифікованому користувачу
  if (
    authenticatedUserCode &&
    parsed.senderCode &&
    parsed.senderCode !== authenticatedUserCode
  ) {
    errors.push("senderCode не збігається з автентифікованим користувачем");
  }

  // Додаткове правило:
  // студент не може змінювати рейтинг іншого користувача
  if (
    role === "student" &&
    (parsed.method === "PATCH" || parsed.method === "PUT" || parsed.method === "DELETE")
  ) {
    errors.push("Студент не має права змінювати дані інших користувачів");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { checkAccess };