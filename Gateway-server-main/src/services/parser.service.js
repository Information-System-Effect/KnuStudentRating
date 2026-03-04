function parseGatewayMessage(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Request payload must not be empty");
  }

  const normalized = raw.trim();
  const parts = normalized.split("#");

  if (parts.length < 5) {
    throw new Error("Invalid format: expected at least 5 parts");
  }

  const [senderCode, targetUserCode, methodRaw, ...rest] = parts;
  const method = methodRaw.trim().toUpperCase();

  if (rest.length % 2 !== 0) {
    throw new Error("Invalid format: tail must contain key/value pairs");
  }

  const pairs = [];
  for (let i = 0; i < rest.length; i += 2) {
    pairs.push({
      key: rest[i],
      value: rest[i + 1],
    });
  }

  if (method === "GET" || method === "DELETE") {
    if (pairs.length < 1) {
      throw new Error(`Invalid format: "${method}" requires at least one key/value pair`);
    }

    const [{ key: targetField, value: opParams }] = pairs;

    return {
      senderCode,
      targetUserCode,
      method,
      mode: pairs.length === 1 ? "single" : "multi",
      targetField,
      opParams,
      pairs,
      rawMessage: normalized,
    };
  }

  if (method === "PATCH" || method === "PUT") {
    if (pairs.length < 1) {
      throw new Error(`Invalid format: "${method}" requires at least one key/value pair`);
    }

    const changes = pairs.map(({ key, value }) => ({
      targetField: key,
      changeValue: value,
    }));

    return {
      senderCode,
      targetUserCode,
      method,
      mode: changes.length === 1 ? "single" : "multi",
      changes,
      pairs,
      rawMessage: normalized,
    };
  }

  return {
    senderCode,
    targetUserCode,
    method,
    mode: "unknown",
    pairs,
    rawMessage: normalized,
  };
}

module.exports = { parseGatewayMessage };
