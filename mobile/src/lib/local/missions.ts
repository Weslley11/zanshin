/** Missão Índia no modo local — espelha backend/app/services/missions.py. */
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { completeActivity, currentPlan, dayView } from "./learning";
import { addPersonalItem, itemById, reviewCard } from "./vocab";

export const MISSIONS: Row[] = CONTENT.india_missions;
const LANGUAGE = "en";

export function personalize<T>(value: T, name: string): T {
  if (typeof value === "string") return value.split("{name}").join(name) as T;
  if (Array.isArray(value)) return value.map((v) => personalize(v, name)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, personalize(v, name)])) as T;
  return value;
}

export function firstName(display?: string | null): string {
  const n = (display ?? "").trim().split(" ")[0].slice(0, 30);
  return n || "Alex";
}

export function missionFor(db: DB, id: string): Row | null {
  const m = MISSIONS.find((x) => x.id === id);
  return m ? personalize(m, firstName(db.user?.display_name)) : null;
}

function summary(m: Row) {
  return { id: m.id, order: m.order, icon: m.icon, minutes: m.minutes, title_pt: m.title_pt, subtitle_pt: m.subtitle_pt,
           goal_pt: m.goal_pt, chunk_count: m.chunks.length };
}

export function overview(db: DB) {
  const progress: Record<string, { completions: number; best_score: number; last_at: string | null }> = {};
  for (const log of db.activities) {
    if (log.activity_type !== "india_mission" || !log.details?.mission_id) continue;
    const p = (progress[log.details.mission_id] ??= { completions: 0, best_score: 0, last_at: null });
    p.completions += 1;
    p.best_score = Math.max(p.best_score, log.score ?? 0);
    if (!p.last_at || log.started_at > p.last_at) p.last_at = log.started_at;
  }
  const items = MISSIONS.map((m) => {
    const p = progress[m.id] ?? { completions: 0, best_score: 0, last_at: null };
    return { ...summary(m), completed: p.completions > 0, completions: p.completions, best_score: Math.round(p.best_score * 1000) / 1000, last_at: p.last_at };
  });
  const pending = items.filter((i) => !i.completed);
  const next = pending[0] ?? [...items].sort((a, b) => a.best_score - b.best_score || a.order - b.order)[0];
  const done = items.filter((i) => i.completed);
  return { missions: items, next_mission_id: next.id, completed: done.length, total: items.length,
           phrases_learned: done.reduce((s, i) => s + i.chunk_count, 0) };
}

/** Reaproveita o cartão se a frase já existir (conteúdo base ou pessoal); senão cria um item pessoal. */
function cardFor(db: DB, chunk: Row): [Row, boolean] {
  const term = chunk.en.toLowerCase();
  const existing = Object.values(db.cards).find((c) => c.language === LANGUAGE && itemById(db, c.item_id)?.term.toLowerCase() === term);
  if (existing) return [existing, false];
  const card = addPersonalItem(db, { language: LANGUAGE, term: chunk.en, meaning_pt: chunk.pt, kind: "phrase", source: "mission", domain: "india",
                                     definition: chunk.note_pt ?? "" })!;
  return [card, true];
}

export function completeMission(db: DB, mission: Row, body: Row) {
  const ratingOk = (r: any) => Number.isInteger(r) && r >= 1 && r <= 4;
  const results: Row[] = Array.isArray(body.results) ? body.results.slice(0, 40) : [];
  if (results.some((r) => !ratingOk(r.rating))) throw new Error("Nota inválida.");
  const chunks = Object.fromEntries((mission.chunks as Row[]).map((c) => [c.id, c]));
  let added = 0;
  let reviewed = 0;
  for (const r of results) {
    const chunk = chunks[r.chunk_id];
    if (!chunk) continue;
    const [card, created] = cardFor(db, chunk);
    added += Number(created);
    reviewCard(db, card, r.rating, null, "mission");
    reviewed += 1;
  }
  const details = Object.fromEntries(Object.entries(body.details ?? {}).filter(([, v]) => ["number", "string", "boolean"].includes(typeof v)).slice(0, 10));
  db.activities.push({ id: newId(), started_at: nowIso(), language: LANGUAGE, activity_type: "india_mission",
                       duration_seconds: Math.max(0, Math.min(Number(body.duration_seconds) || 0, 7200)),
                       score: Math.max(0, Math.min(Number(body.score) || 0, 1)), skills: ["vocabulary", "speaking", "listening"],
                       details: { mission_id: mission.id, ...details } });
  let day = null;
  if (body.plan_day && body.plan_activity_id) {
    const plan = currentPlan(db, LANGUAGE);
    const d = plan ? completeActivity(plan, body.plan_day, body.plan_activity_id) : null;
    day = d ? dayView(d) : null;
  }
  return { reviewed, added, plan_day: day, overview: overview(db) };
}
