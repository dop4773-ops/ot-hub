const assert = require('assert');
const { assign, zoneKey } = require('../modules/cleaning/assign');
const slots = require('../modules/cleaning/slots.json').weekday;
const people = Array.from({ length: 30 }, (_, i) => 'P' + i);
// P0·P1은 과거 공용공간만 여러 번 해 봄 → 이번엔 해 보지 않은 구역으로 가야 한다
const hist = []; for (const p of ['P0', 'P1']) for (let k = 0; k < 4; k++) hist.push({ name: p, zone: '공용공간', category: '쓸기', role: 'x' });
let bad = 0;
for (let seed = 1; seed <= 20; seed++) {
  const r = assign({ slots, people, history: hist, lastRows: [], seed, tries: 400 });
  assert.strictEqual(new Set(r.cells.map(c => c.name)).size, 26);
  bad += r.cells.filter(c => ['P0', 'P1'].includes(c.name) && zoneKey(c.zone) === '공용공간').length;
}
assert.strictEqual(bad, 0, '많이 해 본 구역에 다시 배정됨');
console.log('청소 배정(새 구역 우선) 시험 OK');
