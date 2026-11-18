/** Detector de interferência do português — porte de app/services/error_analyzer.py (paridade testada). */

export type Correction = {
  original: string;
  corrected: string;
  explanation_pt: string;
  category: string;
  subtype: string;
  severity: "minor" | "may_confuse" | "blocks_understanding";
  rule_id: string;
  source: string;
};

type Groups = (string | undefined)[];
type Rule = {
  id: string;
  re: RegExp;
  repl: string | ((g: Groups, sentence: string) => string);
  category: string;
  subtype: string;
  explanation: string;
  severity?: Correction["severity"];
  guard?: (sentence: string, index: number) => boolean;
};

const IRREGULAR_PP: Record<string, string> = {
  went: "gone", did: "done", saw: "seen", ate: "eaten", wrote: "written", took: "taken", gave: "given", spoke: "spoken",
  came: "come", began: "begun", drank: "drunk", knew: "known", broke: "broken", chose: "chosen", forgot: "forgotten", drove: "driven",
};
const BASE_FROM_PAST: Record<string, string> = {
  went: "go", did: "do", saw: "see", ate: "eat", wrote: "write", took: "take", gave: "give", spoke: "speak", came: "come",
  made: "make", had: "have", said: "say", got: "get", bought: "buy", thought: "think", found: "find", told: "tell",
  knew: "know", sent: "send", worked: "work", finished: "finish", started: "start", called: "call", needed: "need",
};
const COMPARATIVES: Record<string, string> = {
  easy: "easier", cheap: "cheaper", fast: "faster", big: "bigger", small: "smaller", hard: "harder", busy: "busier",
  high: "higher", low: "lower", long: "longer", short: "shorter", quick: "quicker", old: "older", good: "better", bad: "worse",
};
const UNCOUNTABLE: Record<string, string> = {
  informations: "information", equipments: "equipment", advices: "advice", feedbacks: "feedback", softwares: "software",
  hardwares: "hardware", furnitures: "furniture", knowledges: "knowledge", homeworks: "homework", luggages: "luggage",
  baggages: "baggage",
};

const keepCase = (src: string, repl: string) => (src && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() && repl
  ? repl[0].toUpperCase() + repl.slice(1) : repl);

function verb(base: string, suffix: string | undefined): string {
  const s = (suffix ?? "").toLowerCase();
  if (s === "s" || s === "es") return ({ have: "has", do: "does", go: "goes" } as Record<string, string>)[base] ?? base + "s";
  if (s === "ed" || s === "d" || s === "t") {
    const irr: Record<string, string> = { make: "made", have: "had", do: "did", hold: "held", miss: "missed" };
    if (irr[base]) return irr[base];
    return base.endsWith("y") && !"aeiou".includes(base[base.length - 2]) ? base.slice(0, -1) + "ied" : base + "ed";
  }
  if (s === "ing") return ({ make: "making", have: "having" } as Record<string, string>)[base] ?? base + "ing";
  return base;
}

function notAfterAux(sentence: string, index: number): boolean {
  const before = sentence.slice(0, index).toLowerCase().trimEnd();
  return !/\b(does|did|doesn't|didn't|will|would|can|could|should|must|might|may|to|let|make|help|why|does not|did not)$/.test(before);
}

const r = (src: string) => new RegExp(src, "gi");
const HOLD = ["meeting", "event", "training", "presentation"];

