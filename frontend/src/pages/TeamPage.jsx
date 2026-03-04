export default function TeamPage() {
  return (
    <div className="page-stack">
      <section className="hero hero-short">
        <p className="hero-kicker">Підтримка</p>
        <h1 className="hero-title">Центр підтримки користувачів</h1>
        <p className="hero-text">
          Тут зібрані контакти, канали зворотного зв'язку та короткі підказки для швидкого старту роботи з платформою.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-title">Як швидко отримати допомогу</h2>
        <ul className="plain-list">
          <li>Для питань по доступу до акаунта звертайтеся до деканату або адміністратора курсу.</li>
          <li>Якщо не відображаються оцінки, перевірте дедлайн проєкту та вашу роль у команді.</li>
          <li>Якщо знайшли помилку в даних профілю, надішліть короткий опис і код учасника.</li>
          <li>Питання щодо модерації заявок обробляються в робочий час факультету.</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-title">Що підготувати перед зверненням</h2>
        <p>
          Щоб підтримка відповіла швидше, додайте до звернення <strong>код учасника</strong>, <strong>назву проєкту</strong>
          та короткий опис ситуації з датою, коли вона виникла.
        </p>
      </section>
    </div>
  );
}

