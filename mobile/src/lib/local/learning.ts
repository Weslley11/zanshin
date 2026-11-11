/** Avaliação, plano, motor adaptativo, drills e dashboard no aparelho — portes dos serviços do backend. */
import { CEFR_ANCHORS, CEFR_LEVELS, CONTENT, publicLanguage, scoreToCefr } from "./content";
import { newId, nowIso, todayIso, type DB, type Row } from "./db";
import { analyze, correctText } from "./errors";
import { DESTINATIONS, PHASES, expectedOutcomes, generate, planLength } from "./planner";
import { answerMatches, countWords, lexicalDiversity, normalize, similarity, wordErrorRate } from "./text";
import { stats as vocabStats } from "./vocab";

const A = CONTENT.assessment;
const TEST_LEVELS = ["A2", "B1", "B2", "C1"];
const ITEMS: Record<string, Row> = Object.fromEntries((A.items as Row[]).map((i) => [i.id, i]));
const SPEAKING: Record<string, Row> = Object.fromEntries((A.speaking as Row[]).map((p) => [p.id, p]));
const round1 = (x: number) => Number(x.toFixed(1));
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

// ------------------------------- Avaliação -------------------------------
export function scoreItem(item: Row, response: unknown): number {
  if (response === null || response === undefined || response === "") return 0;
  if (item.type === "mc") {
    const n = Number(response);
    return Number.isInteger(n) && n === item.answer ? 1 : 0;
  }
  if (item.type === "gap") {
    const [ok, sim] = answerMatches(String(response), item.answer);
    return ok ? 1 : sim >= 0.75 ? 0.5 : 0;
  }
  if (item.type === "dictation") return Math.max(0, 1 - wordErrorRate(item.audio_text, String(response)));
  return 0;
}

export function estimateLevel(acc: Record<string, number | undefined>): [string, number] {
  let est = "A1";
  for (const lvl of TEST_LEVELS) {
    const a = acc[lvl];
    if (a != null && a >= 0.6) est = lvl;
    else break;
  }
  let score: number;
  if (est === "C1") {
    const a = acc.C1 || 0.6;
    score = CEFR_ANCHORS.C1 + (CEFR_ANCHORS.C2 - CEFR_ANCHORS.C1) * Math.max(0, (a - 0.6) / 0.4) * 0.6;
  } else {
    const nxt = CEFR_LEVELS[CEFR_LEVELS.indexOf(est) + 1];
    const partial = acc[nxt] || 0;
    score = CEFR_ANCHORS[est] + (CEFR_ANCHORS[nxt] - CEFR_ANCHORS[est]) * Math.min(partial / 0.6, 1) * 0.8;
  }
  return [est, round1(score)];
}

export function startAssessment(db: DB, language: string, kind: string): Row {
  if (language !== "en") throw new Error("A avaliação completa está disponível para inglês; os demais idiomas usam autoavaliação.");
  const seen = new Set(Object.values(db.assessments).flatMap((a) => a.item_ids));
  const chosen: string[] = [];
  for (const [skill, perLevel] of Object.entries(A.section_plan as Record<string, number>)) {
    for (const level of TEST_LEVELS) {
      const pool = (A.items as Row[]).filter((i) => i.skill === skill && i.level === level)
        .map((i) => ({ i, k: Number(seen.has(i.id)) + Math.random() * 0.5 })).sort((a, b) => a.k - b.k);
      chosen.push(...pool.slice(0, perLevel).map((x) => x.i.id));
    }
  }
  const cur = db.profiles[language]?.cefr_estimate ?? "B1";
  const targets = new Set([cur, CEFR_LEVELS[Math.min(CEFR_LEVELS.indexOf(cur) + 1, CEFR_LEVELS.length - 1)]]);
  let speaking = (A.speaking as Row[]).filter((p) => targets.has(p.level) && !seen.has(p.id));
  if (!speaking.length) speaking = [...A.speaking];
  speaking.sort(() => Math.random() - 0.5);
  chosen.push(...speaking.slice(0, 2).map((p) => p.id));
  const id = newId();
  db.assessments[id] = { id, language, kind, item_ids: chosen, started_at: nowIso(), completed_at: null };
  return db.assessments[id];
}

