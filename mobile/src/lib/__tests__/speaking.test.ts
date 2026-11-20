import { test } from "node:test";
import assert from "node:assert/strict";
import parity from "../local/__tests__/parity.json";
import { compareChecks, speakingMetrics } from "../speaking";

test("medidor de fala idêntico ao Python", () => {
  for (const c of (parity as any).speaking) assert.deepEqual(speakingMetrics(c.text, c.seconds), c.result, c.text);
});

test("comparação semana a semana", () => {
  const a = speakingMetrics("I work as an engineer. I like it.", 60);
  const b = speakingMetrics("I work as a process engineer in a big plant and I really enjoy solving problems with my team.", 60);
  assert.match(compareChecks(null, a)[0], /ponto de partida/);
  const msgs = compareChecks(a, b);
  assert.match(msgs[0], /^\+\d+ palavras por minuto/);
  assert.ok(msgs.some((m) => /Frases mais longas/.test(m)));
});
