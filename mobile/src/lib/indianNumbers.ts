/**
 * Números no sistema indiano (lakh = 1,00,000; crore = 1,00,00,000), usados com frequência
 * em valores de pedidos, orçamentos e quantidades na Índia.
 */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return below100(r);
  return r ? `${ONES[h]} hundred ${below100(r)}` : `${ONES[h]} hundred`;
}

/** 1250000 → "twelve lakh fifty thousand"; 25000000 → "two crore fifty lakh". */
export function indianWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${crore >= 1000 ? indianWords(crore) : below1000(crore)} crore`);
  if (lakh) parts.push(`${below100(lakh)} lakh`);
  if (thousand) parts.push(`${below100(thousand)} thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** 1250000 → "12,50,000" (agrupamento indiano). */
export function indianFormat(value: number): string {
  const s = String(Math.floor(Math.abs(value)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${last3}`;
}

/** 1250000 → "1,250,000" (agrupamento internacional). */
export function internationalFormat(value: number): string {
  return String(Math.floor(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Lê o que o usuário digitou ("12,50,000", "1.250.000", "1250000") e devolve o número. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** Valores realistas para o treino (pedidos, orçamentos, contratos). */
export function randomAmount(rand: () => number = Math.random): number {
  const kind = rand();
  if (kind < 0.45) return (1 + Math.floor(rand() * 99)) * 100_000 + [0, 25_000, 50_000, 75_000][Math.floor(rand() * 4)];
  if (kind < 0.75) return (10 + Math.floor(rand() * 90)) * 1000;
  return (1 + Math.floor(rand() * 20)) * 10_000_000 + [0, 2_500_000, 5_000_000][Math.floor(rand() * 3)];
}
