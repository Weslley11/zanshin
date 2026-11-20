import { test } from "node:test";
import assert from "node:assert/strict";
import content from "../../content/content.json";
import { buildQuiz, quizRating, type Guide } from "../speechGuide";

const guides = (content as any).speech_guides as Guide[];

test("treino de ouvido: 3 opções da mesma seção, sem repetir, seções intercaladas", () => {
  for (const g of guides) {
    const q = buildQuiz(g, 10, 42);
    assert.equal(q.length, 10);
    assert.equal(new Set(q.map((x) => x.item.id)).size, 10);
    assert.deepEqual(q.slice(0, 4).map((x) => x.section), ["pron", "daily", "slang", "style"]);
    for (const x of q) {
      assert.equal(x.options.length, 3);
      assert.equal(new Set(x.options).size, 3);
      assert.equal(x.options[x.answer], x.item.pt);
      const sec = g.sections.find((s) => s.id === x.section)!;
      assert.ok(x.options.every((o) => sec.items.some((i) => i.pt === o)));
    }
    assert.deepEqual(buildQuiz(g, 10, 42).map((x) => x.item.id), q.map((x) => x.item.id)); // determinístico
    const only = buildQuiz(g, 50, 7, "slang");
    assert.ok(only.every((x) => x.section === "slang"));
    assert.equal(only.length, g.sections.find((s) => s.id === "slang")!.items.length);
  }
  assert.equal(quizRating(true, 1), 3);
  assert.equal(quizRating(true, 3), 2);
  assert.equal(quizRating(false, 1), 1);
});
