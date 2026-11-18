/**
 * Gera os ícones do app (nativo + PWA) a partir de um SVG da marca.
 * Uso (dev): node scripts/make-icons.cjs   — requer Playwright/Chromium instalados.
 * Os PNGs gerados ficam versionados em assets/ e public/; não roda no build.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");

/** Ícone: gradiente de ponta a ponta (o iOS aplica a máscara arredondada), dois balões de fala e uma onda de voz. */
function svg({ size, pad = 0, transparent = false, bgOnly = false }) {
  const s = 1024;
  const inner = s - pad * 2;
  const k = inner / s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5B4BE0"/><stop offset="0.55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#EC4899"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.15" r="0.8">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DE1C2"/><stop offset="1" stop-color="#14B8A6"/></linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#2A0E5C" flood-opacity="0.35"/></filter>
  </defs>
  ${transparent ? "" : `<rect width="${s}" height="${s}" fill="url(#bg)"/><rect width="${s}" height="${s}" fill="url(#glow)"/>`}
  ${bgOnly ? "" : `<g transform="translate(${pad} ${pad}) scale(${k})">
    <g filter="url(#sh)">
      <path d="M520 430 h250 a90 90 0 0 1 90 90 v120 a90 90 0 0 1 -90 90 h-20 l10 80 l-95 -80 h-145 a90 90 0 0 1 -90 -90 v-120 a90 90 0 0 1 90 -90z" fill="url(#teal)"/>
      <path d="M260 250 h380 a110 110 0 0 1 110 110 v170 a110 110 0 0 1 -110 110 h-250 l-130 105 l20 -105 h-20 a110 110 0 0 1 -110 -110 v-170 a110 110 0 0 1 110 -110z" fill="#FFFFFF"/>
    </g>
    <g fill="#6D4AFF">
      <rect x="296" y="400" width="44" height="90" rx="22"/>
      <rect x="370" y="345" width="44" height="200" rx="22"/>
      <rect x="444" y="380" width="44" height="130" rx="22"/>
      <rect x="518" y="320" width="44" height="250" rx="22"/>
      <rect x="592" y="395" width="44" height="100" rx="22"/>
    </g>
  </g>`}
</svg>`;
}

const TARGETS = [
  ["assets/icon.png", 1024, {}],
  ["assets/splash-icon.png", 1024, {}],
  ["assets/favicon.png", 48, {}],
  ["assets/android-icon-foreground.png", 1024, { pad: 170, transparent: true }],
  ["assets/android-icon-background.png", 1024, { bgOnly: true }],
  ["public/icons/icon-192.png", 192, {}],
  ["public/icons/icon-512.png", 512, {}],
  ["public/icons/maskable-512.png", 512, { pad: 110 }],
  ["public/icons/apple-touch-icon.png", 180, {}],
  ["public/favicon.png", 64, {}],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [rel, size, opts] of TARGETS) {
    const out = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg({ size, ...opts })}</body></html>`);
    await page.locator("svg").screenshot({ path: out, omitBackground: !!opts.transparent });
    console.log("ícone", rel, size);
  }
  fs.writeFileSync(path.join(ROOT, "public/icons/icon.svg"), svg({ size: 1024 }));
  await browser.close();
})();
