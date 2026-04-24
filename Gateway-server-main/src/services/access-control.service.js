/**
 * Сервіс контролю доступу для шлюзу.
 *
 * Призначення:
 * - визначати, чи має користувач право виконувати певну операцію;
 * - враховувати тип шаблону запиту;
 * - враховувати HTTP-метод внутрішнього протоколу;
 * - перевіряти відповідність senderCode автентифікованому користувачу.
 */

/**
 * Матриця дозволів для різних шаблонів і методів.
 *
 * Структура:
 * - ключ верхнього рівня — тип шаблону;
 * - ключ другого рівня — метод запиту;
 * - значення — список ролей, яким дозволено виконувати цю операцію.
 *
 * Приклад:
 * - для шаблону "rating" метод PATCH доступний лише teacher і admin;
 * - для шаблону "general" метод DELETE доступний лише admin.
 */
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

/**
 * Нормалізує тип шаблону.
 *
 * Функція підтримує два варіанти:
 * 1. templateInfo уже є рядком, наприклад "rating";
 * 2. templateInfo є об'єктом, наприклад { type: "rating", targetBackend: "rating" }.
 *
 * Якщо тип шаблону не визначено, за замовчуванням повертається "general".
 *
 * @param {string|object} templateInfo - Інформація про шаблон запиту.
 * @returns {string} Нормалізований тип шаблону.
 */
function normalizeTemplateType(templateInfo) {
  if (typeof templateInfo === "string") {
    return templateInfo;
  }

  return templateInfo?.type || "general";
}

/**
 * Перевіряє, чи має користувач право виконувати запит.
 *
 * Перевіряються такі умови:
 * - чи вдалося визначити роль користувача;
 * - чи дозволена ця роль для конкретного шаблону і методу;
 * - чи збігається senderCode у запиті з кодом автентифікованого користувача;
 * - додаткові бізнес-обмеження, наприклад заборона студенту змінювати чужі дані.
 *
 * @param {object} params - Вхідні параметри перевірки доступу.
 * @param {object} params.parsed - Розпарсений gateway-запит.
 * @param {string|object} params.templateInfo - Інформація про визначений шаблон.
 * @param {object} params.userContext - Контекст автентифікованого користувача.
 * @param {string} params.userContext.role - Роль користувача.
 * @param {string} params.userContext.userCode - Код автентифікованого користувача.
 * @returns {{ok: boolean, errors: string[]}} Результат перевірки доступу.
 */
function checkAccess({ parsed, templateInfo, userContext }) {
  const errors = [];
  const templateType = normalizeTemplateType(templateInfo);

  const role = userContext?.role;
  const authenticatedUserCode = userContext?.userCode;

  /**
   * Перевірка 1.
   * Роль користувача має бути визначена.
   */
  if (!role) {
    errors.push("Не вдалося визначити роль користувача");
  }

  /**
   * Перевірка 2.
   * Для комбінації "шаблон + метод" визначається список дозволених ролей.
   * Якщо роль користувача відсутня в цьому списку, доступ забороняється.
   */
  const allowedRoles =
    TEMPLATE_PERMISSIONS[templateType]?.[parsed.method] || [];

  if (role && !allowedRoles.includes(role)) {
    errors.push(
      `Роль "${role}" не має доступу до операції ${parsed.method} для шаблону ${templateType}`
    );
  }

  /**
   * Перевірка 3.
   * senderCode у повідомленні повинен відповідати коду
   * автентифікованого користувача.
   *
   * Це захищає від ситуації, коли користувач надсилає запит
   * від імені іншого користувача.
   */
  if (
    authenticatedUserCode &&
    parsed.senderCode &&
    parsed.senderCode !== authenticatedUserCode
  ) {
    errors.push("senderCode не збігається з автентифікованим користувачем");
  }

  /**
   * Перевірка 4.
   * Додаткове бізнес-правило:
   * студент не має права змінювати дані інших користувачів,
   * тобто виконувати PATCH, PUT або DELETE.
   */
  if (
    role === "student" &&
    (parsed.method === "PATCH" ||
      parsed.method === "PUT" ||
      parsed.method === "DELETE")
  ) {
    errors.push("Студент не має права змінювати дані інших користувачів");
  }

  /**
   * Повертається підсумковий результат:
   * - ok = true, якщо помилок немає;
   * - ok = false, якщо знайдено хоча б одне порушення правил доступу.
   */
  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { checkAccess };