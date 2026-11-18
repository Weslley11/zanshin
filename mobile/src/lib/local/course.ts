/** Trilha no modo local — espelha backend/app/services/course.py. */
import { CONTENT } from "./content";
import { newId, nowIso, todayIso, type DB, type Row } from "./db";
import { cardForPhrase, firstName, personalize } from "./missions";
import { reviewCard } from "./vocab";

const C = CONTENT.course;
export const UNITS: Row[] = C.units;
const LESSONS: Record<string, Row> = Object.fromEntries(UNITS.flatMap((u) => u.lessons.map((l: Row) => [l.id, { ...l, unit_id: u.id }])));
export const ORDER: string[] = UNITS.flatMap((u) => u.lessons.map((l: Row) => l.id));
const ITEMS: Record<string, Row> = Object.fromEntries(UNITS.flatMap((u) => u.items.map((i: Row) => [i.id, i])));

export function xpFor(correctFirst: number, total: number): number {
  const t = Math.max(total, 1);
  const cf = Math.max(0, Math.min(correctFirst, t));
  return C.xp_base + Math.min(10, cf) + (cf === t ? C.xp_perfect_bonus : 0);
}

function streak(days: Set<string>, today: string): number {
  const dayOf = (o: number) => new Date(Date.parse(today) - o * 86_400_000).toISOString().slice(0, 10);
  let n = 0;
  for (let o = days.has(today) ? 0 : 1; days.has(dayOf(o)); o++) n++;
  return n;
}

export function summarize(logs: Row[], today: string) {
  const best: Record<string, number> = {};
  let xpTotal = 0;
  let xpToday = 0;
  const days = new Set<string>();
  for (const log of logs) {
    const d = log.details ?? {};
    if (d.lesson_id) best[d.lesson_id] = Math.max(best[d.lesson_id] ?? 0, log.score ?? 0);
    const xp = Number(d.xp ?? 0);
    xpTotal += xp;
    const day = log.started_at.slice(0, 10);
    days.add(day);
    if (day === today) xpToday += xp;
  }
  const current = ORDER.find((id) => !(id in best)) ?? null;
  const units = UNITS.map((u) => {
    const lessons = u.lessons.map((l: Row) => ({
      id: l.id, kind: l.kind, title_pt: l.title_pt, item_count: l.item_ids.length,
      status: l.id in best ? "done" : l.id === current ? "current" : "locked", best_score: Math.round((best[l.id] ?? 0) * 1000) / 1000,
    }));
    return { id: u.id, order: u.order, title_pt: u.title_pt, icon: u.icon, levels: u.levels, lessons,
             done: lessons.filter((x: Row) => x.status === "done").length };
  });
  return { units, current_lesson_id: current, xp_total: xpTotal, xp_today: xpToday, streak_days: streak(days, today),
           lessons_done: Object.keys(best).length, total_lessons: ORDER.length, daily_goal_options: C.daily_goal_options };
}

export const overview = (db: DB) => summarize(db.activities.filter((a) => a.activity_type === "lesson"), todayIso());

export function lessonFor(db: DB, id: string): Row | null {
  const lesson = LESSONS[id];
  if (!lesson) return null;
  const k = UNITS.findIndex((u) => u.id === lesson.unit_id);
  const unit = UNITS[k];
  const pool = UNITS.slice(Math.max(0, k - 1), k + 2).flatMap((u) => u.items).filter((i: Row) => !lesson.item_ids.includes(i.id));
  return personalize({ id, kind: lesson.kind, title_pt: lesson.title_pt, unit_id: unit.id, unit_title_pt: unit.title_pt, unit_order: unit.order,
                       items: lesson.item_ids.map((i: string) => ITEMS[i]), pool: pool.map((i: Row) => ({ id: i.id, en: i.en, pt: i.pt })) },
                     firstName(db.user?.display_name));
}

export function completeLesson(db: DB, lesson: Row, body: Row) {
  const results: Row[] = Array.isArray(body.results) ? body.results.slice(0, 20) : [];
  if (results.some((r) => !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 4)) throw new Error("Nota inválida.");
  const total = Math.max(1, Math.min(Number(body.total) || 1, 100));
  const correctFirst = Math.max(0, Math.min(Number(body.correct_first) || 0, 100));
  const items: Record<string, Row> = Object.fromEntries(lesson.items.map((i: Row) => [i.id, i]));
  let reviewed = 0;
  for (const r of results) {
    const item = items[r.item_id];
    if (!item) continue;
    const [card] = cardForPhrase(db, item);
    reviewCard(db, card, r.rating, null, "lesson");
    reviewed++;
  }
  const xp = xpFor(correctFirst, total);
  db.activities.push({ id: newId(), started_at: nowIso(), language: "en", activity_type: "lesson",
                       duration_seconds: Math.max(0, Math.min(Number(body.duration_seconds) || 0, 7200)), score: Math.min(1, correctFirst / total),
                       skills: ["vocabulary", "grammar", "listening"], details: { lesson_id: lesson.id, xp, correct_first: correctFirst, total } });
  const ov = overview(db);
  return { xp, perfect: correctFirst >= total, reviewed, xp_today: ov.xp_today, xp_total: ov.xp_total, streak_days: ov.streak_days,
           next_lesson_id: ov.current_lesson_id, lessons_done: ov.lessons_done, total_lessons: ov.total_lessons };
}
