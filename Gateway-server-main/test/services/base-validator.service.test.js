const { validateBaseMessage } = require("../../src/services/base-validator.service");

describe("Base Validator Service", () => {
  test("пропускає валідний запит GET", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "GET",
      targetField: "LANG_JAVA",
      opParams: "page=1;limit=10",
    };
    const result = validateBaseMessage(parsed);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("знаходить помилку в невірному senderCode", () => {
    const parsed = {
      senderCode: "U1@BAD", // Недопустимий символ @
      targetUserCode: "U2",
      method: "GET",
      targetField: "LANG_JAVA",
      opParams: "",
    };
    const result = validateBaseMessage(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Невірний формат senderCode/);
  });

  test("відхиляє зміну, що виходить за абсолютні межі базового протоколу (+25)", () => {
    const parsed = {
      senderCode: "L1",
      targetUserCode: "U2",
      method: "PUT",
      changes: [{ targetField: "LANG_JAVA", changeValue: "+25" }],
    };
    const result = validateBaseMessage(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Невірний формат зміни/);
  });

  test("відхиляє непідтримуваний метод", () => {
    const parsed = {
      senderCode: "U1",
      targetUserCode: "U2",
      method: "POST", // POST не в ALLOWED_OPERATIONS
      targetField: "USER",
      opParams: "",
    };
    const result = validateBaseMessage(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Невідомий або недопустимий метод: POST/);
  });
});