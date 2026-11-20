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

test("Missão Índia no aparelho: lista, missão personalizada, conclusão → revisão e plano", async () => {
  setMemoryDB(null);
  mem.clear();
  await localApi("/auth/register", { body: { display_name: "Ana Souza" } });
  await localApi("/me/profiles/en", { method: "PUT", body: { daily_minutes: 45, self_level: "B1", trip_destination: "IN" } });
  const ov: any = await localApi("/india/missions");
  assert.equal(ov.completed, 0);
  assert.equal(ov.next_mission_id, "m01");
  assert.ok(ov.total >= 12);

  const m: any = await localApi("/india/missions/m01");
  assert.match(m.chunks[0].en, /I'm Ana, from Brazil/);
  await assert.rejects(localApi("/india/missions/zz"), /não encontrada/);

  await localApi("/plans", { body: { language: "en" } });
  let planDay = 0;
  let act: any = null;
  for (let i = 1; i <= 7 && !act; i++) {
    const d: any = await localApi(`/plans/current/days/${i}?language=en`);
    act = d.activities.find((a: any) => a.type === "india_mission");
    if (act) planDay = i;
  }
  assert.equal(act?.params.mission_id, "m01");

  const statsBefore: any = await localApi("/vocab/stats?language=en");
  const results = m.chunks.map((c: any, i: number) => ({ chunk_id: c.id, rating: i % 3 ? 3 : 1 }));
  const done: any = await localApi("/india/missions/m01/complete", { body: { results, score: 0.8, duration_seconds: 600,
    details: { listen_correct: 3, nested: { x: 1 } }, plan_day: planDay, plan_activity_id: act.id } });
  assert.equal(done.reviewed, results.length);
  assert.ok(done.added >= 1);
  assert.equal(done.overview.completed, 1);
  assert.equal(done.overview.next_mission_id, "m02");
  assert.ok(done.plan_day.activities.find((a: any) => a.id === act.id).done);
  const statsAfter: any = await localApi("/vocab/stats?language=en");
  assert.notDeepEqual(statsAfter, statsBefore);

  const again: any = await localApi("/india/missions/m01/complete", { body: { results, score: 1, duration_seconds: 300 } });
  assert.equal(again.added, 0);
  await assert.rejects(localApi("/india/missions/m01/complete", { body: { results: [{ chunk_id: "m01-c01", rating: 9 }], score: 1 } }), /inválida/);
});

test("Trilha no aparelho: XP, desbloqueio, sequência e revisão", async () => {
  setMemoryDB(null);
  mem.clear();
  await localApi("/auth/register", { body: { display_name: "Ana" } });
  await localApi("/me/profiles/en", { method: "PUT", body: { daily_minutes: 30, self_level: "B1" } });
  const ov: any = await localApi("/course");
  assert.equal(ov.xp_total, 0);
  const first = ov.current_lesson_id;
  assert.equal(ov.units[0].lessons[0].status, "current");
  assert.equal(ov.units[0].lessons[1].status, "locked");

  const lesson: any = await localApi(`/course/lessons/${first}`);
  assert.ok(lesson.items.length >= 3 && lesson.pool.length >= 10);
  const u2: any = await localApi("/course/lessons/u02-l1");
  assert.ok(!JSON.stringify(u2).includes("{name}"));

  const r: any = await localApi(`/course/lessons/${first}/complete`, { body: {
    results: lesson.items.map((i: any) => ({ item_id: i.id, rating: 3 })), correct_first: 9, total: 11, duration_seconds: 200 } });
  assert.equal(r.xp, 19);
  assert.equal(r.xp_today, 19);
  assert.equal(r.streak_days, 1);
  assert.equal(r.reviewed, lesson.items.length);
  const ov2: any = await localApi("/course");
  assert.equal(ov2.units[0].lessons[0].status, "done");
  assert.equal(ov2.units[0].lessons[1].status, "current");
  await assert.rejects(localApi(`/course/lessons/${first}/complete`, { body: { results: [{ item_id: "x", rating: 0 }], total: 1 } }), /inválida/);
  await assert.rejects(localApi("/course/lessons/nope"), /não encontrada/);
});

test("Missão Wisconsin e mapas mentais no aparelho", async () => {
  setMemoryDB(null);
  mem.clear();
  await localApi("/auth/register", { body: { display_name: "Ana" } });
  await localApi("/me/profiles/en", { method: "PUT", body: { daily_minutes: 30, self_level: "B1" } });
  const us: any = await localApi("/india/missions?track=us");
  assert.equal(us.track, "us");
  assert.equal(us.next_mission_id, "w01");
  assert.ok(us.missions.every((m: any) => m.accent === "US"));
  await assert.rejects(localApi("/india/missions?track=xx"), /inválida/);
  const w: any = await localApi("/india/missions/w02");
  const done: any = await localApi("/india/missions/w02/complete", { body: { results: w.chunks.map((c: any) => ({ chunk_id: c.id, rating: 3 })), score: 1, duration_seconds: 300 } });
  assert.equal(done.overview.track, "us");
  assert.equal(done.overview.completed, 1);
  assert.equal(((await localApi("/india/missions")) as any).completed, 0);

  const ov: any = await localApi("/maps");
  assert.equal(ov.practiced, 0);
  assert.equal(ov.next_map_id, "mm01");
  const m: any = await localApi("/maps/mm08");
  const leaves = m.branches.flatMap((b: any) => b.leaves);
  const res: any = await localApi("/maps/mm08/complete", { body: { mode: "rebuild", duration_seconds: 200,
    results: leaves.map((l: any, i: number) => ({ leaf_id: l.id, rating: i % 2 ? 3 : 1 })) } });
  assert.equal(res.reviewed, leaves.length);
  assert.equal(res.added, leaves.length);
  assert.equal(res.score, 0.5);
  assert.equal(res.overview.practiced, 1);
  assert.equal(res.overview.next_map_id, "mm01");
  await assert.rejects(localApi("/maps/mm08/complete", { body: { mode: "zz", results: [] } }), /inválido/);
  await assert.rejects(localApi("/maps/zz"), /não encontrado/);
});

test("plano com Índia + EUA, medidor de fala e conversas reais no aparelho", async () => {
  setMemoryDB(null);
  mem.clear();
  await localApi("/auth/register", { body: { display_name: "Ana" } });
  const prof: any = await localApi("/me/profiles/en", { method: "PUT", body: { daily_minutes: 45, self_level: "B1", trip_destination: "IN", extra_destinations: ["US", "IN", "zz"] } });
  assert.deepEqual(prof.extra_destinations, ["US"]);
  const plan: any = await localApi("/plans", { body: { language: "en" } });
  assert.deepEqual(plan.insights.slice(0, 2).map((i: any) => i.signal), ["destination_india", "destination_us"]);
  const types = new Set<string>();
  let check: any = null;
  for (let i = 1; i <= 21; i++) {
    const d: any = await localApi(`/plans/current/days/${i}?language=en`);
    for (const a of d.activities) types.add(a.type);
    if (!check) {
      const a = d.activities.find((x: any) => x.type === "speaking_check");
      if (a) check = { day: i, id: a.id };
    }
  }
  for (const t of ["india_mission", "us_mission", "turbo", "mind_map", "speaking_check"]) assert.ok(types.has(t), t);
  assert.equal(check.day, 7);

  const ov: any = await localApi("/speaking");
  assert.equal(ov.summary, null);
  assert.equal(ov.prompt.id, "sc01");
  const r: any = await localApi("/speaking/checks", { body: { prompt_id: "sc01", transcript: "Hi, I'm Ana. I work as an engineer at a big company.", seconds: 30,
    confidence: 3, plan_day: check.day, plan_activity_id: check.id } });
  assert.equal(r.metrics.words, 12);
  assert.equal(r.metrics.wpm, 24);
  assert.ok(r.plan_day.activities.find((a: any) => a.id === check.id).done);
  assert.equal(r.overview.prompt.id, "sc02");
  assert.equal(r.overview.summary.checks, 1);
  await assert.rejects(localApi("/speaking/checks", { body: { prompt_id: "zz", transcript: "x", seconds: 60, confidence: 3 } }), /desconhecido/);
  const real: any = await localApi("/speaking/real", { body: { minutes: 15, partner: "india" } });
  assert.equal(real.real.week_minutes, 15);
  assert.equal(real.real.by_partner.india, 15);
  await assert.rejects(localApi("/speaking/real", { body: { minutes: 0, partner: "india" } }), /inválidos/);
});
