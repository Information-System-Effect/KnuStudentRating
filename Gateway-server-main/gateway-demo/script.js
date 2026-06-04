document.addEventListener("DOMContentLoaded", () => {
  const requestInput = document.getElementById("requestInput");
  const validateBtn = document.getElementById("validateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusBox = document.getElementById("statusBox");
  const responseOutput = document.getElementById("responseOutput");
  const exampleButtons = document.querySelectorAll(".example-btn");

  const GATEWAY_URL = window.APP_CONFIG?.GATEWAY_URL;
  const ROLE_MAP = window.APP_CONFIG?.ROLE_MAP || {};

  const STORAGE_KEYS = {
    request: "gateway_request",
    result: "gateway_result",
    statusText: "gateway_status_text",
    statusClass: "gateway_status_class"
  };

  if (!requestInput || !validateBtn || !clearBtn || !statusBox || !responseOutput) {
    console.error("Не знайдено один або кілька елементів сторінки");
    return;
  }

  restoreState();

  validateBtn.addEventListener("click", handleValidation);
  clearBtn.addEventListener("click", clearAll);

  requestInput.addEventListener("input", () => {
    sessionStorage.setItem(STORAGE_KEYS.request, requestInput.value);
  });

  exampleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      requestInput.value = btn.dataset.example;
      sessionStorage.setItem(STORAGE_KEYS.request, requestInput.value);
    });
  });

  function restoreState() {
    const savedRequest = sessionStorage.getItem(STORAGE_KEYS.request);
    const savedResult = sessionStorage.getItem(STORAGE_KEYS.result);
    const savedStatusText = sessionStorage.getItem(STORAGE_KEYS.statusText);
    const savedStatusClass = sessionStorage.getItem(STORAGE_KEYS.statusClass);

    if (savedRequest) requestInput.value = savedRequest;
    if (savedResult) responseOutput.textContent = savedResult;
    if (savedStatusText) statusBox.textContent = savedStatusText;
    if (savedStatusClass) statusBox.className = savedStatusClass;
  }

  function saveUiState() {
    sessionStorage.setItem(STORAGE_KEYS.request, requestInput.value);
    sessionStorage.setItem(STORAGE_KEYS.statusText, statusBox.textContent);
    sessionStorage.setItem(STORAGE_KEYS.statusClass, statusBox.className);
    sessionStorage.setItem(STORAGE_KEYS.result, responseOutput.textContent);
  }

  function clearAll() {
    requestInput.value = "";
    statusBox.textContent = "Очікується запит…";
    statusBox.className = "status neutral";
    responseOutput.textContent = "{}";

    sessionStorage.removeItem(STORAGE_KEYS.request);
    sessionStorage.removeItem(STORAGE_KEYS.result);
    sessionStorage.removeItem(STORAGE_KEYS.statusText);
    sessionStorage.removeItem(STORAGE_KEYS.statusClass);
  }

  function resolveSenderCode(raw) {
    return raw.split("#")[0]?.trim() || "";
  }

  function resolveRoleBySender(senderCode) {
    const prefix = senderCode.charAt(0).toUpperCase();
    return ROLE_MAP[prefix] || "";
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!text) {
      return {
        ok: response.ok,
        code: response.status,
        message: response.ok
          ? "Запит успішно оброблено"
          : "Сервер повернув порожню відповідь",
        backendData: null,
        error: response.ok ? null : "Порожня відповідь сервера"
      };
    }

    if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(text);

        // Якщо backend не повертає ok/message, нормалізуємо успіх
        if (response.ok) {
          return {
            ok: data.ok ?? true,
            code: data.code ?? response.status,
            message: data.message ?? "Запит успішно оброблено",
            ...data
          };
        }

        return {
          ok: data.ok ?? false,
          code: data.code ?? response.status,
          message: data.message ?? "Помилка сервера",
          ...data
        };
      } catch {
        return {
          ok: response.ok,
          code: response.status,
          message: response.ok
            ? "Запит успішно оброблено"
            : "Сервер повернув некоректний JSON",
          backendData: response.ok ? text : null,
          error: response.ok ? null : text
        };
      }
    }

    return {
      ok: response.ok,
      code: response.status,
      message: response.ok
        ? "Запит успішно оброблено"
        : "Сервер повернув помилку",
      backendData: response.ok ? text : null,
      error: response.ok ? null : text
    };
  }

  async function handleValidation(event) {
    if (event) event.preventDefault();

    const raw = requestInput.value.trim();

    if (!raw) {
      showResult({
        ok: false,
        code: 400,
        message: "Порожній запит",
        backendData: null,
        error: "Введіть текст запиту"
      });
      return;
    }

    if (!GATEWAY_URL) {
      showResult({
        ok: false,
        code: 500,
        message: "Не задано адресу шлюзу",
        backendData: null,
        error: "Перевірте значення GATEWAY_URL у config.js"
      });
      return;
    }

    const senderCode = resolveSenderCode(raw);
    const userRole = resolveRoleBySender(senderCode);

    if (!senderCode) {
      showResult({
        ok: false,
        code: 400,
        message: "Некоректний запит",
        backendData: null,
        error: "Не вдалося визначити SENDER_CODE"
      });
      return;
    }

    if (!userRole) {
      showResult({
        ok: false,
        code: 400,
        message: "Не вдалося сформувати заголовки доступу",
        backendData: null,
        error: `Для senderCode "${senderCode}" не знайдено роль у ROLE_MAP`
      });
      return;
    }

    statusBox.textContent = "Шлюз обробляє запит...";
    statusBox.className = "status neutral";
    responseOutput.textContent = JSON.stringify(
      {
        message: "Очікування відповіді від серверу шлюзу...",
        requestMeta: {
          senderCode,
          userRole,
          gatewayUrl: GATEWAY_URL
        }
      },
      null,
      2
    );
    saveUiState();

    validateBtn.disabled = true;
    clearBtn.disabled = true;

    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "x-user-code": senderCode,
          "x-user-role": userRole,
          "x-request-id": `REQ-${Date.now()}`
        },
        body: raw
      });

      const result = await parseResponse(response);
      showResult(result);
    } catch (error) {
      showResult({
        ok: false,
        code: 500,
        message: "Не вдалося звернутися до серверу шлюзу",
        backendData: null,
        error: error.message
      });
    } finally {
      validateBtn.disabled = false;
      clearBtn.disabled = false;
    }
  }

  function showResult(result) {
    if (result.ok) {
      statusBox.textContent = "Запит успішно оброблено";
      statusBox.className = "status success";
    } else {
      statusBox.textContent = "Запит заблоковано шлюзом";
      statusBox.className = "status error";
    }

    responseOutput.textContent = JSON.stringify(result, null, 2);
    saveUiState();
  }
});