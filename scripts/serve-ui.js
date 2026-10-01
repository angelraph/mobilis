"use strict";

/*
 * Serves the Mobilis interface (ui/) and forwards ledger calls to the
 * Canton 3.x JSON Ledger API, all on one origin, so the browser needs no
 * CORS setup. (Canton 2.x's JSON API could host static files itself; the
 * 3.x one can't.)
 *
 *   /ui/*                -> files from ui/
 *   /v2/*, /livez, /docs -> the JSON Ledger API (JSON_API, default http://127.0.0.1:7576)
 *   /                    -> redirects to /ui/home.html
 *
 *   PORT=7575 HOST=127.0.0.1 JSON_API=http://127.0.0.1:7576 node scripts/serve-ui.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "7575", 10);
const HOST = process.env.HOST || "127.0.0.1";
const JSON_API = new URL(process.env.JSON_API || "http://127.0.0.1:7576");
const UI_DIR = path.resolve(__dirname, "..", "ui");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/^\/ui\/?/, "")) || "home.html";
  const file = path.resolve(UI_DIR, rel);
  if (!file.startsWith(UI_DIR + path.sep) && file !== UI_DIR) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size });
    fs.createReadStream(file).pipe(res);
  });
}

function proxy(req, res) {
  const upstream = http.request(
    { hostname: JSON_API.hostname, port: JSON_API.port, path: req.url, method: req.method, headers: { ...req.headers, host: JSON_API.host } },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ cause: "The ledger is not reachable yet." }));
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const p = req.url.split("?")[0];
    if (p === "/" || p === "") {
      res.writeHead(302, { Location: "/ui/home.html" }).end();
    } else if (p.startsWith("/ui")) {
      serveStatic(req, res);
    } else if (p.startsWith("/v2/") || p === "/livez" || p === "/readyz" || p.startsWith("/docs")) {
      proxy(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    }
  })
  .listen(PORT, HOST, () => console.log(`Mobilis UI on http://${HOST}:${PORT}/ui/ (ledger API ${JSON_API.href})`));
