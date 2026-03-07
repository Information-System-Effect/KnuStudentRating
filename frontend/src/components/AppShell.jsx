import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function navClassName({ isActive }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

export default function AppShell() {
  const { isAuthenticated, isBootstrapping, hasRole, logout, session } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAuthenticated && hasRole("ADMIN");

  async function handleLogout() {
    await logout();
    navigate("/site/auth/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar-wrap">
        <div className="topbar container">
          <div className="brand-zone">
            <Link to="/" className="brand-link">
              Рейтинг студентів КНУ
            </Link>
            <p className="brand-meta">Офіційна платформа взаємооцінювання КНУ</p>
          </div>

          <nav className="nav-stack" aria-label="Головна навігація">
            <div className="nav-row">
              <NavLink to="/" end className={navClassName}>
                Головна
              </NavLink>
              <NavLink to="/site/projects/completed" className={navClassName}>
                Проєкти
              </NavLink>
              <NavLink to="/site/projects/requests" className={navClassName}>
                Заявки
              </NavLink>
              <NavLink to="/site/projects/reviews" className={navClassName}>
                Відгуки
              </NavLink>
            </div>
            <div className="nav-row">
              <NavLink to="/site/participants/students/profile" className={navClassName}>
                Студенти
              </NavLink>
              <NavLink to="/site/participants/teachers/profile" className={navClassName}>
                Викладачі
              </NavLink>
              {isAdmin ? (
                <NavLink to="/site/admin" className={navClassName}>
                  Адмінка
                </NavLink>
              ) : null}
              <NavLink to="/site/team" className={navClassName}>
                Підтримка
              </NavLink>
              <NavLink to="/site/projects/rules" className={navClassName}>
                Правила
              </NavLink>
            </div>
          </nav>

          <div className="auth-zone">
            {isAuthenticated ? (
              <>
                <NavLink to="/site/auth/profile" className={navClassName}>
                  {session.userCode || "Профіль"}
                </NavLink>
                <button type="button" className="nav-btn" onClick={handleLogout}>
                  Вийти
                </button>
              </>
            ) : (
              <>
                <NavLink to="/site/auth/login" className={navClassName}>
                  Увійти
                </NavLink>
                <NavLink to="/site/auth/register" className={navClassName}>
                  Реєстрація
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container main-content">
        {isBootstrapping ? <div className="panel">Перевірка сесії...</div> : <Outlet />}
      </main>

      <footer className="container footer">
        <span>Платформа рейтингу КНУ</span>
        <span>Для студентів, викладачів і адміністраторів</span>
      </footer>
    </div>
  );
}

