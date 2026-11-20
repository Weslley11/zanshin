/**
 * Mapas mentais para fixação — funções puras usadas na tela e nos testes.
 * Evidência: construir/reconstruir o mapa de memória e depois conferir (recuperação) fixa mais do que estudar
 * um mapa pronto (Karpicke & Blunt, 2011; Blunt & Karpicke, 2014; Nesbit & Adesope, 2006).
 */
import { normalize, similarity, tokenize } from "./local/text";

export type Leaf = { id: string; en: string; pt: string };
export type Branch = { id: string; en: string; pt: string; icon: string; leaves: Leaf[] };
export type MindMap = { id: string; order: number; icon: string; track: string; title_pt: string; center_en: string; center_pt: string; branches: Branch[] };
export type MapMode = "study" | "recall" | "rebuild";

export const TRACK_LABEL: Record<string, string> = { work: "Trabalho", travel: "Viagem", india: "Índia", us: "Wisconsin / EUA" };

/** Cores dos 4 ramos (contraste bom em claro e escuro). */
export const BRANCH_COLORS = ["#7C5CFF", "#00A884", "#FF7A45", "#2F80ED"];

const STOP = new Set("a an the to of in on at for is are be i i'm you we it it's that this my your our do does can could would will please and or".split(" "));

/** Palavras que carregam sentido (para reconhecer a frase mesmo com outra ordem ou sem artigos). */
export const contentWords = (text: string) => tokenize(text).filter((w) => !STOP.has(w) && w.length > 1);

/**
 * Reconstrução: quais frases do ramo a pessoa conseguiu lembrar no que disse/escreveu.
 * Conta como lembrada se algum trecho for parecido com a frase (≥ 0,75) ou se ≥ 60% das palavras de sentido aparecerem.
 */
export function matchRecalled(answer: string, leaves: Leaf[]): Set<string> {
  const said = new Set(tokenize(answer));
  const parts = answer.split(/[\n.!?;,]+/).map((s) => s.trim()).filter(Boolean);
  const hit = new Set<string>();
  if (!normalize(answer)) return hit;
  for (const leaf of leaves) {
    const best = Math.max(0, ...parts.map((p) => similarity(p, leaf.en)));
    const words = contentWords(leaf.en);
    const cover = words.length ? words.filter((w) => said.has(w)).length / words.length : 0;
    if (best >= 0.75 || (words.length >= 2 && cover >= 0.6)) hit.add(leaf.id);
  }
  return hit;
}

/** Revisões espaçadas do mapa inteiro: 1, 3, 7, 14 e 30 dias depois de cada sessão. */
export const MAP_INTERVALS = [1, 3, 7, 14, 30];

export function dueInDays(sessions: number, lastAt: string | null, now = new Date()): number | null {
  if (!sessions || !lastAt) return null;
  const gap = MAP_INTERVALS[Math.min(sessions, MAP_INTERVALS.length) - 1];
  const elapsed = (now.getTime() - new Date(lastAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(gap - elapsed));
}

/** Posição dos ramos ao redor do centro (em graus, começando em cima à esquerda), para o desenho radial. */
export function branchAngles(n: number): number[] {
  return Array.from({ length: n }, (_, k) => -135 + (360 / n) * k);
}

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [Math.round((cx + r * Math.cos(rad)) * 10) / 10, Math.round((cy + r * Math.sin(rad)) * 10) / 10];
}

/** O que a pesquisa diz (resumo honesto). */
export const MAP_EVIDENCE: { title_pt: string; text_pt: string }[] = [
  { title_pt: "Montar > olhar", text_pt: "Construir um mapa ajuda mais do que estudar um mapa pronto (meta-análise de Nesbit & Adesope, 2006)." },
  { title_pt: "Lembrar > montar olhando", text_pt: "Puxar da memória rendeu cerca de 50% mais retenção uma semana depois do que montar o mapa com o texto aberto (Karpicke & Blunt, 2011)." },
  { title_pt: "Mapa de memória", text_pt: "Montar o mapa de memória e depois conferir funciona tão bem quanto a recuperação livre (Blunt & Karpicke, 2014). É o modo Reconstruir." },
  { title_pt: "Espaçar", text_pt: "Voltar ao mesmo mapa depois de 1, 3, 7… dias vale mais do que repetir tudo no mesmo dia (efeito de espaçamento)." },
];
