const express = require("express");
const { handleGatewayMessage } = require("../controllers/gateway.controller");

const router = express.Router();

router.post("/message", handleGatewayMessage);

module.exports = router;