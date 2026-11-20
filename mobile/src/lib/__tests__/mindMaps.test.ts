import { test } from "node:test";
import assert from "node:assert/strict";
import content from "../../content/content.json";
import { branchAngles, contentWords, dueInDays, matchRecalled, polar, type MindMap } from "../mindMaps";

const maps = (content as any).mind_maps as MindMap[];

test("reconstrução reconhece frases lembradas, mesmo com pequenas diferenças", () => {
  const b = maps.find((m) => m.id === "mm07")!.branches[0]; // bubbler / ope / you betcha
  const got = matchRecalled("where is the bubbler. you betcha", b.leaves);
  assert.ok(got.has("mm07-a-1") && got.has("mm07-a-3"));
  assert.ok(!got.has("mm07-a-2"));
  assert.equal(matchRecalled("", b.leaves).size, 0);
  const meet = maps[0].branches[3].leaves; // recap / owns / notes
  const r = matchRecalled("who owns the task? I will send notes after call", meet);
  assert.ok(r.has(meet[1].id) && r.has(meet[2].id) && !r.has(meet[0].id));
  assert.deepEqual(contentWords("Let's recap the action items."), ["let", "us", "recap", "action", "items"]);
});

test("revisão espaçada do mapa e geometria do desenho", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(dueInDays(0, null, now), null);
  assert.equal(dueInDays(1, "2026-11-19T12:00:00Z", now), 0); // 1 dia depois: hoje
  assert.equal(dueInDays(2, "2026-11-19T12:00:00Z", now), 2); // depois da 2ª sessão: 3 dias
  assert.equal(dueInDays(9, "2026-11-20T12:00:00Z", now), 30);
  assert.deepEqual(branchAngles(4), [-135, -45, 45, 135]);
  assert.deepEqual(polar(100, 100, 50, 0), [150, 100]);
});

test("todo mapa tem 4 ramos com frases únicas", () => {
  const ids = new Set<string>();
  for (const m of maps) {
    assert.equal(m.branches.length, 4);
    for (const l of m.branches.flatMap((b) => b.leaves)) {
      assert.ok(!ids.has(l.id));
      ids.add(l.id);
    }
  }
  assert.ok(ids.size >= 90);
});
