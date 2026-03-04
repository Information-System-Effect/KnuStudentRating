const { proxyToBackend } = require("../services/proxy.service");

const PROXY_PREFIXES = Object.freeze([
  "/api",
  "/site",
  "/assets",
  "/css",
  "/js",
  "/images",
  "/uploads",
  "/swagger-ui",
  "/v3/api-docs",
]);

const EXACT_PROXY_PATHS = new Set(["/", "/swagger-ui.html", "/favicon.ico"]);
const IGNORED_RESPONSE_HEADERS = new Set(["transfer-encoding", "content-length", "set-cookie"]);

function shouldProxy(pathname) {
  if (EXACT_PROXY_PATHS.has(pathname)) {
    return true;
  }
  return PROXY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function handleProxyRequest(req, res) {
  try {
    const pathname = req.path || "/";

    if (!shouldProxy(pathname)) {
      return res.status(404).json({
        ok: false,
        code: 404,
        error: { type: "NOT_FOUND", message: "Route is not handled by gateway" },
      });
    }

    const result = await proxyToBackend(req);

    for (const [name, value] of result.headers.entries()) {
      const lowered = name.toLowerCase();
      if (IGNORED_RESPONSE_HEADERS.has(lowered)) {
        continue;
      }
      res.setHeader(name, value);
    }

    if (Array.isArray(result.setCookies) && result.setCookies.length > 0) {
      res.setHeader("Set-Cookie", result.setCookies);
    }

    return res.status(result.statusCode).send(result.body);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: 502,
      error: {
        type: "BACKEND_UNAVAILABLE",
        message: `Proxy error: ${error.message}`,
      },
    });
  }
}

module.exports = { handleProxyRequest, shouldProxy };
