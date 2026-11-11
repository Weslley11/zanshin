/**
 * API local: implementa os endpoints do backend no próprio aparelho (modo sem servidor / PWA / offline).
 * As telas chamam `api()` normalmente; aqui o caminho é roteado para a lógica local e os dados ficam no AsyncStorage.
 */
import { ApiError } from "../apiError";
import { CONTENT, CEFR_LEVELS, publicLanguage } from "./content";
import { getDB, newId, nowIso, resetDB, saveDB, type DB, type Row } from "./db";
import {
  adaptPlan, assessmentPayload, completeActivity, createPlan, currentPlan, dashboard, dayView, evaluateQuickResponse,
  evaluateSentenceBuilding, planView, scoreListening, startAssessment, submitAssessment,
} from "./learning";
import { shadowingFeedback } from "./speech";
import { endSession, getScenario, postMessage, sessionView, startSession } from "./tutor";
import { addPersonalItem, cardView, checkAnswer, enroll, priorityDomains, reprioritize, reviewCard, sessionCards, stats } from "./vocab";
import { answerMatches } from "./text";

type Opts = { method?: string; body?: any; form?: FormData };
const D = CONTENT.drills;
const DEST_ACCENTS: Record<string, string[]> = { IN: ["IN", "UK", "US"], US: ["US", "UK"], GB: ["UK", "US"], AU: ["AU", "UK", "US"] };
const CONSENTS = ["voice_processing", "recording_storage", "document_processing", "ai_processing"];
const TOKENS = { access_token: "local", refresh_token: "local", token_type: "bearer", expires_in: 31_536_000 };

const notFound = (what = "Não encontrado.") => new ApiError(404, what);
const bad = (msg: string) => new ApiError(400, msg);
const serverOnly = (what: string) => new ApiError(501, `${what} requer um servidor com provedores configurados. No modo local, use o teclado (o ditado do iPhone funciona) ou o reconhecimento de voz do navegador.`, { code: "server_only" }, "server_only");

function formValue(form: FormData | undefined, key: string): string | null {
  if (!form) return null;
  const f = form as any;
  if (typeof f.get === "function") {
    const v = f.get(key);
    return v == null ? null : String(v);
  }
  const part = (f.getParts?.() ?? []).find((p: any) => p.fieldName === key);
  return part ? String(part.string ?? "") : null;
}

function profileView(p: Row) {
  return { language: p.language, cefr_estimate: p.cefr_estimate ?? null, skill_scores: p.skill_scores ?? {}, daily_minutes: p.daily_minutes,
           goals: p.goals ?? [], focus_domains: p.focus_domains ?? [], difficulties: p.difficulties ?? [], trip_date: p.trip_date ?? null,
           preferred_accents: p.preferred_accents ?? [], new_cards_per_day: p.new_cards_per_day ?? 12, trip_destination: p.trip_destination ?? null };
}

function meView(db: DB) {
  const u = db.user!;
  return { id: u.id, email: u.email, display_name: u.display_name, ui_locale: "pt-BR", active_language: u.active_language,
           consents: u.consents, profiles: Object.values(db.profiles).map(profileView) };
}

const logActivity = (db: DB, row: Row) => db.activities.push({ id: newId(), started_at: nowIso(), score: null, details: {}, ...row });

function requireUser(db: DB) {
  if (!db.user) throw new ApiError(401, "Crie seu perfil para começar.");
}

