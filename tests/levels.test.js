// Проверка всех 25 уровней: каждое заявленное решение должно проходить до конца,
// а уровни должны иметь уникальные id, подсказку и корректные ссылки.
// Запуск: node tests/levels.test.js
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const LEVELS = require(path.join(root, 'js/levels.js'));
const Q = require(path.join(root, 'js/logic.js'));

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

check('25 уровней', () => assert.strictEqual(LEVELS.length, 25));

check('уникальные id и обязательные поля', () => {
  const ids = new Set();
  for (const lv of LEVELS) {
    assert.ok(!ids.has(lv.id), 'дубликат уровня ' + lv.id);
    ids.add(lv.id);
    assert.ok(lv.title && lv.hint && lv.intro, 'нет текста в уровне ' + lv.id);
    assert.ok(Array.isArray(lv.solve) && lv.solve.length > 0, 'нет решения в уровне ' + lv.id);
    const hid = new Set();
    for (const h of lv.hotspots) {
      assert.ok(!hid.has(h.id), `дубликат хотспота ${h.id} в уровне ${lv.id}`);
      hid.add(h.id);
    }
    assert.ok(lv.hotspots.some((h) => h.exit), 'нет выхода в уровне ' + lv.id);
  }
});

check('ссылки на рычаги и выключатели существуют', () => {
  for (const lv of LEVELS) {
    for (const id of lv.sequence || []) {
      const h = lv.hotspots.find((x) => x.id === id);
      assert.ok(h && h.kind === 'lever', `уровень ${lv.id}: рычаг ${id} не найден`);
    }
    for (const h of lv.hotspots) {
      for (const l of h.links || []) {
        assert.ok(lv.hotspots.some((x) => x.id === l), `уровень ${lv.id}: link ${l} не найден`);
      }
    }
  }
});

for (const lv of LEVELS) {
  check(`уровень ${lv.id} «${lv.title}» решается`, () => {
    let s = Q.initState(lv);
    for (const step of lv.solve) {
      const r = Q.act(lv, s, step);
      assert.ok(r.ok, `шаг ${JSON.stringify(step)} не сработал (${r.reason}): ${r.state.msg}`);
      s = r.state;
    }
    assert.ok(s.complete, 'после решения уровень не завершён');
  });
}

check('неверный порядок рычагов сбрасывает механизм, но не блокирует', () => {
  const lv = LEVELS.find((l) => l.id === 11);
  let s = Q.initState(lv);
  s = Q.act(lv, s, 'sun').state; // не тот рычаг
  assert.strictEqual(s.flags.seqDone, undefined);
  assert.deepStrictEqual(s.seq, []);
  s = Q.act(lv, s, 'moon').state;
  s = Q.act(lv, s, 'sun').state;
  s = Q.act(lv, s, 'star').state;
  assert.ok(s.flags.seqDone, 'механизм должен запуститься после сброса');
});

check('неверный код не открывает панель', () => {
  const lv = LEVELS.find((l) => l.id === 16);
  const r = Q.act(lv, Q.initState(lv), { id: 'keypad', code: '00' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.state.complete, false);
});

check('скрытый предмет нельзя взять до срабатывания условия', () => {
  const lv = LEVELS.find((l) => l.id === 2);
  const r = Q.act(lv, Q.initState(lv), 'key');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'hidden');
});

check('состояние не мутирует при действии', () => {
  const lv = LEVELS.find((l) => l.id === 1);
  const s0 = Q.initState(lv);
  const before = JSON.stringify(s0);
  Q.act(lv, s0, 'key');
  assert.strictEqual(JSON.stringify(s0), before);
});

if (failures) {
  console.log(`\n${failures} проверок провалено`);
  process.exit(1);
}
console.log('\nВсе проверки пройдены');
