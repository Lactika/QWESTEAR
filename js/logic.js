/*
 * Игровая логика QWESTEAR (чистые функции, без DOM).
 * Состояние уровня иммутабельно: act() возвращает новое состояние.
 * Один и тот же код работает в браузере (Telegram WebView) и в Node-тестах.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function defaultState(h) {
    if (h.init !== undefined) return String(h.init);
    switch (h.kind) {
      case 'switch': return (h.values || ['0', '1'])[0];
      case 'lever': return 'up';
      case 'keypad': return 'locked';
      case 'door': return 'closed';
      case 'pickup': return 'here';
      default: return 'idle';
    }
  }

  function findHotspot(level, id) {
    return level.hotspots.find((h) => h.id === id) || null;
  }

  // Требование: {item} — есть предмет; {is:[id,val]} — состояние; {isNot:[id,val]}; {flag} — флаг.
  function holds(req, s) {
    if (req.item) return s.inv.includes(req.item);
    if (req.is) return s.states[req.is[0]] === String(req.is[1]);
    if (req.isNot) return s.states[req.isNot[0]] !== String(req.isNot[1]);
    if (req.flag) return !!s.flags[req.flag];
    return true;
  }

  function allHold(reqs, s) {
    return (reqs || []).every((r) => holds(r, s));
  }

  function isVisible(h, s) {
    if (h.kind === 'pickup' && s.states[h.id] === 'taken') return false;
    return allHold(h.visibleIf, s);
  }

  function initState(level) {
    const states = {};
    for (const h of level.hotspots) states[h.id] = defaultState(h);
    return {
      states,
      inv: [],
      flags: {},
      seq: [],
      bearAt: null,
      complete: false,
      msg: level.intro || '',
      msgId: 0,
      moves: 0,
    };
  }

  function setMsg(s, text) {
    s.msg = text || '';
    s.msgId += 1;
  }

  /*
   * step: строка-id хотспота ("tap") или {id, code} для ввода кода.
   * Возвращает {state, ok, reason}. ok=false — действие ничего не изменило
   * (игрок получит подсказку в сообщении, но прогресс не ломается).
   */
  function act(level, state, step) {
    const s = clone(state);
    const id = typeof step === 'string' ? step : step.id;
    const h = findHotspot(level, id);
    if (!h) return { state: s, ok: false, reason: 'unknown' };
    if (s.complete) return { state: s, ok: false, reason: 'finished' };
    if (!isVisible(h, s)) return { state: s, ok: false, reason: 'hidden' };

    s.bearAt = h.id;
    s.moves += 1;

    switch (h.kind) {
      case 'decor':
      case 'clue': {
        setMsg(s, h.text || h.msg || '');
        return { state: s, ok: true };
      }

      case 'pickup': {
        s.inv.push(h.item);
        s.states[h.id] = 'taken';
        setMsg(s, h.msg || `Взято: ${h.label}`);
        return { state: s, ok: true };
      }

      case 'switch': {
        if (!allHold(h.needs, s)) {
          setMsg(s, h.lockedMsg || 'Не работает.');
          return { state: s, ok: false, reason: 'locked' };
        }
        const vals = h.values || ['0', '1'];
        const cur = vals.indexOf(s.states[h.id]);
        s.states[h.id] = vals[(cur + 1) % vals.length];
        // «Выключатели-лампы»: двухпозиционные соседи переключаются вместе
        for (const linkId of h.links || []) {
          const lh = findHotspot(level, linkId);
          if (!lh) continue;
          s.states[linkId] = s.states[linkId] === '1' ? '0' : '1';
        }
        setMsg(s, h.msg || 'Щёлк.');
        return { state: s, ok: true };
      }

      case 'lever': {
        if (s.flags.seqDone) {
          setMsg(s, 'Механизм уже запущен.');
          return { state: s, ok: false, reason: 'done' };
        }
        const expected = level.sequence[s.seq.length];
        if (expected === id) {
          s.seq.push(id);
          s.states[id] = 'down';
          if (s.seq.length === level.sequence.length) {
            s.flags.seqDone = true;
            setMsg(s, h.okMsg || 'Механизм запущен!');
          } else {
            setMsg(s, h.msg || 'Щёлк...');
          }
          return { state: s, ok: true };
        }
        // Ошибка: сбрасываем все рычаги, но не наказываем — можно начать заново
        for (const other of level.hotspots) {
          if (other.kind === 'lever') s.states[other.id] = 'up';
        }
        s.seq = [];
        if (level.sequence[0] === id) {
          s.seq = [id];
          s.states[id] = 'down';
          setMsg(s, 'Лязг! Порядок сбит. Начинаем заново — это первый рычаг.');
        } else {
          setMsg(s, 'Лязг! Порядок сбит, все рычаги вернулись.');
        }
        return { state: s, ok: false, reason: 'wrong-order' };
      }

      case 'keypad': {
        if (s.states[id] === 'open') {
          setMsg(s, h.passMsg || 'Проход открыт.');
          return { state: s, ok: true };
        }
        if (!allHold(h.needs, s)) {
          setMsg(s, h.lockedMsg || 'Заперто.');
          return { state: s, ok: false, reason: 'locked' };
        }
        if (typeof step === 'string' || step.code === undefined) {
          setMsg(s, h.askMsg || 'Нужен код. Откройте панель.');
          return { state: s, ok: false, reason: 'need-code' };
        }
        if (String(step.code) !== String(h.code)) {
          setMsg(s, 'Неверный код. Попробуйте ещё раз.');
          return { state: s, ok: false, reason: 'wrong-code' };
        }
        s.states[id] = 'open';
        if (h.exit) {
          s.complete = true;
          setMsg(s, h.exitMsg || 'Дверь открыта!');
        } else {
          setMsg(s, h.openMsg || 'Код подошёл. Щёлк!');
        }
        return { state: s, ok: true };
      }

      case 'door': {
        if (s.states[id] === 'open') {
          if (h.exit) {
            s.complete = true;
            setMsg(s, h.exitMsg || 'Мишутка уходит дальше.');
          } else {
            setMsg(s, h.openAgainMsg || 'Уже открыто.');
          }
          return { state: s, ok: true };
        }
        if (!allHold(h.needs, s)) {
          setMsg(s, h.lockedMsg || 'Заперто.');
          return { state: s, ok: false, reason: 'locked' };
        }
        s.states[id] = 'open';
        if (h.exit) {
          s.complete = true;
          setMsg(s, h.exitMsg || 'Мишутка уходит дальше.');
        } else {
          setMsg(s, h.openMsg || 'Открылось.');
        }
        return { state: s, ok: true };
      }

      default:
        return { state: s, ok: false, reason: 'bad-kind' };
    }
  }

  // Все видимые ходы из состояния (для BFS-проверки решаемости).
  function legalSteps(level, state) {
    const out = [];
    for (const h of level.hotspots) {
      if (h.kind === 'clue' || h.kind === 'decor') continue;
      if (!isVisible(h, state)) continue;
      if (h.kind === 'keypad') continue; // коды проверяются отдельно
      out.push(h.id);
    }
    return out;
  }

  function stateKey(s) {
    return JSON.stringify([s.states, s.inv.slice().sort(), s.flags, s.seq]);
  }

  // Поиск кратчайшего решения (только для проверки уровней, без кодов).
  function solve(level, maxDepth = 14) {
    const start = initState(level);
    const queue = [{ s: start, path: [] }];
    const seen = new Set([stateKey(start)]);
    while (queue.length) {
      const { s, path } = queue.shift();
      if (path.length > maxDepth) continue;
      for (const id of legalSteps(level, s)) {
        const r = act(level, s, id);
        if (!r.ok && r.reason !== 'wrong-order') continue;
        if (r.state.complete) return path.concat(id);
        const k = stateKey(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ s: r.state, path: path.concat(id) });
      }
    }
    return null;
  }

  return { initState, act, legalSteps, solve, isVisible, holds, findHotspot };
});
