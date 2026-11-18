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
let manifestLoaded = false;
let manifestPromise: Promise<void> | null = null;
export function loadAudioManifest(): Promise<void> {
  if (!IS_WEB) return Promise.resolve();
  manifestPromise ??= fetch(`${BASE}/audio/index.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : { clips: {} }))
    .then((m) => { clips = m.clips ?? {}; manifestLoaded = true; })
    .catch(() => { manifestLoaded = true; });
  return manifestPromise;
}
export const recordedCount = () => Object.keys(clips).length;
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
export function playRecorded(text: string, rate: number, onDone: () => void, onFail: () => void): boolean {
  if (!manifestLoaded) return false;
  const file = clips[fnv1a(normalizeKey(text))];
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