export function assessmentPayload(a: Row) {
  const sections: Record<string, Row[]> = {};
  const speaking: Row[] = [];
  for (const id of a.item_ids) {
    if (ITEMS[id]) {
      const { answer: _a, ...pub } = ITEMS[id];
      if (pub.type === "dictation") pub.question = "Escreva exatamente o que você ouviu.";
      (sections[pub.skill] ??= []).push(pub);
    } else if (SPEAKING[id]) speaking.push(SPEAKING[id]);
  }
  return { id: a.id, kind: a.kind, language: a.language, sections, speaking, self_assessment: a.kind === "placement" ? A.self_assessment : [],
           disclaimer_pt: "Estimativa interna baseada nos descritores CEFR. Não é uma certificação oficial.", completed: !!a.completed_at };
}

function heuristicSpeaking(responses: Row[]) {
  const text = responses.map((r) => r.transcript ?? "").join(" ");
  const words = countWords(text);
  const dur = responses.reduce((s, r) => s + Number(r.duration_seconds || 0), 0);
  const wpm = dur > 5 ? (words / dur) * 60 : null;
  const errRate = (analyze(text, "en").length / Math.max(words, 1)) * 100;
  const mattr = lexicalDiversity(text);
  const lower = text.toLowerCase();
  const connectors = [" because", " but ", " so ", " however", " although", " which ", " if "].reduce((s, c) => s + lower.split(c).length - 1, 0);
  let pts = Math.min(words / 120, 1) * 30 + Math.min(mattr / 0.75, 1) * 20 + Math.min(connectors / 6, 1) * 20 + Math.max(0, 1 - errRate / 8) * 15;
  if (wpm != null) pts += Math.min(wpm / 130, 1) * 15;
  else pts = (pts / 85) * 100;
  const score = 15 + pts * 0.7;
  return { score: round1(score), level: scoreToCefr(score), method: "heuristic", confidence: "low",
           metrics: { words, wpm: wpm ? round1(wpm) : null, lexical_diversity: Math.round(mattr * 1000) / 1000, connectors },
           fluency_score: wpm ? round1(Math.min(wpm / 130, 1) * 70 + 15) : null };
}

export function submitAssessment(db: DB, a: Row, payload: Row) {
  const answers = payload.answers ?? {};
  const speakingResp: Row[] = payload.speaking ?? [];
  const perSkill: Record<string, Record<string, number[]>> = {};
  const items: Row[] = [];
  for (const id of a.item_ids) {
    const item = ITEMS[id];
    if (!item) continue;
    const s = scoreItem(item, answers[id]);
    ((perSkill[item.skill] ??= {})[item.level] ??= []).push(s);
    items.push({ id, skill: item.skill, level: item.level, score: Math.round(s * 100) / 100,
                 correct_answer: item.type === "dictation" ? item.audio_text : item.answer, transcript: item.skill === "listening" ? item.audio_text : null });
  }
  const skills: Record<string, Row> = {};
  for (const [skill, levels] of Object.entries(perSkill)) {
    const acc = Object.fromEntries(Object.entries(levels).map(([l, v]) => [l, mean(v)]));
    const [level, score] = estimateLevel(acc);
    skills[skill] = { level, score, method: "items", confidence: "medium" };
  }
  if (speakingResp.some((r) => r.transcript)) {
    const sp = heuristicSpeaking(speakingResp);
    skills.speaking = { level: sp.level, score: sp.score, method: sp.method, confidence: sp.confidence, details: sp.metrics };
    if (sp.fluency_score != null) skills.fluency = { level: scoreToCefr(sp.fluency_score), score: sp.fluency_score, method: sp.method, confidence: "low" };
  }
  for (const missing of ["pronunciation", "interaction"]) {
    skills[missing] ??= { level: null, score: null, method: "not_measured", confidence: null,
                          note_pt: "Medido nas sessões de shadowing e conversação ao longo do plano." };
  }
  const weights: Record<string, number> = { listening: 1.5, speaking: 1.5, fluency: 1, vocabulary: 1, grammar: 1, reading: 0.7 };
  const measured = Object.entries(skills).filter(([, v]) => v.score != null);
  const wsum = measured.reduce((s, [k]) => s + (weights[k] ?? 1), 0);
  const overallScore = measured.length ? measured.reduce((s, [k, v]) => s + v.score * (weights[k] ?? 1), 0) / wsum : null;
  const overall = overallScore != null ? scoreToCefr(overallScore) : null;
  Object.assign(a, { completed_at: nowIso(), overall_cefr: overall, section_scores: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v.score])),
                     details: { skills, items, overall_score: overallScore } });
  const p = db.profiles[a.language];
  if (p) {
    p.skill_scores = { ...p.skill_scores, ...Object.fromEntries(measured.map(([k, v]) => [k, v.score])) };
    p.cefr_estimate = overall;
    if (payload.self_assessment) p.self_assessment = payload.self_assessment;
  }
  db.activities.push({ id: newId(), language: a.language, activity_type: "assessment", started_at: nowIso(), duration_seconds: Number(payload.duration_seconds || 0),
                       score: (overallScore ?? 0) / 100, details: { assessment_id: a.id } });
  return { id: a.id, overall_cefr: overall, overall_score: overallScore != null ? round1(overallScore) : null,
           overall_descriptor_pt: CONTENT.cefr.descriptors_pt[overall ?? ""] ?? "", skills, items,
           disclaimer_pt: "Estimativa interna alinhada aos descritores CEFR, não é certificação oficial. A confiança varia por competência (veja 'method' e 'confidence')." };
}

