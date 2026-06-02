/**
 * Набір констант внутрішнього gateway-протоколу.
 *
 * Призначення:
 * - зберігати перелік дозволених операцій протоколу;
 * - зберігати перелік доступних категорій / предметів, розділених за типами (технічні/софт-скіли);
 * - зберігати конфігурації ролей та їхніх лімітів для рейтингової системи;
 * - зберігати константи для криптографічного підпису та безпеки (headers);
 * - уніфікувати коди відповідей для клієнтської частини.
 */

/**
 * Список дозволених операцій внутрішнього текстового протоколу.
 * @type {string[]}
 */
const ALLOWED_OPERATIONS = ["GET", "PUT", "PATCH", "DELETE"];

/**
 * Технічні категорії рейтингу.
 * Згідно з правилами доступу, змінювати ці категорії можуть переважно викладачі.
 * @type {string[]}
 */
const TECHNICAL_SUBJECTS = [
  "LANG_JAVA",
  "LANG_CPP",
  "LANG_CS",
  "LANG_JS",
  "LANG_PYTHON",
  "MY_SQL",
  "POSTGRES_SQL",
  "DB_DESIGN",
  "ALGORITHMS",
  "DATA_STRUCTURES",
  "SYSTEM_ANALYSIS"
];

/**
 * Нетехнічні (soft-skills) категорії рейтингу.
 * Ці категорії можуть оцінювати студенти (в межах своїх лімітів) під час командної роботи.
 * @type {string[]}
 */
const SOFT_SKILLS = [
  "TEAMWORK",
  "COMMUNICATION",
  "RESPONSIBILITY",
  "INITIATIVE",
  "PROBLEM_SOLVING",
  "CREATIVITY",
  "LEADERSHIP"
];

/**
 * Об'єднаний перелік усіх доступних категорій.
 * @type {string[]}
 */
const AVAILABLE_SUBJECTS = [...TECHNICAL_SUBJECTS, ...SOFT_SKILLS];

/**
 * Константи ролей користувачів у системі.
 * Використовуються для парсингу кодів відправників (наприклад, U1 -> STUDENT, L1 -> TEACHER).
 */
const ROLES = {
  STUDENT: "STUDENT",
  TEACHER: "TEACHER"
};

/**
 * Ліміти балів для різних ролей.
 * Використовуються в модулі access-control.service для запобігання перевищенню повноважень.
 */
const RATING_LIMITS = {
  STUDENT_MAX: 5,
  TEACHER_MAX: 20
};

/**
 * Константи безпеки для захищеної взаємодії між шлюзом та сервером обробки даних.
 */
const SECURITY = {
  // Секретний ключ для підпису хешу (у реальному проєкті береться з .env)
  SECRET_KEY: process.env.GATEWAY_SECRET_KEY || "secure_gateway_salt_2026_IS_effect",
  // Назва заголовку для передачі криптографічної сигнатури
  HEADER_SIGNATURE: "X-Gateway-Signature",
  // Назва заголовку для передачі часової позначки (захист від Replay Attacks)
  HEADER_TIMESTAMP: "X-Timestamp"
};

/**
 * Стандартизовані коди HTTP-відповідей для формування JSON-конвертів шлюзу.
 */
const RESPONSE_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,   // Помилка парсингу, невірна структура або шаблон
  UNAUTHORIZED: 401,  // Спроба прямого доступу або невалідний підпис
  FORBIDDEN: 403,     // Порушення ролей, лімітів або спроба змінити недозволене поле
  INTERNAL_ERROR: 500 // Внутрішня помилка шлюзу
};

module.exports = {
  ALLOWED_OPERATIONS,
  TECHNICAL_SUBJECTS,
  SOFT_SKILLS,
  AVAILABLE_SUBJECTS,
  ROLES,
  RATING_LIMITS,
  SECURITY,
  RESPONSE_CODES
};