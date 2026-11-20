/** Correção das etapas da Missão Índia e importação de frases próprias (funções puras, usadas nas telas e nos testes). */
import { alignWords, answerMatches, countWords, looksPortuguese, normalize, similarity, type Alignment } from "./local/text";

export type Chunk = { id: string; kind: "say" | "hear"; level: string; en: string; pt: string; alts?: string[]; cue?: string; note_pt?: string };
export type ListenItem = { id: string; say: string; question_pt: string; options_pt: string[]; answer: number; note_pt?: string };
export type Turn = { say: string; hint_pt: string; keywords: string[]; model: string };
export type Mission = {
  id: string; order: number; icon: string; minutes: number; title_pt: string; subtitle_pt: string; goal_pt: string;
  chunks: Chunk[]; listen: ListenItem[]; dialog: { partner: string; turns: Turn[] };
  track?: "india" | "us"; accent?: "IN" | "US";
};

export type SayCheck = { ok: boolean; sim: number; closest: string; diff: Alignment[] };

/** "say": produzir a frase a partir do português (tolerante a pequenos erros e variações aceitas). */
export function checkSay(answer: string, chunk: Chunk): SayCheck {
  const accepted = [chunk.en, ...(chunk.alts ?? [])];
  const [ok, sim, closest] = answerMatches(answer, accepted);
  return { ok, sim, closest, diff: alignWords(closest, answer) };
}

/** "hear": repetir o que ouviu (percepção). Mais tolerante: o reconhecimento de voz erra palavras em hindi e nomes. */
export function checkHear(answer: string, chunk: Chunk, threshold = 0.72): SayCheck {
  const sim = similarity(answer, chunk.en);
  return { ok: sim >= threshold, sim, closest: chunk.en, diff: alignWords(chunk.en, answer) };
}

export function checkChunk(answer: string, chunk: Chunk): SayCheck {
  return chunk.kind === "hear" ? checkHear(answer, chunk) : checkSay(answer, chunk);
}

/** Mini-conversa: a resposta cumpre a tarefa se usar alguma das ideias-chave (e não for só uma palavra). */
export function checkTurn(answer: string, turn: Turn): { ok: boolean; tooShort: boolean; portuguese: boolean } {
  const raw = answer.toLowerCase().replace(/[’‘]/g, "'");
  const norm = normalize(answer);
  const portuguese = looksPortuguese(answer);
  const tooShort = countWords(answer) < 2;
  const hit = turn.keywords.some((k) => raw.includes(k.toLowerCase()) || norm.includes(normalize(k)));
  return { ok: hit && !tooShort && !portuguese, tooShort, portuguese };
}

/** Nota FSRS de cada frase: de primeira = Good (3), na segunda tentativa = Hard (2), não acertou = Again (1). */
export function ratingFor(ok: boolean, attempts: number): 1 | 2 | 3 {
  if (!ok) return 1;
  return attempts <= 1 ? 3 : 2;
}

/** Nota da missão: falar pesa mais (é o objetivo), compreensão e conversa completam. */
export function missionScore(speak: number, listen: number, talk: number): number {
  return Math.round((0.5 * speak + 0.25 * listen + 0.25 * talk) * 1000) / 1000;
}

export type ImportedPhrase = { term: string; meaning_pt: string };

const SEPARATORS = ["\t", " = ", " | ", " — ", " – ", " - ", ";", " : "];
const PT_WORDS = new Set("vou você voce me de da do das dos que não nao eu é um uma para pra com no na nos nas os as por se meu minha onde fica quando como mais está esta estou isso isto ele ela tem ter aqui ali muito obrigado pode posso".split(" "));
const EN_WORDS = new Set("the i you is are to of and a an in it be will i'll i'm it's could can my your where what how do does did please this that me we they for with have has".split(" "));

/** Quão "português" ou "inglês" um trecho parece (para corrigir a ordem das colunas na importação). */
function langScore(text: string): { pt: number; en: number } {
  const words = text.toLowerCase().replace(/[’‘]/g, "'").split(/[^\p{L}']+/u).filter(Boolean);
  const accents = (text.match(/[ãõçáéíóúâêô]/gi) ?? []).length;
  return { pt: words.filter((w) => PT_WORDS.has(w)).length + accents, en: words.filter((w) => EN_WORDS.has(w)).length };
}

/**
 * Lê frases coladas, uma por linha: "inglês = tradução" (também aceita |, —, -, ;, tab).
 * Se o lado esquerdo estiver em português, inverte. Ignora numeração/marcadores e repetições.
 */
export function parsePhrases(text: string, max = 200): { phrases: ImportedPhrase[]; invalid: string[] } {
  const phrases: ImportedPhrase[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:\d+[.)]|[-•*–])\s*/, "").trim();
    if (!line) continue;
    const sep = SEPARATORS.find((s) => line.includes(s));
    if (!sep) {
      invalid.push(line);
      continue;
    }
    const i = line.indexOf(sep);
    let a = line.slice(0, i).trim();
    let b = line.slice(i + sep.length).trim();
    if (!a || !b) {
      invalid.push(line);
      continue;
    }
    const sa = langScore(a);
    const sb = langScore(b);
    if (sa.pt > sa.en && sb.en >= sb.pt) [a, b] = [b, a];
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push({ term: a.slice(0, 200), meaning_pt: b.slice(0, 500) });
    if (phrases.length >= max) break;
  }
  return { phrases, invalid };
}
