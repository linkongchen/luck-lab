const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../dist/engine.js');
const base = { p: .02, draws: 100, pity: 0, seed: 20260923 };

test('same seed produces identical results regardless of animation batches', () => {
  const a = engine.create(base), b = engine.create(base);
  a.step(100); for (let n = 0; n < 50; n++) b.step(2);
  assert.deepEqual(a.counts, b.counts); assert.deepEqual(a.wins, b.wins);
  assert.deepEqual(a.summary(), b.summary());
});
test('hard pity prevents more than H−1 misses, resets after every win, and preserves the baseline stream', () => {
  for (const limit of [20, 50, 100]) {
    const plain = engine.create({ ...base, draws: 300 });
    const protectedRun = engine.create({ ...base, draws: 300, pity: limit });
    plain.step(300); protectedRun.step(300);
    assert.deepEqual(plain.counts, protectedRun.baseline);
    assert.equal(protectedRun.summary().empty, 0);
    assert.equal(protectedRun.summary().theoreticalEmpty, 0);
    for (let i = 0; i < 1000; i++) {
      const rounds = protectedRun.wins[i];
      assert.ok(rounds.length >= Math.floor(300 / limit));
      let previous = 0;
      for (const round of rounds) { assert.ok(round - previous <= limit); previous = round; }
      assert.ok(300 - previous < limit);
      assert.ok(protectedRun.counts[i] >= plain.counts[i]);
    }
  }
});
test('pity triggers on exactly the guaranteed draw and not one draw earlier', () => {
  const experiment = engine.create({ ...base, p: .001, pity: 50 });
  experiment.step(49);
  assert.ok(experiment.summary().empty > 0);
  assert.ok(experiment.summary().theoreticalEmpty > 0);
  experiment.step(1);
  assert.equal(experiment.summary().empty, 0);
});
test('histogram, person histories, total wins, and empty count agree', () => {
  const experiment = engine.create({ ...base, p: .2, draws: 300 });
  experiment.step(999);
  const result = experiment.summary();
  assert.equal(result.round, 300);
  assert.equal(result.histogram.reduce((a, b) => a + b), 1000);
  assert.equal(result.histogram[0], result.empty);
  assert.equal(experiment.wins.reduce((total, rounds) => total + rounds.length, 0), result.total);
  assert.ok(result.histogram[8] > 0);
  experiment.step(1); assert.deepEqual(experiment.summary(), result);
});
test('independent-draw analytical probability and aggregate simulation agree within sampling error', () => {
  let empty = 0, wins = 0;
  for (let seed = 0; seed < 30; seed++) {
    const experiment = engine.create({ ...base, seed }); experiment.step(100);
    const result = experiment.summary(); empty += result.empty; wins += result.total;
    assert.ok(Math.abs(result.theoreticalEmpty - .132619555894753) < 1e-12);
  }
  assert.ok(Math.abs(empty / 30000 - Math.pow(.98, 100)) < .01);
  assert.ok(Math.abs(wins / 30000 - 2) < .05);
});
test('unsafe or unsupported input is rejected; uint32 seed boundaries remain reproducible', () => {
  for (const changed of [{ p: NaN }, { p: 0 }, { p: .21 }, { draws: 9 }, { draws: 301 }, { draws: 2.5 }, { pity: -1 }, { pity: 101 }, { seed: -1 }, { seed: 4294967296 }]) assert.throws(() => engine.create({ ...base, ...changed }));
  for (const seed of [0, 4294967295]) { const a = engine.create({ ...base, seed }), b = engine.create({ ...base, seed }); a.step(100); b.step(100); assert.deepEqual(a.counts, b.counts); }
});
