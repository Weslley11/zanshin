/**
 * Trilha: gerador de exercícios das lições (determinístico por semente) e correção.
 * Tipos: escolher significado, escolher em inglês, montar frase com blocos, ouvir e montar, lacuna, pares e digitar/falar.
 */
import { answerMatches, normalize } from "./local/text";

export type Item = { id: string; en: string; pt: string; example?: string; alts?: string[]; level?: string; kind?: string };
export type Lesson = { id: string; kind: "learn" | "review"; title_pt: string; unit_id: string; unit_title_pt: string; unit_order: number;
  items: Item[]; pool: Item[] };

export type Exercise =
  | { type: "choose_pt"; item: Item; options: string[]; answer: number }
  | { type: "choose_en"; item: Item; options: string[]; answer: number }
  | { type: "build"; item: Item; tiles: string[] }
  | { type: "listen_build"; item: Item; tiles: string[] }
  | { type: "cloze"; item: Item; sentence: string; options: string[]; answer: number }
  | { type: "match"; pairs: Item[] }
  | { type: "type"; item: Item };

export const EXERCISE_TITLE: Record<Exercise["type"], string> = {
  choose_pt: "O que significa?", choose_en: "Como se diz em inglês?", build: "Monte a frase em inglês", listen_build: "Ouça e monte o que ouviu",
  cloze: "Complete a frase", match: "Junte os pares", type: "Diga ou escreva em inglês",
};

// ------------------------------- aleatoriedade com semente -------------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------- utilidades de texto -------------------------------
export const tokens = (s: string) => s.replace(/[.,!?;:"“”…—]/g, " ").split(/\s+/).filter(Boolean);
/** Forma "limpa" para mostrar como opção: sem parênteses e reticências. */
export const display = (en: string) => en.replace(/\s*\([^)]*\)/g, "").replace(/…/g, "…").trim();
const canBuild = (it: Item) => !/[…/(]/.test(it.en) && tokens(it.en).length >= 2 && tokens(it.en).length <= 9;
const accepted = (it: Item) => [it.en, ...(it.alts ?? [])];

function clozeOf(it: Item): { sentence: string; variant: string } | null {
  if (!it.example) return null;
  const variants = accepted(it).map((v) => v.replace(/…/g, "").trim()).filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
  for (const v of variants) {
    const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = it.example.match(re);
    if (m) return { sentence: it.example.replace(re, "_____"), variant: m[0] };
  }
  return null;
}

function pickDistinct(cands: string[], exclude: string[], n: number, r: () => number): string[] {
  const seen = new Set(exclude.map((x) => normalize(x)));
  const out: string[] = [];
  for (const c of shuffle(cands, r)) {
    const k = normalize(c);
    if (!c.trim() || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

function choice(correct: string, cands: string[], r: () => number): { options: string[]; answer: number } {
  const options = shuffle([correct, ...pickDistinct(cands, [correct], 3, r)], r);
  return { options, answer: options.indexOf(correct) };
}

function tilesFor(it: Item, others: Item[], r: () => number): string[] {
  const ans = tokens(it.en);
  const lower = new Set(ans.map((w) => w.toLowerCase()));
  const extra = pickDistinct(others.flatMap((o) => tokens(o.en)).filter((w) => !lower.has(w.toLowerCase())), [], ans.length >= 7 ? 2 : 3, r);
  return shuffle([...ans, ...extra], r);
}

// ------------------------------- montagem da lição -------------------------------
type Kind = "build" | "listen_build" | "cloze" | "choose_en" | "type";
const ROTATION: Kind[] = ["build", "listen_build", "cloze", "choose_en", "type"];

export function buildLesson(lesson: Lesson, seed = "0"): Exercise[] {
  const r = rng(`${lesson.id}:${seed}`);
  const others = [...lesson.items, ...lesson.pool];
  const pts = (it: Item) => others.filter((o) => o.id !== it.id).map((o) => o.pt);
  const ens = (it: Item) => others.filter((o) => o.id !== it.id).map((o) => display(o.en));

  const recognize = (it: Item): Exercise => ({ type: "choose_pt", item: it, ...choice(it.pt, pts(it), r) });
  const produce = (it: Item, k: number): Exercise => {
    for (let step = 0; step < ROTATION.length; step++) {
      const kind = ROTATION[(k + step) % ROTATION.length];
      if ((kind === "build" || kind === "listen_build") && canBuild(it)) return { type: kind, item: it, tiles: tilesFor(it, others, r) };
      if (kind === "cloze") {
        const c = clozeOf(it);
        if (c) {
          const cands = others.filter((o) => o.id !== it.id).map((o) => display(o.en)).filter((x) => tokens(x).length <= 4);
          return { type: "cloze", item: it, sentence: c.sentence, ...choice(c.variant, cands.length >= 3 ? cands : ens(it), r) };
        }
      }
      if (kind === "choose_en") return { type: "choose_en", item: it, ...choice(display(it.en), ens(it), r) };
      if (kind === "type" && tokens(it.en).length <= 10) return { type: "type", item: it };
    }
    return { type: "choose_en", item: it, ...choice(display(it.en), ens(it), r) };
  };

  const items = lesson.items;
  const offset = Math.floor(r() * ROTATION.length);
  if (lesson.kind === "learn") {
    // reconhecer cada item novo antes de produzi-lo; produção intercalada; pares no meio
    const out: Exercise[] = [];
    items.forEach((it, i) => {
      out.push(recognize(it));
      if (i >= 1) out.push(produce(items[i - 1], i - 1 + offset));
      if (i === 2) out.push({ type: "match", pairs: shuffle(items, r).slice(0, 5) });
    });
    out.push(produce(items[items.length - 1], items.length - 1 + offset));
    if (items.length < 3) out.push({ type: "match", pairs: items });
    return out;
  }
  const mixed = shuffle(items, r).slice(0, 10);
  const out: Exercise[] = mixed.map((it, i) => produce(it, i + offset));
  out.splice(3, 0, { type: "match", pairs: mixed.slice(0, 5) });
  if (mixed.length >= 8) out.splice(out.length - 2, 0, { type: "match", pairs: mixed.slice(5, 10) });
  return out;
}

// ------------------------------- correção -------------------------------
export function checkTyped(answer: string, it: Item): { ok: boolean; closest: string } {
  const [ok, , closest] = answerMatches(answer, accepted(it));
  return { ok, closest };
}
export function checkTiles(picked: string[], it: Item): boolean {
  return answerMatches(picked.join(" "), accepted(it), 0.97)[0];
}

/** Nota FSRS por item: tudo certo de primeira = 3; errou mas corrigiu = 2; não acertou = 1. */
export function itemRatings(items: Item[], log: { itemId: string; ok: boolean; firstTry: boolean }[]) {
  return items.map((it) => {
    const mine = log.filter((l) => l.itemId === it.id);
    if (!mine.length) return { item_id: it.id, rating: 3 };
    const allFirst = mine.filter((l) => l.firstTry).every((l) => l.ok);
    const fixed = mine.some((l) => l.ok);
    return { item_id: it.id, rating: allFirst ? 3 : fixed ? 2 : 1 };
  });
}