// ------------------------------- Motor adaptativo -------------------------------
export function adjustments(db: DB, language: string): { multipliers: Record<string, number>; insights: Row[] } {
  const m: Record<string, number> = {};
  const insights: Row[] = [];
  const bump = (t: string, f: number) => (m[t] = Math.round((m[t] ?? 1) * f * 1000) / 1000);
  const p = db.profiles[language] ?? {};
  const sc = p.skill_scores ?? {};
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const logs = db.activities.filter((l) => l.language === language && l.started_at >= since);
  const lst = logs.filter((l) => l.activity_type === "listening" && l.score != null).map((l) => l.score);
  const lat = logs.filter((l) => l.activity_type === "quick_response" && l.details?.latency_ms).map((l) => l.details.latency_ms).sort((a, b) => a - b);
  const qrLat = lat.length >= 5 ? lat[Math.floor(lat.length / 2)] : null;
  if (sc.reading != null && sc.listening != null && sc.reading - sc.listening >= 12) {
    bump("listening", 1.4); bump("shadowing", 1.2);
    insights.push({ signal: "reading_gt_listening", finding_pt: `Sua leitura (${Math.round(sc.reading)}) está bem acima da compreensão auditiva (${Math.round(sc.listening)}).`,
                    action_pt: "Aumentamos listening com sotaques variados e shadowing para conectar som e escrita." });
  }
  if (lst.length >= 3 && mean(lst) < 0.65) {
    bump("listening", 1.25);
    insights.push({ signal: "low_listening_practice", finding_pt: `Acerto recente em listening: ${Math.round(mean(lst) * 100)}%.`,
                    action_pt: "Mais exercícios de listening em velocidade reduzida, com ditado de trechos-chave." });
  }
  if ((qrLat != null && qrLat > 5000) || (sc.vocabulary != null && sc.speaking != null && sc.vocabulary - sc.speaking >= 10)) {
    bump("quick_response", 1.5); bump("think_in_english", 1.3); bump("conversation", 1.2);
    insights.push({ signal: "knows_but_slow", finding_pt: "Você conhece o vocabulário, mas a resposta oral ainda é lenta.",
                    action_pt: "Mais Quick Response e Think in English para recuperar palavras sem tradução mental." });
  }
  const errs: Record<string, number> = {};
  for (const e of Object.values(db.errors)) if (e.language === language && !e.resolved && e.subtype) errs[e.subtype] = (errs[e.subtype] ?? 0) + e.occurrences;
  const recurring = Object.entries(errs).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (recurring.length) {
    bump("error_review", 1.6); bump("sentence_building", 1.3);
    insights.push({ signal: "recurring_errors", focus: recurring.map(([k]) => k), finding_pt: `Erros recorrentes: ${recurring.map(([k]) => k).join(", ")}.`,
                    action_pt: "Inserimos revisões contextualizadas desses pontos e construção de frases com eles." });
  }
  const dest = language === "en" ? DESTINATIONS[p.trip_destination ?? ""] : undefined;
  if (dest) {
    for (const [t, f] of Object.entries(dest.multipliers as Record<string, number>)) m[t] = Math.round((m[t] ?? 1) * f * 1000) / 1000;
    insights.unshift(dest.insight);
  }
  return { multipliers: m, insights };
}

