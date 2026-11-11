/**
 * Gera as animações Lottie do app (formato Bodymovin/After Effects) em src/assets/lottie/.
 * Para trocar por animações feitas no After Effects: exporte com o plugin Bodymovin (JSON) e substitua o arquivo de mesmo nome.
 * Uso: node scripts/make-lottie.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "lottie");
mkdirSync(OUT, { recursive: true });

const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, a];
const st = (k) => ({ a: 0, k });
const EASE_OUT = { i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } };
const EASE_IO = { i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } };
/** Propriedade animada: frames = [[t, valor], ...] */
const anim = (frames, ease = EASE_OUT) => ({
  a: 1,
  k: frames.map(([t, s], i) => {
    const v = Array.isArray(s) ? s : [s];
    const kf = { t, s: v };
    if (i < frames.length - 1) {
      const n = v.length;
      kf.i = { x: Array(n).fill(ease.i.x[0]), y: Array(n).fill(ease.i.y[0]) };
      kf.o = { x: Array(n).fill(ease.o.x[0]), y: Array(n).fill(ease.o.y[0]) };
    }
    return kf;
  }),
});
const animPos = (frames, ease = EASE_OUT) => ({
  a: 1,
  k: frames.map(([t, s], i) => ({ t, s, ...(i < frames.length - 1 ? { i: { x: ease.i.x[0], y: ease.i.y[0] }, o: { x: ease.o.x[0], y: ease.o.y[0] }, to: [0, 0, 0], ti: [0, 0, 0] } : {}) })),
});
const tr = () => ({ ty: "tr", p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0), nm: "t" });
const group = (items, nm = "g") => ({ ty: "gr", nm, it: [...items, tr()] });
const ellipse = (w, h = w) => ({ ty: "el", d: 1, s: st([w, h]), p: st([0, 0]), nm: "e" });
const rect = (w, h, r = 0) => ({ ty: "rc", d: 1, s: st([w, h]), p: st([0, 0]), r: st(r), nm: "r" });
const star = (pts, ir, or) => ({ ty: "sr", sy: 1, d: 1, pt: st(pts), p: st([0, 0]), r: st(0), ir: st(ir), is: st(0), or: st(or), os: st(0), nm: "s" });
const path = (v, closed = false, inT, outT) => ({ ty: "sh", nm: "p", ks: st({ i: inT ?? v.map(() => [0, 0]), o: outT ?? v.map(() => [0, 0]), v, c: closed }) });
const fill = (color, o = 100) => ({ ty: "fl", c: st(hex(color)), o: st(o), r: 1, nm: "f" });
const stroke = (color, w, o = 100) => ({ ty: "st", c: st(hex(color)), o: st(o), w: st(w), lc: 2, lj: 2, ml: 4, nm: "st" });
const trim = (end) => ({ ty: "tm", s: st(0), e: end, o: st(0), m: 1, nm: "tm" });

let ind = 1;
function layer(nm, shapes, ks = {}, ip = 0, op = 120) {
  return {
    ddd: 0, ind: ind++, ty: 4, nm, sr: 1, ao: 0, ip, op, st: 0, bm: 0, shapes,
    ks: { o: ks.o ?? st(100), r: ks.r ?? st(0), p: ks.p ?? st([0, 0, 0]), a: ks.a ?? st([0, 0, 0]), s: ks.s ?? st([100, 100, 100]) },
  };
}
function comp(nm, w, h, op, layers, fr = 60) {
  ind = 1;
  return { v: "5.9.0", fr, ip: 0, op, w, h, nm, ddd: 0, assets: [], layers: layers.reverse() };
}
function save(name, data) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data));
  console.log(`lottie: ${name}.json (${data.layers.length} camadas)`);
}

// 1) Sucesso: círculo com "pop" + check desenhado (trim path) + anel expandindo
save("success", comp("success", 200, 200, 70, [
  layer("ring", [group([ellipse(120), stroke("#2BD47D", 6)])], {
    p: st([100, 100, 0]), s: anim([[8, [80, 80, 100]], [40, [150, 150, 100]]]), o: anim([[8, 80], [40, 0]]),
  }),
  layer("circle", [group([ellipse(120), fill("#22C55E")])], {
    p: st([100, 100, 0]), s: anim([[0, [0, 0, 100]], [14, [112, 112, 100]], [22, [100, 100, 100]]], EASE_IO),
  }),
  layer("check", [group([path([[-28, 2], [-8, 22], [30, -18]]), stroke("#FFFFFF", 12), trim(anim([[16, 0], [36, 100]]))])], { p: st([100, 100, 0]) }),
]));

// 2) Confete: 28 partículas em explosão com rotação e queda
const COLORS = ["#6C5CE7", "#FF6A3D", "#FF2E7E", "#00B8A9", "#F59F00", "#22C55E", "#3DD6F5"];
const particles = [];
for (let i = 0; i < 28; i++) {
  const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.2;
  const dist = 90 + (i % 5) * 22;
  const x = 200 + Math.cos(ang) * dist;
  const y = 170 + Math.sin(ang) * dist * 0.75;
  const shape = i % 3 === 0 ? ellipse(10) : rect(8 + (i % 2) * 6, 14, 2);
  particles.push(layer(`p${i}`, [group([shape, fill(COLORS[i % COLORS.length])])], {
    p: animPos([[0, [200, 190, 0]], [26, [x, y, 0]], [90, [x + (i % 2 ? 18 : -18), y + 140, 0]]]),
    r: anim([[0, 0], [90, (i % 2 ? 1 : -1) * (240 + i * 7)]], EASE_IO),
    s: anim([[0, [0, 0, 100]], [10, [100, 100, 100]]]),
    o: anim([[0, 100], [60, 100], [90, 0]], EASE_IO),
  }, 0, 90));
}
save("confetti", comp("confetti", 400, 400, 90, particles));

