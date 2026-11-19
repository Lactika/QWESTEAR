/*
 * Движок QWESTEAR: сцена на canvas, интерфейс, прогресс, Telegram WebApp.
 * Логика уровней — в logic.js, данные — в levels.js.
 */
(function () {
  'use strict';

  const Q = window.QLogic;
  const LEVELS = window.QLEVELS;
  const W = 960;
  const H = 540;
  const GROUND = 410;
  const SAVE_KEY = 'qwestear:v1';
  const IDLE_HINT_MS = 60000;

  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#scene');
  const ctx = canvas.getContext('2d');

  // ---------- Telegram WebApp ----------
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    try { tg.ready(); tg.expand(); } catch (e) { /* вне Telegram — игнорируем */ }
  }

  // ---------- Прогресс ----------
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (p && Array.isArray(p.done)) return p;
    } catch (e) { /* нет localStorage — играем без сохранения */ }
    return { done: [] };
  }
  function saveProgress(p) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }
  let progress = loadProgress();
  function firstOpenId() {
    const lv = LEVELS.find((l) => !progress.done.includes(l.id));
    return lv ? lv.id : LEVELS.length;
  }

  // ---------- Звук (короткие тона, без файлов) ----------
  let audio = null;
  function tone(freq, dur, type, vol) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol || 0.08;
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch (e) { /* звук недоступен */ }
  }
  function sfx(kind) {
    if (kind === 'ok') { tone(660, 0.12); setTimeout(() => tone(990, 0.16), 90); }
    else if (kind === 'fail') { tone(180, 0.22, 'sawtooth', 0.05); }
    else if (kind === 'click') { tone(440, 0.05, 'triangle', 0.05); }
    else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25), i * 120)); }
  }

  // ---------- Состояние игры ----------
  let game = null;
  let particles = [];
  let shake = 0;
  let flash = 0;
  let hoverHs = null;

  function palette(name) {
    const P = {
      dusk: { top: '#f7b267', mid: '#f4845f', low: '#5b3a5e', ground: '#3d2b3a', sun: '#ffe3a3' },
      night: { top: '#0b1d3a', mid: '#14213d', low: '#27304f', ground: '#0d1424', sun: '#ffd166' },
      river: { top: '#9ad1d4', mid: '#5fa8a8', low: '#2d6a6f', ground: '#1f4e52', sun: '#fff7d6' },
      forest: { top: '#c7e9b0', mid: '#6aa84f', low: '#2f4f2f', ground: '#1e3a1e', sun: '#fff3b0' },
      cave: { top: '#2b2238', mid: '#1a1526', low: '#0c0a12', ground: '#171220', sun: '#ffcf8a' },
      ruins: { top: '#e9d8a6', mid: '#c9a66b', low: '#7a5c3a', ground: '#4e3a25', sun: '#fff1c1' },
      dawn: { top: '#ffd6a5', mid: '#ffadad', low: '#caffbf', ground: '#6b4f6b', sun: '#fff7d1' },
    };
    return P[name] || P.dusk;
  }

  const MECH_PALETTE = { items: 'dusk', lights: 'night', levers: 'river', code: 'forest', lamp: 'cave', mixed: 'ruins' };

  function itemLabel(item) {
    const lv = game && game.level;
    const h = lv && lv.hotspots.find((x) => x.kind === 'pickup' && x.item === item);
    return h ? h.label : item;
  }

  function startLevel(id) {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) return;
    game = {
      level,
      s: Q.initState(level),
      bear: { x: 60, tx: 60, dir: 1, busy: false, pending: null, moving: false },
      lastAction: performance.now(),
      hintOpen: false,
      hintAuto: false,
      keypadId: null,
      winShown: false,
    };
    particles = [];
    shake = 0;
    flash = 0;
    $('#lvl-title').textContent = `${level.id}. ${level.title}`;
    $('#hint').textContent = level.hint;
    $('#hint').classList.remove('show');
    $('#hint-btn').disabled = false;
    showScreen('game');
    setMsg(level.intro, '');
    renderInventory();
    closeKeypad();
    $('#win-modal').classList.remove('show');
  }

  function setMsg(text, cls) {
    const el = $('#msg');
    el.textContent = text || '';
    el.className = cls || '';
  }

  function renderInventory() {
    const box = $('#inv');
    box.innerHTML = '';
    if (!game || !game.s.inv.length) {
      const c = document.createElement('span');
      c.className = 'chip empty';
      c.textContent = 'Пусто';
      box.appendChild(c);
      return;
    }
    for (const item of game.s.inv) {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = itemLabel(item);
      box.appendChild(c);
    }
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === name));
  }

  // ---------- Меню ----------
  function renderMenu() {
    const grid = $('#levels');
    grid.innerHTML = '';
    const open = firstOpenId();
    for (const lv of LEVELS) {
      const b = document.createElement('button');
      b.textContent = lv.id;
      b.title = lv.title;
      const done = progress.done.includes(lv.id);
      const locked = lv.id > open;
      if (done) b.classList.add('done');
      if (locked) { b.classList.add('locked'); b.disabled = true; }
      b.addEventListener('click', () => startLevel(lv.id));
      grid.appendChild(b);
    }
    $('#progress-text').textContent = `Пройдено ${progress.done.length} из ${LEVELS.length}`;
  }

  // ---------- Действия ----------
  function markAction() {
    game.lastAction = performance.now();
  }

  // Бедный, но понятный «сок»: частицы и тряска
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.6 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 });
    }
  }

  function standX(hs) {
    const left = hs.x - 70;
    const right = hs.x + 70;
    const target = game.bear.x <= hs.x ? left : right;
    return Math.max(40, Math.min(W - 40, target));
  }

  function requestStep(hs) {
    const b = game.bear;
    if (b.busy || game.s.complete) return;
    b.busy = true;
    b.tx = standX(hs);
    b.pending = { hs, step: hs.id };
  }

  function arrived() {
    const b = game.bear;
    const p = b.pending;
    b.pending = null;
    b.busy = false;
    if (p) applyStep(p.hs);
  }

  function applyStep(hs) {
    const before = game.s;
    const r = Q.act(game.level, game.s, hs.id);
    game.s = r.state;
    markAction();
    if (r.reason === 'need-code') {
      openKeypad(hs.id);
      setMsg(r.state.msg, '');
      renderInventory();
      return;
    }
    afterAction(r.ok, hs, before);
  }

  function afterAction(ok, hs, before) {
    if (ok) {
      sfx('click');
      const color = hs.kind === 'door' || hs.kind === 'keypad' ? '#ffe9a8' : '#ffcf8a';
      burst(hs.x, GROUND - 90, color, 14);
      if (hs.kind === 'door' && before.states[hs.id] !== 'open' && game.s.states[hs.id] === 'open') flash = 0.6;
      if (game.s.inv.length > before.inv.length) sfx('ok');
    } else {
      sfx('fail');
      shake = 0.35;
    }
    const cls = ok ? 'good' : (game.s.complete ? 'good' : 'bad');
    setMsg(game.s.msg, cls);
    renderInventory();
    if (game.s.complete) onWin();
  }

  function onWin() {
    if (game.winShown) return;
    game.winShown = true;
    sfx('win');
    burst(W - 60, GROUND - 100, '#ffe9a8', 40);
    if (!progress.done.includes(game.level.id)) {
      progress.done.push(game.level.id);
      saveProgress(progress);
    }
    game.bear.tx = W + 120;
    game.bear.busy = true;
    setTimeout(showWin, 1600);
  }

  function showWin() {
    const lv = game.level;
    const isLast = lv.id === LEVELS.length;
    $('#win-title').textContent = isLast ? 'Первая часть пройдена!' : `Уровень ${lv.id} пройден`;
    $('#win-text').textContent = game.s.msg;
    $('#win-next').textContent = isLast ? 'К меню' : 'Дальше';
    $('#win-next').disabled = false;
    $('#win-modal').classList.add('show');
  }

  // ---------- Цифровая панель ----------
  let typed = '';
  function openKeypad(id) {
    const lv = game.level;
    const h = Q.findHotspot(lv, id);
    game.keypadId = id;
    typed = '';
    $('#keypad-title').textContent = h.label;
    $('#keypad-ask').textContent = h.askMsg || 'Введите код.';
    const pad = $('#keypad-pad');
    pad.innerHTML = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
    for (const k of keys) {
      const b = document.createElement('button');
      b.textContent = k;
      b.addEventListener('click', () => padPress(k));
      pad.appendChild(b);
    }
    renderTyped();
    $('#keypad-modal').classList.add('show');
    sfx('click');
  }

  function renderTyped() {
    $('#keypad-screen').textContent = typed || '----';
  }

  function padPress(k) {
    if (k === 'C') { typed = ''; renderTyped(); return; }
    if (k === 'OK') { submitCode(); return; }
    if (typed.length < 6) { typed += k; renderTyped(); sfx('click'); }
  }

  function submitCode() {
    const id = game.keypadId;
    const hs = Q.findHotspot(game.level, id);
    const before = game.s;
    const r = Q.act(game.level, game.s, { id, code: typed });
    game.s = r.state;
    markAction();
    if (r.ok) {
      closeKeypad();
      afterAction(true, hs, before);
    } else {
      const card = $('#keypad-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      sfx('fail');
      typed = '';
      renderTyped();
      setMsg(r.state.msg, 'bad');
    }
  }

  function closeKeypad() {
    $('#keypad-modal').classList.remove('show');
    typed = '';
    if (game) game.keypadId = null;
  }

  $('#keypad-cancel').addEventListener('click', closeKeypad);
  $('#keypad-modal').addEventListener('click', (e) => { if (e.target.id === 'keypad-modal') closeKeypad(); });

  // ---------- Ввод на сцене ----------
  // Перевод координат курсора в координаты сцены с учётом полей (object-fit: contain)
  function toLogical(evt) {
    const rect = canvas.getBoundingClientRect();
    const k = Math.min(rect.width / W, rect.height / H);
    const ox = (rect.width - W * k) / 2;
    const oy = (rect.height - H * k) / 2;
    return {
      x: (evt.clientX - rect.left - ox) / k,
      y: (evt.clientY - rect.top - oy) / k,
    };
  }

  function hitHotspot(px, py) {
    if (!game) return null;
    let best = null;
    let bestD = Infinity;
    for (const hs of game.level.hotspots) {
      if (hs.kind === 'decor' || !Q.isVisible(hs, game.s)) continue;
      const cy = hs.kind === 'clue' ? GROUND - 150 : (hs.kind === 'pickup' ? GROUND - 70 : GROUND - 90);
      const dx = Math.abs(px - hs.x);
      const dy = Math.abs(py - cy);
      if (dx <= 58 && dy <= 90) {
        const d = dx + dy * 0.2;
        if (d < bestD) { bestD = d; best = hs; }
      }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!game || $('#keypad-modal').classList.contains('show') || $('#win-modal').classList.contains('show')) return;
    const p = toLogical(e);
    const hs = hitHotspot(p.x, p.y);
    if (hs) {
      requestStep(hs);
    } else if (!game.bear.busy) {
      game.bear.tx = Math.max(40, Math.min(W - 40, p.x));
    }
    markAction();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!game) return;
    const p = toLogical(e);
    hoverHs = hitHotspot(p.x, p.y);
    canvas.style.cursor = hoverHs ? 'pointer' : 'default';
  });

  // ---------- Рисование ----------
  function drawBackground(level, t) {
    const pal = palette(MECH_PALETTE[level.mech]);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.6, pal.mid);
    g.addColorStop(1, pal.low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Небесное тело
    ctx.fillStyle = pal.sun;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(780, 120, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Звёзды для ночных уровней
    if (level.mech === 'lights' || level.mech === 'lamp' || level.mech === 'mixed') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % W;
        const y = (i * 53) % 260;
        const a = 0.4 + 0.5 * Math.sin(t * 2 + i);
        ctx.globalAlpha = a;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Силуэты деревьев / камней
    ctx.fillStyle = pal.low;
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 110;
      ctx.beginPath();
      ctx.moveTo(x - 50, GROUND);
      ctx.lineTo(x, GROUND - 130 - (i % 3) * 25);
      ctx.lineTo(x + 50, GROUND);
      ctx.fill();
    }

    // Земля
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, GROUND, W, 3);

    // Лёгкая виньетка
    const vg = ctx.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawDoor(x, open) {
    const w = 96;
    const top = GROUND - 190;
    ctx.fillStyle = '#4a2f1d';
    ctx.fillRect(x - w / 2 - 8, top - 8, w + 16, 198);
    if (open) {
      const g = ctx.createRadialGradient(x, GROUND - 80, 10, x, GROUND - 80, 140);
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(1, '#1b1020');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, top, w, 190);
    } else {
      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(x - w / 2, top, w, 190);
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 4;
      ctx.strokeRect(x - w / 2 + 10, top + 14, w - 20, 70);
      ctx.strokeRect(x - w / 2 + 10, top + 100, w - 20, 76);
      ctx.fillStyle = '#ffcf8a';
      ctx.beginPath();
      ctx.arc(x + w / 2 - 14, GROUND - 90, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawKeypad(x, open) {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(x - 40, GROUND - 150, 80, 120);
    ctx.fillStyle = open ? '#7CFC7C' : '#ff6b6b';
    ctx.fillRect(x - 28, GROUND - 138, 56, 22);
    ctx.fillStyle = '#555';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.arc(x - 20 + c * 20, GROUND - 98 + r * 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickup(x, item, t) {
    const y = GROUND - 70 + Math.sin(t * 2 + x) * 4;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 36);
    glow.addColorStop(0, 'rgba(255,230,160,0.55)');
    glow.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 40, y - 40, 80, 80);
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffe9a8';
    ctx.fillStyle = '#c9b38a';
    ctx.lineWidth = 4;
    switch (item) {
      case 'key':
        ctx.beginPath(); ctx.arc(-10, 0, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(18, 0); ctx.moveTo(12, 0); ctx.lineTo(12, 8); ctx.moveTo(18, 0); ctx.lineTo(18, 6); ctx.stroke();
        break;
      case 'crowbar':
        ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(10, -12); ctx.lineTo(18, -6); ctx.stroke();
        break;
      case 'fuse':
        ctx.fillStyle = '#d7dbe0'; ctx.fillRect(-14, -6, 28, 12); ctx.fillStyle = '#777'; ctx.fillRect(-16, -5, 3, 10); ctx.fillRect(13, -5, 3, 10);
        break;
      case 'rock':
        ctx.fillStyle = '#8d8d96'; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-8, -10); ctx.lineTo(8, -12); ctx.lineTo(15, 4); ctx.lineTo(4, 10); ctx.closePath(); ctx.fill();
        break;
      case 'battery':
        ctx.fillStyle = '#7bd389'; ctx.fillRect(-14, -8, 26, 16); ctx.fillStyle = '#333'; ctx.fillRect(12, -4, 4, 8);
        break;
      case 'knife':
        ctx.fillStyle = '#d7dbe0'; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(10, -8); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(10, -4, 8, 8);
        break;
      case 'lantern':
        ctx.fillStyle = '#ffd166'; ctx.fillRect(-9, -12, 18, 24); ctx.strokeRect(-12, -14, 24, 28);
        break;
      case 'rope':
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'hook':
        ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-6, 6); ctx.arc(4, 6, 10, Math.PI, 0); ctx.stroke();
        break;
      case 'map':
        ctx.fillStyle = '#f3e3b5'; ctx.fillRect(-14, -10, 28, 20); ctx.strokeStyle = '#8b6b3a'; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-5, 10); ctx.moveTo(6, -10); ctx.lineTo(6, 10); ctx.stroke();
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSwitch(x, value, values) {
    const n = values.length;
    const idx = Math.max(0, values.indexOf(value));
    ctx.fillStyle = '#3a3346';
    ctx.fillRect(x - 30, GROUND - 130, 60, 96);
    // Лампочка-индикатор: яркость растёт с индексом
    const lit = idx / Math.max(1, n - 1);
    if (lit > 0) {
      const g = ctx.createRadialGradient(x, GROUND - 150, 4, x, GROUND - 150, 60);
      g.addColorStop(0, `rgba(255,230,140,${0.5 + lit * 0.4})`);
      g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60, GROUND - 210, 120, 120);
    }
    ctx.fillStyle = lit > 0 ? '#ffe39a' : '#5b5470';
    ctx.beginPath();
    ctx.arc(x, GROUND - 150, 14, 0, Math.PI * 2);
    ctx.fill();
    // Точки-индикаторы положения
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i <= idx ? '#ffcf8a' : '#4d4560';
      ctx.beginPath();
      ctx.arc(x - ((n - 1) * 8) / 2 + i * 8, GROUND - 72, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLever(x, down) {
    ctx.save();
    ctx.translate(x, GROUND);
    ctx.fillStyle = '#2b2b38';
    ctx.fillRect(-18, -6, 36, 10);
    ctx.rotate(down ? 0.7 : -0.1);
    ctx.fillStyle = '#9aa0ad';
    ctx.fillRect(-5, -120, 10, 120);
    ctx.fillStyle = down ? '#7CFC7C' : '#ff8a5b';
    ctx.beginPath();
    ctx.arc(0, -124, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawClue(x) {
    ctx.fillStyle = '#f5ecd2';
    ctx.fillRect(x - 34, GROUND - 190, 68, 80);
    ctx.fillStyle = '#b9a77e';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 24, GROUND - 176 + i * 16, 48, 3);
    ctx.fillStyle = '#c94f4f';
    ctx.beginPath();
    ctx.arc(x, GROUND - 190, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLabel(x, y, text, color) {
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(12,8,20,0.6)';
    ctx.fillRect(x - w / 2, y - 14, w, 19);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawHotspot(hs, t) {
    const s = game.s;
    const x = hs.x;
    switch (hs.kind) {
      case 'door': drawDoor(x, s.states[hs.id] === 'open'); break;
      case 'keypad': drawKeypad(x, s.states[hs.id] === 'open'); break;
      case 'pickup': drawPickup(x, hs.item, t); break;
      case 'switch': drawSwitch(x, s.states[hs.id], hs.values || ['0', '1']); break;
      case 'lever': drawLever(x, s.states[hs.id] === 'down'); break;
      case 'clue': drawClue(x); break;
      default: break;
    }
    if (hs.kind !== 'clue' && hs.kind !== 'decor') {
      drawLabel(x, GROUND + 26, hs.label, hoverHs === hs ? '#ffe9a8' : '#e8dcc0');
    } else if (hs.kind === 'clue') {
      drawLabel(x, GROUND - 200, hs.label, '#e8dcc0');
    }
    if (hoverHs === hs) {
      ctx.strokeStyle = 'rgba(255,233,168,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x - 56, GROUND - 200, 112, 200);
      ctx.setLineDash([]);
    }
  }

  function drawBear(t) {
    const b = game.bear;
    const bob = b.moving ? Math.abs(Math.sin(t * 12)) * 6 : Math.sin(t * 2) * 2;
    const img = window.BEAR_IMG;
    ctx.save();
    ctx.translate(b.x, GROUND - bob);
    ctx.scale(b.dir, 1);
    if (img && img.complete && img.naturalWidth) {
      const h = 170;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, -w / 2, -h + 6, w, h);
      ctx.restore();
      return;
    }
    // Заглушка-медвежонок (пока не загружен assets/bear.png)
    const legSwing = b.moving ? Math.sin(t * 12) * 10 : 0;
    ctx.fillStyle = '#4a2d18';
    ctx.beginPath(); ctx.ellipse(-12 + legSwing, -4, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12 - legSwing, -4, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.ellipse(0, -52, 40, 46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c28a52';
    ctx.beginPath(); ctx.ellipse(0, -44, 22, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.arc(-18, -106, 12, 0, Math.PI * 2); ctx.arc(18, -106, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -96, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a66b';
    ctx.beginPath(); ctx.ellipse(10, -86, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a160a';
    ctx.beginPath(); ctx.ellipse(16, -90, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8, -102, 4, 0, Math.PI * 2); ctx.arc(10, -102, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, -103, 1.4, 0, Math.PI * 2); ctx.arc(11, -103, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParticles(dt) {
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.life -= dt;
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const t = now / 1000;

    if (game) update(dt, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (game) {
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 24, (Math.random() - 0.5) * shake * 12);
      }
      drawBackground(game.level, t);
      for (const hs of game.level.hotspots) {
        if (!Q.isVisible(hs, game.s)) continue;
        drawHotspot(hs, t);
      }
      drawBear(t);
      drawParticles(dt);
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,250,220,${flash * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    shake = Math.max(0, shake - dt * 1.6);
    flash = Math.max(0, flash - dt * 2);
    requestAnimationFrame(frame);
  }

  function update(dt, now) {
    const b = game.bear;
    const speed = 260;
    const dx = b.tx - b.x;
    if (Math.abs(dx) > 1) {
      b.moving = true;
      b.dir = dx > 0 ? 1 : -1;
      b.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    } else {
      b.x = b.tx;
      b.moving = false;
      if (b.pending) arrived();
    }

    // Подсказка: после минуты без действий
    if (!game.s.complete && !game.hintAuto && now - game.lastAction > IDLE_HINT_MS) {
      game.hintAuto = true;
      $('#hint-btn').textContent = 'Подсказка!';
    }
  }

  // ---------- Кнопки ----------
  $('#back').addEventListener('click', () => { game = null; renderMenu(); showScreen('menu'); });
  $('#reset-level').addEventListener('click', () => { if (game) startLevel(game.level.id); });
  $('#hint-btn').addEventListener('click', () => {
    if (!game) return;
    game.hintOpen = !game.hintOpen;
    $('#hint').classList.toggle('show', game.hintOpen);
    $('#hint-btn').textContent = 'Подсказка';
    game.hintAuto = true;
    markAction();
  });
  $('#win-menu').addEventListener('click', () => { $('#win-modal').classList.remove('show'); game = null; renderMenu(); showScreen('menu'); });
  $('#win-next').addEventListener('click', () => {
    const id = game.level.id;
    $('#win-modal').classList.remove('show');
    if (id >= LEVELS.length) { game = null; renderMenu(); showScreen('menu'); return; }
    startLevel(id + 1);
  });
  $('#reset-progress').addEventListener('click', () => {
    if (!confirm('Сбросить прогресс всех уровней?')) return;
    progress = { done: [] };
    saveProgress(progress);
    renderMenu();
  });

  // Фото медвежонка: если есть assets/bear.png — рисуем его вместо заглушки
  const bearImg = new Image();
  bearImg.src = 'assets/bear.png';
  window.BEAR_IMG = bearImg;

  renderMenu();
  requestAnimationFrame(frame);
})();