function phasesFor(destination: string | null): Row {
  const phases = JSON.parse(JSON.stringify(PHASES));
  const dest = DESTINATIONS[destination ?? ""];
  if (dest) for (const [ph, goals] of Object.entries(dest.goals_pt as Record<string, string[]>)) phases[ph].measurable_goals_pt.push(...goals);
  return phases;
}

// ------------------------------- Plano -------------------------------
export function createPlan(db: DB, language: string): Row {
  const p = db.profiles[language];
  const start = todayIso();
  const total = planLength(start, p.trip_date);
  const { multipliers, insights } = adjustments(db, language);
  const placementDone = Object.values(db.assessments).some((a) => a.language === language && a.completed_at);
  const days = generate({ start, total_days: total, daily_minutes: p.daily_minutes, learner_level: p.cefr_estimate ?? "B1", multipliers,
                          focus_domains: p.focus_domains, placement_done: placementDone, destination: p.trip_destination });
  for (const pl of Object.values(db.plans)) if (pl.language === language) pl.status = "archived";
  const id = newId();
  db.plans[id] = { id, language, status: "active", created_at: nowIso(), last_adapted_at: null, start_date: start, end_date: days[days.length - 1].date,
                   total_days: total, daily_minutes: p.daily_minutes,
                   title: `Programa Intensivo de ${language === "en" ? "Inglês Profissional" : "Idioma"} — ${total} dias`,
                   config: { phases: phasesFor(p.trip_destination), multipliers, insights, destination: p.trip_destination,
                             expected_outcomes: expectedOutcomes(total, p.daily_minutes, p.cefr_estimate) },
                   days: days.map((d) => ({ ...d, completed_at: null })) };
  return db.plans[id];
}

export const currentPlan = (db: DB, language: string): Row | undefined =>
  Object.values(db.plans).filter((p) => p.language === language && p.status === "active").sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

const todayIndex = (plan: Row) => Math.min(Math.max(Math.floor((Date.parse(todayIso()) - Date.parse(plan.start_date)) / 86_400_000) + 1, 1), plan.total_days);

export function dayView(d: Row) {
  return { day: d.day_index, date: d.date, phase: d.phase, focus: d.focus, is_assessment_day: d.is_assessment_day, completed: !!d.completed_at,
           minutes: d.activities.reduce((s: number, a: Row) => s + a.minutes, 0), activities: d.activities };
}

export function planView(plan: Row) {
  return { id: plan.id, title: plan.title, language: plan.language, start_date: plan.start_date, end_date: plan.end_date, total_days: plan.total_days,
           daily_minutes: plan.daily_minutes, today: todayIndex(plan), phases: plan.config.phases, insights: plan.config.insights,
           expected_outcomes: plan.config.expected_outcomes, last_adapted_at: plan.last_adapted_at,
           days: plan.days.map((d: Row) => ({ day: d.day_index, date: d.date, phase: d.phase, focus: d.focus, is_assessment_day: d.is_assessment_day,
                                              completed: !!d.completed_at, done: d.activities.filter((a: Row) => a.done).length, total: d.activities.length })) };
}

export function completeActivity(plan: Row, dayIndex: number, activityId: string): Row | null {
  const day = plan.days.find((d: Row) => d.day_index === dayIndex);
  const act = day?.activities.find((a: Row) => a.id === activityId);
  if (!day || !act) return null;
  act.done = true;
  act.done_at = nowIso();
  if (day.activities.every((a: Row) => a.done)) day.completed_at = nowIso();
  return day;
}

