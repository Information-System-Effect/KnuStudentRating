import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await api("/api/site/home", { method: "GET" });
        if (active) {
          setStats(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="hero-kicker">Платформа КНУ</p>
        <h1 className="hero-title">Єдиний простір проєктної репутації</h1>
        <p className="hero-text">
          Відстежуйте результати командної роботи, залишайте оцінювання за проєктами та формуйте прозорий
          академічний рейтинг, який бачать студенти, викладачі та керівники.
        </p>
      </section>

      {error ? <div className="message message-error">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Завершені проєкти</span>
          <strong className="stat-value">{stats ? stats.completedProjects : "..."}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Заявки на розгляді</span>
          <strong className="stat-value">{stats ? stats.pendingProjectRequests : "..."}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Студенти</span>
          <strong className="stat-value">{stats ? stats.studentsCount : "..."}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Викладачі</span>
          <strong className="stat-value">{stats ? stats.teachersCount : "..."}</strong>
        </article>
      </section>

      <section className="card-grid">
        <Link to="/site/projects/completed" className="feature-card">
          <h3>Проєкти</h3>
          <p>Переглядайте завершені проєкти, склад команди й терміни, у які можна залишати оцінювання.</p>
        </Link>
        <Link to="/site/projects/reviews" className="feature-card">
          <h3>Відгуки про проєкти</h3>
          <p>Публікуйте відгуки за категоріями та керуйте впливом оцінок у межах доступного ліміту.</p>
        </Link>
        <Link to="/site/participants/students/profile" className="feature-card">
          <h3>Профілі студентів</h3>
          <p>Порівнюйте динаміку категорій, середні бали та внесок студентів у командні результати.</p>
        </Link>
        <Link to="/site/participants/teachers/profile" className="feature-card">
          <h3>Профілі викладачів</h3>
          <p>Оцінюйте менторський внесок викладачів за відгуками і структурою категорій.</p>
        </Link>
      </section>

      <section className="panel split-two">
        <article>
          <h2 className="panel-title">Підтримка</h2>
          <p>Електронна пошта: {stats?.contactEmail || "support@knu-rating.ua"}</p>
          <p>Телеграм: {stats?.contactTelegram || "@knu_rating_support"}</p>
        </article>
        <article>
          <h2 className="panel-title">Ключові сторінки</h2>
          <div className="chip-row">
            <Link to="/site/projects/requests" className="chip-link">
              Заявки
            </Link>
            <Link to="/site/auth/profile" className="chip-link">
              Обліковий запис
            </Link>
            <Link to="/site/projects/rules" className="chip-link">
              Правила
            </Link>
            <Link to="/site/team" className="chip-link">
              Підтримка
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}


