export default function RulesPage() {
  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Правила</p>
        <h1 className="hero-title">Правила оцінювання та роботи з відгуками</h1>
      </section>

      <section className="panel">
        <h2 className="panel-title">Коли можна оцінювати</h2>
        <ul className="plain-list">
          <li>Оцінювання доступне лише для завершених проєктів.</li>
          <li>Після дедлайну вікно відгуків автоматично закривається.</li>
          <li>Самооцінювання недоступне: можна оцінювати тільки інших учасників своєї команди.</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-title">Хто кого може оцінювати</h2>
        <ul className="plain-list">
          <li>Студент {"->"} студент.</li>
          <li>Викладач {"->"} студент.</li>
          <li>Студент {"->"} викладач.</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-title">Категорії та ліміти</h2>
        <ul className="plain-list">
          <li>Технічні категорії доступні студентам і викладачам, але з різними лімітами.</li>
          <li>Суб'єктивні категорії мають спільний бюджет: не більше 5 балів у межах проєкту для однієї пари учасників.</li>
          <li>Кожна оцінка впливає на публічний профіль із розподілом на підтверджені та непідтверджені категорії.</li>
        </ul>
      </section>
    </div>
  );
}

