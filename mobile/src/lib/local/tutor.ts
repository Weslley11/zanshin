/** Tutor no aparelho (sem IA generativa) — porte de offline_tutor.py + orquestração de tutor.py. */
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { analyze, correctText, type Correction } from "./errors";
import { countWords, lexicalDiversity, looksPortuguese, normalize } from "./text";
import { addPersonalItem } from "./vocab";

const D = CONTENT.drills;
const GENERIC_OPENING: Record<string, string> = {
  en: "Hi! I'm Alex, your practice partner. Let's just talk. {topic}",
  es: "¡Hola! Soy Lucía. Vamos a conversar un poco. ¿Qué tal tu día?",
  it: "Ciao! Sono Marco. Facciamo due chiacchiere. Come stai oggi?",
  zh: "你好！我是李明。我们聊聊天吧。你今天怎么样？",
  ja: "こんにちは！ユキです。少し話しましょう。今日はどうですか。",
};
const SIMPLE_FOLLOWUPS: Record<string, string[]> = {
  es: ["¿Y por qué?", "¡Qué interesante! ¿Me cuentas más?", "¿Y qué pasó después?"],
  it: ["E perché?", "Interessante! Mi racconti di più?", "E poi cosa è successo?"],
  zh: ["为什么？", "很有意思！再说说吧。", "然后呢？"],
  ja: ["どうしてですか。", "おもしろいですね。もう少し教えてください。", "それから？"],
};
const INDIA_TOPICS = [
  "Tell me about your trip to India: which city are you visiting, and what will you do there?",
  "Imagine your first day at the plant in India. How will you introduce yourself to the team?",
  "What do you want to eat in India? Are you veg or non-veg?",
];
const MODE_TITLES: Record<string, string> = { natural: "Conversa livre", immediate: "Treino com correção imediata",
  no_native: "No Portuguese Mode", quick_response: "Quick Response" };
export const getScenario = (id: string | null | undefined): Row | undefined => (CONTENT.scenarios as Row[]).find((s) => s.id === id);

function topics(level: string, destination?: string | null): string[] {
  const base: string[] = D.topics[level] ?? D.topics.B1;
  return destination === "IN" ? [INDIA_TOPICS[0], ...base, ...INDIA_TOPICS.slice(1)] : base;
}

function nextQuick(language: string, level: string, state: Row): string {
  const pool: Row[] = language === "en" ? D.quick_response : D.quick_response_other[language] ?? [];
  const near = pool.filter((q) => q.level === level).length ? pool.filter((q) => q.level === level) : pool;
  const i = state.qr_index ?? 0;
  state.qr_index = i + 1;
  return near.length ? near[i % near.length].q : "?";
}

function opening(language: string, mode: string, level: string, scenario: Row | undefined, state: Row, destination?: string | null): string {
  if (scenario) {
    state.script_index = 0;
    return scenario.opening;
  }
  if (mode === "quick_response") return (language === "en" ? "Quick response! Answer as fast as you can. " : "") + nextQuick(language, level, state);
  state.topic_index = 0;
  return (GENERIC_OPENING[language] ?? GENERIC_OPENING.en).replace("{topic}", topics(level, destination)[0]);
}

