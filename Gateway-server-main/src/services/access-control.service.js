/**
 * Сервіс контролю доступу для шлюзу.
 *
 * Призначення:
 * - реалізовувати Матрицю Контролю Доступу (Access Control Matrix);
 * - перевіряти рольові ліміти балів для студентів (5) та викладачів (20);
 * - блокувати спроби зміни недозволених сутностей (наприклад, технічних предметів студентами);
 * - перевіряти відповідність senderCode автентифікованому користувачу (захист від підробки).
 */

const { ROLES, RATING_LIMITS, TECHNICAL_SUBJECTS, SOFT_SKILLS } = require("../utils/constants");

/**
 * Матриця дозволів для різних шаблонів і методів.
 */
const TEMPLATE_PERMISSIONS = {
  general: {
    GET: [ROLES.STUDENT, ROLES.TEACHER, "ADMIN"],
    DELETE: ["ADMIN"],
    PUT: ["ADMIN"],
    PATCH: ["ADMIN"],
  },
  rating: {
    GET: [ROLES.STUDENT, ROLES.TEACHER, "ADMIN"],
    // Студенти мають право на PUT/PATCH для оцінювання команди (Soft Skills)
    PATCH: [ROLES.STUDENT, ROLES.TEACHER, "ADMIN"],
    PUT: [ROLES.STUDENT, ROLES.TEACHER, "ADMIN"],
    DELETE: ["ADMIN"],
  },
};

function normalizeTemplateType(templateInfo) {
  return typeof templateInfo === "string" ? templateInfo : (templateInfo?.type || "general");
}

/**
 * Перевіряє, чи має користувач право виконувати запит.
 *
 * @param {object} params - Вхідні параметри перевірки доступу.
 * @param {object} params.parsed - Розпарсений gateway-запит.
 * @param {string|object} params.templateInfo - Інформація про визначений шаблон.
 * @param {object} params.userContext - Контекст автентифікованого користувача (з токену).
 * @returns {{ok: boolean, errors: string[]}} Результат перевірки доступу.
 */
function checkAccess({ parsed, templateInfo, userContext }) {
  const errors = [];
  const templateType = normalizeTemplateType(templateInfo);

  const role = userContext?.role;
  const authenticatedUserCode = userContext?.userCode;

  // 1. Перевірка наявності ролі
  if (!role) {
    errors.push("Не вдалося визначити роль користувача (спроба неавторизованого доступу)");
    return { ok: false, errors }; // Критична помилка, припиняємо перевірку
  }

  // 2. Перевірка матриці доступу (чи дозволений метод для ролі в цьому шаблоні)
  const allowedRoles = TEMPLATE_PERMISSIONS[templateType]?.[parsed.method] || [];
  if (!allowedRoles.includes(role)) {
    errors.push(`Роль "${role}" не має доступу до операції ${parsed.method} для шаблону ${templateType}`);
  }

  // 3. Захист від підробки відправника
  if (authenticatedUserCode && parsed.senderCode && parsed.senderCode !== authenticatedUserCode) {
    errors.push("senderCode у запиті не збігається з токеном автентифікованого користувача (загроза підробки ідентифікатора)");
  }

  // 4. Детальна перевірка бізнес-лімітів для операцій оцінювання
  if (templateType === "rating" && (parsed.method === "PUT" || parsed.method === "PATCH")) {
    for (const change of parsed.changes || []) {
      const val = Math.abs(Number(change.changeValue)); // Беремо по модулю для перевірки як позитивних, так і негативних змін

      if (role === ROLES.STUDENT) {
        // Студенти можуть оцінювати лише Soft Skills
        if (!SOFT_SKILLS.includes(change.targetField)) {
          errors.push(`Роль ${ROLES.STUDENT} не має права змінювати технічну категорію: ${change.targetField}`);
        }
        // Перевірка ліміту в 5 балів
        if (val > RATING_LIMITS.STUDENT_MAX) {
          errors.push(`Значення ${change.changeValue} перевищує ліміт (+${RATING_LIMITS.STUDENT_MAX}) для ролі ${ROLES.STUDENT}`);
        }
      }

      else if (role === ROLES.TEACHER) {
        // Перевірка ліміту в 20 балів для викладача
        if (val > RATING_LIMITS.TEACHER_MAX) {
          errors.push(`Значення ${change.changeValue} перевищує ліміт (+${RATING_LIMITS.TEACHER_MAX}) для ролі ${ROLES.TEACHER}`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { checkAccess };