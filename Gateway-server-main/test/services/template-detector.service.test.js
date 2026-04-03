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

const { detectGatewayTemplate } = require("../../src/services/template-detector.service");

describe("detectGatewayTemplate", () => {
  test("detects rating template for GET with target user and rating category", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
      targetField: "TEAMWORK",
      opParams: "",
    };

    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("detects rating template for DELETE with target user and rating category", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "DELETE",
      targetField: "COMMUNICATION",
      opParams: "",
    };

    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("detects rating template for PATCH when all changes are rating categories", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "TEAMWORK", changeValue: "+5" },
      ],
    };

    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("detects rating template for PUT when all changes are rating categories", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PUT",
      changes: [
        { targetField: "MY_SQL", changeValue: "+4" },
        { targetField: "RESPONSIBILITY", changeValue: "+2" },
      ],
    };

    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("detects general template when targetUserCode is '_'", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      targetField: "TEAMWORK",
      opParams: "",
    };

    expect(detectGatewayTemplate(parsed)).toBe("general");
  });

  test("detects general template for GET with non-rating targetField", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
      targetField: "STUDENTS",
      opParams: "",
    };

    expect(detectGatewayTemplate(parsed)).toBe("general");
  });

  test("detects general template for PATCH if not all changes are rating categories", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "STUDENTS", changeValue: "+1" },
      ],
    };

    expect(detectGatewayTemplate(parsed)).toBe("general");
  });

  test("detects general template for empty changes array", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      changes: [],
    };

    expect(detectGatewayTemplate(parsed)).toBe("general");
  });
});