const RULES: Rule[] = [
  { id: "am_agree", re: r("\\b(I|we|they|you)(\\s+am|\\s+are|'m|'re)\\s+agree\\b"), repl: (g) => `${g[1]} agree`,
    category: "grammar", subtype: "verb_agree", explanation: "Em inglês, 'agree' é verbo: diga 'I agree' (não 'I am agree')." },
  { id: "depend_of", re: r("\\bdepend(s|ed|ing)?\\s+of\\b"), repl: (g) => `depend${g[1] ?? ""} on`,
    category: "grammar", subtype: "preposition", explanation: "A preposição de 'depend' é 'on': 'It depends on…'." },
  { id: "explain_me", re: r("\\bexplain\\s+(me|him|her|us|them)\\b"), repl: (g) => `explain to ${g[1]}`,
    category: "grammar", subtype: "verb_pattern", explanation: "'Explain' pede 'to' antes da pessoa: 'Can you explain to me…?' ou 'Can you explain it?'." },
  { id: "present_since", re: r("\\b(I|we|they|you)\\s+(work|live|study|am working|am living|'m working|'m living)\\s+((?:here|there|in\\s+[\\w ]{2,30}?|at\\s+[\\w ]{2,30}?|with\\s+[\\w ]{2,20}?)\\s+)since\\b"),
    repl: (g) => `${g[1]} have been ${g[2]!.includes("work") ? "working" : g[2]!.includes("liv") ? "living" : "studying"} ${g[3]}since`,
    category: "grammar", subtype: "present_perfect", explanation: "Para algo que começou no passado e continua: present perfect — 'I have worked / have been working here since 2020'." },
  { id: "since_duration", re: r("\\bsince\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|many)\\s+(years?|months?|weeks?|days?|hours?)\\b(?!\\s+ago)"),
    repl: (g) => `for ${g[1]} ${g[2]}`, category: "grammar", subtype: "for_since",
    explanation: "'Since' marca o ponto de início (since 2020); para duração use 'for' (for 3 years).", severity: "may_confuse" },
  { id: "have_age", re: r("\\b(I|you|we|they)\\s+have\\s+(\\d{1,2})\\s+years(\\s+old)?(?=\\s*(?:and\\b|[.,!?;]|$))"),
    repl: (g) => `${g[1]} ${g[1]!.toLowerCase() === "i" ? "am" : "are"} ${g[2]} years old`,
    category: "grammar", subtype: "age", explanation: "Idade usa 'to be': 'I am 35 (years old)', não 'I have 35 years'." },
  { id: "has_age", re: r("\\b(he|she)\\s+has\\s+(\\d{1,2})\\s+years(\\s+old)?(?=\\s*(?:and\\b|[.,!?;]|$))"),
    repl: (g) => `${g[1]} is ${g[2]} years old`, category: "grammar", subtype: "age",
    explanation: "Idade usa 'to be': 'She is 30', não 'She has 30 years'." },
  { id: "make_question", re: r("\\bmak(e|es|ing)\\s+a\\s+question\\b"), repl: (g) => verb("ask", g[1]) + " a question",
    category: "vocabulary", subtype: "collocation", explanation: "Collocation: 'ask a question' (não 'make a question')." },
  { id: "do_mistake", re: r("\\b(do|does|did|doing)\\s+((?:a|many|some|a lot of|several)\\s+)mistake(s?)\\b"),
    repl: (g) => ({ do: "make", does: "makes", did: "made", doing: "making" } as Record<string, string>)[g[1]!.toLowerCase()] + ` ${g[2]}mistake${g[3]}`,
    category: "vocabulary", subtype: "collocation", explanation: "Collocation: 'make a mistake' (não 'do a mistake')." },
  { id: "make_meeting", re: r("\\bmak(e|es|ing)\\s+a\\s+meeting\\b"), repl: (g) => verb("have", g[1]) + " a meeting",
    category: "vocabulary", subtype: "collocation", explanation: "Em inglês: 'have/hold a meeting' (decalque de 'fazer uma reunião')." },
  { id: "realize_event", re: r("\\breali[sz](e|es|ed|ing)\\s+(a|the|an)\\s+(meeting|test|project|task|presentation|training|event|audit|inspection)\\b"),
    repl: (g) => {
      const hold = HOLD.includes(g[3]!.toLowerCase());
      return `${verb(hold ? "hold" : "carry", g[1])}${hold ? "" : " out"} ${g[2]} ${g[3]}`;
    },
    category: "false_friend", subtype: "realize", severity: "may_confuse",
    explanation: "Falso cognato: 'realize' = perceber. 'Realizar' (executar) = 'carry out / hold / conduct'." },
  { id: "people_is", re: r("\\b(the\\s+)?people\\s+(is|was|has)\\b"),
    repl: (g) => `${g[1] ?? ""}people ${({ is: "are", was: "were", has: "have" } as Record<string, string>)[g[2]!.toLowerCase()]}`,
    category: "grammar", subtype: "agreement", explanation: "'People' é plural: 'people are / were / have'." },
  { id: "third_person_dont", re: r("\\b(he|she|it)\\s+don'?t\\b"), repl: (g) => `${g[1]} doesn't`,
    category: "grammar", subtype: "third_person", explanation: "Na 3ª pessoa do singular (he/she/it) o auxiliar é 'doesn't'." },
  { id: "third_person_have", re: r("\\b(he|she|it)\\s+have\\b(?!\\s+(?:been|had|got|done|seen|gone|made|taken|to)\\b)"),
    repl: (g) => `${g[1]} has`, category: "grammar", subtype: "third_person",
    explanation: "Na 3ª pessoa do singular use 'has': 'she has a meeting'.", guard: notAfterAux },
  { id: "have_past", re: r("\\b(have|has|had)\\s+(went|did|saw|ate|wrote|took|gave|spoke|came|began|drank|knew|broke|chose|forgot|drove)\\b"),
    repl: (g) => `${g[1]} ${IRREGULAR_PP[g[2]!.toLowerCase()]}`, category: "grammar", subtype: "past_participle",
    explanation: "Depois de 'have/has/had' usa-se o particípio: 'have gone', 'have done', 'have seen'." },
  { id: "did_past", re: r(`\\b(didn't|did not|did)\\s+((?:you|he|she|they|we|i|it)\\s+)?(${Object.keys(BASE_FROM_PAST).join("|")})\\b`),
    repl: (g) => `${g[1]} ${g[2] ?? ""}${BASE_FROM_PAST[g[3]!.toLowerCase()]}`, category: "grammar", subtype: "did_base_form",
    explanation: "Com 'did/didn't' o verbo principal fica na forma base: 'I didn't go', 'Did you finish?'." },
  { id: "modal_s", re: r("\\b(can|could|will|would|should|must|might)\\s+(goes|does|works|needs|has|makes|takes|gets|wants|knows|sends|says)\\b"),
    repl: (g) => `${g[1]} ` + (({ goes: "go", does: "do", has: "have" } as Record<string, string>)[g[2]!.toLowerCase()] ?? g[2]!.slice(0, -1)),
    category: "grammar", subtype: "modal_base_form", explanation: "Depois de modal (can, will, should…) o verbo fica na forma base, sem -s." },
  { id: "modal_to", re: r("\\b(can|could|will|would|should|must|might)\\s+to\\s+(\\w+)"), repl: (g) => `${g[1]} ${g[2]}`,
    category: "grammar", subtype: "modal_base_form", explanation: "Modais não levam 'to': 'I can go' (não 'I can to go')." },
  { id: "do_you_can", re: r("\\bdo\\s+you\\s+can\\b"), repl: "can you", category: "grammar", subtype: "question_form",
    explanation: "Com 'can' a pergunta inverte o modal: 'Can you…?' (não 'Do you can…?')." },
  { id: "more_comparative", re: r(`\\bmore\\s+(${Object.keys(COMPARATIVES).join("|")})\\b(?=\\s+than\\b|\\s+to\\b|\\s*[.,!?;]|\\s*$)`),
    repl: (g) => COMPARATIVES[g[1]!.toLowerCase()], category: "grammar", subtype: "comparative",
    explanation: "Adjetivos curtos fazem comparativo com -er: 'easier', 'cheaper', 'faster' (good → better)." },
  { id: "uncountable_plural", re: r(`\\b(${Object.keys(UNCOUNTABLE).join("|")})\\b`),
    repl: (g) => keepCase(g[1]!, UNCOUNTABLE[g[1]!.toLowerCase()]), category: "grammar", subtype: "uncountable",
    explanation: "Este substantivo é incontável em inglês: sem plural (use 'pieces of information', 'some advice')." },
  { id: "assist_event", re: r("\\bassist(s|ed|ing)?\\s+(the|a|an)\\s+(meeting|movie|film|class|lecture|presentation|game|training|conference|webinar)\\b"),
    repl: (g) => `${verb(["movie", "film", "game"].includes(g[3]!.toLowerCase()) ? "watch" : "attend", g[1])} ${g[2]} ${g[3]}`,
    category: "false_friend", subtype: "assist", severity: "may_confuse",
    explanation: "Falso cognato: 'assist' = ajudar. 'Assistir a uma reunião' = 'attend a meeting'; 'assistir a um filme' = 'watch a movie'." },
  { id: "pretend_to", re: r("\\b(I|we)\\s+pretend\\s+to\\s+(?!be\\b|know\\b|understand\\b|like\\b)(\\w+)"),
    repl: (g) => `${g[1]} intend to ${g[2]}`, category: "false_friend", subtype: "pretend", severity: "may_confuse",
    explanation: "Falso cognato: 'pretend' = fingir. Se quis dizer 'pretendo fazer', use 'intend to / plan to'." },
  { id: "lose_flight", re: r("\\blos(e|es|t|ing)\\s+(the|my|our|a|his|her|their)\\s+(flight|bus|train|plane|connection|meeting|deadline|appointment)\\b"),
    repl: (g) => `${verb("miss", ({ e: "", es: "es", t: "ed", ing: "ing" } as Record<string, string>)[g[1]!.toLowerCase()])} ${g[2]} ${g[3]}`.replace("misss", "misses"),
    category: "vocabulary", subtype: "lose_miss", severity: "may_confuse",
    explanation: "'Perder' um voo/ônibus/prazo = 'miss'. 'Lose' = perder algo que some (lose my passport)." },
  { id: "have_doubt", re: r("\\b(I|we)\\s+have\\s+(a|one|some|a few)?\\s*doubts?\\b(?!\\s+(?:that|whether|about\\s+whether)\\b)"),
    repl: (g) => `${g[1]} have ${g[2] ? g[2] + " " : "some "}question${["a", "one"].includes((g[2] ?? "").toLowerCase()) ? "" : "s"}`,
    category: "vocabulary", subtype: "doubt_question", severity: "may_confuse",
    explanation: "'Tenho uma dúvida' = 'I have a question'. 'Doubt' expressa desconfiança/incerteza." },
  { id: "discuss_about", re: r("\\bdiscuss(es|ed|ing)?\\s+about\\b"), repl: (g) => `discuss${g[1] ?? ""}`,
    category: "grammar", subtype: "preposition", explanation: "'Discuss' não leva 'about': 'discuss the project' (mas 'talk about')." },
  { id: "arrive_to", re: r("\\barriv(e|es|ed|ing)\\s+to\\b"), repl: (g) => `arriv${g[1]} at`, category: "grammar", subtype: "preposition",
    explanation: "Use 'arrive at' (lugar específico) ou 'arrive in' (cidade/país), não 'arrive to'." },
  { id: "dummy_subject", re: r("(^|[.!?]\\s+)(is|was)\\s+(possible|necessary|important|difficult|raining)\\b"),
    repl: (g, sentence) => (sentence.trimEnd().endsWith("?")
      ? `${g[1]}${g[2]} it ${g[3]}` : `${g[1]}${keepCase(g[2]!, "it")} ${g[2]!.toLowerCase()} ${g[3]}`),
    category: "grammar", subtype: "dummy_subject", explanation: "Inglês exige sujeito: 'It is possible…', 'It's raining' (o português omite)." },
  { id: "like_very_much", re: r("\\b(like|love|enjoy)\\s+very\\s+much\\s+([^,.!?;]+)"), repl: (g) => `${g[1]} ${g[2]!.trim()} very much`,
    category: "grammar", subtype: "word_order", explanation: "Ordem: 'I like it very much' / 'I really like…' (o advérbio vem depois do objeto)." },
  { id: "how_call", re: r("\\bhow\\s+do\\s+you\\s+call\\b"), repl: "what do you call", category: "vocabulary", subtype: "question_form",
    explanation: "Para perguntar o nome de algo: 'What do you call…?' / 'How do you say…?'." },
  { id: "in_the_weekend", re: r("\\bin\\s+the\\s+weekend\\b"), repl: "on the weekend", category: "grammar", subtype: "preposition",
    explanation: "Diga 'on the weekend' (EUA) ou 'at the weekend' (Reino Unido)." },
  { id: "born", re: r("\\bI\\s+born\\b"), repl: "I was born", category: "grammar", subtype: "passive",
    explanation: "'Nascer' em inglês é passiva: 'I was born in…'." },
  { id: "actually_currently", re: r("(^|[.!?]\\s+)actually\\s+(I\\s+work|I\\s+am\\s+working|I'm\\s+working|we\\s+are\\s+working|we\\s+work|I\\s+live)\\b"),
    repl: (g) => `${g[1]}Currently ${g[2]}`, category: "false_friend", subtype: "actually", severity: "may_confuse",
    explanation: "Se quis dizer 'atualmente', use 'currently / nowadays'. 'Actually' significa 'na verdade'." },
];

