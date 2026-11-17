import { test } from "node:test";
import assert from "node:assert/strict";
import raw from "../../content/content.json";
import { checkChunk, checkSay, checkTurn, missionScore, parsePhrases, ratingFor, type Mission } from "../missions";

const MISSIONS = (raw as any).india_missions as Mission[];
const m01 = MISSIONS[0];

test("frases 'say': aceita a forma principal, variações e pequenos erros; recusa outra frase", () => {
  const c = m01.chunks.find((x) => x.id === "m01-c06")!; // It's my first time in India.
  assert.ok(checkSay("It's my first time in India", c).ok);
  assert.ok(checkSay("this is my first time in india", c).ok);
  assert.ok(checkSay("Its my frist time in India", c).ok);
  assert.ok(!checkSay("I'm from Brazil", c).ok);
  for (const m of MISSIONS) for (const ch of m.chunks) assert.ok(checkChunk(ch.en, ch).ok, ch.id);
});

test("frases 'hear': repetição tolerante ao reconhecimento de voz", () => {
  const c = MISSIONS.find((m) => m.id === "m13")!.chunks.find((x) => x.id === "m13-c01")!; // Accha, theek hai.
  assert.ok(checkChunk("Acha theek hai", c).ok);
  assert.ok(!checkChunk("good morning everyone", c).ok);
});

test("mini-conversa: palavras-chave, resposta curta e português", () => {
  const t = m01.dialog.turns[2];
  for (const m of MISSIONS) for (const turn of m.dialog.turns) assert.ok(checkTurn(turn.model.replace("{name}", "Ana"), turn).ok, turn.model);
  assert.ok(checkTurn("Yes, it's my first time here", t).ok);
  assert.equal(checkTurn("Yes", t).tooShort, true);
  assert.equal(checkTurn("Sim, é a minha primeira vez aqui na Índia", t).ok, false);
});

test("notas FSRS e nota da missão", () => {
  assert.equal(ratingFor(true, 1), 3);
  assert.equal(ratingFor(true, 2), 2);
  assert.equal(ratingFor(false, 2), 1);
  assert.equal(missionScore(1, 1, 1), 1);
  assert.equal(missionScore(0.8, 0.6, 0.4), 0.65);
});

test("importação de frases coladas", () => {
  const { phrases, invalid } = parsePhrases([
    "1. Could you send me the invoice? = Você pode me mandar a fatura?",
    "- Vou me atrasar 10 minutos | I'll be ten minutes late",
    "Where is the restroom?\tOnde fica o banheiro?",
    "Could you send me the invoice? = repetida",
    "linha sem separador",
    "",
  ].join("\n"));
  assert.deepEqual(phrases.map((p) => p.term), ["Could you send me the invoice?", "I'll be ten minutes late", "Where is the restroom?"]);
  assert.equal(phrases[1].meaning_pt, "Vou me atrasar 10 minutos");
  assert.deepEqual(invalid, ["linha sem separador"]);
});
