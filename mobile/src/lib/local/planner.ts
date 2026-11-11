/** Gerador do plano intensivo — porte de app/services/planner.py (saída idêntica, testada por paridade). */
import { CEFR_LEVELS, CONTENT } from "./content";
import { pyRound } from "./fsrs";

const P = CONTENT.planner;
export const ACTIVITY_INFO: Record<string, any> = P.activity_info;
export const PHASE_WEIGHTS: Record<string, Record<string, number>> = P.phase_weights;
export const PHASES: Record<string, any> = P.phases;
export const WEEK_THEMES: string[] = P.week_themes;
export const DESTINATIONS: Record<string, any> = P.destinations;

export type PlannedActivity = { id: string; type: string; title_pt: string; minutes: number; skills: string[]; params: Record<string, any>; done: boolean };
export type PlannedDay = { day_index: number; date: string; phase: number; focus: string; is_assessment_day: boolean; activities: PlannedActivity[] };

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function phaseFor(day: number, total: number): number {
  if (day <= pyRound(total / 3)) return 1;
  if (day <= pyRound((2 * total) / 3)) return 2;
  return 3;
}

export function assessmentDays(total: number): Set<number> {
  const s = new Set<number>([1, total]);
  for (let d = 15; d <= total; d += 15) s.add(d);
  return s;
}

function conversationTarget(day: number, total: number): number {
  const f = day / total;
  if (f <= 0.11) return 3;
  if (f <= 0.33) return 5;
  if (f <= 0.5) return 10;
  if (f <= 0.8) return 15;
  return 30;
}

const round5 = (x: number) => Math.max(0, Math.trunc(5 * pyRound(x / 5)));
const levelOk = (level: string, learner: string) =>
  CEFR_LEVELS.indexOf(level) <= Math.min(CEFR_LEVELS.indexOf(learner) + 1, CEFR_LEVELS.length - 1);

function pickRotating<T>(pool: T[], counter: Record<string, number>, key: string): T | null {
  if (!pool.length) return null;
  const i = counter[key] ?? 0;
  counter[key] = i + 1;
  return pool[i % pool.length];
}

/** Comparação de tuplas como no Python (booleanos antes de strings). */
function tupleCmp(a: (boolean | string)[], b: (boolean | string)[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (typeof a[i] === "boolean") return Number(a[i]) - Number(b[i]);
    return (a[i] as string) < (b[i] as string) ? -1 : 1;
  }
  return 0;
}

