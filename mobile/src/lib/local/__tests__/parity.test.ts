/** Paridade com o backend Python: as fixtures são geradas por backend/scripts/export_content.py. */
import { test } from "node:test";
import assert from "node:assert/strict";
import parity from "./parity.json";
import { analyzeEnglish, correctText } from "../errors";
import { newCard, review, type CardState } from "../fsrs";
import { generate } from "../planner";
import { answerMatches, normalize, wordErrorRate } from "../text";
import { estimateLevel, scoreItem } from "../learning";
import { acceptedAnswers, cloze } from "../vocab";
import { shadowingFeedback } from "../speech";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test("FSRS idêntico ao Python", () => {
  for (const steps of (parity as any).fsrs) {
    let card: CardState = newCard(new Date(steps[0].at));
    for (const s of steps) {
      card = review(card, s.rating, new Date(s.at)).card;
      assert.equal(card.state, s.state);
      assert.equal(card.step, s.step);
      close(card.stability!, s.stability);
      close(card.difficulty!, s.difficulty);
      assert.equal(Date.parse(card.due), Date.parse(s.due));
      assert.equal(card.lapses, s.lapses);
    }
  }
});

test("analisador de erros idêntico ao Python", () => {
  for (const c of (parity as any).analyzer) {
    const got = analyzeEnglish(c.text);
    assert.deepEqual(got.map((x) => x.rule_id), c.rules, c.text);
    assert.equal(correctText(c.text), c.corrected, c.text);
  }
});

test("planejador idêntico ao Python", () => {
  for (const pc of (parity as any).planner) {
    const days = generate({ start: "2026-11-10", ...pc.config });
    assert.equal(days.length, pc.days.length);
    days.forEach((d, i) => {
      const e = pc.days[i];
      assert.equal(d.phase, e.phase);
      assert.equal(d.focus, e.focus);
      assert.equal(d.is_assessment_day, e.assessment);
      assert.deepEqual(d.activities.map((a) => [a.type, a.minutes, a.params]), e.activities, `dia ${d.day_index}`);
    });
  }
});

test("texto, avaliação e vocabulário idênticos ao Python", () => {
  const p = parity as any;
  for (const c of p.normalize) assert.equal(normalize(c.text), c.result);
  for (const c of p.wer) close(wordErrorRate(c.ref, c.hyp), c.result);
  for (const c of p.answer_matches) {
    const [ok, sim, target] = answerMatches(c.answer, c.accepted);
    assert.equal(ok, c.result[0], c.answer);
    close(sim, c.result[1]);
    assert.equal(target, c.result[2]);
  }
  for (const c of p.estimate_level) {
    const [lvl, score] = estimateLevel(c.acc);
    assert.equal(lvl, c.result[0]);
    close(score, c.result[1], 1e-6);
  }
  for (const c of p.score_item) close(scoreItem(c.item, c.response), c.result);
  for (const c of p.accepted_answers) assert.deepEqual([...acceptedAnswers(c.term)].sort(), c.result);
  for (const c of p.cloze) assert.equal(cloze(c.example, c.term), c.result);
  for (const c of p.shadowing) {
    const fb = shadowingFeedback(c.args);
    assert.equal(fb.status, c.result.status);
    if (c.result.intelligibility != null) close(fb.intelligibility, c.result.intelligibility, 1e-6);
    if (c.result.substitutions) assert.deepEqual(fb.substitutions, c.result.substitutions);
  }
});
