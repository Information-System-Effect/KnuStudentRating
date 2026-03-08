export default function TeamPage() {
  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Підтримка</p>
        <h1 className="hero-title">Центр підтримки користувачів</h1>
        <p className="hero-text">
          Тут зібрані контакти, канали зворотного зв&apos;язку та короткі рекомендації для початку роботи з платформою.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-title">Порядок отримання допомоги</h2>
        <ul className="plain-list">
          <li>З питань щодо доступу до облікового запису звертайтеся до деканату або адміністратора курсу.</li>
          <li>Якщо не відображаються оцінки, перевірте дедлайн проєкту та вашу роль у команді.</li>
          <li>Якщо знайшли помилку в даних профілю, надішліть короткий опис і код учасника.</li>
          <li>Питання щодо модерації заявок обробляються в робочий час факультету.</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-title">Що підготувати перед зверненням</h2>
        <p>
          Щоб звернення було опрацьовано оперативніше, додайте до нього <strong>код учасника</strong>,{" "}
          <strong>назву проєкту</strong> та короткий опис ситуації із зазначенням дати її виникнення.
        </p>
      </section>
    </div>
  );
}