export function generate(opts: {
  start: string; total_days: number; daily_minutes: number; learner_level?: string; multipliers?: Record<string, number>;
  focus_domains?: string[]; placement_done?: boolean; destination?: string | null;
}): PlannedDay[] {
  const multipliers = opts.multipliers ?? {};
  const focus = opts.focus_domains ?? [];
  const destination = opts.destination ?? null;
  const dest = destination ? DESTINATIONS[destination] : undefined;
  const destAccent: string | null = dest ? dest.accent : null;
  const level = opts.learner_level && CEFR_LEVELS.includes(opts.learner_level) ? opts.learner_level : "B1";
  const total = opts.total_days;
  const credits: Record<string, number> = Object.fromEntries(Object.keys(ACTIVITY_INFO).map((k) => [k, 0]));
  const rotation: Record<string, number> = {};
  const aDays = assessmentDays(total);
  const out: PlannedDay[] = [];

  for (let day = 1; day <= total; day++) {
    const phase = phaseFor(day, total);
    const raw = Object.fromEntries(Object.entries(PHASE_WEIGHTS[String(phase)]).map(([t, w]) => [t, w * (multipliers[t] ?? 1)]));
    const tot = Object.values(raw).reduce((a, b) => a + b, 0);
    const weights = Object.fromEntries(Object.entries(raw).map(([t, w]) => [t, w / tot]));
    const week = Math.min(Math.floor(((day - 1) * 13) / total), 12);
    const weekly = day % 7 === 0;
    const dp: PlannedDay = { day_index: day, date: addDays(opts.start, day - 1), phase,
      focus: WEEK_THEMES[week] + (weekly ? " · revisão semanal" : ""), is_assessment_day: false, activities: [] };
    let left = opts.daily_minutes;
    const chosen: [string, number][] = [];

    if (aDays.has(day) && !(day === 1 && opts.placement_done)) {
      const block = Math.min(ACTIVITY_INFO.assessment.min, left);
      chosen.push(["assessment", block]);
      left -= block;
      dp.is_assessment_day = true;
    }
    for (const [t, w] of Object.entries(weights)) credits[t] += w * left;
    if (weekly) {
      credits.error_review += 5;
      credits.conversation += 5;
    }
    if (left >= 15) {
      chosen.push(["vocab_review", 5]);
      credits.vocab_review -= 5;
      left -= 5;
    }
    const used = new Set(chosen.map(([t]) => t));
    while (left >= 3) {
      const candidates = Object.keys(weights).filter((t) => !used.has(t) && credits[t] > 0);
      if (!candidates.length) break;
      let t = candidates[0];
      for (const c of candidates) if (credits[c] > credits[t]) t = c;
      const info = ACTIVITY_INFO[t];
      const block = t === "conversation"
        ? Math.min(conversationTarget(day, total), info.max, left)
        : Math.min(Math.max(info.min, round5(credits[t])), info.max, left);
      if (block < info.min && t !== "conversation") {
        used.add(t);
        continue;
      }
      credits[t] -= block;
      chosen.push([t, block]);
      used.add(t);
      left -= block;
    }
    if (left > 0 && chosen.length) {
      const order = chosen.map((_, i) => i).sort((a, b) => Number(ACTIVITY_INFO[chosen[a][0]].mode !== "output") - Number(ACTIVITY_INFO[chosen[b][0]].mode !== "output"));
      for (const i of order) {
        const [t, mins] = chosen[i];
        const room = t === "conversation" || t === "assessment" ? 0 : ACTIVITY_INFO[t].max - mins;
        if (room > 0 && left > 0) {
          const add = Math.min(room, left);
          chosen[i] = [t, mins + add];
          left -= add;
        }
      }
      if (left > 0) {
        let idx = 0;
        for (let i = 1; i < chosen.length; i++) if (chosen[i][1] > chosen[idx][1]) idx = i;
        chosen[idx] = [chosen[idx][0], chosen[idx][1] + left];
      }
    }
    const headOrder: Record<string, number> = { assessment: 0, vocab_review: 1 };
    const inputs = chosen.filter(([t]) => ACTIVITY_INFO[t].mode === "input" && !(t in headOrder));
    const outputs = chosen.filter(([t]) => ACTIVITY_INFO[t].mode === "output" && t !== "error_review");
    const head = chosen.filter(([t]) => t in headOrder).sort((a, b) => headOrder[a[0]] - headOrder[b[0]]);
    const tail = chosen.filter(([t]) => t === "error_review");
    const mixed: [string, number][] = [];
    while (inputs.length || outputs.length) {
      if (inputs.length) mixed.push(inputs.shift()!);
      if (outputs.length) mixed.push(outputs.shift()!);
    }
    [...head, ...mixed, ...tail].forEach(([t, minutes], i) => {
      const info = ACTIVITY_INFO[t];
      const params: Record<string, any> = {};
      let title: string = info.title_pt;
      if (t === "conversation") {
        params.challenge_minutes = minutes;
        if (destAccent) params.accent = destAccent;
        params.mode = phase >= 2 && day % 2 === 0 ? "no_native" : "natural";
        title = `Conversation Challenge — ${minutes} min` + (params.mode === "no_native" ? " (No Portuguese)" : "");
      } else if (t === "scenario") {
        const pool = (CONTENT.scenarios as any[]).filter((s) => s.phase <= phase && levelOk(s.level, level))
          .sort((a, b) => tupleCmp([a.phase !== phase, !focus.includes(a.domain) && a.category !== "work", a.id],
                                   [b.phase !== phase, !focus.includes(b.domain) && b.category !== "work", b.id]));
        const destPool = pool.filter((s) => destination && s.country === destination);
        const general = pool.filter((s) => !s.country);
        const k = rotation.scenario_count ?? 0;
        rotation.scenario_count = k + 1;
        const useDest = destPool.length > 0 && k % (phase + 1) !== phase;
        const sc = pickRotating(useDest ? destPool : general.length ? general : pool, rotation, `scenario${phase}${useDest ? "d" : ""}`);
        if (sc) {
          params.scenario_id = sc.id;
          title = `Simulação: ${sc.title_pt}`;
        }
      } else if (t === "listening") {
        const pool = (CONTENT.listening as any[]).filter((x) => x.phase <= phase && levelOk(x.level, level))
          .sort((a, b) => tupleCmp([a.phase !== phase, a.id], [b.phase !== phase, b.id]));
        const destPool = pool.filter((x) => destAccent && x.accents.includes(destAccent));
        const k = rotation.listening_count ?? 0;
        rotation.listening_count = k + 1;
        const useDest = destPool.length > 0 && k % 3 !== 2;
        const ls = pickRotating(useDest ? destPool : pool, rotation, `listening${phase}${useDest ? "d" : ""}`);
        if (ls) {
          params.listening_id = ls.id;
          title = `Listening: ${ls.title}`;
        }
      } else if ((t === "shadowing" || t === "quick_response") && destAccent) {
        params.accent = destAccent;
        params.destination = destination;
      } else if (t === "assessment") {
        params.kind = day === 1 && !opts.placement_done ? "placement" : "checkpoint";
        title = params.kind === "placement" ? "Avaliação inicial" : `Avaliação de progresso (dia ${day})`;
      }
      dp.activities.push({ id: `d${day}-a${i}`, type: t, title_pt: title, minutes, skills: info.skills, params, done: false });
    });
    out.push(dp);
  }
  return out;
}

export function expectedOutcomes(totalDays: number, dailyMinutes: number, level: string | null) {
  const hours = (totalDays * dailyMinutes) / 60;
  const f = hours / 200;
  const progress = f < 0.25 ? "um avanço perceptível dentro do nível atual"
    : f < 0.6 ? "cerca de um terço a metade de um nível CEFR" : "algo próximo de meio a um nível CEFR";
  return {
    total_hours: Math.round(hours * 10) / 10,
    general_progress_pt: `Com ~${Math.round(hours)} h de prática, a expectativa realista é ${progress} em proficiência geral.`,
    task_readiness_pt: "Nas tarefas treinadas (reuniões, explicações técnicas, situações de viagem) o ganho tende a ser maior, porque a prática é específica e repetida.",
    basis_pt: "Referência: ~180–200 horas de aprendizagem guiada por nível CEFR (estimativa da Cambridge English); a variação individual é grande.",
    no_guarantee_pt: "Não há garantia de fluência. O progresso é medido a cada 15 dias e o plano se ajusta.",
    current_level: level,
  };
}

export function planLength(start: string, tripDate: string | null): number {
  if (!tripDate) return 90;
  const days = Math.round((Date.parse(tripDate) - Date.parse(start)) / 86_400_000);
  return Math.max(14, Math.min(120, days));
}
