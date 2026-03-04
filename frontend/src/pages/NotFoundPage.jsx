import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="panel">
      <h1 className="panel-title">Сторінку не знайдено</h1>
      <p>Посилання застаріло або сторінку було переміщено.</p>
      <Link to="/" className="button button-primary inline-action">
        Повернутися на головну
      </Link>
    </section>
  );
}
