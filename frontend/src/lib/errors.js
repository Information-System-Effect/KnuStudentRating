export function getErrorMessage(error, fallback = "Сталася помилка. Спробуйте ще раз.") {
  const message = String(error?.message || "").trim();
  if (!message) {
    return fallback;
  }
  if (/^помилка запиту/i.test(message) || /^\d{3}\b/.test(message)) {
    return fallback;
  }
  return message;
}
