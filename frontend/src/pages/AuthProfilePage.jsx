import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatRoleLabel, profileLink } from "../lib/format";

export default function AuthProfilePage() {
  const { authApi, hasRole, logout, me, refreshMe, refreshSession, session } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = hasRole("ADMIN");

  const myPublicLink = useMemo(() => {
    const code = me?.userCode || session.userCode;
    return code ? profileLink(code) : "/";
  }, [me?.userCode, session.userCode]);

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const myProfile = await authApi("/api/participants/me", { method: "GET" });
      setProfile(myProfile);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [authApi]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function handleRefreshSession() {
    setMessage("");
    setError("");

    try {
      await refreshSession();
      await refreshMe();
      await loadPage();
      setMessage("Сесію оновлено.");
    } catch (refreshError) {
      setError(refreshError.message);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/site/auth/login", { replace: true });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <h1 className="panel-title">Мій обліковий запис</h1>

        {isLoading ? <p>Завантаження профілю...</p> : null}

        {!isLoading && profile ? (
          <div className="plain-list">
            <p>
              <strong>Ідентифікатор користувача:</strong> {me?.userId}
            </p>
            <p>
              <strong>Код користувача:</strong> {me?.userCode || profile.code}
            </p>
            <p>
              <strong>Ролі:</strong>{" "}
              {(me?.roles || []).map((role) => formatRoleLabel(role)).join(", ") || formatRoleLabel(profile.role)}
            </p>
            <p>
              <strong>ПІБ:</strong> {profile.fullName}
            </p>
            <p>
              <strong>Електронна пошта:</strong> {profile.email}
            </p>
            <p>
              <strong>Роль профілю:</strong> {formatRoleLabel(profile.role)}
            </p>
          </div>
        ) : null}

        <div className="toolbar">
          <button type="button" className="button button-primary" onClick={handleRefreshSession}>
            Оновити сесію
          </button>
          <button type="button" className="button button-soft" onClick={handleLogout}>
            Вийти
          </button>
          <Link to={myPublicLink} className="button button-soft">
            Відкрити публічний профіль
          </Link>
          {isAdmin ? (
            <Link to="/site/admin" className="button button-soft">
              Перейти до панелі адміністрування
            </Link>
          ) : null}
        </div>

        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}
      </section>
    </div>
  );
}
