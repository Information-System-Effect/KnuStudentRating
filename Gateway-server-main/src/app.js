/**
 * @module AppConfig
 * @description Файл конфігурації Express-застосунку.
 * Налаштовує middleware для обробки текстових запитів (text/plain) 
 * та підключає маршрути для внутрішнього протоколу і proxy-переадресації.
 */

/**
 * Головний файл конфігурації Express-застосунку шлюзу.
 *
 * Призначення:
 * - створити екземпляр Express;
 * - підключити маршрути gateway для обробки внутрішнього текстового протоколу;
 * - підключити proxy-контролер для пересилання звичайних HTTP-запитів на backend;
 * - визначити порядок обробки запитів у межах шлюзу.
 */

const express = require("express");
const gatewayRoutes = require("./routes/gateway.routes");
const { handleProxyRequest } = require("./controllers/proxy.controller");

const cors = require("cors");

/**
 * Екземпляр Express-застосунку.
 * Через нього підключаються всі middleware, маршрути та контролери шлюзу.
 */
const app = express();

app.use(cors());
/**
 * Підключення middleware для маршруту /gateway.
 *
 * На цьому шляху шлюз очікує text/plain-запити,
 * які відповідають внутрішньому текстовому протоколу.
 *
 * Налаштування:
 * - type: "text/plain" — приймаються лише текстові повідомлення;
 * - limit: "10kb" — обмежується максимальний розмір body.
 *
 * Це необхідно для подальшого коректного парсингу gateway-повідомлень.
 */
app.use("/gateway", express.text({ type: "text/plain", limit: "10kb" }));

/**
 * Підключення маршрутів gateway.
 *
 * Усі запити, що надходять на /gateway,
 * передаються у файл gateway.routes, де вже описані конкретні endpoint-и,
 * наприклад POST /gateway/message.
 */
app.use("/gateway", gatewayRoutes);

/**
 * Підключення proxy-контролера як універсального обробника
 * для решти HTTP-запитів.
 *
 * Логіка:
 * - якщо запит не належить до /gateway,
 *   він може бути перевірений і пересланий на backend через proxy;
 * - рішення про це приймає handleProxyRequest.
 *
 * Таким чином:
 * - /gateway/* обробляється власним внутрішнім протоколом;
 * - інші маршрути можуть працювати як reverse proxy до backend.
 */
app.use(handleProxyRequest);

/**
 * Експортується налаштований Express-застосунок,
 * який використовується у файлі запуску сервера.
 */
module.exports = app;