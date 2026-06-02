const { checkAccess } = require("../../src/services/access-control.service");
const { ROLES } = require("../../src/utils/constants");

describe("Access Control Service", () => {
  const templateInfo = "rating";

  test("відхиляє доступ, якщо роль відсутня (неавторизований користувач)", () => {
    const parsed = { method: "GET" };
    const userContext = { role: null, userCode: null };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Не вдалося визначити роль/);
  });

  test("відхиляє доступ при спробі підробки senderCode", () => {
    const parsed = { senderCode: "U1", method: "GET" };
    const userContext = { role: ROLES.STUDENT, userCode: "U2" }; // U2 намагається видати себе за U1
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/загроза підробки ідентифікатора/);
  });

  test("дозволяє СТУДЕНТУ виставляти SOFT_SKILLS в межах ліміту (<=5)", () => {
    const parsed = {
      senderCode: "U1",
      method: "PUT",
      changes: [{ targetField: "TEAMWORK", changeValue: "+4" }],
    };
    const userContext = { role: ROLES.STUDENT, userCode: "U1" };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(true);
  });

  test("забороняє СТУДЕНТУ виставляти оцінки більше 5 балів", () => {
    const parsed = {
      senderCode: "U1",
      method: "PUT",
      changes: [{ targetField: "TEAMWORK", changeValue: "+6" }],
    };
    const userContext = { role: ROLES.STUDENT, userCode: "U1" };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/перевищує ліміт \(\+5\) для ролі STUDENT/);
  });

  test("забороняє СТУДЕНТУ виставляти оцінки з ТЕХНІЧНИХ предметів", () => {
    const parsed = {
      senderCode: "U1",
      method: "PUT",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+5" }],
    };
    const userContext = { role: ROLES.STUDENT, userCode: "U1" };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/не має права змінювати технічну категорію/);
  });

  test("дозволяє ВИКЛАДАЧУ виставляти ТЕХНІЧНІ оцінки в межах ліміту (<=20)", () => {
    const parsed = {
      senderCode: "L1",
      method: "PUT",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+15" }],
    };
    const userContext = { role: ROLES.TEACHER, userCode: "L1" };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(true);
  });

  test("забороняє ВИКЛАДАЧУ виставляти оцінки більше 20 балів", () => {
    const parsed = {
      senderCode: "L1",
      method: "PUT",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+21" }],
    };
    const userContext = { role: ROLES.TEACHER, userCode: "L1" };
    const result = checkAccess({ parsed, templateInfo, userContext });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/перевищує ліміт \(\+20\) для ролі TEACHER/);
  });
});