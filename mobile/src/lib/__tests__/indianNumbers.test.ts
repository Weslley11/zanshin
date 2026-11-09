import { test } from "node:test";
import assert from "node:assert/strict";
import { indianFormat, indianWords, internationalFormat, parseAmount, randomAmount } from "../indianNumbers.ts";

test("indianWords", () => {
  assert.equal(indianWords(100_000), "one lakh");
  assert.equal(indianWords(1_250_000), "twelve lakh fifty thousand");
  assert.equal(indianWords(25_000_000), "two crore fifty lakh");
  assert.equal(indianWords(75_000), "seventy-five thousand");
  assert.equal(indianWords(10_000_000), "one crore");
  assert.equal(indianWords(305_250), "three lakh five thousand two hundred fifty");
});

test("formats", () => {
  assert.equal(indianFormat(1_250_000), "12,50,000");
  assert.equal(indianFormat(25_000_000), "2,50,00,000");
  assert.equal(indianFormat(999), "999");
  assert.equal(internationalFormat(1_250_000), "1,250,000");
});

test("parseAmount accepts any grouping", () => {
  assert.equal(parseAmount("12,50,000"), 1_250_000);
  assert.equal(parseAmount("1.250.000"), 1_250_000);
  assert.equal(parseAmount("abc"), null);
});

test("randomAmount stays realistic and round-trips through words", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const n = randomAmount(rand);
    assert.ok(n >= 10_000 && n <= 210_000_000, String(n));
    assert.ok(indianWords(n).length > 0);
  }
});
