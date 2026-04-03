jest.mock("../../src/utils/constants", () => ({
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

const { validateTemplateMessage } = require("../../src/services/template-validator.service");

describe("validateTemplateMessage", () => {
  describe("rating template", () => {
    test("returns ok=true for valid GET rating request", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "GET",
        targetField: "TEAMWORK",
        opParams: "",
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns error if rating template has no targetUserCode", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "TEAMWORK",
        opParams: "",
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Рейтинговий шаблон вимагає targetUserCode");
    });

    test("returns error for invalid category in GET rating request", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "GET",
        targetField: "HISTORY",
        opParams: "",
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
    });

    test("returns ok=true for valid PATCH rating request", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [
          { targetField: "LANG_JAVA", changeValue: "+10" },
          { targetField: "TEAMWORK", changeValue: "+5" },
        ],
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns error for invalid category in PATCH rating request", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PATCH",
        changes: [
          { targetField: "LANG_JAVA", changeValue: "+10" },
          { targetField: "HISTORY", changeValue: "+5" },
        ],
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
    });

    test("returns multiple category errors for PUT rating request", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "U2",
        method: "PUT",
        changes: [
          { targetField: "HISTORY", changeValue: "+10" },
          { targetField: "BIOLOGY", changeValue: "-5" },
        ],
      };

      const result = validateTemplateMessage(parsed, "rating");

      expect(result.ok).toBe(false);
      expect(result.errors).toContain("Невірна категорія: HISTORY");
      expect(result.errors).toContain("Невірна категорія: BIOLOGY");
    });
  });

  describe("general template", () => {
    test("returns ok=true for general template", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "STUDENTS",
        opParams: "page=1",
      };

      const result = validateTemplateMessage(parsed, "general");

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });

    test("returns ok=true for unknown template type by default", () => {
      const parsed = {
        senderCode: "U1",
        targetUserCode: "_",
        method: "GET",
        targetField: "STUDENTS",
        opParams: "",
      };

      const result = validateTemplateMessage(parsed, "something_else");

      expect(result).toEqual({
        ok: true,
        errors: [],
      });
    });
  });
});