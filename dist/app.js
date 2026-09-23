(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const colors = ['#dcdfea', '#d6cbf9', '#ac95eb', '#8866d6', '#523198'];
  const canvas = $('crowd'), ctx = canvas.getContext('2d');
  let selected = 316, timer = null, toastTimer, cellLayout, simulation;
  let seed = newSeed();
  const presets = { classic: { p: 2, draws: 100, pity: 0 }, pity: { p: 2, draws: 100, pity: 50 }, rare: { p: 0.5, draws: 100, pity: 0 } };
  function newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  function configuration() { return { p: Number($('probability').value) / 100, draws: Number($('draws').value), pity: $('pity-toggle').checked ? Number($('pity-limit').value) : 0, seed }; }
  function setControls(c) {
    $('probability').value = c.p * 100; $('probability-number').value = +(c.p * 100).toFixed(1);
    $('draws').value = c.draws; $('pity-toggle').checked = c.pity > 0;
    if (c.pity) $('pity-limit').value = c.pity;
    refreshControls();
  }
  function refreshControls() {
    $('draws-value').textContent = $('draws').value; $('round-target').textContent = $('draws').value;
    $('pity-options').hidden = !$('pity-toggle').checked;
    const c = configuration();
    document.querySelectorAll('.preset').forEach((el) => {
      const preset = presets[el.dataset.preset];
      const active = Math.abs(preset.p / 100 - c.p) < 0.000001 && preset.draws === c.draws && preset.pity === c.pity;
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    });
    explanation(c);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function reset(announce) {
    stop(); simulation = LuckEngine.create(configuration());
    refreshControls(); render();
    if (announce) $('announcement').textContent = '参数已更新，可以开始新实验。';
  }
  function start() {
    if (timer) { stop(); render(); $('announcement').textContent = '实验已暂停。'; return; }
    if (simulation.summary().round === simulation.config.draws) { seed = newSeed(); reset(false); }
    timer = setInterval(() => {
      simulation.step(Math.max(1, Math.ceil(simulation.config.draws / 85)));
      if (simulation.summary().round === simulation.config.draws) { stop(); announceComplete(); }
      render();
    }, 45);
    render();
  }
  function finish() { stop(); simulation.step(simulation.config.draws); render(); announceComplete(); }
  function announceComplete() {
    const s = simulation.summary(); $('announcement').textContent = '实验完成。' + s.empty + ' 人一次未中，平均每人中奖 ' + s.average.toFixed(2) + ' 次。';
  }
  function render() {
    const s = simulation.summary(), c = simulation.config, began = s.round > 0, done = s.round === c.draws;
    $('round').textContent = s.round; $('progress').style.width = (s.round / c.draws * 100) + '%';
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow', String(Math.round(s.round / c.draws * 100)));
    $('run').innerHTML = timer ? '<span aria-hidden="true">Ⅱ</span> 暂停一下' : done ? '<span aria-hidden="true">↻</span> 换一批运气' : began ? '<span aria-hidden="true">▶</span> 继续实验' : '<span aria-hidden="true">▶</span> 开始实验';
    $('finish').disabled = done; $('share').disabled = !done; $('replay').disabled = !began;
    $('status').textContent = timer ? '每个人都在经历同样的概率…' : done ? '实验完成。每个方块，都有自己的结果。' : began ? '已暂停，点继续或直接看结果。' : '准备好了，试着让运气发生。';
    $('empty-count').textContent = began ? s.empty.toLocaleString('zh-CN') : '—';
    $('empty-percent').textContent = began ? '占全部参与者的 ' + (s.empty / 10).toFixed(1) + '%' : '等待实验开始';
    $('average').textContent = began ? s.average.toFixed(2) : '—'; $('best').textContent = began ? s.max : '—';
    $('best-note').textContent = began ? '次 · 比平均多 ' + (s.max - s.average).toFixed(2) + ' 次' : '次 · 看看运气能差多远';
    let insight = '平均每 ' + (1 / c.p).toFixed(c.p < .02 ? 0 : 1).replace(/\.0$/, '') + ' 抽中一次，意味着每个人都能如期中奖吗？';
    if (began && c.pity) insight = '同一批随机数下：无保底有 ' + s.baseEmpty + ' 人没中；开启 ' + c.pity + ' 抽保底后，还有 ' + s.empty + ' 人没中。';
    else if (began) insight = '理论上，' + s.round + ' 抽后约 ' + Math.round(s.theoreticalEmpty * 1000) + ' 人仍会一次未中。这次实验里，是 ' + s.empty + ' 人。';
    $('insight').querySelector('p').textContent = insight;
    drawCrowd(); renderPerson(); renderHistogram(s, began);
  }
  function drawCrowd() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = rect.width, height = rect.height;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const cols = width < 440 ? 40 : 50, rows = 1000 / cols, cw = width / cols, ch = height / rows, gap = width < 440 ? 2.3 : 3;
    cellLayout = { cols, cw, ch };
    for (let i = 0; i < 1000; i++) {
      const n = simulation.counts[i], x = i % cols * cw + gap / 2, y = Math.floor(i / cols) * ch + gap / 2;
      ctx.fillStyle = colors[n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n < 5 ? 3 : 4];
      ctx.beginPath(); ctx.roundRect(x, y, Math.max(1, cw - gap), Math.max(1, ch - gap), 1.8); ctx.fill();
      if (i === selected) { ctx.strokeStyle = '#29253c'; ctx.lineWidth = 1.6; ctx.stroke(); }
    }
    const s = simulation.summary();
    canvas.setAttribute('aria-label', '1000 位参与者，第 ' + s.round + ' 抽，' + s.empty + ' 人未中奖。当前选择第 ' + (selected + 1) + ' 人。用方向键切换。');
  }
  function renderPerson() {
    const s = simulation.summary(), n = simulation.counts[selected], wins = simulation.wins[selected];
    $('person-id').textContent = '#' + String(selected + 1).padStart(4, '0');
    $('person-headline').textContent = s.round ? n ? s.round + ' 抽，中了 ' + n + ' 次' : s.round + ' 抽，还在等待第一次中奖' : '故事还没开始';
    $('person-description').textContent = wins.length ? '第一次中奖在第 ' + wins[0] + ' 抽。最近连续 ' + simulation.misses[selected] + ' 抽未中。' : s.round ? '别人的好运，不会改变这个人的下一次概率。' : '点击上方任意方块，换一个视角。';
    const timeline = $('timeline');
    if (timeline.children.length !== simulation.config.draws) {
      timeline.replaceChildren(...Array.from({ length: simulation.config.draws }, (_, i) => { const node = document.createElement('i'); node.title = '第 ' + (i + 1) + ' 抽：尚未抽取'; return node; }));
    }
    const winSet = new Set(wins);
    [...timeline.children].forEach((node, i) => {
      const hit = winSet.has(i + 1); node.className = i >= s.round ? '' : hit ? 'hit' : 'miss';
      node.title = '第 ' + (i + 1) + ' 抽：' + (i >= s.round ? '尚未抽取' : hit ? '中奖' : '未中');
    });
    timeline.setAttribute('aria-label', '第 ' + (selected + 1) + ' 位参与者，已抽 ' + s.round + ' 次，中奖 ' + n + ' 次。' + (wins.length ? '中奖轮次：' + wins.join('、') : ''));
    $('pick-best').disabled = $('pick-worst').disabled = !s.round;
  }
  function renderHistogram(s, began) {
    const root = $('histogram');
    if (!root.children.length) for (let i = 0; i < 9; i++) {
      const col = document.createElement('div'); col.className = 'bar-column';
      col.innerHTML = '<span class="bar-value"></span><div class="bar"></div><span class="bar-label">' + (i === 8 ? '8+' : i) + '</span>'; root.append(col);
    }
    const max = Math.max(1, ...s.histogram);
    [...root.children].forEach((col, i) => {
      const n = began ? s.histogram[i] : 0;
      col.querySelector('.bar-value').textContent = n || '';
      col.querySelector('.bar').style.height = (began ? Math.max(2, n / max * 94) : 2) + 'px';
      col.title = '中奖 ' + i + (i === 8 ? ' 次及以上' : ' 次') + '：' + n + ' 人';
    });
    root.setAttribute('aria-label', began ? s.histogram.map((n, i) => '中奖 ' + i + (i === 8 ? ' 次及以上' : ' 次') + '，' + n + ' 人').join('；') : '等待实验：中奖次数的人数分布');
  }
  function explanation(c) {
    const percent = +(c.p * 100).toFixed(1), chance = Math.pow(1 - c.p, c.draws) * 100;
    if (c.pity) {
      $('explanation-text').textContent = '保底改变了规则：从开始或上次中奖起，连续 ' + (c.pity - 1) + ' 抽没中后，第 ' + c.pity + ' 抽必定中奖。每次中奖都会重新开始保底计数。';
      $('formula').textContent = '每人 ' + c.draws + ' 抽，至少中奖 ' + Math.floor(c.draws / c.pity) + ' 次（' + c.pity + ' 抽硬保底）';
      $('model-note').textContent = '本实验采用固定基础概率 + 硬保底。对照组使用相同随机数但不触发保底。它不包含概率递增、大小保底等真实游戏规则。';
    } else {
      $('explanation-text').textContent = '在没有保底的独立抽奖中，前面没中，不会让下一抽更容易中。' + percent + '% 的单次概率，抽 ' + c.draws + ' 次仍然一次没中的概率约为 ' + (chance < .01 ? chance.toExponential(2) : chance.toFixed(2)) + '%。';
      $('formula').textContent = '全程一次没中的概率 = (1 − ' + percent + '%)^' + c.draws + ' ≈ ' + (chance < .01 ? chance.toExponential(2) : chance.toFixed(2)) + '%';
      $('model-note').textContent = '这是简化的随机模型。每次实验的人数分布会波动，模拟结果不等于理论值，也不预测真实游戏的掉落。';
    }
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
  function loadHash() {
    if (!location.hash.startsWith('#lab=')) return false;
    try {
      const parts = location.hash.slice(5).split(',');
      if (parts.length !== 5 || parts[0] !== '1') throw new Error('未知版本');
      const c = LuckEngine.validate({ p: Number(parts[1]) / 1000, draws: Number(parts[2]), pity: Number(parts[3]), seed: Number(parts[4]) });
      if (c.draws % 10 || ![0, 20, 50, 100].includes(c.pity) || !/^\d+$/.test(parts[1])) throw new Error('参数不受支持');
      seed = c.seed; setControls(c); reset(false); finish(); toast('已还原这次实验：规则和随机结果都相同。'); return true;
    } catch (_) { seed = newSeed(); setControls({ p: .02, draws: 100, pity: 0 }); reset(false); toast('实验链接参数无效，已使用默认设置。'); return false; }
  }
  async function share() {
    const c = simulation.config;
    if (location.protocol === 'file:') { toast('本地文件可以试玩；发布为网站后即可分享链接。'); return; }
    const hash = '#lab=1,' + Math.round(c.p * 1000) + ',' + c.draws + ',' + c.pity + ',' + c.seed;
    const url = location.href.split('#')[0] + hash;
    try { await navigator.clipboard.writeText(url); toast(location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? '已复制本机试玩链接。GitHub 发布后即可给朋友访问。' : '链接已复制，朋友会看到完全相同的实验。'); }
    catch (_) { $('share-fallback').hidden = false; $('share-url').value = url; $('share-url').focus(); $('share-url').select(); }
  }
  $('run').addEventListener('click', start); $('finish').addEventListener('click', finish);
  $('replay').addEventListener('click', () => { reset(false); start(); });
  $('probability').addEventListener('input', () => { $('probability-number').value = $('probability').value; reset(true); });
  $('probability-number').addEventListener('input', () => {
    const raw = Number($('probability-number').value);
    if (Number.isFinite(raw) && raw >= .1 && raw <= 20) { $('probability').value = Math.round(raw * 10) / 10; reset(true); }
  });
  $('probability-number').addEventListener('blur', () => {
    const raw = Number($('probability-number').value);
    if (!Number.isFinite(raw) || raw < .1 || raw > 20) { $('probability-number').value = $('probability').value; toast('请输入 0.1 到 20 之间的概率。'); return; }
    const value = Math.round(raw * 10) / 10; $('probability').value = value; $('probability-number').value = value; reset(true);
  });
  $('draws').addEventListener('input', () => reset(true)); $('pity-toggle').addEventListener('change', () => reset(true)); $('pity-limit').addEventListener('change', () => reset(true));
  document.querySelectorAll('.preset').forEach((el) => el.addEventListener('click', () => { const c = presets[el.dataset.preset]; setControls({ p: c.p / 100, draws: c.draws, pity: c.pity }); reset(true); }));
  canvas.addEventListener('click', (event) => { if (!cellLayout) return; const r = canvas.getBoundingClientRect(); selected = Math.max(0, Math.min(999, Math.floor((event.clientY - r.top) / cellLayout.ch) * cellLayout.cols + Math.floor((event.clientX - r.left) / cellLayout.cw))); drawCrowd(); renderPerson(); });
  canvas.addEventListener('keydown', (event) => { const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cellLayout.cols, ArrowDown: cellLayout.cols }; if (event.key in offsets) { event.preventDefault(); selected = Math.max(0, Math.min(999, selected + offsets[event.key])); drawCrowd(); renderPerson(); } });
  $('pick-best').addEventListener('click', () => { selected = simulation.summary().luckiest; drawCrowd(); renderPerson(); });
  $('pick-worst').addEventListener('click', () => { selected = simulation.summary().unluckiest; drawCrowd(); renderPerson(); });
  $('share').addEventListener('click', share); $('close-share').addEventListener('click', () => { $('share-fallback').hidden = true; $('share').focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('share-fallback').hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { stop(); render(); } });
  window.addEventListener('resize', drawCrowd);
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#lab=')) loadHash(); });
  reset(false); loadHash();
  // Optional browser integration; all actions use the same simulation as the visible controls.
  const context = document.modelContext;
  if (context && context.registerTool) {
    const lifecycle = new AbortController();
    const tool = { name: 'read_luck_experiment', title: '读取概率实验', description: '读取当前可见实验的规则、进度和统计结果。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) { if (!input || Object.keys(input).length) throw new Error('此工具不接受参数'); return { config: simulation.config, ...simulation.summary() }; } };
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) { /* Standard browsers work without WebMCP. */ }
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
