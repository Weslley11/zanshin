/** FSRS-5 — porte do backend (app/services/fsrs.py), verificado por fixtures de paridade. */
const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11,
  0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const MIN = 60_000;
const DAY = 86_400_000;
const LEARNING_STEPS = [1 * MIN, 10 * MIN];
const RELEARNING_STEPS = [10 * MIN];
const DESIRED_RETENTION = 0.9;
const MAX_INTERVAL = 36500;

export type CardState = {
  state: "new" | "learning" | "review" | "relearning";
  step: number | null;
  stability: number | null;
  difficulty: number | null;
  due: string;
  last_review: string | null;
  reps: number;
  lapses: number;
};

/** round() do Python (arredondamento bancário). */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export function retrievability(stability: number, elapsedDays: number): number {
  return (1 + (FACTOR * Math.max(0, elapsedDays)) / stability) ** DECAY;
}

const initialStability = (r: number) => Math.max(W[r - 1], 0.1);
const initialDifficulty = (r: number) => clamp(W[4] - Math.exp(W[5] * (r - 1)) + 1, 1, 10);

function nextDifficulty(d: number, r: number): number {
  const delta = -W[6] * (r - 3);
  const damped = d + ((10 - d) * delta) / 9;
  return clamp(W[7] * initialDifficulty(4) + (1 - W[7]) * damped, 1, 10);
}
const shortTerm = (s: number, r: number) => s * Math.exp(W[17] * (r - 3 + W[18]));
function recallStability(d: number, s: number, ret: number, r: number) {
  const hard = r === 2 ? W[15] : 1;
  const easy = r === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp((1 - ret) * W[10]) - 1) * hard * easy);
}
function forgetStability(d: number, s: number, ret: number) {
  const longTerm = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp((1 - ret) * W[14]);
  return Math.min(longTerm, s / Math.exp(W[17] * W[18]));
}
export function nextIntervalDays(s: number): number {
  const ivl = (s / FACTOR) * (DESIRED_RETENTION ** (1 / DECAY) - 1);
  return Math.min(Math.max(pyRound(ivl), 1), MAX_INTERVAL);
}

export function newCard(now: Date = new Date()): CardState {
  return { state: "new", step: null, stability: null, difficulty: null, due: now.toISOString(), last_review: null, reps: 0, lapses: 0 };
}

export function review(card: CardState, rating: number, now: Date = new Date()): { card: CardState; intervalMs: number; retrievabilityBefore: number | null } {
  let state = card.state;
  let step = card.step;
  let s = card.stability;
  let d = card.difficulty;
  const last = card.last_review ? new Date(card.last_review).getTime() : null;
  const daysSince = last != null ? Math.floor((now.getTime() - last) / DAY) : null;
  const rBefore = s && last != null ? retrievability(s, daysSince!) : null;
  let lapses = card.lapses;
  if (state === "new") {
    state = "learning";
    step = 0;
  }
  if (s == null || d == null) {
    s = initialStability(rating);
    d = initialDifficulty(rating);
  } else if (daysSince != null && daysSince < 1) {
    s = shortTerm(s, rating);
    d = nextDifficulty(d, rating);
  } else {
    const r = rBefore ?? 0;
    s = rating === 1 ? forgetStability(d, s, r) : recallStability(d, s, r, rating);
    d = nextDifficulty(d, rating);
  }
  let interval: number;
  if (state === "learning" || state === "relearning") {
    const steps = state === "learning" ? LEARNING_STEPS : RELEARNING_STEPS;
    if (steps.length === 0 || step! > steps.length) {
      state = "review";
      step = null;
      interval = nextIntervalDays(s) * DAY;
    } else if (rating === 1) {
      step = 0;
      interval = steps[0];
    } else if (rating === 2) {
      if (step === 0 && steps.length === 1) interval = steps[0] * 1.5;
      else if (step === 0 && steps.length >= 2) interval = (steps[0] + steps[1]) / 2;
      else interval = steps[step!];
    } else if (rating === 3) {
      if (step! + 1 === steps.length) {
        state = "review";
        step = null;
        interval = nextIntervalDays(s) * DAY;
      } else {
        step = step! + 1;
        interval = steps[step];
      }
    } else {
      state = "review";
      step = null;
      interval = nextIntervalDays(s) * DAY;
    }
  } else if (rating === 1) {
    lapses += 1;
    state = "relearning";
    step = 0;
    interval = RELEARNING_STEPS[0];
  } else {
    interval = nextIntervalDays(s) * DAY;
  }
  return {
    card: { state, step, stability: s, difficulty: d, due: new Date(now.getTime() + interval).toISOString(),
            last_review: now.toISOString(), reps: card.reps + 1, lapses },
    intervalMs: interval,
    retrievabilityBefore: rBefore,
  };
}

export function preview(card: CardState, now: Date = new Date()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of [1, 2, 3, 4]) out[String(r)] = Math.round((review(card, r, now).intervalMs / DAY) * 1000) / 1000;
  return out;
}

export function suggestRating(correct: boolean, similarity: number, responseMs: number | null): number {
  if (!correct) return 1;
  if (similarity < 0.97 || (responseMs != null && responseMs > 12_000)) return 2;
  if (responseMs != null && responseMs < 4_000) return 4;
  return 3;
}