// 3) Chama (sequência de estudo): duas camadas que tremulam em loop
const flameV = [[0, -46], [24, -6], [18, 28], [0, 38], [-18, 28], [-24, -6]];
const flameI = [[0, 0], [-6, -18], [10, -10], [12, 0], [0, 10], [-10, 10]];
const flameO = [[0, 0], [10, 14], [-10, 10], [-12, 0], [0, -10], [6, -18]];
save("flame", comp("flame", 120, 120, 60, [
  layer("outer", [group([path(flameV, true, flameI, flameO), fill("#FF6A3D")])], {
    p: st([60, 96, 0]), a: st([0, 30, 0]), s: anim([[0, [100, 100, 100]], [15, [94, 108, 100]], [30, [104, 96, 100]], [45, [96, 106, 100]], [60, [100, 100, 100]]], EASE_IO),
    r: anim([[0, -3], [30, 3], [60, -3]], EASE_IO),
  }),
  layer("inner", [group([path(flameV.map(([x, y]) => [x * 0.55, y * 0.55 + 12]), true, flameI.map(([x, y]) => [x * 0.55, y * 0.55]), flameO.map(([x, y]) => [x * 0.55, y * 0.55])), fill("#FFD43B")])], {
    p: st([60, 100, 0]), a: st([0, 30, 0]), s: anim([[0, [100, 100, 100]], [20, [90, 112, 100]], [40, [106, 94, 100]], [60, [100, 100, 100]]], EASE_IO),
  }),
]));

// 4) Conversa: dois balões que flutuam + pontos de digitação
const dots = [0, 1, 2].map((i) => layer(`dot${i}`, [group([ellipse(12), fill("#FFFFFF")])], {
  p: st([86 + i * 20, 104, 0]), s: anim([[i * 8, [70, 70, 100]], [i * 8 + 12, [120, 120, 100]], [i * 8 + 24, [70, 70, 100]], [90, [70, 70, 100]]], EASE_IO),
}, 0, 90));
save("talk", comp("talk", 240, 200, 90, [
  layer("bubble-b", [group([rect(110, 70, 26), fill("#00B8A9")]), group([path([[-10, 30], [-30, 52], [10, 32]], true), fill("#00B8A9")])], {
    p: anim([[0, [158, 132, 0]], [45, [158, 124, 0]], [90, [158, 132, 0]]], EASE_IO),
  }, 0, 90),
  layer("bubble-a", [group([rect(130, 80, 30), fill("#6C5CE7")]), group([path([[20, 34], [44, 58], [0, 38]], true), fill("#6C5CE7")])], {
    p: anim([[0, [106, 104, 0]], [45, [106, 112, 0]], [90, [106, 104, 0]]], EASE_IO),
  }, 0, 90),
  ...dots,
]));

// 5) Globo + avião orbitando (viagem / Índia)
save("globe", comp("globe", 220, 220, 120, [
  // em Lottie, o primeiro grupo da lista fica por cima
  layer("globe", [group([ellipse(110), stroke("#FFFFFF", 3, 60)]),
                  group([path([[-40, -20], [-10, -34], [8, -16], [-6, 4], [-30, 6]], true), fill("#22C55E")]),
                  group([path([[10, 12], [36, 0], [44, 22], [22, 38], [8, 30]], true), fill("#22C55E")]),
                  group([ellipse(110), fill("#3DD6F5")])], {
    p: st([110, 110, 0]), s: anim([[0, [100, 100, 100]], [60, [104, 104, 100]], [120, [100, 100, 100]]], EASE_IO),
  }),
  layer("orbit", [group([ellipse(170, 170), stroke("#FFFFFF", 2, 35)])], { p: st([110, 110, 0]) }),
  layer("plane", [group([path([[0, -14], [5, -2], [16, 4], [16, 8], [4, 4], [3, 12], [7, 16], [7, 18], [0, 16], [-7, 18], [-7, 16], [-3, 12], [-4, 4], [-16, 8], [-16, 4], [-5, -2]], true), fill("#FF6A3D")])], {
    a: st([0, 85, 0]), p: st([110, 110, 0]), r: anim([[0, 0], [120, 360]], { i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } }),
  }),
]));

// 6) Conquista: estrela com raios
const rays = Array.from({ length: 12 }, (_, i) => layer(`ray${i}`, [group([rect(6, 26, 3), fill(i % 2 ? "#F59F00" : "#FF6A3D")])], {
  p: st([120, 120, 0]), r: st(i * 30), a: st([0, 78, 0]), s: anim([[6, [0, 0, 100]], [24, [100, 100, 100]], [50, [0, 0, 100]]]),
}, 0, 80));
save("trophy", comp("trophy", 240, 240, 80, [
  ...rays,
  layer("star", [group([star(5, 26, 58), fill("#FFD43B")]), group([star(5, 26, 58), stroke("#F59F00", 5)])], {
    p: st([120, 120, 0]), s: anim([[0, [0, 0, 100]], [18, [118, 118, 100]], [28, [100, 100, 100]]], EASE_IO), r: anim([[0, -40], [28, 0]]),
  }, 0, 80),
]));
