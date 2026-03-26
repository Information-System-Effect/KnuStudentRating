function parseGatewayMessage(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Порожній запит");
  }

  const parts = raw.trim().split("#");

  if (parts.length < 5) {
    throw new Error("Недостатньо полів у запиті");
  }

  const [senderCode, targetUserCode, methodRaw, ...rest] = parts;
  const method = methodRaw.trim().toUpperCase();

  // GET / DELETE -> строго 2 поля після METHOD
  if (method === "GET" || method === "DELETE") {
    if (rest.length !== 2) {
      throw new Error(`Для методу "${method}" очікується 5 полів`);
    }

    const [targetField, opParams] = rest;

    return {
      senderCode,
      targetUserCode,
      method,
      mode: "single",
      targetField,
      opParams,
    };
  }

  // PATCH / PUT -> одна або багато змін
  if (method === "PATCH" || method === "PUT") {
    if (rest.length < 2 || rest.length % 2 !== 0) {
      throw new Error('Для методу "PATCH" або "PUT" після нього мають іти пари');
    }

    const changes = [];
    for (let i = 0; i < rest.length; i += 2) {
      changes.push({
        targetField: rest[i],
        changeValue: rest[i + 1],
      });
    }

    return {
      senderCode,
      targetUserCode,
      method,
      mode: changes.length === 1 ? "single" : "multi",
      changes,
    };
  }

  // Невідомий метод — далі помилку дасть валідатор
  return {
    senderCode,
    targetUserCode,
    method,
    mode: "unknown",
    rawRest: rest,
  };
}

module.exports = { parseGatewayMessage };