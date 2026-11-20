/**
 * Medidor de fala — mesma fórmula de backend/app/services/speaking.py (testada por paridade).
 * Estimativas sobre o texto reconhecido: valem pela tendência ao longo das semanas, não pelo número isolado.
 */
import { CONTENT } from "./local/content";
import { pyRound } from "./local/fsrs";

const SC = CONTENT.speaking_check;
export const SPEAK_SECONDS: number = SC.seconds;
const FILLERS = new Set<string>(SC.fillers);
const PT_WORDS = new Set<string>(SC.pt_words);
export const PARTNERS: Record<string, string> = SC.partners;
export type SpeakingPrompt = { id: string; en: string; pt: string; tip_pt: string };
export type SpeakingMetrics = { words: number; wpm: number; variety_pct: number; fillers: number; pt_words: number; mean_sentence: number; seconds: number };

const WORD_RE = /\p{L}+(?:'\p{L}+)?/gu;

export function speakingMetrics(transcript: string, seconds: number): SpeakingMetrics {
  const text = transcript.toLowerCase().replace(/[’‘]/g, "'");
  const words = text.match(WORD_RE) ?? [];
  const n = words.length;
  const secs = Math.min(Math.max(seconds, 10), 180);
  const sentences = text.split(/[.!?]+/).filter((p) => /\p{L}/u.test(p)).length;
  return {
    words: n,
    wpm: pyRound((n * 60) / secs),
    variety_pct: n ? pyRound((100 * new Set(words).size) / n) : 0,
    fillers: words.filter((w) => FILLERS.has(w)).length,
    pt_words: words.filter((w) => PT_WORDS.has(w)).length,
    mean_sentence: pyRound((10 * n) / Math.max(1, sentences)) / 10,
    seconds: pyRound(secs),
  };
}

/** Comparação com a medida anterior, em linguagem simples. */
export function compareChecks(prev: SpeakingMetrics | null, cur: SpeakingMetrics): string[] {
  if (!prev) return ["Primeira medida: ela vira o seu ponto de partida. Repita toda semana para ver a curva."];
  const out: string[] = [];
  const d = cur.wpm - prev.wpm;
  out.push(d > 0 ? `+${d} palavras por minuto em relação à última vez.` : d < 0 ? `${d} palavras por minuto (o tema muda; olhe a tendência de várias semanas).` : "Mesmo ritmo da última vez.");
  if (cur.pt_words < prev.pt_words) out.push("Menos português no meio da fala. 👏");
  if (cur.variety_pct > prev.variety_pct) out.push("Vocabulário mais variado.");
  if (cur.mean_sentence > prev.mean_sentence) out.push("Frases mais longas (mais ideias conectadas).");
  return out;
}
