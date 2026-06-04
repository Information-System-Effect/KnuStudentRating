/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";

const ToastContext = createContext(null);

let nextToastId = 1;

function toneLabel(tone) {
  if (tone === "error") {
    return "Помилка";
  }
  if (tone === "info") {
    return "Інформація";
  }
  return "Успіх";
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function removeToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function showToast({ title, description = "", tone = "success", duration = 4200 }) {
    const id = nextToastId++;
    const toast = { id, title, description, tone };
    setToasts((current) => [...current, toast]);

    if (duration > 0) {
      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }

  const value = {
    showToast,
    success(title, description = "") {
      return showToast({ title, description, tone: "success" });
    },
    error(title, description = "") {
      return showToast({ title, description, tone: "error" });
    },
    info(title, description = "") {
      return showToast({ title, description, tone: "info" });
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <div className="toast-copy">
              <span className="toast-label">{toneLabel(toast.tone)}</span>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => removeToast(toast.id)}
              aria-label="Закрити сповіщення"
            >
              Закрити
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast має використовуватися всередині ToastProvider");
  }
  return context;
}
