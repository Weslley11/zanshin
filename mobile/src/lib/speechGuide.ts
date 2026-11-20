/** Guia "Como eles falam": tipos e montagem do treino de ouvido (funções puras, testadas). */
export type GuideItem = { id: string; en: string; pt: string; note_pt: string; sounds_pt?: string; fast?: string };
export type GuideSection = { id: string; icon: string; title_pt: string; intro_pt: string; items: GuideItem[] };
export type Guide = {
  code: "IN" | "US"; accent: string; title_pt: string; icon: string; intro_pt: string; sections: GuideSection[];
  accents: { title_pt: string; text_pt: string }[]; listening_tips: string[];
};
export type QuizQuestion = { item: GuideItem; section: string; options: string[]; answer: number };

/** Gerador pseudoaleatório determinístico (mulberry32): o mesmo seed gera o mesmo treino. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Treino de ouvido: ouve a frase (sem ver) e escolhe o significado entre 3 opções da MESMA seção
 * (distratores parecidos obrigam a ouvir de verdade). Seções intercaladas.
 */
export function buildQuiz(guide: Guide, count = 10, seed = Date.now(), sectionId?: string): QuizQuestion[] {
  const r = rng(seed);
  const sections = guide.sections.filter((s) => !sectionId || s.id === sectionId);
  const pools = sections.map((s) => shuffle(s.items, r));
  const out: QuizQuestion[] = [];
  for (let k = 0; out.length < count && pools.some((p) => p.length); k++) {
    const si = k % pools.length;
    const item = pools[si].shift();
    if (!item) continue;
    const others = shuffle(sections[si].items.filter((i) => i.id !== item.id), r).slice(0, 2).map((i) => i.pt);
    const options = shuffle([item.pt, ...others], r);
    out.push({ item, section: sections[si].id, options, answer: options.indexOf(item.pt) });
  }
  return out;
}

/** Nota FSRS: acertou de primeira = 3; acertou depois de ouvir de novo = 2; errou = 1. */
export const quizRating = (correct: boolean, replays: number): 1 | 2 | 3 => (!correct ? 1 : replays > 1 ? 2 : 3);
