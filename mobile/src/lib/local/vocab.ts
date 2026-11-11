/** Vocabulário com FSRS no aparelho — porte de app/services/vocab.py. */
import { CONTENT } from "./content";
import { newId, nowIso, type DB, type Row } from "./db";
import { preview, retrievability, review as fsrsReview, suggestRating, type CardState } from "./fsrs";
import { answerMatches } from "./text";

const SEED: Record<string, Row> = Object.fromEntries((CONTENT.vocab as Row[]).map((v) => [v.seed_key, { ...v, id: v.seed_key, source: "seed" }]));

export function itemById(db: DB, id: string): Row | undefined {
  return SEED[id] ?? db.items[id];
}

export function acceptedAnswers(term: string): string[] {
  const strip = (s: string) => s.replace(/^[ .?!]+|[ .?!]+$/g, "");
  const base = strip(term.replace(/\s*\([^)]*\)/g, "").replace(/…/g, ""));
  const variants = new Set<string>([term.trim(), base]);
  for (const part of base.split(/\s*\/\s*/)) if (part.trim()) variants.add(strip(part));
  for (const m of term.matchAll(/\(([^)]*)\)/g)) if (m[1].length <= 12 && !m[1].includes(",")) variants.add(m[1].trim());
  return [...variants].filter(Boolean);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function cloze(example: string, term: string): string {
  for (const v of [...acceptedAnswers(term)].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(escapeRe(v), "i");
    if (re.test(example)) return example.replace(re, "_____");
  }
  return example;
}

function priority(item: Row, focus: string[]): number {
  let p = 10_000 - (item.frequency_rank ?? 5000);
  if (focus.includes(item.domain) || (item.kind === "technical" && focus.includes("engineering"))) p += 300;
  if (item.domain === "india" && focus.includes("india")) p += 600;
  if (["error", "tutor", "document"].includes(item.source)) p += 2000;
  return p;
}

export function priorityDomains(profile: Row): string[] {
  const d = [...(profile.focus_domains ?? [])];
  if (profile.trip_destination === "IN") d.push("india");
  return d;
}

export function enroll(db: DB, language: string, focus: string[]): number {
  const have = new Set(Object.values(db.cards).map((c) => c.item_id));
  let n = 0;
  for (const item of [...Object.values(SEED), ...Object.values(db.items)]) {
    if (item.language !== language || have.has(item.id)) continue;
    const id = newId();
    db.cards[id] = { id, item_id: item.id, language, state: "new", step: null, stability: null, difficulty: null, due: nowIso(),
                     last_review: null, reps: 0, lapses: 0, priority: priority(item, focus), introduced_at: null };
    n++;
  }
  return n;
}

export function reprioritize(db: DB, language: string, focus: string[]) {
  for (const c of Object.values(db.cards)) if (c.language === language && c.state === "new") c.priority = priority(itemById(db, c.item_id)!, focus);
}

export function addPersonalItem(db: DB, o: { language: string; term: string; meaning_pt: string; example?: string; kind?: string;
  source?: string; domain?: string; definition?: string }): Row | null {
  const term = o.term.trim().slice(0, 200);
  if (!term) return null;
  if (Object.values(db.items).some((i) => i.language === o.language && i.term.toLowerCase() === term.toLowerCase())) return null;
  const id = "u:" + newId();
  const item = { id, language: o.language, term, kind: o.kind ?? "phrase", meaning_pt: o.meaning_pt.slice(0, 500), definition: (o.definition ?? "").slice(0, 500),
                 examples: o.example ? [{ text: o.example.slice(0, 300) }] : [], domain: o.domain ?? "general", source: o.source ?? "user",
                 frequency_rank: 100, cefr: "B1", pronunciation: "" };
  db.items[id] = item;
  const cid = newId();
  db.cards[cid] = { id: cid, item_id: id, language: o.language, state: "new", step: null, stability: null, difficulty: null, due: nowIso(),
                    last_review: null, reps: 0, lapses: 0, priority: priority(item, []), introduced_at: null };
  return db.cards[cid];
}

const toState = (c: Row): CardState => ({ state: c.state, step: c.step, stability: c.stability, difficulty: c.difficulty, due: c.due,
  last_review: c.last_review, reps: c.reps, lapses: c.lapses });

