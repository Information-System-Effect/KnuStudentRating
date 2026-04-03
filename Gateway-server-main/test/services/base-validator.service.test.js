const { validateBaseMessage } = require("../../src/services/base-validator.service");

jest.mock("../../src/utils/constants", () => ({
  ALLOWED_OPERATIONS: ["GET", "PUT", "PATCH", "DELETE"],
}));

describe("validateBaseMessage", () => {
  test("returns ok=true for valid GET request", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      targetField: "STUDENTS",
      opParams: "page=1;limit=20",
    };

    const result = validateBaseMessage(parsed);

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("returns error for invalid senderCode", () => {
    const parsed = {
      senderCode: "U 1",
      targetUserCode: "_",
      method: "GET",
      targetField: "STUDENTS",
      opParams: "",
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний senderCode");
  });

  test("returns error for invalid targetUserCode when target user exists", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U 2",
      method: "GET",
      targetField: "STUDENTS",
      opParams: "",
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний targetUserCode");
  });

  test("returns error for unsupported method", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "POST",
      targetField: "STUDENTS",
      opParams: "",
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірна операція");
  });

  test("returns error for invalid TARGET_FIELD in GET", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      targetField: "STUDENTS!",
      opParams: "",
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний TARGET_FIELD");
  });

  test("returns error for invalid query params", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      targetField: "STUDENTS",
      opParams: "page=1;limit=20#bad",
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний формат параметрів запиту");
  });

  test("returns ok=true for valid PATCH request", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "TEAMWORK", changeValue: "-5" },
      ],
    };

    const result = validateBaseMessage(parsed);

    expect(result).toEqual({
      ok: true,
      errors: [],
    });
  });

  test("returns error for invalid TARGET_FIELD in PATCH", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [{ targetField: "LANG-JAVA", changeValue: "+10" }],
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний TARGET_FIELD: LANG-JAVA");
  });

  test("returns error for non numeric changeValue", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [{ targetField: "TEAMWORK", changeValue: "abc" }],
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний формат зміни: abc");
  });

  test("returns error for changeValue out of range", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [{ targetField: "TEAMWORK", changeValue: "+25" }],
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний формат зміни: +25");
  });

  test("returns multiple errors for several invalid fields", () => {
    const parsed = {
      senderCode: "bad code",
      targetUserCode: "bad target",
      method: "PATCH",
      changes: [
        { targetField: "LANG-JAVA", changeValue: "abc" },
        { targetField: "TEAMWORK", changeValue: "+50" },
      ],
    };

    const result = validateBaseMessage(parsed);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Невірний senderCode");
    expect(result.errors).toContain("Невірний targetUserCode");
    expect(result.errors).toContain("Невірний TARGET_FIELD: LANG-JAVA");
    expect(result.errors).toContain("Невірний формат зміни: abc");
    expect(result.errors).toContain("Невірний формат зміни: +50");
  });
});