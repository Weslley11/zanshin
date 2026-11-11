/** Jornada completa no modo local (sem servidor): perfil → plano → revisão → listening → tutor → relatório → dashboard. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setMemoryDB, setStorage } from "../db";
import { localApi } from "../localApi";

const mem = new Map<string, string>();
setStorage({ getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v), removeItem: async (k) => void mem.delete(k) });

test("jornada completa no aparelho", async () => {
  setMemoryDB(null);
  mem.clear();
  await assert.rejects(localApi("/me"), /perfil/);
  await localApi("/auth/register", { body: { display_name: "Weslley" } });
  const prof: any = await localApi("/me/profiles/en", { method: "PUT", body: { daily_minutes: 45, focus_domains: ["engineering"], self_level: "B1", trip_destination: "IN" } });
  assert.equal(prof.preferred_accents[0], "IN");

  const plan: any = await localApi("/plans", { body: { language: "en" } });
  assert.equal(plan.total_days, 90);
  assert.equal(plan.insights[0].signal, "destination_india");
  const day: any = await localApi("/plans/current/days/1?language=en");
  assert.equal(day.activities.reduce((s: number, a: any) => s + a.minutes, 0), 45);

  const vs: any = await localApi("/vocab/session?language=en");
  assert.equal(vs.new_count, 12);
  assert.ok(vs.cards.some((c: any) => c.item.kind === "indian_english"));
  const card = vs.cards[0];
  const chk: any = await localApi(`/vocab/cards/${card.card_id}/check`, { body: { answer: card.item.term, response_ms: 2000 } });
  assert.equal(chk.correct, true);
  const rev: any = await localApi(`/vocab/cards/${card.card_id}/review`, { body: { rating: 3 } });
  assert.equal(rev.state, "learning");

  const lr: any = await localApi("/listening/lst-in-supplier-call/submit", { body: { answers: { "0": 1, "1": 1, "2": 1 }, duration_seconds: 120 } });
  assert.equal(lr.score, 1);

  const s: any = await localApi("/tutor/sessions", { body: { mode: "scenario", scenario_id: "india-plant-visit" } });
  assert.equal(s.engine, "offline");
  for (const t of ["Good morning! I am agree, let's start.", "I have a doubt about the tolerance.", "Can you explain me the drawing?"]) {
    const m: any = await localApi(`/tutor/sessions/${s.id}/messages`, { body: { text: t, latency_ms: 2000 } });
    assert.ok(m.reply.length > 0);
  }
  const rep: any = await localApi(`/tutor/sessions/${s.id}/end`, { method: "POST" });
  assert.ok(rep.main_errors.length >= 3);
  assert.ok(rep.added_to_review >= 1);
  const errs: any = await localApi("/errors?language=en");
  assert.ok(errs.length >= 3);

  const a: any = await localApi("/assessments", { body: { language: "en", kind: "placement" } });
  assert.ok(Object.keys(a.sections).length === 4 && !JSON.stringify(a.sections).includes('"answer"'));
  const res: any = await localApi(`/assessments/${a.id}/submit`, { body: { answers: {}, speaking: [{ id: a.speaking[0].id, transcript: "I work as an engineer because I like design.", duration_seconds: 10 }] } });
  assert.ok(res.overall_cefr);
  assert.ok(res.plan_adaptation);

  const dash: any = await localApi("/dashboard?language=en");
  assert.equal(dash.level_source, "assessment");
  assert.equal(dash.effort.streak_days, 1);
  assert.equal(dash.plan.day, 1);

  // persistência: recarrega do armazenamento
  setMemoryDB(null);
  const me: any = await localApi("/me");
  assert.equal(me.display_name, "Weslley");
  assert.equal(Object.keys(((await localApi("/me/export")) as any).data.sessions).length, 1);

  await assert.rejects(localApi(`/tutor/sessions/${s.id}/audio`, { method: "POST" }), /servidor/);
  await localApi("/me/delete", { method: "POST", body: { password: "" } });
  setMemoryDB(null);
  await assert.rejects(localApi("/me"), /perfil/);
});