export function cardView(db: DB, c: Row, now = new Date()) {
  const item = itemById(db, c.item_id)!;
  const example = item.examples?.[0]?.text ?? "";
  return {
    card_id: c.id, state: c.state, due: c.due, reps: c.reps,
    item: { id: item.id, term: item.term, kind: item.kind, meaning_pt: item.meaning_pt, example, pronunciation: item.pronunciation ?? "",
            domain: item.domain, cefr: item.cefr, source: item.source, definition: item.definition ?? "" },
    prompt: { meaning_pt: item.meaning_pt, cloze: example && item.kind !== "correction" ? cloze(example, item.term) : "" },
    intervals_days: preview(toState(c), now),
  };
}

export function sessionCards(db: DB, language: string, limit: number) {
  const now = new Date();
  const nowIsoStr = now.toISOString();
  const cards = Object.values(db.cards).filter((c) => c.language === language);
  const due = cards.filter((c) => c.state !== "new" && c.due <= nowIsoStr).sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, limit);
  const perDay = db.profiles[language]?.new_cards_per_day ?? 12;
  const startOfDay = nowIsoStr.slice(0, 10);
  const introducedToday = cards.filter((c) => c.introduced_at && c.introduced_at.slice(0, 10) === startOfDay).length;
  const quota = Math.max(0, Math.min(perDay - introducedToday, limit - due.length));
  const fresh = cards.filter((c) => c.state === "new").sort((a, b) => b.priority - a.priority).slice(0, quota);
  return { cards: [...due, ...fresh].map((c) => cardView(db, c, now)), due_count: due.length, new_count: fresh.length,
           new_remaining_today: Math.max(0, perDay - introducedToday - fresh.length) };
}

export function checkAnswer(db: DB, c: Row, answer: string, responseMs: number | null) {
  const item = itemById(db, c.item_id)!;
  const [correct, sim, target] = answerMatches(answer, acceptedAnswers(item.term));
  return { correct, similarity: Math.round(sim * 1000) / 1000, expected: item.term, closest: target,
           suggested_rating: suggestRating(correct, sim, responseMs) };
}

export function reviewCard(db: DB, c: Row, rating: number, responseMs: number | null, mode = "recall_text") {
  const now = new Date();
  const before = c.state;
  const out = fsrsReview(toState(c), rating, now);
  if (c.state === "new") c.introduced_at = now.toISOString();
  Object.assign(c, out.card);
  db.reviews.push({ id: newId(), card_id: c.id, language: c.language, rating, state_before: before, retrievability: out.retrievabilityBefore,
                    scheduled_days: out.intervalMs / 86_400_000, response_ms: responseMs, mode, reviewed_at: now.toISOString() });
  return { card_id: c.id, state: c.state, due: c.due, interval_days: Math.round((out.intervalMs / 86_400_000) * 1000) / 1000,
           stability: Math.round((c.stability ?? 0) * 1000) / 1000, difficulty: Math.round((c.difficulty ?? 0) * 1000) / 1000 };
}

export function stats(db: DB, language: string) {
  const now = Date.now();
  const cards = Object.values(db.cards).filter((c) => c.language === language);
  const byState: Record<string, number> = {};
  let retained = 0;
  const rs: number[] = [];
  for (const c of cards) {
    byState[c.state] = (byState[c.state] ?? 0) + 1;
    if (c.state === "review" && c.stability && c.last_review) {
      const r = retrievability(c.stability, Math.floor((now - Date.parse(c.last_review)) / 86_400_000));
      rs.push(r);
      if (r >= 0.85) retained++;
    }
  }
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const logs = db.reviews.filter((r) => r.language === language && r.reviewed_at >= since);
  const rev = logs.filter((r) => r.state_before === "review");
  const trueRet = rev.length ? rev.filter((r) => r.rating > 1).length / rev.length : null;
  return {
    total: cards.length, by_state: byState, learned: byState.review ?? 0, retained_estimate: retained,
    mean_retrievability: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 1000) / 1000 : null,
    true_retention_30d: trueRet != null ? Math.round(trueRet * 1000) / 1000 : null, reviews_30d: logs.length,
    due_now: cards.filter((c) => c.state !== "new" && Date.parse(c.due) <= now).length,
    note_pt: "‘Retidas’ = itens em revisão com probabilidade estimada de lembrança ≥ 85% hoje (modelo FSRS).",
  };
}
