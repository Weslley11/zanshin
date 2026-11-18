/**
 * Turbo: sessão diária de ~15 min que junta os métodos com melhor evidência para fixar rápido e falar sem medo.
 * 1) Confiança (antes) → 2) Recuperação em voz alta com intervalos crescentes (antecipação + espaçamento)
 * → 3) Shadowing relâmpago → 4) Fluência 4/3/2 (mesma história, menos tempo) → 5) Confiança (depois) + desafio real.
 * Funções puras (fila, notas, histórico) para poderem ser testadas.
 */

export type Recall = "ok" | "almost" | "miss";
export type TurboItem = { id: string; card_id?: string; en: string; pt: string };

/** Distância (em itens) até a frase voltar: errou volta logo; quase, um pouco depois; acertou de primeira, uma confirmação mais adiante. */
export const REINSERT_GAP: Record<Recall, number> = { miss: 2, almost: 4, ok: 6 };

export type RecallState = { queue: string[]; pos: number; attempts: Record<string, Recall[]> };

export function startRecall(ids: string[]): RecallState {
  return { queue: [...ids], pos: 0, attempts: {} };
}

/** Registra a resposta da frase atual e devolve o novo estado (intervalos crescentes dentro da sessão). */
export function answerRecall(st: RecallState, r: Recall): RecallState {
  const id = st.queue[st.pos];
  const prev = st.attempts[id] ?? [];
  const attempts = { ...st.attempts, [id]: [...prev, r] };
  const queue = [...st.queue];
  const confirmed = r === "ok" && prev.length > 0; // já acertou depois de errar/confirmar: não precisa voltar
  const firstOk = r === "ok" && prev.length === 0;
  const tooMany = prev.length >= 3;
  if (!confirmed && !tooMany) {
    const at = Math.min(queue.length, st.pos + 1 + REINSERT_GAP[r]);
    if (!(firstOk && queue.length - st.pos <= 1)) queue.splice(at, 0, id); // no fim da fila não vale confirmar
  }
  return { queue, pos: st.pos + 1, attempts };
}

export const recallDone = (st: RecallState) => st.pos >= st.queue.length;

/** Nota FSRS: de primeira = Good (3); precisou repetir mas saiu = Hard (2); não saiu = Again (1). */
export function recallRating(history: Recall[] = []): 1 | 2 | 3 {
  if (!history.length) return 1;
  if (history[0] === "ok") return 3;
  return history.includes("ok") ? 2 : 1;
}

export type TurboLog = { date: string; before: number; after: number; recalled: number; total: number };

/** Resumo do histórico de confiança (1–5): média antes/depois e tendência das últimas sessões. */
export function confidenceSummary(history: TurboLog[]) {
  if (!history.length) return null;
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  const first = history.slice(0, Math.min(3, history.length));
  const last = history.slice(-3);
  return {
    sessions: history.length,
    avgBefore: avg(history.map((h) => h.before)),
    avgAfter: avg(history.map((h) => h.after)),
    trendStart: avg(first.map((h) => h.before)),
    trendNow: avg(last.map((h) => h.before)),
  };
}

/** Rodadas da fluência 4/3/2 adaptada ao celular (Nation: mesma fala, menos tempo a cada vez). */
export const FLUENCY_ROUNDS = [90, 60, 45];

/** Desafios fora do app: pequenas exposições graduais (dessensibilização) que vão do fácil ao real. */
export const CHALLENGES: { level: number; text_pt: string }[] = [
  { level: 1, text_pt: "Narre em inglês, em voz baixa, 1 minuto do que você está fazendo agora (self-talk)." },
  { level: 1, text_pt: "Grave um áudio de 30 s para você mesmo contando seu dia — e ouça uma vez sem se julgar." },
  { level: 2, text_pt: "Leia em voz alta um e-mail de trabalho em inglês, como se estivesse numa call." },
  { level: 2, text_pt: "Mande uma mensagem de voz em inglês para um amigo ou colega (pode ser só uma frase)." },
  { level: 3, text_pt: "Faça uma pergunta em inglês numa call ou reunião — 'Could you share your screen?' já vale." },
  { level: 3, text_pt: "Comece uma conversa de 2 minutos com um colega indiano: 'How's your week going?'" },
  { level: 4, text_pt: "Explique em inglês um problema técnico de 1 minuto para alguém (sintoma → causa → próximo passo)." },
  { level: 4, text_pt: "Ligue (ou entre numa call) e conduza um assunto curto do começo ao fim em inglês." },
];

export function challengeFor(sessions: number): { level: number; text_pt: string } {
  const level = Math.min(4, 1 + Math.floor(sessions / 3)); // sobe de nível a cada 3 sessões
  const pool = CHALLENGES.filter((c) => c.level === level);
  return pool[sessions % pool.length];
}

/** O que a pesquisa diz (resumo honesto, com o tamanho da evidência). */
export const METHODS: { title_pt: string; how_pt: string; evidence_pt: string }[] = [
  { title_pt: "Recuperação espaçada", how_pt: "Puxar a frase da memória, em intervalos que crescem.",
    evidence_pt: "Meta-análise com 48 experimentos em L2 (Kim & Webb, 2022): efeito de médio a grande, principalmente na retenção de longo prazo." },
  { title_pt: "Antecipação (estilo Pimsleur)", how_pt: "Ver o português, falar em inglês antes de ouvir a resposta.",
    evidence_pt: "Princípio bem fundamentado na prática de recuperação; os intervalos exatos de Pimsleur são escolha de design, não dados." },
  { title_pt: "Fluência 4/3/2", how_pt: "Contar a mesma história 3 vezes com cada vez menos tempo.",
    evidence_pt: "Nation (1989) e estudos posteriores mostram aumento da velocidade de fala; estudos pequenos, efeitos consistentes." },
  { title_pt: "Shadowing", how_pt: "Repetir junto com o áudio, imitando ritmo e entonação.",
    evidence_pt: "Estudos (em geral pequenos) indicam ganhos em fluência e pronúncia; efeito maior na escuta." },
  { title_pt: "Falar sem medo", how_pt: "Exposição gradual, prática de baixo risco e sentir progresso (autoeficácia).",
    evidence_pt: "Meta-análise de 37 estudos: intervenções reduzem a ansiedade de língua estrangeira (efeito moderado); ansiedade e autoconfiança andam fortemente juntas." },
];
