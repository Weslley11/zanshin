/**
 * Pós-processa `expo export --platform web` (pasta dist/) para virar um PWA instalável:
 * - injeta no index.html as metatags do iOS ("Adicionar à Tela de Início"), manifest e ícones;
 * - gera um service worker que guarda o app inteiro em cache (funciona offline);
 * - cria 404.html (rotas profundas no GitHub Pages) e .nojekyll.
 * Uso: FLUENT_BASE_URL=/zanshin node scripts/build-pwa.mjs  (o mesmo valor usado no export)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.FLUENT_BASE_URL || "").replace(/\/$/, "");
const SKIP = new Set(["sw.js", "404.html", "metadata.json", ".nojekyll"]);

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html não encontrado. Rode antes: npx expo export --platform web");
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

// 1) index.html
const indexPath = path.join(DIST, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes('rel="manifest"')) {
  html = html.replace(/<html lang="[^"]*">/, '<html lang="pt-BR">');
  html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
  const head = `
    <meta name="description" content="Fluent AI: treine conversação, compreensão, vocabulário e pronúncia com um plano de 90 dias. Funciona offline." />
    <meta name="theme-color" content="#F4F3FA" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0B0A14" media="(prefers-color-scheme: dark)" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Fluent AI" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="${BASE}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${BASE}/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="${BASE}/favicon.png" />
    <style id="pwa-base">
      html, body { background: #F4F3FA; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
      @media (prefers-color-scheme: dark) { html, body { background: #0B0A14; } }
    </style>
    <script>
      (function () {
        if (!("serviceWorker" in navigator)) return;
        var hadController = !!navigator.serviceWorker.controller, reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (!hadController || reloading) return; // primeira instalação: nada a recarregar
          reloading = true; location.reload();      // nova versão publicada: recarrega uma vez
        });
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("${BASE}/sw.js", { scope: "${BASE}/" }).catch(function () {});
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        });
      })();
    </script>
`;
  html = html.replace("</head>", `${head}  </head>`);
  fs.writeFileSync(indexPath, html);
}

// 2) 404.html (GitHub Pages devolve este arquivo para rotas como /zanshin/plan) e .nojekyll
fs.copyFileSync(indexPath, path.join(DIST, "404.html"));
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

// 3) service worker com precache versionado pelo conteúdo
const files = walk(DIST)
  .map((f) => path.relative(DIST, f).split(path.sep).join("/"))
  .filter((rel) => !SKIP.has(rel))
  .sort();
const hash = crypto.createHash("sha256");
for (const rel of files) hash.update(rel).update(fs.readFileSync(path.join(DIST, rel)));
const version = hash.digest("hex").slice(0, 12);
const precache = [`${BASE}/`, ...files.filter((f) => f !== "index.html").map((f) => `${BASE}/${f}`)];

const sw = `/* Gerado por scripts/build-pwa.mjs — não editar. */
const VERSION = ${JSON.stringify(version)};
const BASE = ${JSON.stringify(BASE)};
const CACHE = "fluent-" + VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 0)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fluent-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE + "/")) return;

  if (req.mode === "navigate") {
    // Página: tenta a rede (para receber atualizações) e cai para o cache se estiver offline ou lenta.
    event.respondWith(
      withTimeout(fetch(req), 3500)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(BASE + "/", copy));
            return res;
          }
          return caches.match(BASE + "/").then((hit) => hit || res);
        })
        .catch(() => caches.match(BASE + "/")),
    );
    return;
  }

  // Arquivos estáticos (nomes com hash): cache primeiro.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
`;
fs.writeFileSync(path.join(DIST, "sw.js"), sw);
console.log(`PWA pronto: ${files.length} arquivos em cache, versão ${version}, base "${BASE || "/"}"`);