function reply(o: { language: string; mode: string; level: string; scenario?: Row; state: Row; text: string; corrections: Correction[];
  destination?: string | null }): string {
  const { language, mode, level, scenario, state, text, corrections } = o;
  const turn = state.user_turns ?? 0;
  const bc = language === "en" ? D.backchannels[turn % D.backchannels.length] : "";
  const recast = mode === "immediate" && corrections.length && language === "en" ? `Oh, you mean: "${correctText(corrections[0].original)}" ` : "";
  if (mode === "no_native" && looksPortuguese(text)) {
    return "Let's keep it in English! Try with simple words. You can start with: \"I think…\" or \"In my opinion…\".";
  }
  if (scenario) {
    const i = state.script_index ?? 0;
    const lines: string[] = [];
    if (i === 3 && !state.event_done) {
      state.event_done = true;
      lines.push("(Unexpected situation) " + scenario.unexpected_events[(state.event_index ?? 0) % scenario.unexpected_events.length]);
    }
    if (i < scenario.script.length) {
      lines.push(scenario.script[i]);
      state.script_index = i + 1;
    } else {
      lines.push("Alright, I think that covers everything. Thanks a lot!");
      state.finished = true;
    }
    return `${recast}${bc} ${lines.join(" ")}`.trim();
  }
  if (mode === "quick_response") return `${recast}${bc} ${nextQuick(language, level, state)}`.trim();
  if (language !== "en") {
    const ups = SIMPLE_FOLLOWUPS[language] ?? ["?"];
    return ups[turn % ups.length];
  }
  let next: string;
  if (countWords(text) < 8 && (state.followups_on_topic ?? 0) < 2) {
    state.followups_on_topic = (state.followups_on_topic ?? 0) + 1;
    next = D.follow_ups[turn % D.follow_ups.length];
  } else {
    state.followups_on_topic = 0;
    const t = topics(level, o.destination);
    state.topic_index = ((state.topic_index ?? 0) + 1) % t.length;
    next = "Let's talk about something else. " + t[state.topic_index];
  }
  return `${recast}${bc} ${next}`.trim();
}

export function startSession(db: DB, o: { language: string; mode: string; scenario_id?: string; settings: Row }): Row {
  const profile = db.profiles[o.language];
  const scenario = o.mode === "scenario" ? getScenario(o.scenario_id) : undefined;
  if (o.mode === "scenario" && !scenario) throw new Error("Cenário não encontrado.");
  const level = o.settings.level ?? profile?.cefr_estimate ?? "B1";
  const settings: Row = { ...o.settings, level };
  if (!settings.accent && profile?.preferred_accents?.length && o.language === "en" && !scenario) settings.accent = profile.preferred_accents[0];
  if (scenario) settings.event_index = Math.floor(Date.now() / 1000) % Math.max(1, scenario.unexpected_events.length);
  const state: Row = { user_turns: 0, goals_achieved: [] };
  const id = newId();
  const title = scenario ? scenario.title_pt : o.mode === "challenge" ? `Conversation Challenge — ${settings.challenge_minutes ?? 5} min` : MODE_TITLES[o.mode] ?? "Conversa";
  const first = opening(o.language, o.mode, level, scenario, state, profile?.trip_destination);
  db.sessions[id] = { id, language: o.language, mode: o.mode, scenario_id: scenario?.id ?? null, title, settings, state, report: null,
                      metrics: {}, provider: "offline", started_at: nowIso(), ended_at: null,
                      turns: [{ role: "assistant", text: first, corrections: [], meta: {}, created_at: nowIso() }] };
  return db.sessions[id];
}

export function sessionView(s: Row) {
  return { id: s.id, language: s.language, mode: s.mode, scenario_id: s.scenario_id, title: s.title, settings: s.settings, engine: s.provider,
           started_at: s.started_at, ended_at: s.ended_at, report: s.report, goals_achieved: s.state.goals_achieved ?? [],
           turns: s.turns.map((t: Row) => ({ role: t.role, text: t.text, created_at: t.created_at,
                                             corrections: s.mode === "immediate" || s.ended_at ? t.corrections : [] })) };
}

export function postMessage(db: DB, s: Row, text: string, meta: Row) {
  if (s.ended_at) throw new Error("Esta sessão já foi encerrada.");
  const clean = text.trim().slice(0, 2000);
  if (!clean) throw new Error("Mensagem vazia.");
  s.state.user_turns = (s.state.user_turns ?? 0) + 1;
  const m = { ...meta, words: countWords(clean), portuguese: looksPortuguese(clean) };
  const corrections = analyze(clean, s.language);
  s.turns.push({ role: "user", text: clean, corrections, meta: m, created_at: nowIso() });
  const scenario = getScenario(s.scenario_id);
  const answer = reply({ language: s.language, mode: s.mode, level: s.settings.level ?? "B1", scenario, state: s.state, text: clean, corrections,
                         destination: db.profiles[s.language]?.trip_destination });
  s.turns.push({ role: "assistant", text: answer, corrections: [], meta: {}, created_at: nowIso() });
  const visible = s.mode === "immediate" ? corrections : corrections.filter((c) => c.severity === "blocks_understanding");
  return { reply: answer, visible_corrections: visible, hidden_corrections_count: corrections.length - visible.length, new_vocabulary: [],
           goals: scenario ? scenario.goals.map((g: Row) => ({ id: g.id, pt: g.pt, achieved: false })) : [], comprehension_issue: false,
           portuguese_detected: m.portuguese, degraded: null, engine: "offline" };
}

