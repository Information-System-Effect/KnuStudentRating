const { checkAccess } = require("../../src/services/access-control.service");

describe("checkAccess", () => {
  test("returns ok=true for teacher on rating PATCH", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
    };

    const templateInfo = {
      type: "rating",
      targetBackend: "rating",
    };

    const userContext = {
      role: "teacher",
      userCode: "U1",
    };

    const result = checkAccess({ parsed, templateInfo, userContext });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("returns error when role is missing", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "rating",
      userContext: {
        userCode: "U1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Не вдалося визначити роль користувача");
  });

  test("returns error when role is not allowed for template method", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "rating",
      userContext: {
        role: "student",
        userCode: "U1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Роль "student" не має доступу до операції PATCH для шаблону rating'
    );
  });

  test("returns error when senderCode does not match authenticated user", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "rating",
      userContext: {
        role: "teacher",
        userCode: "U999",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "senderCode не збігається з автентифікованим користувачем"
    );
  });

  test("returns error when student tries to modify data", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PUT",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "rating",
      userContext: {
        role: "student",
        userCode: "U1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Студент не має права змінювати дані інших користувачів"
    );
  });

  test("allows student to do rating GET", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "rating",
      userContext: {
        role: "student",
        userCode: "U1",
      },
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("returns error when general DELETE is requested by teacher", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "DELETE",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "general",
      userContext: {
        role: "teacher",
        userCode: "U1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Роль "teacher" не має доступу до операції DELETE для шаблону general'
    );
  });

  test("allows admin to do general DELETE", () => {
    const parsed = {
      senderCode: "ADMIN_1",
      targetUserCode: "_",
      method: "DELETE",
    };

    const result = checkAccess({
      parsed,
      templateInfo: "general",
      userContext: {
        role: "admin",
        userCode: "ADMIN_1",
      },
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("uses templateInfo.type when templateInfo is object", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
    };

    const result = checkAccess({
      parsed,
      templateInfo: {
        type: "rating",
        targetBackend: "rating",
      },
      userContext: {
        role: "teacher",
        userCode: "U1",
      },
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });
});