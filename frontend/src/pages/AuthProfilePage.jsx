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
    <div className="page-stack account-page">
      <section className="page-hero account-hero">
        <div>
          <p className="hero-kicker">Центр облікового запису</p>
          <h1 className="hero-title">Мій обліковий запис</h1>
          <p className="hero-text">Контроль сесії, ролей і швидкий перехід до публічного профілю учасника.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button button-primary" onClick={handleRefreshSession}>
            Оновити сесію
          </button>
          <Link to={myPublicLink} className="button button-soft">
            Публічний профіль
          </Link>
        </div>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{error}</span>
          </div>
          <button type="button" className="button button-soft" onClick={loadPage}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      <section className="account-grid">
        <article className="panel account-card">
          {isLoading ? <div className="empty-state">Завантаження профілю...</div> : null}

          {!isLoading && profile ? (
            <>
              <div className="account-avatar">{(me?.userCode || profile.code || "U").slice(0, 2).toUpperCase()}</div>
              <h2>{profile.fullName}</h2>
              <p className="muted">{profile.email}</p>
              <div className="chip-row">
                <span className="status-pill status-pill-active">{formatRoleLabel(profile.role)}</span>
                {(me?.roles || []).map((role) => (
                  <span key={role} className="category-pill">
                    {formatRoleLabel(role)}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </article>

        <article className="panel detail-matrix">
          <h2 className="panel-title">Дані доступу</h2>
          <div className="detail-grid">
            <div>
              <span>Ідентифікатор</span>
              <strong>{me?.userId || "-"}</strong>
            </div>
            <div>
              <span>Код користувача</span>
              <strong>{me?.userCode || profile?.code || "-"}</strong>
            </div>
            <div>
              <span>Роль профілю</span>
              <strong>{profile ? formatRoleLabel(profile.role) : "-"}</strong>
            </div>
            <div>
              <span>Доступ</span>
              <strong>{isAdmin ? "Адміністратор" : "Користувач"}</strong>
            </div>
          </div>
        </article>

        <aside className="panel action-panel">
          <h2 className="panel-title">Швидкі дії</h2>
          <div className="button-list">
            {isAdmin ? (
              <Link to="/site/admin" className="button button-primary">
                Панель адміністрування
              </Link>
            ) : null}
            <Link to="/site/projects/requests" className="button button-soft">
              Заявки на проєкти
            </Link>
            <Link to="/site/projects/reviews" className="button button-soft">
              Оцінювання
            </Link>
            <button type="button" className="button button-danger" onClick={handleLogout}>
              Вийти
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