function metrics(s: Row) {
  const user = s.turns.filter((t: Row) => t.role === "user");
  const words = user.map((t: Row) => countWords(t.text));
  const lat = user.map((t: Row) => t.meta.latency_ms).filter(Boolean);
  const audio = user.map((t: Row) => t.meta.audio_seconds).filter(Boolean);
  const audioWords = user.filter((t: Row) => t.meta.audio_seconds).map((t: Row) => countWords(t.text));
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const end = s.ended_at ? Date.parse(s.ended_at) : Date.now();
  return {
    user_turns: user.length, user_words: sum(words), avg_words_per_turn: words.length ? Math.round((sum(words) / words.length) * 10) / 10 : 0,
    longest_turn_words: words.length ? Math.max(...words) : 0,
    avg_response_latency_ms: lat.length ? Math.round(sum(lat) / lat.length) : null,
    speaking_seconds: audio.length ? Math.round(sum(audio) * 10) / 10 : null,
    speech_rate_wpm: audio.length && sum(audio) > 3 ? Math.round((sum(audioWords) / sum(audio)) * 600) / 10 : null,
    lexical_diversity: user.length ? Math.round(lexicalDiversity(user.map((t: Row) => t.text).join(" ")) * 1000) / 1000 : null,
    portuguese_turns: user.filter((t: Row) => t.meta.portuguese).length,
    voice_turns: user.filter((t: Row) => t.meta.source === "voice" || t.meta.source === "device_stt").length,
    duration_seconds: Math.floor((end - Date.parse(s.started_at)) / 1000),
  };
}

function report(language: string, scenario: Row | undefined, texts: string[], corrections: Correction[], m: Row) {
  const key = (c: Correction) => c.rule_id || c.subtype;
  const counts: Record<string, number> = {};
  for (const c of corrections) counts[key(c)] = (counts[key(c)] ?? 0) + 1;
  const seen = new Set<string>();
  const sev = ["minor", "may_confuse", "blocks_understanding"];
  const main = corrections.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true)))
    .map((c) => ({ original: c.original, corrected: c.corrected, explanation_pt: c.explanation_pt, category: c.category, subtype: c.subtype,
                   severity: c.severity, count: counts[key(c)] }))
    .sort((a, b) => sev.indexOf(b.severity) - sev.indexOf(a.severity) || b.count - a.count);
  const corrected = [...new Set(corrections.map((c) => c.original))].map((o) => ({ original: o, corrected: language === "en" ? correctText(o) : o }));
  const used = normalize(texts.join(" "));
  const vocab = scenario ? (scenario.useful_phrases as string[]).filter((p) => {
    const core = normalize(p.replace(/…/g, ""));
    return core && !used.includes(core);
  }).map((p) => ({ term: p, meaning_pt: "Expressão útil para este cenário", example: p })) : [];
  const recs: string[] = [];
  const wpt = m.avg_words_per_turn || 0;
  if (wpt && wpt < 8) recs.push("Suas respostas foram curtas. Treine expandir com 'because…', 'for example…', 'so…' (Construção de frases).");
  if (m.avg_response_latency_ms && m.avg_response_latency_ms > 6000) recs.push("Você demorou para começar a responder. Faça sessões de Quick Response para acelerar a recuperação de palavras.");
  if (m.portuguese_turns) recs.push("Você recorreu ao português algumas vezes. Experimente Think in English: explicar a ideia com palavras simples.");
  if (main.length) recs.push("Revise os erros abaixo: eles foram adicionados ao seu caderno de erros e à revisão espaçada.");
  if (!recs.length) recs.push("Boa sessão! Na próxima, aumente a duração do Conversation Challenge.");
  const qr = D.quick_response[texts.length % D.quick_response.length];
  const exercises = main.slice(0, 3).map((e) => ({ type: "rewrite", instruction_pt: "Reescreva a frase corretamente.", prompt: e.original,
                                                   answer: language === "en" ? correctText(e.original) : e.corrected }));
  if (language === "en") exercises.push({ type: "quick_answer", instruction_pt: "Responda em até 5 segundos, em voz alta.", prompt: qr.q, answer: qr.model });
  return {
    summary_pt: `Você fez ${m.user_turns} intervenções com média de ${wpt.toFixed(1)} palavras. Foram detectados ${corrections.length} pontos de atenção por regras automáticas.`,
    strengths_pt: [...(!m.portuguese_turns ? ["Você manteve a conversa em inglês durante toda a sessão."] : []), ...(wpt >= 12 ? ["Boa extensão das respostas."] : [])],
    main_errors: main.slice(0, 6), corrected_sentences: corrected.slice(0, 8), natural_expressions: [], new_vocabulary: vocab.slice(0, 6),
    recommendations_pt: recs, exercises, topics: scenario ? [scenario.title_pt] : [],
    cefr_observation_pt: "Observação por nível CEFR disponível com IA generativa configurada.",
    limitations_pt: "Relatório gerado no aparelho (regras automáticas): detecta erros comuns de falantes de português e não avalia naturalidade, coerência ou objetivos do cenário.",
    engine: "offline",
  };
}

