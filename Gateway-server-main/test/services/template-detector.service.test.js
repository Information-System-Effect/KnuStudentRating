const { detectGatewayTemplate } = require("../../src/services/template-detector.service");

describe("Template Detector Service", () => {
  test("повертає 'general' для системних запитів (targetUserCode === '_')", () => {
    const parsed = { targetUserCode: "_", method: "GET" };
    expect(detectGatewayTemplate(parsed)).toBe("general");
  });

  test("повертає 'rating' для GET запиту відомої рейтингової категорії", () => {
    const parsed = {
      targetUserCode: "U2",
      method: "GET",
      mode: "single",
      targetField: "LANG_JAVA", // Це технічний предмет з констант
    };
    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("повертає 'rating' для PUT запиту, де всі зміни стосуються рейтингу", () => {
    const parsed = {
      targetUserCode: "U2",
      method: "PUT",
      mode: "multi",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "TEAMWORK", changeValue: "+5" },
      ],
    };
    expect(detectGatewayTemplate(parsed)).toBe("rating");
  });

  test("повертає 'general', якщо хоча б одне поле PUT не є рейтинговим", () => {
    const parsed = {
      targetUserCode: "U2",
      method: "PUT",
      mode: "multi",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "UNKNOWN_DATA", changeValue: "+5" }, // Не категорія
      ],
    };
    expect(detectGatewayTemplate(parsed)).toBe("general");
  });
});