export function splitSentences(text: string): string[] {
  return text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
}

function applyRule(rule: Rule, sentence: string): [string, boolean] {
  let changed = false;
  const parts: string[] = [];
  let pos = 0;
  rule.re.lastIndex = 0;
  for (const m of sentence.matchAll(rule.re)) {
    const index = m.index ?? 0;
    if (rule.guard && !rule.guard(sentence, index)) continue;
    const repl = typeof rule.repl === "string" ? keepCase(m[0], rule.repl) : rule.repl(Array.from(m), sentence);
    parts.push(sentence.slice(pos, index), repl);
    pos = index + m[0].length;
    changed = changed || repl.toLowerCase() !== m[0].toLowerCase();
  }
  parts.push(sentence.slice(pos));
  return [parts.join("").replace(/\s{2,}/g, " ").trim(), changed];
}

export function correctText(text: string): string {
  return splitSentences(text).map((s) => RULES.reduce((acc, rule) => applyRule(rule, acc)[0], s)).join(" ");
}

export function analyzeEnglish(text: string): Correction[] {
  const out: Correction[] = [];
  for (const sentence of splitSentences(text)) {
    const found = RULES.filter((rule) => applyRule(rule, sentence)[1]);
    if (!found.length) continue;
    const full = correctText(sentence);
    for (const rule of found) {
      out.push({ original: sentence, corrected: full, explanation_pt: rule.explanation, category: rule.category,
                 subtype: rule.subtype, severity: rule.severity ?? "minor", rule_id: rule.id, source: "rules" });
    }
  }
  return out;
}

