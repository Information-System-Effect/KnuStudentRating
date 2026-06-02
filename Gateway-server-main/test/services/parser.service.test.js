const { parseGatewayMessage } = require("../../src/services/parser.service");

describe("Parser Service", () => {
  test("успішно парсить одинарний GET запит", () => {
    const raw = "U1#U2#GET#LANG_JAVA#page=1";
    const result = parseGatewayMessage(raw);

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
      mode: "single",
      targetField: "LANG_JAVA",
      opParams: "page=1",
    });
  });

  test("успішно парсить складений PUT запит (multi)", () => {
    const raw = "L1#U2#PUT#LANG_JAVA#+10#TEAMWORK#+5";
    const result = parseGatewayMessage(raw);

    expect(result).toEqual({
      senderCode: "L1",
      targetUserCode: "U2",
      method: "PUT",
      mode: "multi",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "TEAMWORK", changeValue: "+5" },
      ],
    });
  });

  test("викидає помилку при порожньому запиті", () => {
    expect(() => parseGatewayMessage("   ")).toThrow("Порожній запит");
    expect(() => parseGatewayMessage(null)).toThrow("Порожній запит");
  });

  test("викидає помилку при недостатній кількості полів", () => {
    expect(() => parseGatewayMessage("U1#U2#GET")).toThrow("Недостатньо полів у запиті");
  });

  test("викидає помилку при порушенні парності параметрів для масового оновлення", () => {
    const raw = "L1#U2#PUT#LANG_JAVA#+10#TEAMWORK"; // Немає значення для TEAMWORK
    expect(() => parseGatewayMessage(raw)).toThrow("Порушено парність параметрів");
  });

  test("повертає режим unknown для невідомих методів", () => {
    const raw = "U1#U2#FETCH#LANG_JAVA#+10";
    const result = parseGatewayMessage(raw);
    expect(result.mode).toBe("unknown");
    expect(result.method).toBe("FETCH");
  });
});