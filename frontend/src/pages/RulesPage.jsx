export default function RulesPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Правила платформи</p>
          <h1 className="hero-title">Правила оцінювання та роботи з відгуками</h1>
          <p className="hero-text">Коротка, структурована логіка доступу до оцінювання, ролей і категорійних лімітів.</p>
        </div>
      </section>

      <section className="info-card-grid">
        <article className="panel info-step-card">
          <span className="feature-index">01</span>
          <h2 className="panel-title">Коли можна оцінювати</h2>
          <ul className="benefit-list">
            <li>Оцінювання доступне лише для завершених проєктів.</li>
            <li>Після дедлайну вікно відгуків автоматично закривається.</li>
            <li>Самооцінювання недоступне: можна оцінювати тільки інших учасників своєї команди.</li>
          </ul>
        </article>

        <article className="panel info-step-card">
          <span className="feature-index">02</span>
          <h2 className="panel-title">Хто кого може оцінювати</h2>
          <div className="rule-flow">
            <span>Студент → студент</span>
            <span>Викладач → студент</span>
            <span>Студент → викладач</span>
          </div>
        </article>

        <article className="panel info-step-card">
          <span className="feature-index">03</span>
          <h2 className="panel-title">Категорії та ліміти</h2>
          <ul className="benefit-list">
            <li>Технічні категорії доступні студентам і викладачам, але з різними лімітами.</li>
            <li>Суб'єктивні категорії мають спільний бюджет: не більше 5 балів у межах проєкту для однієї пари учасників.</li>
            <li>Кожна оцінка впливає на публічний профіль із розподілом на підтверджені та непідтверджені категорії.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

