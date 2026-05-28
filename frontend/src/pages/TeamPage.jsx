export default function TeamPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <p className="hero-kicker">Центр підтримки</p>
          <h1 className="hero-title">Центр підтримки користувачів</h1>
          <p className="hero-text">
            Тут зібрані контакти, канали зворотного зв&apos;язку та короткі рекомендації для початку роботи з платформою.
          </p>
        </div>
      </section>

      <section className="support-grid">
        <article className="panel home-info-card">
          <p className="hero-kicker">Порядок дій</p>
          <h2 className="panel-title">Порядок отримання допомоги</h2>
          <ul className="benefit-list">
            <li>З питань щодо доступу до облікового запису звертайтеся до деканату або адміністратора курсу.</li>
            <li>Якщо не відображаються оцінки, перевірте дедлайн проєкту та вашу роль у команді.</li>
            <li>Якщо знайшли помилку в даних профілю, надішліть короткий опис і код учасника.</li>
            <li>Питання щодо модерації заявок обробляються в робочий час факультету.</li>
          </ul>
        </article>

        <article className="panel home-info-card">
          <p className="hero-kicker">Перед зверненням</p>
          <h2 className="panel-title">Що підготувати перед зверненням</h2>
          <p className="muted">
            Щоб звернення було опрацьовано оперативніше, додайте до нього <strong>код учасника</strong>,{" "}
            <strong>назву проєкту</strong> та короткий опис ситуації із зазначенням дати її виникнення.
          </p>
        </article>
      </section>
    </div>
  );
}

