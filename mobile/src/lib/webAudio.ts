/**
 * Áudio gravado (MP3 gerado no build com voz neural) para a versão web/PWA.
 * No iPhone, tocar um arquivo como mídia é confiável (inclusive no modo silencioso), ao contrário da voz do sistema.
 * Usa um único elemento <audio>, "destravado" no primeiro toque, para poder tocar depois sem novo gesto.
 */

const IS_WEB = typeof document !== "undefined" && typeof window !== "undefined" && typeof window.addEventListener === "function";
const BASE = (process.env.EXPO_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
// MP3 de silêncio mínimo, para destravar o elemento de áudio no primeiro toque
const SILENT = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAACAAAA/oAR0dHR0dHR0dHR0dHYmJiYmJiYmJiYmJifHx8fHx8fHx8fHx8fJaWlpaWlpaWlpaWlrGxsbGxsbGxsbGxsbHLy8vLy8vLy8vLy8vl5eXl5eXl5eXl5eXl////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQC1AAAAAAAAAP6yysejgAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80LEowAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsSjAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";

export function normalizeKey(text: string): string {
  return text.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** FNV-1a de 32 bits sobre UTF-8 (mesma função de scripts/make_audio.py). */
export function fnv1a(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

let clips: Record<string, string> = {};
/** Gravações com sotaque indiano por falante (VCTK: p248 feminina, p251 e p376 masculinas). */
let clipsIn: Record<string, Record<string, string>> = {};
let indianVoice = "";
export const INDIAN_VOICES: { id: string; label: string }[] = [
  { id: "p251", label: "Masculina 1" }, { id: "p376", label: "Masculina 2" }, { id: "p248", label: "Feminina" },
];
export const indianVoicesAvailable = () => INDIAN_VOICES.filter((v) => clipsIn[v.id] && Object.keys(clipsIn[v.id]).length);
export const setIndianVoice = (v: string) => { indianVoice = v; };
export const getIndianVoice = () => indianVoice || indianVoicesAvailable()[0]?.id || "";
function indianFile(key: string): string | undefined {
  const pref = getIndianVoice();
  return clipsIn[pref]?.[key] ?? Object.values(clipsIn).find((m) => m[key])?.[key];
}
let manifestLoaded = false;
let manifestPromise: Promise<void> | null = null;
export function loadAudioManifest(): Promise<void> {
  if (!IS_WEB) return Promise.resolve();
  manifestPromise ??= fetch(`${BASE}/audio/index.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : { clips: {} }))
    .then((m) => {
      clips = m.clips ?? {};
      const raw = m.clips_in ?? {};
      // formato antigo: {chave: arquivo} de um único falante
      clipsIn = Object.values(raw).some((v) => typeof v === "string") ? { in: raw } : raw;
      manifestLoaded = true;
    })
    .catch(() => { manifestLoaded = true; });
  return manifestPromise;
}
export const recordedCount = () => Object.keys(clips).length;
export const recordedIndianCount = () => Math.max(0, ...Object.values(clipsIn).map((m) => Object.keys(m).length));
export const hasRecorded = (text: string) => !!clips[fnv1a(normalizeKey(text))];

let el: HTMLAudioElement | null = null;
function element(): HTMLAudioElement | null {
  if (!IS_WEB) return null;
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    (el as any).playsInline = true;
  }
  return el;
}

let unlocked = false;
export function unlockWebAudio() {
  const a = element();
  if (!a || unlocked) return;
  unlocked = true;
  try {
    a.src = SILENT;
    a.volume = 0;
    a.play().then(() => { a.pause(); a.volume = 1; }).catch(() => { a.volume = 1; });
  } catch {
    /* sem suporte */
  }
}
if (IS_WEB) {
  loadAudioManifest();
  const once = () => {
    unlockWebAudio();
    window.removeEventListener("touchend", once, true);
    window.removeEventListener("click", once, true);
  };
  window.addEventListener("touchend", once, true);
  window.addEventListener("click", once, true);
}

let seq = 0;
export function stopRecorded() {
  seq++;
  if (el && !el.paused) el.pause();
}

/**
 * Toca a gravação da frase, se existir. Retorna false se não houver gravação (o chamador usa a voz do aparelho).
 * onFail: a gravação existe mas não tocou (bloqueio do navegador/erro de rede) — o chamador pode tentar a voz do aparelho.
 */
export function playRecorded(text: string, rate: number, onDone: () => void, onFail: () => void, accent?: string | null): boolean {
  if (!manifestLoaded) return false;
  const key = fnv1a(normalizeKey(text));
  // sotaque indiano gravado quando pedido (cai para a gravação padrão se não houver)
  const file = (accent === "IN" && indianFile(key)) || clips[key];
  const a = element();
  if (!file || !a) return false;
  const my = ++seq;
  a.pause();
  a.src = `${BASE}/audio/${file}`;
  a.volume = 1;
  a.playbackRate = Math.max(0.5, Math.min(rate, 1.5));
  (a as any).preservesPitch = true;
  a.onended = () => { if (my === seq) onDone(); };
  a.onerror = () => { if (my === seq) onFail(); };
  a.play().catch(() => { if (my === seq) onFail(); });
  return true;
}

/** Baixa antes (e deixa no cache do app) os áudios das próximas frases, para o "Ouvir" tocar sem espera. */
export async function prefetchRecorded(texts: string[], accent?: string | null) {
  if (!IS_WEB) return;
  await loadAudioManifest();
  const files = new Set<string>();
  for (const t of texts) {
    const key = fnv1a(normalizeKey(t));
    const f = (accent === "IN" && indianFile(key)) || clips[key];
    if (f) files.add(f);
  }
  for (const f of [...files].slice(0, 80)) fetch(`${BASE}/audio/${f}`).catch(() => {});
}