const SPANISH_FALSE_FRIENDS: Record<string, string> = {
  exquisito: "Em espanhol 'exquisito' = delicioso/refinado (não 'esquisito' = 'raro/extraño').",
  embarazada: "'Embarazada' = grávida (não 'envergonhada' = 'avergonzada').",
  oficina: "'Oficina' = escritório (oficina mecânica = 'taller').",
  polvo: "'Polvo' = pó (o animal é 'pulpo').",
  borracha: "'Borracha' = bêbada (borracha de apagar = 'goma').",
  pronto: "'Pronto' = logo/em breve (pronto = 'listo').",
  apellido: "'Apellido' = sobrenome (apelido = 'apodo').",
  cena: "'Cena' = jantar (cena de filme = 'escena').",
  largo: "'Largo' = comprido (largo = 'ancho').",
};

export function analyze(text: string, language: string): Correction[] {
  if (language === "en") return analyzeEnglish(text);
  if (language !== "es") return [];
  const out: Correction[] = [];
  for (const sentence of splitSentences(text)) {
    const words = new Set(sentence.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []);
    for (const [ff, note] of Object.entries(SPANISH_FALSE_FRIENDS)) {
      if (words.has(ff)) out.push({ original: sentence, corrected: sentence, explanation_pt: `Atenção ao falso cognato: ${note}`,
        category: "false_friend", subtype: ff, severity: "may_confuse", rule_id: `es_ff_${ff}`, source: "rules" });
    }
  }
  return out;
}