export function adaptPlan(db: DB, plan: Row) {
  const p = db.profiles[plan.language];
  const { multipliers, insights } = adjustments(db, plan.language);
  const regen = generate({ start: plan.start_date, total_days: plan.total_days, daily_minutes: p.daily_minutes, learner_level: p.cefr_estimate ?? "B1",
                           multipliers, focus_domains: p.focus_domains, placement_done: true, destination: p.trip_destination });
  const today = todayIso();
  let changed = 0;
  for (const d of plan.days) {
    if (d.date <= today || d.activities.some((a: Row) => a.done)) continue;
    const n = regen[d.day_index - 1];
    d.activities = n.activities;
    d.is_assessment_day = n.is_assessment_day;
    changed++;
  }
  plan.config = { ...plan.config, multipliers, insights, phases: phasesFor(p.trip_destination) };
  plan.last_adapted_at = nowIso();
  return { changed_days: changed, insights, multipliers };
}

// ------------------------------- Drills -------------------------------
export function nextTimeLimit(current: number, success: boolean) {
  return Math.trunc(Math.min(Math.max(current * (success ? 0.9 : 1.15), 2500), 12000));
}

export function evaluateQuickResponse(question: Row, answer: string, latency: number, limit: number, language: string) {
  const words = countWords(answer);
  const inTime = latency <= limit;
  const kw: string[] = (question.keywords ?? []).map((k: string) => k.toLowerCase());
  const norm = normalize(answer);
  const relevant = kw.length ? kw.some((k) => norm.includes(k)) : true;
  const success = inTime && words >= 2 && relevant;
  return {
    in_time: inTime, latency_ms: latency, words, answered: words >= 2, relevant, corrections: analyze(answer, language), model_answer: question.model,
    method: "rules", success, next_time_limit_ms: nextTimeLimit(limit, success),
    feedback_pt: inTime && words >= 2 ? "Rápido e direto!" : !inTime
      ? "Tente começar a falar antes de ter a frase perfeita: comece com 'Well…' ou 'I think…'." : "Responda com pelo menos uma frase curta.",
  };
}

export function evaluateSentenceBuilding(item: Row, answer: string) {
  if (item.stage === "order") {
    const [ok, sim] = answerMatches(answer, [item.answer], 0.95);
    return { correct: ok, similarity: Math.round(sim * 1000) / 1000, expected: item.answer, method: "exact_order" };
  }
  const corrections = analyze(answer, "en");
  const words = countWords(answer);
  const base = item.base ? countWords(item.base) : 0;
  const expanded = base ? words >= base + 3 : words >= 8;
  const toks = normalize(answer).split(" ");
  const connectors = ["because", "but", "however", "if", "provided", "when", "so", "which", "although", "next", "then"].filter((c) => toks.includes(c));
  return { correct: expanded && !corrections.length, expanded, connectors_used: connectors, corrections, example: item.example,
           corrected: corrections.length ? correctText(answer) : null, method: "rules" };
}

export function scoreListening(ex: Row, answers: Row) {
  const questions = ex.questions.map((q: Row, i: number) => {
    const a = answers[String(i)];
    if (q.type === "mc") return { index: i, correct: a != null && String(a) !== "" && Number(a) === q.answer, expected: q.options[q.answer] };
    return { index: i, correct: answerMatches(String(a ?? ""), q.accepted)[0], expected: q.accepted[0] };
  });
  const dictation = (ex.dictation ?? []).map((target: string, j: number) => {
    const a = answers[`d${j}`];
    return a == null ? null : { index: j, target, answer: a, accuracy: Math.round(similarity(String(a), target) * 1000) / 10 };
  }).filter(Boolean);
  const total = questions.length + dictation.length;
  const score = total ? (questions.filter((q: Row) => q.correct).length + dictation.reduce((s: number, d: Row) => s + d.accuracy / 100, 0)) / total : 0;
  return { score: Math.round(score * 1000) / 1000, questions, dictation, transcript: ex.lines, connected_speech: ex.connected_speech ?? [], key_phrases: ex.key_phrases ?? [] };
}

// ------------------------------- Dashboard -------------------------------
const SKILL_LABELS: Record<string, string> = CONTENT.skill_labels_pt;