export function endSession(db: DB, s: Row) {
  if (s.ended_at && s.report) return s.report;
  s.ended_at = nowIso();
  const m = metrics(s);
  s.metrics = m;
  const userTexts = s.turns.filter((t: Row) => t.role === "user").map((t: Row) => t.text);
  const corrections: Correction[] = s.turns.filter((t: Row) => t.role === "user").flatMap((t: Row) => t.corrections ?? []);
  const scenario = getScenario(s.scenario_id);
  const r: Row = report(s.language, scenario, userTexts, corrections, m);
  if (scenario) {
    r.goals = scenario.goals.map((g: Row) => ({ id: g.id, pt: g.pt, achieved: false }));
    r.goals_note_pt = "Verificação automática de objetivos disponível apenas com IA generativa.";
  }
  r.metrics = m;
  for (const e of r.main_errors) saveError(db, s.language, e, s.id);
  let added = 0;
  for (const v of r.new_vocabulary.slice(0, 6)) if (addPersonalItem(db, { language: s.language, term: v.term, meaning_pt: v.meaning_pt, example: v.example, source: "tutor" })) added++;
  for (const e of r.main_errors.slice(0, 3)) {
    if (addPersonalItem(db, { language: s.language, term: e.corrected.slice(0, 200), meaning_pt: `Diga de forma correta: “${e.original.slice(0, 200)}”`,
                              definition: e.explanation_pt, example: e.corrected, kind: "correction", source: "error" })) added++;
  }
  r.added_to_review = added;
  db.activities.push({ id: newId(), language: s.language, activity_type: s.mode === "scenario" ? "scenario" : "conversation", started_at: s.started_at,
                       duration_seconds: m.duration_seconds, score: null, details: { session_id: s.id, mode: s.mode, latency_ms: m.avg_response_latency_ms,
                                                                                    avg_words_per_turn: m.avg_words_per_turn } });
  s.report = r;
  return r;
}

export function saveError(db: DB, language: string, e: Row, sourceId: string | null) {
  const original = (e.original ?? "").trim();
  const corrected = (e.corrected ?? "").trim();
  if (!original || !corrected || original.toLowerCase() === corrected.toLowerCase()) return;
  const existing = Object.values(db.errors).find((x) => x.language === language && x.subtype === (e.subtype ?? "") && x.corrected.toLowerCase() === corrected.toLowerCase());
  if (existing) {
    existing.occurrences += e.count ?? 1;
    existing.last_seen_at = nowIso();
    existing.correct_streak = 0;
    existing.resolved = false;
    return;
  }
  const id = newId();
  db.errors[id] = { id, language, category: e.category ?? "grammar", subtype: e.subtype ?? "", original, corrected, explanation_pt: e.explanation_pt ?? "",
                    severity: e.severity ?? "minor", source: "tutor", source_id: sourceId, occurrences: e.count ?? 1, correct_streak: 0, resolved: false,
                    created_at: nowIso(), last_seen_at: nowIso() };
}
