/** Feedback de shadowing com controle de confiança — porte de app/services/speech_metrics.py (sem tempos por palavra). */
import { alignWords, countWords, FILLERS, normalize } from "./text";

export function fluencyMetrics(duration: number, text: string) {
  const tokens = normalize(text, { expand: false }).split(" ").filter(Boolean);
  const n = countWords(text);
  const base = { words: n, duration_seconds: Math.round(duration * 100) / 100, filled_pauses: tokens.filter((t) => FILLERS.has(t)).length };
  if (duration <= 1 || n === 0) return { ...base, speech_rate_wpm: null };
  return { ...base, speech_rate_wpm: Math.round((n / duration) * 60 * 10) / 10 };
}

export function shadowingFeedback(a: { reference: string; transcript: string; duration?: number; rate?: number; stt_confidence?: number | null }): any {
  const { reference, transcript } = a;
  const duration = a.duration ?? 0;
  const rate = a.rate ?? 1;
  const refWords = normalize(reference).split(" ").filter(Boolean);
  const expected = (refWords.length / (150 * rate)) * 60;
  const alignment = alignWords(reference, transcript);
  const ok = alignment.filter((x) => x.op === "ok").length;
  const acc = refWords.length ? ok / refWords.length : 0;
  const reasons: string[] = [];
  if (!transcript.trim()) reasons.push("Nenhuma fala foi reconhecida (silêncio, ruído ou microfone bloqueado).");
  if (a.stt_confidence != null && a.stt_confidence < 0.5) reasons.push("A qualidade do áudio parece baixa (confiança do reconhecimento < 50%).");
  if (duration && duration < 0.4 * expected) reasons.push("A gravação parece incompleta (muito mais curta que a frase-modelo).");
  if (transcript.trim() && acc < 0.3 && a.stt_confidence == null) reasons.push("O texto reconhecido é muito diferente da frase — pode ser ruído ou outra frase.");
  const result: any = { reference, recognized: transcript, method: "transcript_alignment", notes_pt: [] as string[] };
  if (reasons.length) {
    return { ...result, status: "inconclusive", reasons_pt: reasons,
             advice_pt: "Grave novamente em um lugar silencioso, com o microfone a ~15 cm da boca, e fale a frase completa." };
  }
  const missing = alignment.filter((x) => x.op === "del").map((x) => x.ref);
  const substitutions = alignment.filter((x) => x.op === "sub").map((x) => ({ expected: x.ref, heard: x.hyp }));
  const extra = alignment.filter((x) => x.op === "ins").map((x) => x.hyp);
  const ratio = expected && duration ? Math.round((duration / expected) * 100) / 100 : null;
  const tips: string[] = [];
  for (const s of substitutions.slice(0, 3)) tips.push(`'${s.expected}' foi reconhecida como '${s.heard}'. Repita a palavra isolada 3× e depois a frase.`);
  if (missing.length) tips.push("Palavras não reconhecidas: " + missing.slice(0, 5).join(", ") + ". Em connected speech elas ficam fracas, mas devem existir.");
  if (ratio && ratio > 1.4) tips.push(`Você levou ${ratio}× o tempo do modelo. Tente agrupar as palavras em blocos, sem pausas entre elas.`);
  else if (ratio && ratio < 0.75) tips.push("Você falou mais rápido que o modelo — priorize clareza antes de velocidade.");
  if (!tips.length) tips.push("Ótimo! O reconhecedor entendeu a frase inteira. Agora tente acompanhar o modelo ao mesmo tempo (shadowing simultâneo).");
  return {
    ...result, status: "ok", intelligibility: Math.round(acc * 1000) / 10,
    word_alignment: alignment.map((x) => ({ op: x.op, expected: x.ref, heard: x.hyp })),
    missing_words: missing, substitutions, extra_words: extra,
    timing: { duration_seconds: Math.round(duration * 100) / 100, model_seconds: Math.round(expected * 100) / 100, ratio, pauses_inside_phrase: [] },
    fluency: fluencyMetrics(duration, transcript), tips_pt: tips,
    notes_pt: ["Inteligibilidade estimada = % das palavras que o reconhecedor de fala entendeu. Sotaque estrangeiro compreensível não é penalizado.",
               "Este método não avalia fonemas individualmente."],
  };
}
