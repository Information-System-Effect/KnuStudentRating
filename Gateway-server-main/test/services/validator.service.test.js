jest.mock("../../src/utils/constants", () => ({
  ALLOWED_OPERATIONS: ["GET", "PUT", "PATCH", "DELETE"],
  ALLOWED_CATEGORIES: [
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
    "SYSTEM_ANALYSIS",
    "TEAMWORK",
    "COMMUNICATION",
    "RESPONSIBILITY",
    "INITIATIVE",
    "PROBLEM_SOLVING",
    "CREATIVITY",
    "LEADERSHIP",
  ],
}));

const { validateParsedMessage } = require("../../src/services/validator.service");

describe("validateParsedMessage", () => {
  describe("common validation", () => {
    test("returns ok=true for valid GET without target user", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "STUDENTS",
        opParams: "page=1;limit=20",
      };

      const result = validateParsedMessage(parsed);

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

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний senderCode");
    });

    test("returns error for invalid targetUserCode when target user exists", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U 2",
        method: "GET",
        targetField: "LANG_JAVA",
        opParams: "",
      };

      const result = validateParsedMessage(parsed);

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

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна операція");
    });
  });

  describe("GET / DELETE validation", () => {
    test("returns ok=true for valid GET with target user and allowed category", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "GET",
        targetField: "TEAMWORK",
        opParams: "",
      };

      const result = validateParsedMessage(parsed);

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns error for invalid TARGET_FIELD in GET", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "TEAMWORK!",
        opParams: "",
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний TARGET_FIELD");
    });

    test("returns error for invalid query params in GET", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "STUDENTS",
        opParams: "page=1;limit=20#bad",
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний формат параметрів запиту");
    });

    test("returns error for invalid category in GET when target user exists", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "GET",
        targetField: "HISTORY",
        opParams: "",
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
    });

    test("does not check category in GET when target user is '_'", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "HISTORY",
        opParams: "",
      };

      const result = validateParsedMessage(parsed);

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns ok=true for valid DELETE with target user and allowed category", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "DELETE",
        targetField: "COMMUNICATION",
        opParams: "reason=test",
      };

      const result = validateParsedMessage(parsed);

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });
  });

  describe("PUT / PATCH validation", () => {
    test("returns ok=true for valid PATCH with target user and allowed categories", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [
          { targetField: "LANG_JAVA", changeValue: "+10" },
          { targetField: "TEAMWORK", changeValue: "-5" },
        ],
      };

      const result = validateParsedMessage(parsed);

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

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний TARGET_FIELD: LANG-JAVA");
    });

    test("returns error for invalid category in PATCH when target user exists", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [{ targetField: "HISTORY", changeValue: "+10" }],
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
    });

    test("does not check category in PATCH when target user is '_'", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "PATCH",
        changes: [{ targetField: "HISTORY", changeValue: "+10" }],
      };

      const result = validateParsedMessage(parsed);

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns error for non-numeric change value", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [{ targetField: "TEAMWORK", changeValue: "abc" }],
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний формат зміни: abc");
    });

    test("returns error for change value out of allowed range", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [{ targetField: "TEAMWORK", changeValue: "+25" }],
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірний формат зміни: +25");
    });

    test("returns multiple errors if several fields are invalid", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PUT",
        changes: [
          { targetField: "HISTORY", changeValue: "+50" },
          { targetField: "LANG-JAVA", changeValue: "abc" },
        ],
      };

      const result = validateParsedMessage(parsed);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
      expect(result.errors).toContain("Невірний формат зміни: +50");
      expect(result.errors).toContain("Невірний TARGET_FIELD: LANG-JAVA");
    });
  });
});