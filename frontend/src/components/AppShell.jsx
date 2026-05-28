import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatRoleLabel } from "../lib/format";

const PRIMARY_NAV = [
  { to: "/", label: "Огляд", end: true },
  { to: "/site/projects/completed", label: "Проєкти" },
  { to: "/site/projects/requests", label: "Заявки" },
  { to: "/site/projects/reviews", label: "Оцінювання" },
];

const PEOPLE_NAV = [
  { to: "/site/participants/students/profile", label: "Студенти" },
  { to: "/site/participants/teachers/profile", label: "Викладачі" },
];

const SUPPORT_NAV = [
  { to: "/site/projects/rules", label: "Правила" },
  { to: "/site/team", label: "Підтримка" },
];

function navClassName({ isActive }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

function Brand({ onClick }) {
  return (
    <Link to="/" className="brand-link" onClick={onClick}>
      <span className="brand-mark">К</span>
      <span className="brand-copy">
        <span className="brand-name">KNU Rating</span>
        <span className="brand-meta">Система рейтингів та проєктів</span>
      </span>
    </Link>
  );
}

function NavGroup({ title, items, onNavigate }) {
  return (
    <div className="nav-group">
      <span className="nav-group-title">{title}</span>
      <div className="nav-row">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClassName} onClick={onNavigate}>
            <span className="nav-dot" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function readInitialTheme() {
  const storedTheme = localStorage.getItem("knu.theme");
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Перемкнути тему">
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" />
      </span>
      <span className="theme-toggle-copy">
        <span>{isDark ? "Темна тема" : "Світла тема"}</span>
        <small>{isDark ? "Увімкнено нічний режим" : "Увімкнено світлий режим"}</small>
      </span>
    </button>
  );
}

export default function AppShell() {
  const { isAuthenticated, isBootstrapping, hasRole, logout, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);
  const isAdmin = isAuthenticated && hasRole("ADMIN");
  const roleLabel = isAuthenticated ? formatRoleLabel(session?.role) : "Гість";
  const userCode = session?.userCode || "Обліковий запис";

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    document.body.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("knu.theme", theme);
  }, [theme]);

  async function handleLogout() {
    await logout();
    navigate("/site/auth/login");
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const sidebarContent = (
    <>
      <div className="sidebar-head">
        <Brand onClick={closeMenu} />
        <p>Єдиний простір для проєктів, взаємооцінювання, профілів і ролей КНУ.</p>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <nav className="nav-stack" aria-label="Головна навігація">
        <NavGroup title="Робочий простір" items={PRIMARY_NAV} onNavigate={closeMenu} />
        <NavGroup title="Учасники" items={PEOPLE_NAV} onNavigate={closeMenu} />
        {isAdmin ? (
          <NavGroup title="Керування" items={[{ to: "/site/admin", label: "Адміністрування" }]} onNavigate={closeMenu} />
        ) : null}
        <NavGroup title="Довідка" items={SUPPORT_NAV} onNavigate={closeMenu} />
      </nav>

      <div className="sidebar-footer">
        {isAuthenticated ? (
          <>
            <NavLink to="/site/auth/profile" className="user-card" onClick={closeMenu}>
              <span className="user-avatar">{userCode.slice(0, 2).toUpperCase()}</span>
              <span className="user-copy">
                <span className="user-code">{userCode}</span>
                <span className="user-role">{roleLabel}</span>
              </span>
            </NavLink>
            <button type="button" className="nav-btn" onClick={handleLogout}>
              Вийти
            </button>
          </>
        ) : (
          <div className="sidebar-auth-actions">
            <NavLink to="/site/auth/login" className="button button-soft" onClick={closeMenu}>
              Увійти
            </NavLink>
            <NavLink to="/site/auth/register" className="button button-primary" onClick={closeMenu}>
              Реєстрація
            </NavLink>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar">{sidebarContent}</aside>

      <header className="mobile-topbar">
        <Brand onClick={closeMenu} />
        <button
          type="button"
          className={isMenuOpen ? "mobile-menu-toggle active" : "mobile-menu-toggle"}
          aria-label="Відкрити меню"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {isMenuOpen ? (
        <div className="mobile-drawer">
          <div className="mobile-drawer-panel">{sidebarContent}</div>
        </div>
      ) : null}

      <div className="app-workspace">
        <main className="main-content">
          {isBootstrapping ? <div className="panel loading-panel">Перевірка сесії...</div> : <Outlet />}
        </main>

        <footer className="footer">
          <span>Платформа рейтингу КНУ</span>
          <span>
            {location.pathname === "/"
              ? "Освітня платформа для демо й щоденної роботи"
              : "Студенти, викладачі, адміністратори"}
          </span>
        </footer>
      </div>
    </div>
  );
}
