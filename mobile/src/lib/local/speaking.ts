/** Medidor de fala e conversas reais no modo local — espelha backend/app/services/speaking.py. */
import { speakingMetrics } from "../speaking";
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { completeActivity, currentPlan, dayView } from "./learning";

const SC = CONTENT.speaking_check;
const PROMPTS: Row[] = SC.prompts;
const LANGUAGE = "en";

export function speakingOverview(db: DB) {
  const checks = db.activities.filter((a) => a.activity_type === "speaking_check").sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const history = checks.map((c) => ({ date: c.started_at.slice(0, 10), prompt_id: c.details?.prompt_id, confidence: c.details?.confidence, ...(c.details?.metrics ?? {}) }));
  const real = db.activities.filter((a) => a.activity_type === "real_conversation");
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const byPartner: Record<string, number> = Object.fromEntries(Object.keys(SC.partners).map((k) => [k, 0]));
  const mins = (r: Row) => Math.round((r.duration_seconds ?? 0) / 60);
  for (const r of real) byPartner[r.details?.partner ?? "other"] = (byPartner[r.details?.partner ?? "other"] ?? 0) + mins(r);
  const first = history[0];
  const last = history[history.length - 1];
  return {
    prompt: PROMPTS[checks.length % PROMPTS.length], seconds: 60, history: history.slice(-26),
    summary: history.length ? { checks: history.length, first_wpm: first.wpm ?? 0, last_wpm: last.wpm ?? 0,
                                best_wpm: Math.max(...history.map((h) => h.wpm ?? 0)), change_wpm: (last.wpm ?? 0) - (first.wpm ?? 0) } : null,
    real: { total_minutes: real.reduce((s, r) => s + mins(r), 0), week_minutes: real.filter((r) => r.started_at >= weekAgo).reduce((s, r) => s + mins(r), 0),
            sessions: real.length, by_partner: byPartner, week_goal: 60 },
  };
}

export function saveCheck(db: DB, body: Row) {
  if (!PROMPTS.some((p) => p.id === body.prompt_id)) throw new Error("Tema desconhecido.");
  const confidence = Number(body.confidence);
  if (!(Number.isInteger(confidence) && confidence >= 1 && confidence <= 5)) throw new Error("Confiança inválida.");
  const transcript = String(body.transcript ?? "").slice(0, 4000);
  const m = speakingMetrics(transcript, Number(body.seconds) || 60);
  db.activities.push({ id: newId(), started_at: nowIso(), language: LANGUAGE, activity_type: "speaking_check", duration_seconds: m.seconds,
                       score: null, skills: ["speaking", "fluency"],
                       details: { prompt_id: body.prompt_id, confidence, metrics: m, transcript: transcript.slice(0, 1500) } });
  let day = null;
  if (body.plan_day && body.plan_activity_id) {
    const plan = currentPlan(db, LANGUAGE);
    const d = plan ? completeActivity(plan, body.plan_day, body.plan_activity_id) : null;
    day = d ? dayView(d) : null;
  }
  return { metrics: m, plan_day: day, overview: speakingOverview(db) };
}

export function logReal(db: DB, body: Row) {
  const minutes = Number(body.minutes);
  if (!(Number.isInteger(minutes) && minutes >= 1 && minutes <= 240)) throw new Error("Minutos inválidos.");
  if (!["india", "us", "other"].includes(body.partner)) throw new Error("Com quem? inválido.");
  db.activities.push({ id: newId(), started_at: nowIso(), language: LANGUAGE, activity_type: "real_conversation", duration_seconds: minutes * 60,
                       score: null, skills: ["speaking", "interaction"], details: { partner: body.partner, note: String(body.note ?? "").slice(0, 200) } });
  return speakingOverview(db);
}
