const { parseGatewayMessage } = require("../../src/services/parser.service");

describe("parseGatewayMessage", () => {
  test("throws error for empty request", () => {
    expect(() => parseGatewayMessage("")).toThrow("Порожній запит");
    expect(() => parseGatewayMessage("   ")).toThrow("Порожній запит");
    expect(() => parseGatewayMessage(null)).toThrow("Порожній запит");
  });

  test("throws error when request has fewer than 5 parts", () => {
    expect(() => parseGatewayMessage("U1#U2#GET#ONLY")).toThrow(
      "Недостатньо полів у запиті"
    );
  });

  test("parses valid GET request", () => {
    const result = parseGatewayMessage("U1#_#GET#STUDENTS#page=1;limit=20");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      mode: "single",
      targetField: "STUDENTS",
      opParams: "page=1;limit=20",
    });
  });

  test("parses valid DELETE request", () => {
    const result = parseGatewayMessage("U1#U2#DELETE#TEAMWORK#reason=test");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "DELETE",
      mode: "single",
      targetField: "TEAMWORK",
      opParams: "reason=test",
    });
  });

  test("throws error for GET if fields count is not exactly 5", () => {
    expect(() =>
      parseGatewayMessage("U1#_#GET#STUDENTS#page=1#extra")
    ).toThrow('Для методу "GET" очікується 5 полів');
  });

  test("throws error for DELETE if fields count is not exactly 5", () => {
    expect(() =>
      parseGatewayMessage("U1#U2#DELETE#TEAMWORK#reason=test#extra")
    ).toThrow('Для методу "DELETE" очікується 5 полів');
  });

  test("parses valid PATCH request with one pair", () => {
    const result = parseGatewayMessage("U1#U2#PATCH#LANG_JAVA#+10");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [
        {
          targetField: "LANG_JAVA",
          changeValue: "+10",
        },
      ],
    });
  });

  test("parses valid PUT request with multiple pairs", () => {
    const result = parseGatewayMessage(
      "U1#U2#PUT#LANG_JAVA#+10#MY_SQL#-5#TEAMWORK#+7"
    );

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PUT",
      mode: "multi",
      changes: [
        { targetField: "LANG_JAVA", changeValue: "+10" },
        { targetField: "MY_SQL", changeValue: "-5" },
        { targetField: "TEAMWORK", changeValue: "+7" },
      ],
    });
  });

  test("throws error for PUT if number of fields after method is odd", () => {
    expect(() =>
      parseGatewayMessage("U1#U2#PUT#LANG_JAVA#+10#MY_SQL")
    ).toThrow('Для методу "PATCH" або "PUT" після нього мають іти пари');
  });

  test("normalizes method to uppercase", () => {
    const result = parseGatewayMessage("U1#U2#patch#TEAMWORK#+5");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "PATCH",
      mode: "single",
      changes: [
        {
          targetField: "TEAMWORK",
          changeValue: "+5",
        },
      ],
    });
  });

  test("returns unknown mode for unsupported method", () => {
    const result = parseGatewayMessage("U1#U2#POST#FIELD#VALUE");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "U2",
      method: "POST",
      mode: "unknown",
      rawRest: ["FIELD", "VALUE"],
    });
  });

  test("trims request before parsing", () => {
    const result = parseGatewayMessage("   U1#_#GET#STUDENTS#page=1   ");

    expect(result).toEqual({
      senderCode: "U1",
      targetUserCode: "_",
      method: "GET",
      mode: "single",
      targetField: "STUDENTS",
      opParams: "page=1",
    });
  });
});