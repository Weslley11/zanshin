import * as Speech from "expo-speech";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { API_URL, authHeader } from "./api";

/** Locales por idioma/sotaque para a voz do dispositivo (gratuita, funciona offline se a voz estiver instalada). */
export const ACCENT_LOCALES: Record<string, Record<string, string>> = {
  en: { US: "en-US", UK: "en-GB", AU: "en-AU", IN: "en-IN" },
  es: { ES: "es-ES", MX: "es-MX", AR: "es-AR" },
  it: { IT: "it-IT" },
  zh: { CN: "zh-CN" },
  ja: { JP: "ja-JP" },
};

export const ACCENT_LABELS: Record<string, string> = {
  US: "EUA", UK: "Reino Unido", AU: "Austrália", IN: "Índia", ES: "Espanha", MX: "México", AR: "Argentina",
  IT: "Itália", CN: "China", JP: "Japão", "DE-EN": "Alemanha (inglês)", "IT-EN": "Itália (inglês)",
};

let serverVoice = false;
let player: AudioPlayer | null = null;
let activeId = 0; // cada fala recebe um id; parar explicitamente invalida o callback de término

/** Ativado quando o servidor tem TTS neural configurado (vozes com sotaques consistentes entre aparelhos). */
export function setServerVoice(enabled: boolean) {
  serverVoice = enabled;
}

export function localeFor(language: string, accent?: string | null): string {
  const map = ACCENT_LOCALES[language] ?? ACCENT_LOCALES.en;
  // sotaques "de não nativos" (ex.: DE-EN) usam a voz padrão do idioma
  return (accent && map[accent]) || Object.values(map)[0];
}

export function speedToRate(speed: "slow" | "normal" | "fast" | number): number {
  if (typeof speed === "number") return speed;
  return speed === "slow" ? 0.8 : speed === "fast" ? 1.15 : 1.0;
}

export async function stopSpeaking() {
  activeId++;
  await Speech.stop();
  try {
    player?.pause();
  } catch {
    /* player já liberado */
  }
}

export function speak(
  text: string,
  opts: { language?: string; accent?: string | null; rate?: number; onDone?: () => void } = {},
) {
  const { language = "en", accent, rate = 1 } = opts;
  const clean = text.replace(/\([^)]*\)/g, "").trim(); // remove anotações entre parênteses (ex.: "(Unexpected situation)")
  // Garante que onDone seja chamado uma única vez — inclusive se o aparelho não tiver voz instalada
  // e o mecanismo de TTS nunca sinalizar o fim (evita travar drills que esperam a fala terminar).
  let fired = false;
  const myId = ++activeId;
  const words = clean.split(/\s+/).length;
  const safety = setTimeout(() => onDone(), (words * 0.55) / Math.max(rate, 0.5) * 1000 + 2500);
  const onDone = () => {
    if (fired) return;
    fired = true;
    clearTimeout(safety);
    if (myId === activeId) opts.onDone?.();
  };
  if (serverVoice) {
    const qs = new URLSearchParams({ text: clean.slice(0, 500), language, speed: String(rate), ...(accent ? { accent } : {}) });
    try {
      player?.remove();
    } catch {
      /* noop */
    }
    player = createAudioPlayer({ uri: `${API_URL}/api/v1/speech/tts?${qs}`, headers: authHeader() });
    const sub = player.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) {
        sub.remove();
        onDone?.();
      }
    });
    player.play();
    return;
  }
  Speech.stop();
  activeId = myId;
  Speech.speak(clean, { language: localeFor(language, accent), rate, onDone, onStopped: onDone, onError: () => onDone?.() });
}

/** Fala uma sequência de linhas (diálogos de listening) com o sotaque de cada personagem. */
export function speakLines(
  lines: { text: string; accent?: string }[],
  opts: { language?: string; rate?: number; onLine?: (i: number) => void; onDone?: () => void } = {},
) {
  let i = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled) return;
    if (i >= lines.length) {
      opts.onDone?.();
      return;
    }
    opts.onLine?.(i);
    const line = lines[i++];
    speak(line.text, { language: opts.language, accent: line.accent, rate: opts.rate, onDone: () => setTimeout(next, 350) });
  };
  next();
  return () => {
    cancelled = true;
    stopSpeaking();
  };
}
