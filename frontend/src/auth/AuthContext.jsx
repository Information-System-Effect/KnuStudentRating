/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  accessToken: "knu.accessToken",
  userCode: "knu.userCode",
  role: "knu.role",
};

class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function parseErrorMessage(payload, fallback) {
  if (!payload) {
    return fallback;
  }
  if (typeof payload.data === "string") {
    return payload.data;
  }
  if (payload.data?.message) {
    return payload.data.message;
  }
  const details = payload.data?.details;
  if (details && typeof details === "object") {
    for (const value of Object.values(details)) {
      if (typeof value === "string") {
        return value;
      }
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0]);
      }
    }
  }
  return fallback;
}

function readStoredSession() {
  return {
    accessToken: localStorage.getItem(STORAGE_KEYS.accessToken) || "",
    userCode: localStorage.getItem(STORAGE_KEYS.userCode) || "",
    role: localStorage.getItem(STORAGE_KEYS.role) || "",
  };
}

function isSerializableBody(body) {
  if (!body) {
    return false;
  }
  if (body instanceof FormData) {
    return false;
  }
  if (body instanceof Blob) {
    return false;
  }
  if (body instanceof URLSearchParams) {
    return false;
  }
  return typeof body === "object";
}

function normalizeInit(init = {}) {
  const normalized = { ...init };
  if (isSerializableBody(normalized.body)) {
    const headers = new Headers(normalized.headers || {});
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    normalized.headers = headers;
    normalized.body = JSON.stringify(normalized.body);
  }
  return normalized;
}

async function requestRaw(path, init = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...normalizeInit(init),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.status !== "success") {
    throw new ApiError(
      parseErrorMessage(payload, `Помилка запиту (${response.status})`),
      response.status,
      payload,
    );
  }

  return payload.data;
}

function withBearer(init, accessToken) {
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return {
    ...(init || {}),
    headers,
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [me, setMe] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const refreshPromiseRef = useRef(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.userCode);
    localStorage.removeItem(STORAGE_KEYS.role);
    setSession({ accessToken: "", userCode: "", role: "" });
  }, []);

  const persistSession = useCallback((tokens) => {
    const next = {
      accessToken: tokens?.accessToken || "",
      userCode: tokens?.userCode || "",
      role: tokens?.role || "",
    };
    localStorage.setItem(STORAGE_KEYS.accessToken, next.accessToken);
    localStorage.setItem(STORAGE_KEYS.userCode, next.userCode);
    localStorage.setItem(STORAGE_KEYS.role, next.role);
    setSession(next);
  }, []);

  const loadMeByToken = useCallback((accessToken) => {
    return requestRaw("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }, []);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const current = (async () => {
      try {
        const refreshed = await requestRaw("/api/auth/refresh", {
          method: "POST",
          body: {},
        });
        persistSession(refreshed);
        const refreshedMe = await loadMeByToken(refreshed.accessToken);
        setMe(refreshedMe);
        return refreshed;
      } catch (error) {
        clearSession();
        setMe(null);
        throw error;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = current;
    return current;
  }, [clearSession, loadMeByToken, persistSession]);

  const api = useCallback((path, init = {}) => requestRaw(path, init), []);

  const authApi = useCallback(
    async (path, init = {}) => {
      if (!session.accessToken) {
        throw new ApiError("Потрібна авторизація", 401);
      }

      try {
        return await requestRaw(path, withBearer(init, session.accessToken));
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }
        const refreshed = await refreshSession();
        return requestRaw(path, withBearer(init, refreshed.accessToken));
      }
    },
    [refreshSession, session.accessToken],
  );

  const login = useCallback(
    async (payload) => {
      const tokens = await requestRaw("/api/auth/login", {
        method: "POST",
        body: payload,
      });
      persistSession(tokens);
      const meData = await loadMeByToken(tokens.accessToken);
      setMe(meData);
      return tokens;
    },
    [loadMeByToken, persistSession],
  );

  const register = useCallback(
    async (_role, payload) => {
      const tokens = await requestRaw("/api/auth/register", {
        method: "POST",
        body: payload,
      });
      persistSession(tokens);
      const meData = await loadMeByToken(tokens.accessToken);
      setMe(meData);
      return tokens;
    },
    [loadMeByToken, persistSession],
  );

  const logout = useCallback(async () => {
    const accessToken = session.accessToken;
    if (accessToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch {
        // Network errors are ignored, local session is still dropped.
      }
    }
    clearSession();
    setMe(null);
  }, [clearSession, session.accessToken]);

  const refreshMe = useCallback(async () => {
    const meData = await authApi("/api/auth/me", { method: "GET" });
    setMe(meData);
    return meData;
  }, [authApi]);

  const hasRole = useCallback(
    (role) => {
      const normalized = role.startsWith("ROLE_") ? role.toUpperCase() : `ROLE_${role.toUpperCase()}`;
      if (Array.isArray(me?.roles) && me.roles.length > 0) {
        return me.roles.includes(normalized);
      }
      if (!session.role) {
        return false;
      }
      return session.role.toUpperCase() === normalized.replace("ROLE_", "");
    },
    [me?.roles, session.role],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!session.accessToken) {
        if (active) {
          setMe(null);
          setIsBootstrapping(false);
        }
        return;
      }

      if (active) {
        setIsBootstrapping(true);
      }

      try {
        const meData = await loadMeByToken(session.accessToken);
        if (active) {
          setMe(meData);
          setIsBootstrapping(false);
        }
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          clearSession();
          if (active) {
            setMe(null);
            setIsBootstrapping(false);
          }
          return;
        }
      }

      try {
        await refreshSession();
      } catch {
        if (active) {
          setMe(null);
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [clearSession, loadMeByToken, refreshSession, session.accessToken]);

  const value = useMemo(
    () => ({
      session,
      me,
      api,
      authApi,
      login,
      register,
      logout,
      refreshSession,
      refreshMe,
      hasRole,
      isAuthenticated: Boolean(session.accessToken),
      isBootstrapping,
      ApiError,
    }),
    [api, authApi, hasRole, isBootstrapping, login, logout, me, refreshMe, refreshSession, register, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth має використовуватися всередині AuthProvider");
  }
  return context;
}