export function dashboard(db: DB, language: string) {
  const today = todayIso();
  const p = db.profiles[language];
  const logs = db.activities.filter((l) => l.language === language);
  const byDay: Record<string, number> = {};
  for (const l of logs) byDay[l.started_at.slice(0, 10)] = (byDay[l.started_at.slice(0, 10)] ?? 0) + l.duration_seconds / 60;
  const active = new Set(Object.entries(byDay).filter(([, m]) => m >= 1).map(([d]) => d));
  const dayOf = (offset: number) => new Date(Date.parse(today) - offset * 86_400_000).toISOString().slice(0, 10);
  let streak = 0;
  for (let o = active.has(today) ? 0 : 1; active.has(dayOf(o)); o++) streak++;
  const series = (type: string) => logs.filter((l) => l.activity_type === type && l.score != null).slice(-12)
    .map((l) => ({ date: l.started_at.slice(0, 10), value: Math.round(l.score * 1000) / 10 }));
  const sessions = Object.values(db.sessions).filter((s) => s.language === language && s.ended_at).sort((a, b) => (a.ended_at < b.ended_at ? -1 : 1));
  const qr = logs.filter((l) => l.activity_type === "quick_response" && l.details?.latency_ms).map((l) => l.details.latency_ms).sort((a, b) => a - b);
  const assessments = Object.values(db.assessments).filter((a) => a.language === language && a.completed_at).sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1));
  const plan = currentPlan(db, language);
  let planInfo = null;
  let pending: Row[] = [];
  if (plan) {
    const idx = todayIndex(plan);
    const todayDay = plan.days[idx - 1];
    const total = plan.days.reduce((s: number, d: Row) => s + d.activities.length, 0);
    const done = plan.days.reduce((s: number, d: Row) => s + d.activities.filter((a: Row) => a.done).length, 0);
    pending = todayDay ? todayDay.activities.filter((a: Row) => !a.done) : [];
    planInfo = { id: plan.id, day: idx, total_days: plan.total_days, phase: todayDay?.phase ?? null,
                 percent_activities_done: total ? Math.round((done / total) * 1000) / 10 : 0,
                 days_completed: plan.days.filter((d: Row) => d.completed_at).length, end_date: plan.end_date,
                 next_assessment_day: plan.days.filter((d: Row) => d.is_assessment_day && d.day_index >= idx).map((d: Row) => d.day_index)[0] ?? null };
  }
  const vs = vocabStats(db, language);
  const scores = p?.skill_scores ?? {};
  return {
    language: publicLanguage(language), level_estimate: p?.cefr_estimate ?? null,
    level_source: assessments.length ? "assessment" : "self_reported",
    level_note_pt: assessments.length ? "Estimativa interna (descritores CEFR) — não é certificação." : "Nível autodeclarado. Faça a avaliação para medir suas competências.",
    skills: Object.keys(SKILL_LABELS).map((k) => ({ skill: k, label_pt: SKILL_LABELS[k], score: scores[k] ?? null })),
    effort: {
      total_minutes: Math.round(Object.values(byDay).reduce((a, b) => a + b, 0) * 10) / 10, today_minutes: Math.round((byDay[today] ?? 0) * 10) / 10,
      daily_goal_minutes: p?.daily_minutes ?? 45, streak_days: streak,
      week: [6, 5, 4, 3, 2, 1, 0].map((o) => ({ date: dayOf(o), minutes: Math.round((byDay[dayOf(o)] ?? 0) * 10) / 10 })),
      note_pt: "Tempo de estudo mede esforço, não domínio. Seu nível é medido pelas avaliações e desempenho.",
    },
    vocabulary: vs, pending: { cards_due: vs.due_now, plan_activities_today: pending },
    conversation: { sessions: sessions.length, quick_response_median_ms: qr.length ? qr[Math.floor(qr.length / 2)] : null,
                    history: sessions.slice(-12).map((s) => ({ date: s.ended_at.slice(0, 10), avg_words_per_turn: s.metrics.avg_words_per_turn,
                                                              latency_ms: s.metrics.avg_response_latency_ms, wpm: s.metrics.speech_rate_wpm,
                                                              minutes: Math.round((s.metrics.duration_seconds ?? 0) / 6) / 10, mode: s.mode })) },
    listening: { history: series("listening") }, shadowing: { history: series("shadowing") },
    skill_history: assessments.map((a) => ({ date: a.completed_at.slice(0, 10), kind: a.kind, overall: a.overall_cefr, scores: a.section_scores })),
    plan: planInfo,
  };
}
