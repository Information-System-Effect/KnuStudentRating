/**
 * @module GatewayRoutes
 * @description Визначає HTTP-маршрути для обробки внутрішніх текстових запитів.
 * Зв'язує endpoint (POST /message) з відповідним методом контролера шлюзу.
 */

/**
 * Маршрути шлюзу для обробки внутрішніх текстових запитів.
 *
 * Призначення файлу:
 * - створити окремий router для gateway-маршрутів;
 * - прив’язати HTTP endpoint до відповідного controller;
 * - відокремити опис маршрутів від бізнес-логіки обробки запиту.
 */

const express = require("express");
const { handleGatewayMessage } = require("../controllers/gateway.controller");

/**
 * Екземпляр маршрутизатора Express для gateway-модуля.
 * Через нього описуються всі маршрути, що належать до шлюзу.
 */
const router = express.Router();

/**
 * POST /message
 *
 * Основний маршрут для приймання текстових повідомлень внутрішнього протоколу.
 *
 * Через цей endpoint клієнт надсилає text/plain-запит,
 * який далі передається в handleGatewayMessage, де виконується:
 * - парсинг;
 * - базова валідація;
 * - визначення шаблону;
 * - шаблонна валідація;
 * - перевірка прав доступу;
 * - пересилання на backend.
 */
router.post("/message", handleGatewayMessage);

/**
 * Експортується router gateway-модуля для підключення
 * в основний застосунок Express.
 */
module.exports = router;