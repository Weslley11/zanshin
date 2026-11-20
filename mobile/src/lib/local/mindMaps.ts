/** Mapas mentais no modo local — espelha backend/app/services/mind_maps.py. */
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { cardForPhrase } from "./missions";
import { reviewCard } from "./vocab";

export const MAPS: Row[] = CONTENT.mind_maps;
const LANGUAGE = "en";

export const mapById = (id: string): Row | null => MAPS.find((m) => m.id === id) ?? null;
export const mapLeaves = (m: Row): Row[] => (m.branches as Row[]).flatMap((b) => b.leaves as Row[]);

function summary(m: Row) {
  return { id: m.id, order: m.order, icon: m.icon, track: m.track, title_pt: m.title_pt, center_en: m.center_en, center_pt: m.center_pt,
           branch_count: m.branches.length, leaf_count: mapLeaves(m).length };
}

export function overview(db: DB) {
  const progress: Record<string, { sessions: number; best_score: number; rebuilt: boolean; last_at: string | null }> = {};
  for (const log of db.activities) {
    if (log.activity_type !== "mind_map" || !log.details?.map_id) continue;
    const p = (progress[log.details.map_id] ??= { sessions: 0, best_score: 0, rebuilt: false, last_at: null });
    p.sessions += 1;
    p.best_score = Math.max(p.best_score, log.score ?? 0);
    p.rebuilt = p.rebuilt || log.details.mode === "rebuild";
    if (!p.last_at || log.started_at > p.last_at) p.last_at = log.started_at;
  }
  const items = MAPS.map((m) => {
    const p = progress[m.id] ?? { sessions: 0, best_score: 0, rebuilt: false, last_at: null };
    return { ...summary(m), sessions: p.sessions, best_score: Math.round(p.best_score * 1000) / 1000, rebuilt: p.rebuilt, last_at: p.last_at };
  });
  const fresh = items.filter((i) => i.sessions === 0);
  const next = fresh[0] ?? [...items].sort((a, b) => a.best_score - b.best_score || a.order - b.order)[0];
  return { maps: items, next_map_id: next.id, practiced: items.filter((i) => i.sessions).length, total: items.length,
           mastered: items.filter((i) => i.best_score >= 0.8 && i.rebuilt).length };
}

export function completeMap(db: DB, m: Row, body: Row) {
  if (!["study", "recall", "rebuild"].includes(body.mode)) throw new Error("Modo inválido.");
  const results: Row[] = Array.isArray(body.results) ? body.results.slice(0, 40) : [];
  if (results.some((r) => !(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 4))) throw new Error("Nota inválida.");
  const byId = Object.fromEntries(mapLeaves(m).map((l) => [l.id, l]));
  let added = 0;
  let reviewed = 0;
  let good = 0;
  for (const r of results) {
    const leaf = byId[r.leaf_id];
    if (!leaf) continue;
    const [card, created] = cardForPhrase(db, leaf, "mind_map", m.track);
    added += Number(created);
    reviewCard(db, card, r.rating, null, "mind_map");
    reviewed += 1;
    if (r.rating >= 3) good += 1;
  }
  const score = reviewed ? Math.round((good / reviewed) * 1000) / 1000 : 0;
  db.activities.push({ id: newId(), started_at: nowIso(), language: LANGUAGE, activity_type: "mind_map",
                       duration_seconds: Math.max(0, Math.min(Number(body.duration_seconds) || 0, 7200)), score,
                       skills: ["vocabulary", "speaking"], details: { map_id: m.id, mode: body.mode } });
  return { reviewed, added, score, overview: overview(db) };
}
