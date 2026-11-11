/** Normalização, alinhamento, WER e correspondência de respostas — porte de app/services/text_utils.py. */
const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is", "she's": "she is",
  "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is", "i've": "i have", "you've": "you have",
  "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will", "we'll": "we will",
  "they'll": "they will", "it'll": "it will", "i'd": "i would", "you'd": "you would", "we'd": "we would",
  "they'd": "they would", "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot",
  "won't": "will not", "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "haven't": "have not", "hasn't": "has not", "couldn't": "could not", "shouldn't": "should not",
  "wouldn't": "would not", "let's": "let us", "gonna": "going to", "wanna": "want to",
};
export const FILLERS = new Set(["um", "uh", "uhm", "erm", "er", "hmm", "mm", "ah", "é", "eh", "tipo", "né", "então", "ãh", "ahn"]);
const WORD_RE = /[\p{L}\p{N}_']+/gu;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "");
}

export function normalize(text: string, opts: { expand?: boolean; keepAccents?: boolean } = {}): string {
  const { expand = true, keepAccents = true } = opts;
  let t = text.toLowerCase().replace(/[’‘]/g, "'").normalize("NFC");
  if (!keepAccents) t = stripAccents(t);
  let words: string[] = t.match(WORD_RE) ?? [];
  if (expand) words = words.flatMap((w) => (CONTRACTIONS[w] ?? w).split(" "));
  return words.join(" ");
}

export const tokenize = (text: string) => normalize(text).split(" ").filter(Boolean);
export const countWords = (text: string) => (text.match(WORD_RE) ?? []).length;

export function levenshtein<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  if (a.length < b.length) [a, b] = [b, a];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const na = normalize(a, { keepAccents: false });
  const nb = normalize(b, { keepAccents: false });
  if (!na && !nb) return 1;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);
  if (!ref.length) return hyp.length ? 1 : 0;
  return levenshtein(ref, hyp) / ref.length;
}

export type Alignment = { op: "ok" | "sub" | "del" | "ins"; ref: string | null; hyp: string | null };

export function alignWords(reference: string, hypothesis: string): Alignment[] {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);
  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
  }
  const out: Alignment[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (ref[i - 1] !== hyp[j - 1] ? 1 : 0)) {
      out.push({ op: ref[i - 1] === hyp[j - 1] ? "ok" : "sub", ref: ref[i - 1], hyp: hyp[j - 1] });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.push({ op: "del", ref: ref[i - 1], hyp: null });
      i--;
    } else {
      out.push({ op: "ins", ref: null, hyp: hyp[j - 1] });
      j--;
    }
  }
  return out.reverse();
}

const ARTICLES = new Set(["a", "an", "the"]);
const stripArticles = (s: string) => normalize(s, { keepAccents: false }).split(" ").filter((w) => w && !ARTICLES.has(w)).join(" ");

export function answerMatches(answer: string, accepted: string[], tolerance = 0.85): [boolean, number, string] {
  let best = 0;
  let bestTarget = accepted[0] ?? "";
  const a = stripArticles(answer);
  for (const target of accepted) {
    const t = stripArticles(target);
    if (!t) continue;
    if (a === t) return [true, 1, target];
    const sim = 1 - levenshtein(a, t) / Math.max(a.length, t.length, 1);
    if (sim > best) {
      best = sim;
      bestTarget = target;
    }
  }
  const minLen = accepted.length ? Math.min(...accepted.map((t) => normalize(t).length)) : 0;
  const threshold = minLen <= 4 ? 0.97 : tolerance;
  return [best >= threshold, best, bestTarget];
}

export function lexicalDiversity(text: string, window = 25): number {
  const words = tokenize(text);
  if (!words.length) return 0;
  if (words.length <= window) return new Set(words).size / words.length;
  let sum = 0;
  const n = words.length - window + 1;
  for (let i = 0; i < n; i++) sum += new Set(words.slice(i, i + window)).size / window;
  return sum / n;
}

const PT_MARKERS = new Set(["não", "você", "voce", "é", "está", "eu", "que", "isso", "como", "por", "fala", "português",
  "obrigado", "tudo", "também", "porque", "então", "mas", "uma", "com", "pra", "para"]);
export function looksPortuguese(text: string): boolean {
  const words = normalize(text).split(" ").filter(Boolean);
  if (!words.length) return false;
  const hits = words.filter((w) => PT_MARKERS.has(w)).length;
  return hits / words.length >= 0.25 && hits >= 2;
}
