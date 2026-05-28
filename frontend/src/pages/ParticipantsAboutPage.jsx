export default function ParticipantsAboutPage({ audience }) {
  const isStudents = audience === "students";

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Огляд аудиторії</p>
          <h1 className="hero-title">{isStudents ? "Студенти" : "Викладачі"}</h1>
          <p className="hero-text">
            {isStudents
              ? "Профілі студентів відображають командну активність, внесок у проєкти та зміну категорійних балів."
              : "Профілі викладачів показують менторський вплив, якість відгуків та верифікацію категорій."}
          </p>
        </div>
      </section>

      <section className="info-card-grid">
        {[
          "Публічні поля профілю та короткий опис.",
          "Поточні категорійні бали зі статусом верифікації.",
          "Історія відгуків, прив'язана до конкретних проєктів.",
          "Візуальний розподіл балів на графіках.",
        ].map((item, index) => (
          <article key={item} className="panel info-step-card">
            <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="panel-title">{index === 0 ? "Що відображається" : "Дані профілю"}</h2>
            <p className="muted">{item}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