async function route(db: DB, method: string, path: string, q: URLSearchParams, body: any, form?: FormData): Promise<unknown> {
  const seg = path.split("/").filter(Boolean);
  const lang = q.get("language") ?? db.user?.active_language ?? "en";

  // ------------------------------- sistema e conta -------------------------------
  if (path === "/system/capabilities") {
    return { llm: { provider: "offline", model: "rules", generative: false }, stt: { provider: null, available: false },
             tts: { provider: "device", server_available: false },
             pronunciation_assessment: { provider: null, available: false, fallback: "client_transcript_only" }, realtime_streaming: false,
             local_mode: true,
             notes_pt: ["Modo local: tudo roda no seu aparelho, sem servidor e sem custo. O tutor usa roteiros e correções por regras (sem IA generativa)."] };
  }
  if (path === "/auth/register" && method === "POST") {
    db.user = { id: newId(), email: body?.email || "local@device", display_name: (body?.display_name ?? "").trim(), active_language: "en",
                consents: Object.fromEntries(CONSENTS.map((k) => [k, true])), created_at: nowIso() };
    return TOKENS;
  }
  if ((path === "/auth/login" || path === "/auth/refresh") && method === "POST") {
    if (!db.user) throw new ApiError(401, "Nenhum perfil neste aparelho.");
    return TOKENS;
  }
  if (path === "/auth/logout") return undefined;
  if (path === "/languages") return Object.keys(CONTENT.languages).map(publicLanguage);
  if (seg[0] === "languages" && seg[1]) {
    if (!CONTENT.languages[seg[1]]) throw notFound("Idioma não suportado.");
    const extra = seg[1] === "ja" ? { hiragana: CONTENT.starter.hiragana, katakana: CONTENT.starter.katakana }
      : seg[1] === "zh" ? { tone_pairs: CONTENT.starter.tone_pairs } : {};
    return { ...publicLanguage(seg[1]), starter: extra };
  }
  if (seg[0] === "varieties") {
    if (seg[1]?.toUpperCase() !== "IN") throw notFound("Variedade não disponível.");
    return CONTENT.india_guide;
  }

  requireUser(db);
  if (path === "/me" && method === "GET") return meView(db);
  if (path === "/me" && method === "PATCH") {
    if (body.display_name != null) db.user!.display_name = String(body.display_name).trim();
    if (body.active_language != null) {
      if (!CONTENT.languages[body.active_language]) throw bad("Idioma não suportado.");
      db.user!.active_language = body.active_language;
    }
    return meView(db);
  }
  if (path === "/me/consents") {
    db.user!.consents = { ...db.user!.consents, ...body.consents };
    return db.user!.consents;
  }
  if (seg[0] === "me" && seg[1] === "profiles" && seg[2]) {
    const language = seg[2];
    if (!CONTENT.languages[language]) throw notFound("Idioma não suportado.");
    const created = !db.profiles[language];
    const p = (db.profiles[language] ??= { language, skill_scores: {}, cefr_estimate: null });
    const changed = p.trip_destination !== (body.trip_destination ?? null);
    Object.assign(p, { daily_minutes: body.daily_minutes ?? 45, goals: body.goals ?? [], focus_domains: body.focus_domains ?? [],
                       difficulties: body.difficulties ?? [], trip_date: body.trip_date ?? null, new_cards_per_day: body.new_cards_per_day ?? 12,
                       preferred_accents: body.preferred_accents ?? [], trip_destination: body.trip_destination ?? null });
    if (p.trip_destination && DEST_ACCENTS[p.trip_destination] && (!(body.preferred_accents ?? []).length || changed)) p.preferred_accents = DEST_ACCENTS[p.trip_destination];
    if (body.self_level && !p.cefr_estimate) p.cefr_estimate = body.self_level;
    db.user!.active_language = language;
    if (created) enroll(db, language, priorityDomains(p));
    else if (changed) reprioritize(db, language, priorityDomains(p));
    return profileView(p);
  }
  if (path === "/me/usage") return { llm_tokens: { used: 0, limit: 0 }, stt_seconds: { used: 0, limit: 0 }, tts_chars: { used: 0, limit: 0 } };
  if (path === "/me/export") return { exported_at: nowIso(), format: "fluent-ai-local-v1", data: db };
  if (path === "/me/import" && method === "POST") return { ok: true };
  if (path === "/me/delete") {
    await resetDB();
    return undefined;
  }

  // ------------------------------- conteúdo -------------------------------
  if (path === "/scenarios") {
    const cat = q.get("category");
    const country = q.get("country");
    return (CONTENT.scenarios as Row[]).filter((s) => (!cat || s.category === cat) && (!country || s.country === country))
      .map((s) => ({ id: s.id, category: s.category, title_pt: s.title_pt, level: s.level, phase: s.phase, domain: s.domain, minutes: s.minutes,
                     learner_role: s.learner_role, goals: s.goals, characters: s.characters, country: s.country ?? null }));
  }
  if (seg[0] === "scenarios" && seg[1]) {
    const s = getScenario(seg[1]);
    if (!s) throw notFound("Cenário não encontrado.");
    const { script: _s, ...pub } = s;
    return pub;
  }
  const listeningPublic = (x: Row, full: boolean) => ({
    id: x.id, title: x.title, level: x.level, domain: x.domain, phase: x.phase, accents: x.accents, country: x.country ?? null,
    ...(full ? { lines: x.lines, questions: x.questions.map(({ answer: _a, accepted: _b, ...rest }: Row) => rest), dictation: x.dictation ?? [],
                 dictation_count: (x.dictation ?? []).length, structure_tip_pt: x.structure_tip_pt ?? null } : {}),
  });
  if (path === "/listening") return lang === "en" ? (CONTENT.listening as Row[]).filter((x) => !q.get("level") || x.level === q.get("level")).map((x) => listeningPublic(x, false)) : [];
  if (seg[0] === "listening" && seg[1]) {
    const x = (CONTENT.listening as Row[]).find((e) => e.id === seg[1]);
    if (!x) throw notFound("Exercício não encontrado.");
    if (seg[2] !== "submit") return listeningPublic(x, true);
    const res = scoreListening(x, Object.fromEntries(Object.entries(body.answers ?? {}).filter(([, v]) => v != null)));
    logActivity(db, { language: "en", activity_type: "listening", duration_seconds: body.duration_seconds ?? 0, score: res.score,
                      details: { exercise_id: x.id, speed: body.speed, plays: body.plays } });
    return res;
  }
  const qrPool = (language: string, destination: string | null | "ALL") => language !== "en" ? (D.quick_response_other[language] ?? [])
    : [...D.quick_response, ...(destination === "IN" || destination === "ALL" ? D.quick_response_india : [])];
  if (path === "/drills/quick-response") {
    const pool = qrPool(lang, q.get("destination"));
    const lvl = Math.max(0, CEFR_LEVELS.indexOf(q.get("level") ?? "B1"));
    const near = pool.filter((x: Row) => Math.abs(CEFR_LEVELS.indexOf(x.level) - lvl) <= 1);
    const src = near.length ? near : pool;
    const count = Number(q.get("count") ?? 8);
    let picks = [...src].sort(() => Math.random() - 0.5).slice(0, count);
    if (q.get("destination") === "IN" && lang === "en") {
      const india = (D.quick_response_india as Row[]).filter((x) => !picks.includes(x)).sort(() => Math.random() - 0.5).slice(0, 3);
      picks = [...india, ...picks].slice(0, count).sort(() => Math.random() - 0.5);
    }
    return { questions: picks.map((x: Row) => ({ id: x.id, level: x.level, theme: x.theme, q: x.q })),
             initial_time_limit_ms: [10000, 9000, 8000, 6500, 5500, 5000][lvl] ?? 8000,
             instructions_pt: "Ouça a pergunta e comece a responder antes do tempo acabar. Frases curtas valem!" };
  }
  if (path === "/drills/quick-response/evaluate") {
    const x = qrPool(body.language ?? "en", "ALL").find((i: Row) => i.id === body.question_id);
    if (!x) throw notFound("Pergunta não encontrada.");
    const res = evaluateQuickResponse(x, body.answer, body.latency_ms, body.time_limit_ms, body.language ?? "en");
    logActivity(db, { language: body.language ?? "en", activity_type: "quick_response", duration_seconds: Math.floor(body.latency_ms / 1000) + 3,
                      score: res.success ? 1 : 0, details: { question_id: x.id, latency_ms: body.latency_ms } });
    return res;
  }
  if (path === "/drills/sentence-building") {
    return (D.sentence_building as Row[]).filter((x) => !q.get("level") || x.level === q.get("level"))
      .map(({ answer: _a, ...x }) => (x.stage === "order" ? { ...x, shuffled: [...x.chunks].sort(() => Math.random() - 0.5) } : x));
  }
  if (path === "/drills/sentence-building/evaluate") {
    const item = (D.sentence_building as Row[]).find((x) => x.id === body.item_id);
    if (!item) throw notFound("Exercício não encontrado.");
    const res = evaluateSentenceBuilding(item, body.answer);
    logActivity(db, { language: "en", activity_type: "sentence_building", duration_seconds: body.duration_seconds ?? 0, score: res.correct ? 1 : 0 });
    return res;
  }
  if (path === "/drills/think-in-english") return (D.think_in_english as Row[]).filter((x) => !q.get("level") || x.level === q.get("level"));
  if (path === "/shadowing") {
    const pool = lang === "en" ? D.shadowing : D.shadowing_other[lang] ?? [];
    return pool.filter((x: Row) => !q.get("level") || x.level === q.get("level"));
  }
  if (seg[0] === "shadowing" && seg[2] === "attempt") {
    const all: [string, Row][] = [...(D.shadowing as Row[]).map((x) => ["en", x] as [string, Row]),
      ...Object.entries(D.shadowing_other as Record<string, Row[]>).flatMap(([l, xs]) => xs.map((x) => [l, x] as [string, Row]))];
    const found = all.find(([, x]) => x.id === seg[1]);
    if (!found) throw notFound("Frase não encontrada.");
    const transcript = formValue(form, "transcript");
    if (transcript == null) throw serverOnly("A avaliação a partir do áudio");
    const duration = Number(formValue(form, "duration_seconds") ?? 0);
    const fb = shadowingFeedback({ reference: found[1].text, transcript, duration, rate: Number(formValue(form, "rate") ?? 1) });
    logActivity(db, { language: found[0], activity_type: "shadowing", duration_seconds: Math.round(duration * 2) + 5,
                      score: fb.status === "ok" ? fb.intelligibility / 100 : null, details: { item_id: found[1].id, status: fb.status } });
    return { ...fb, item: found[1] };
  }

  // ------------------------------- avaliação -------------------------------
  if (path === "/assessments" && method === "POST") {
    try {
      return assessmentPayload(startAssessment(db, body.language ?? "en", body.kind ?? "placement"));
    } catch (e: any) {
      throw bad(e.message);
    }
  }
  if (path === "/assessments") {
    return Object.values(db.assessments).filter((a) => a.language === lang).sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
      .map((a) => ({ id: a.id, kind: a.kind, started_at: a.started_at, completed_at: a.completed_at, overall_cefr: a.overall_cefr ?? null, scores: a.section_scores ?? {} }));
  }
  if (seg[0] === "assessments" && seg[1]) {
    const a = db.assessments[seg[1]];
    if (!a) throw notFound("Avaliação não encontrada.");
    if (seg[2] !== "submit") return { ...assessmentPayload(a), ...(a.completed_at ? { result: { ...a.details, overall_cefr: a.overall_cefr } } : {}) };
    if (a.completed_at) throw new ApiError(409, "Avaliação já enviada.");
    const res: Row = submitAssessment(db, a, body);
    const plan = currentPlan(db, a.language);
    if (plan) res.plan_adaptation = adaptPlan(db, plan);
    return res;
  }

  // ------------------------------- plano -------------------------------
  if (path === "/plans" && method === "POST") {
    if (!db.profiles[body.language ?? "en"]) throw bad("Configure seu perfil para este idioma primeiro.");
    return planView(createPlan(db, body.language ?? "en"));
  }
  if (seg[0] === "plans" && seg[1] === "current") {
    const plan = currentPlan(db, lang);
    if (!plan) throw notFound("Nenhum plano ativo.");
    if (seg.length === 2) return planView(plan);
    if (seg[2] === "adapt") return adaptPlan(db, plan);
    if (seg[2] === "days") {
      const n = Number(seg[3]);
      const d = plan.days.find((x: Row) => x.day_index === n);
      if (!d) throw notFound("Dia não encontrado.");
      if (seg[4] === "activities" && seg[6] === "complete") {
        const updated = completeActivity(plan, n, seg[5]);
        if (!updated) throw notFound("Atividade não encontrada.");
        return dayView(updated);
      }
      return { ...dayView(d), phase_info: plan.config.phases[String(d.phase)] };
    }
  }

  // ------------------------------- vocabulário -------------------------------
  if (path === "/vocab/session") return sessionCards(db, lang, Math.min(Math.max(Number(q.get("limit") ?? 20), 1), 50));
  if (path === "/vocab/stats") return stats(db, lang);
  if (path === "/vocab/items" && method === "POST") {
    const c = addPersonalItem(db, { language: body.language ?? "en", term: body.term, meaning_pt: body.meaning_pt, example: body.example, kind: body.kind });
    if (!c) throw new ApiError(409, "Você já tem este item.");
    return cardView(db, c);
  }
  if (seg[0] === "vocab" && seg[1] === "cards" && seg[2]) {
    const c = db.cards[seg[2]];
    if (!c) throw notFound("Cartão não encontrado.");
    if (seg[3] === "check") return checkAnswer(db, c, body.answer ?? "", body.response_ms ?? null);
    if (seg[3] === "review") {
      const res = reviewCard(db, c, body.rating, body.response_ms ?? null, body.mode);
      logActivity(db, { language: c.language, activity_type: "vocab_review", duration_seconds: Math.min(Math.floor((body.response_ms ?? 8000) / 1000) + 4, 120),
                        score: body.rating > 1 ? 1 : 0 });
      return res;
    }
  }

  // ------------------------------- erros e atividades -------------------------------
  const errorRows = () => Object.values(db.errors).filter((e) => e.language === lang);
  if (path === "/errors") {
    return errorRows().filter((e) => q.get("include_resolved") === "true" || !e.resolved)
      .sort((a, b) => b.occurrences - a.occurrences || (a.last_seen_at < b.last_seen_at ? 1 : -1)).slice(0, 100);
  }
  if (path === "/errors/review") {
    const sev: Record<string, number> = { blocks_understanding: 3, may_confuse: 2, minor: 1 };
    return errorRows().filter((e) => !e.resolved).sort((a, b) => sev[b.severity] * b.occurrences - sev[a.severity] * a.occurrences || a.correct_streak - b.correct_streak)
      .slice(0, Number(q.get("count") ?? 5))
      .map((e) => ({ id: e.id, prompt: e.original, instruction_pt: "Reescreva a frase de forma correta e natural.", hint_pt: e.explanation_pt, subtype: e.subtype }));
  }
  if (seg[0] === "errors" && seg[2] === "attempt") {
    const e = db.errors[seg[1]];
    if (!e) throw notFound("Erro não encontrado.");
    const [ok, sim] = answerMatches(body.answer ?? "", [e.corrected], 0.9);
    e.correct_streak = ok ? e.correct_streak + 1 : 0;
    if (e.correct_streak >= 3) e.resolved = true;
    logActivity(db, { language: e.language, activity_type: "error_review", duration_seconds: 30, score: ok ? 1 : 0 });
    return { correct: ok, similarity: Math.round(sim * 1000) / 1000, expected: e.corrected, explanation_pt: e.explanation_pt,
             correct_streak: e.correct_streak, resolved: e.resolved };
  }
  if (path === "/activities" && method === "POST") {
    logActivity(db, { language: body.language ?? "en", activity_type: body.activity_type, duration_seconds: body.duration_seconds ?? 0,
                      score: body.score ?? null, details: body.details ?? {} });
    let day = null;
    if (body.plan_day && body.plan_activity_id) {
      const plan = currentPlan(db, body.language ?? "en");
      const d = plan ? completeActivity(plan, body.plan_day, body.plan_activity_id) : null;
      day = d ? dayView(d) : null;
    }
    return { ok: true, plan_day: day };
  }
  if (path === "/dashboard") return dashboard(db, lang);

  // ------------------------------- tutor -------------------------------
  if (path === "/tutor/sessions" && method === "POST") {
    try {
      const s = startSession(db, { language: body.language ?? "en", mode: body.mode ?? "natural", scenario_id: body.scenario_id, settings: body.settings ?? {} });
      return sessionView(s);
    } catch (e: any) {
      throw bad(e.message);
    }
  }
  if (path === "/tutor/sessions") {
    return Object.values(db.sessions).filter((s) => s.language === lang).sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
      .map((s) => ({ id: s.id, title: s.title, mode: s.mode, started_at: s.started_at, ended_at: s.ended_at, metrics: s.metrics, engine: s.provider }));
  }
  if (seg[0] === "tutor" && seg[1] === "sessions" && seg[2]) {
    const s = db.sessions[seg[2]];
    if (!s) throw notFound("Sessão não encontrada.");
    if (method === "DELETE") {
      delete db.sessions[seg[2]];
      return undefined;
    }
    if (seg[3] === "messages") {
      try {
        return postMessage(db, s, body.text ?? "", { source: body.source, latency_ms: body.latency_ms, audio_seconds: body.audio_seconds });
      } catch (e: any) {
        throw bad(e.message);
      }
    }
    if (seg[3] === "audio") throw serverOnly("O envio de áudio para transcrição");
    if (seg[3] === "end") {
      const report = endSession(db, s);
      if (s.settings.plan_day && s.settings.plan_activity_id) {
        const plan = currentPlan(db, s.language);
        if (plan) completeActivity(plan, s.settings.plan_day, s.settings.plan_activity_id);
      }
      return report;
    }
    return sessionView(s);
  }
  if (seg[0] === "speech") throw serverOnly("Este recurso de voz");
  if (seg[0] === "documents") throw serverOnly("O processamento de documentos");
  throw notFound(`Rota local desconhecida: ${method} ${path}`);
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function localApi(fullPath: string, opts: Opts = {}): Promise<unknown> {
  const db = await getDB();
  const [path, query = ""] = fullPath.split("?");
  const method = (opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET")).toUpperCase();
  const result = await route(db, method, path, new URLSearchParams(query), opts.body ?? {}, opts.form);
  if (MUTATING.has(method) || path === "/vocab/session") await saveDB();
  return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
}

/** Restaura um backup exportado (JSON gerado em /me/export). */
export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  const data = parsed?.data ?? parsed;
  if (!data || data.version !== 1 || !data.user) throw new ApiError(400, "Arquivo de backup inválido.");
  const { replaceDB } = await import("./db");
  await replaceDB(data);
}
