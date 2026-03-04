const express = require("express");
const gatewayRoutes = require("./routes/gateway.routes");
const { handleProxyRequest } = require("./controllers/proxy.controller");

const app = express();

app.use("/gateway", express.text({ type: "text/plain", limit: "10kb" }));
app.use("/gateway", gatewayRoutes);

app.use(handleProxyRequest);

module.exports = app;
