export default function ParticipantsAboutPage({ audience }) {
  const isStudents = audience === "students";

  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Аудиторія</p>
        <h1 className="hero-title">{isStudents ? "Студенти" : "Викладачі та аспіранти"}</h1>
        <p className="hero-text">
          {isStudents
            ? "Профілі студентів відображають командну активність, внесок у проєкти та зміну категорійних балів."
            : "Профілі викладачів і аспірантів показують менторський вплив, якість відгуків та верифікацію категорій."}
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-title">Що відображається</h2>
        <ul className="plain-list">
          <li>Публічні поля профілю та короткий опис.</li>
          <li>Поточні категорійні бали зі статусом верифікації.</li>
          <li>Історія відгуків, прив'язана до конкретних проєктів.</li>
          <li>Візуальний розподіл балів на графіках.</li>
        </ul>
      </section>
    </div>
  );
}
