import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const KPI_CARDS = [
  {
    key: "completedProjects",
    label: "Завершені проєкти",
    helper: "Архів командних робіт",
    icon: "project",
  },
  {
    key: "pendingProjectRequests",
    label: "Заявки на розгляді",
    helper: "Очікують рішення",
    icon: "queue",
  },
  {
    key: "studentsCount",
    label: "Студенти",
    helper: "Активні профілі",
    icon: "students",
  },
  {
    key: "teachersCount",
    label: "Викладачі",
    helper: "Ментори й адміністратори",
    icon: "teachers",
  },
];

const FEATURE_CARDS = [
  {
    index: "01",
    to: "/site/projects/completed",
    title: "Проєктний контекст",
    text: "Переглядайте завершені проєкти, склад команди й терміни, у які можна залишати оцінювання.",
    icon: "layers",
  },
  {
    index: "02",
    to: "/site/projects/reviews",
    title: "Розумне оцінювання",
    text: "Публікуйте відгуки за категоріями та керуйте впливом оцінок у межах доступного ліміту.",
    icon: "spark",
  },
  {
    index: "03",
    to: "/site/participants/students/profile",
    title: "Профілі студентів",
    text: "Порівнюйте динаміку категорій, середні бали та внесок студентів у командні результати.",
    icon: "profile",
  },
  {
    index: "04",
    to: "/site/participants/teachers/profile",
    title: "Профілі викладачів",
    text: "Оцінюйте менторський внесок викладачів за відгуками і структурою категорій.",
    icon: "mentor",
  },
];

export default function HomePage() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadHomeStats = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await api("/api/site/home", { method: "GET" });
      setStats(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        setError("");
        const data = await api("/api/site/home", { method: "GET" });
        if (active) {
          setStats(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <div className="page-stack home-page">
      <section className="hero home-hero">
        <div className="hero-content">
          <p className="hero-kicker">Платформа КНУ</p>
          <h1 className="hero-title">Репутація, проєкти й оцінювання в одному академічному просторі</h1>
          <p className="hero-text">
            KNU Rating допомагає студентам, викладачам і адміністраторам бачити реальний внесок у командну роботу,
            приймати прозорі рішення та підтримувати культуру якісного фідбеку.
          </p>
          <div className="hero-actions">
            <Link to="/site/projects/completed" className="button button-primary">
              Переглянути проєкти
            </Link>
            <Link to="/site/projects/reviews" className="button button-soft">
              Залишити відгук
            </Link>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="Огляд платформи">
          <div className="hero-dashboard-head">
            <span>Огляд платформи</span>
            <span className="status-pill status-pill-active">Активно</span>
          </div>
          <div className="hero-dashboard-grid">
            <article>
              <span>Рейтинг</span>
              <strong>98.4</strong>
            </article>
            <article>
              <span>Верифікація</span>
              <strong>86%</strong>
            </article>
          </div>
          <div className="hero-progress">
            <span />
          </div>
          <div className="hero-feed">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {error ? (
        <section className="home-error-alert" role="alert">
          <span className="alert-icon" aria-hidden="true" />
          <div>
            <h2>Не вдалося завантажити дані</h2>
            <p>Спробуйте оновити сторінку або повторити запит пізніше.</p>
            <span className="alert-details">{error}</span>
          </div>
          <button type="button" className="button button-soft" onClick={loadHomeStats}>
            Спробувати ще раз
          </button>
        </section>
      ) : null}

      <section className="stats-grid home-stats">
        {KPI_CARDS.map((card) => (
          <article key={card.key} className="stat-card home-kpi-card">
            <span className={`kpi-icon kpi-icon-${card.icon}`} aria-hidden="true" />
            <span className="stat-label">{card.label}</span>
            {isLoading && !stats ? (
              <span className="skeleton-value" aria-label="Завантаження" />
            ) : (
              <strong className="stat-value">{stats ? stats[card.key] : 0}</strong>
            )}
            <span className="stat-helper">{card.helper}</span>
          </article>
        ))}
      </section>

      <section className="card-grid home-feature-grid">
        {FEATURE_CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="feature-card home-feature-card">
            <div className="feature-card-head">
              <span className={`feature-icon feature-icon-${card.icon}`} aria-hidden="true" />
              <span className="feature-index">{card.index}</span>
            </div>
            <div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="home-bottom-grid home-bottom-grid-single">
        <article className="panel home-info-card">
          <p className="hero-kicker">Переваги</p>
          <h2 className="panel-title">Побудовано для прозорої академічної взаємодії</h2>
          <ul className="benefit-list">
            <li>Єдина навігація між заявками, командами, профілями та правилами</li>
            <li>Швидкий доступ до оцінювання</li>
            <li>Зрозуміла структура для студентів і викладачів</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
