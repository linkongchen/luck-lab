(function (root) {
  'use strict';
  function validate(input) {
    const p = Number(input.p), draws = Number(input.draws), pity = Number(input.pity), seed = Number(input.seed);
    if (!Number.isFinite(p) || p < 0.001 || p > 0.2) throw new Error('中奖率须在 0.1%–20% 之间');
    if (!Number.isInteger(draws) || draws < 10 || draws > 300) throw new Error('抽取次数须在 10–300 之间');
    if (!Number.isInteger(pity) || (pity !== 0 && (pity < 10 || pity > 100))) throw new Error('保底须为 0 或 10–100');
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('无效实验编号');
    return { p, draws, pity, seed };
  }
  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function create(input) {
    const config = validate(input), rng = random(config.seed), size = 1000;
    const counts = new Uint16Array(size), baseline = new Uint16Array(size), misses = new Uint16Array(size);
    const wins = Array.from({ length: size }, () => []);
    let round = 0;
    function step(amount) {
      const until = Math.min(config.draws, round + Math.max(0, Math.floor(amount)));
      while (round < until) {
        round++;
        for (let i = 0; i < size; i++) {
          const natural = rng() < config.p;
          if (natural) baseline[i]++;
          const guaranteed = config.pity > 0 && misses[i] + 1 >= config.pity;
          if (natural || guaranteed) { counts[i]++; misses[i] = 0; wins[i].push(round); }
          else misses[i]++;
        }
      }
      return summary();
    }
    function summary() {
      let total = 0, empty = 0, baseEmpty = 0, max = 0, luckiest = 0, unluckiest = 0;
      const histogram = new Array(9).fill(0);
      for (let i = 0; i < size; i++) {
        total += counts[i];
        if (!counts[i]) empty++;
        if (!baseline[i]) baseEmpty++;
        if (counts[i] > max) { max = counts[i]; luckiest = i; }
        if (counts[i] < counts[unluckiest]) unluckiest = i;
        histogram[Math.min(8, counts[i])]++;
      }
      return { round, total, empty, baseEmpty, max, luckiest, unluckiest, average: total / size, histogram,
        theoreticalEmpty: config.pity && round >= config.pity ? 0 : Math.pow(1 - config.p, round) };
    }
    return { config, counts, baseline, misses, wins, size, step, summary };
  }
  const api = { validate, random, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LuckEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
