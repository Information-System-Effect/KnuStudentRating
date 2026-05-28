import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="not-found-shell">
      <div className="panel not-found-card">
        <p className="hero-kicker">404</p>
        <h1 className="panel-title">Сторінку не знайдено</h1>
        <p className="muted">Посилання застаріло або сторінку було переміщено.</p>
        <Link to="/" className="button button-primary inline-action">
          Повернутися на головну
        </Link>
      </div>
    </section>
  );
}
