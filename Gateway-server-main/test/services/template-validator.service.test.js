const { validateTemplateMessage } = require("../../src/services/template-validator.service");

describe("Template Validator Service", () => {
  test("шаблон 'general' завжди проходить валідацію", () => {
    const result = validateTemplateMessage({}, "general");
    expect(result.ok).toBe(true);
  });

  test("шаблон 'rating' відхиляється, якщо targetUserCode дорівнює '_'", () => {
    const parsed = { targetUserCode: "_", method: "GET" };
    const result = validateTemplateMessage(parsed, "rating");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/вимагає конкретний targetUserCode/);
  });

  test("шаблон 'rating' приймає валідні категорії у складеному масиві", () => {
    const parsed = {
      targetUserCode: "U2",
      method: "PUT",
      changes: [{ targetField: "TEAMWORK", changeValue: "+5" }],
    };
    const result = validateTemplateMessage(parsed, "rating");
    expect(result.ok).toBe(true);
  });

  test("шаблон 'rating' відхиляє недопустимі категорії", () => {
    const parsed = {
      targetUserCode: "U2",
      method: "PUT",
      changes: [{ targetField: "INVALID_CAT", changeValue: "+5" }],
    };
    const result = validateTemplateMessage(parsed, "rating");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Невідома або недопустима рейтингова категорія/);
  });
});