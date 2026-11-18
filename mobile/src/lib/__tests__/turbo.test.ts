import { test } from "node:test";
import assert from "node:assert/strict";
import { answerRecall, challengeFor, confidenceSummary, recallDone, recallRating, startRecall } from "../turbo";

test("recuperação: errou volta logo, quase volta depois, acerto de primeira ganha uma confirmação", () => {
  let st = startRecall(["a", "b", "c", "d", "e", "f", "g", "h"]);
  st = answerRecall(st, "miss"); // a volta 2 itens depois
  assert.equal(st.queue.indexOf("a", 1), 3);
  st = answerRecall(st, "almost"); // b volta 4 depois
  assert.equal(st.queue.indexOf("b", 2), 6);
  st = answerRecall(st, "ok"); // c: confirmação 6 depois
  assert.ok(st.queue.lastIndexOf("c") > 3);
  // termina mesmo se sempre errar (no máximo 4 tentativas por frase)
  let s2 = startRecall(["x"]);
  for (let i = 0; i < 10 && !recallDone(s2); i++) s2 = answerRecall(s2, "miss");
  assert.ok(recallDone(s2));
  assert.equal(s2.attempts.x.length, 4);
});

test("notas FSRS e resumo de confiança", () => {
  assert.equal(recallRating(["ok", "ok"]), 3);
  assert.equal(recallRating(["miss", "ok"]), 2);
  assert.equal(recallRating(["miss", "almost"]), 1);
  const s = confidenceSummary([
    { date: "d1", before: 2, after: 3, recalled: 5, total: 8 }, { date: "d2", before: 2, after: 4, recalled: 6, total: 8 },
    { date: "d3", before: 3, after: 4, recalled: 7, total: 8 }, { date: "d4", before: 4, after: 5, recalled: 8, total: 8 },
  ])!;
  assert.equal(s.sessions, 4);
  assert.equal(s.trendStart, 2.3);
  assert.equal(s.trendNow, 3);
  assert.equal(confidenceSummary([]), null);
  assert.equal(challengeFor(0).level, 1);
  assert.equal(challengeFor(9).level, 4);
});
