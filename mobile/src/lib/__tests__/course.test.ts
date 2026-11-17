import { test } from "node:test";
import assert from "node:assert/strict";
import raw from "../../content/content.json";
import { buildLesson, checkTiles, checkTyped, itemRatings, tokens, type Lesson } from "../course";
import { personalize } from "../local/missions";

const UNITS = (raw as any).course.units as any[];

function lessonOf(u: any, l: any, k: number): Lesson {
  const items = l.item_ids.map((id: string) => u.items.find((i: any) => i.id === id));
  const pool = UNITS.slice(Math.max(0, k - 1), k + 2).flatMap((x) => x.items).filter((i: any) => !l.item_ids.includes(i.id));
  return personalize({ id: l.id, kind: l.kind, title_pt: l.title_pt, unit_id: u.id, unit_title_pt: u.title_pt, unit_order: u.order, items, pool }, "Ana");
}

test("todas as lições geram exercícios resolvíveis e variados", () => {
  const types = new Set<string>();
  UNITS.forEach((u, k) => u.lessons.forEach((l: any) => {
    const lesson = lessonOf(u, l, k);
    const ex = buildLesson(lesson, "s1");
    assert.ok(ex.length >= 7 && ex.length <= 16, `${l.id}: ${ex.length}`);
    for (const e of ex) {
      types.add(e.type);
      if ("options" in e) {
        assert.equal(new Set(e.options).size, e.options.length, `${l.id} opções repetidas`);
        assert.ok(e.answer >= 0 && e.options.length >= 2, `${l.id} ${e.type}`);
      }
      if (e.type === "build" || e.type === "listen_build") {
        const ans = tokens(e.item.en);
        const bag = [...e.tiles];
        for (const w of ans) {
          const i = bag.indexOf(w);
          assert.ok(i >= 0, `${l.id}: falta o bloco "${w}"`);
          bag.splice(i, 1);
        }
        assert.ok(checkTiles(ans, e.item), `${l.id}: montagem correta recusada`);
      }
      if (e.type === "cloze") assert.ok(e.sentence.includes("_____"));
      if (e.type === "type") assert.ok(checkTyped(e.item.en, e.item).ok);
      if (e.type === "match") assert.ok(e.pairs.length >= 2 && e.pairs.length <= 5);
    }
    // cada item novo aparece pelo menos duas vezes numa lição de aprendizagem
    if (l.kind === "learn") for (const it of lesson.items) assert.ok(ex.filter((e) => "item" in e && e.item.id === it.id).length >= 2, `${l.id} ${it.id}`);
  }));
  assert.deepEqual([...types].sort(), ["build", "choose_en", "choose_pt", "cloze", "listen_build", "match", "type"]);
});

test("lição é determinística pela semente", () => {
  const l = lessonOf(UNITS[0], UNITS[0].lessons[0], 0);
  assert.deepEqual(buildLesson(l, "a"), buildLesson(l, "a"));
  assert.notDeepEqual(buildLesson(l, "a"), buildLesson(l, "b"));
});

test("montagem errada é recusada e notas por item", () => {
  const l = lessonOf(UNITS[0], UNITS[0].lessons[0], 0);
  const it = l.items.find((i) => tokens(i.en).length >= 3)!;
  assert.equal(checkTiles([...tokens(it.en)].reverse(), it), false);
  const r = itemRatings(l.items.slice(0, 3), [
    { itemId: l.items[0].id, ok: true, firstTry: true },
    { itemId: l.items[1].id, ok: false, firstTry: true }, { itemId: l.items[1].id, ok: true, firstTry: false },
    { itemId: l.items[2].id, ok: false, firstTry: true }, { itemId: l.items[2].id, ok: false, firstTry: false },
  ]);
  assert.deepEqual(r.map((x) => x.rating), [3, 2, 1]);
});
