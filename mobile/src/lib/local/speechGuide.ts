/** Guia "Como eles falam" no modo local — espelha backend/app/services/speech_guide.py. */
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { cardForPhrase } from "./missions";
import { reviewCard } from "./vocab";

export const GUIDES: Row[] = CONTENT.speech_guides;
const LANGUAGE = "en";
const DOMAIN: Record<string, string> = { IN: "india", US: "usa" };

export const guideFor = (code: string): Row | null => GUIDES.find((g) => g.code === code.toUpperCase()) ?? null;
const itemsOf = (g: Row): Row[] => (g.sections as Row[]).flatMap((s) => s.items as Row[]);

export function guidesOverview(db: DB) {
  const stats: Record<string, { sessions: number; best_score: number }> = {};
  for (const log of db.activities) {
    if (log.activity_type !== "guide_quiz" || !log.details?.guide) continue;
    const s = (stats[log.details.guide] ??= { sessions: 0, best_score: 0 });
    s.sessions += 1;
    s.best_score = Math.max(s.best_score, log.score ?? 0);
  }
  return {
    guides: GUIDES.map((g) => ({
      code: g.code, title_pt: g.title_pt, icon: g.icon, accent: g.accent,
      sections: g.sections.map((s: Row) => ({ id: s.id, title_pt: s.title_pt, icon: s.icon, count: s.items.length })),
      item_count: itemsOf(g).length, sessions: stats[g.code]?.sessions ?? 0, best_score: Math.round((stats[g.code]?.best_score ?? 0) * 1000) / 1000,
    })),
  };
}

export function completeGuideQuiz(db: DB, g: Row, body: Row) {
  const results: Row[] = Array.isArray(body.results) ? body.results.slice(0, 40) : [];
  if (results.some((r) => !(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 4))) throw new Error("Nota inválida.");
  const byId = Object.fromEntries(itemsOf(g).map((i) => [i.id, i]));
  let added = 0;
  let reviewed = 0;
  let good = 0;
  for (const r of results) {
    const item = byId[r.item_id];
    if (!item) continue;
    const [card, created] = cardForPhrase(db, item, "guide", DOMAIN[g.code] ?? "general");
    added += Number(created);
    reviewCard(db, card, r.rating, null, "guide");
    reviewed += 1;
    if (r.rating >= 3) good += 1;
  }
  const score = reviewed ? Math.round((good / reviewed) * 1000) / 1000 : 0;
  db.activities.push({ id: newId(), started_at: nowIso(), language: LANGUAGE, activity_type: "guide_quiz",
                       duration_seconds: Math.max(0, Math.min(Number(body.duration_seconds) || 0, 7200)), score,
                       skills: ["listening", "vocabulary"], details: { guide: g.code } });
  return { reviewed, added, score, overview: guidesOverview(db) };
}
