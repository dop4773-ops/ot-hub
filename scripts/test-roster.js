// 평가일 관리(POT 통합): 재원=직전+한 달·MBI 30일 이내, 신환=입원 후 17일, 모두 14일 이전·평일·주치의 off 아닌 날, 이미 입력된 날짜는 유지
const assert = require('assert'); const { buildRoster } = require('../modules/roster/roster'); const { isWeekend, diffDays } = require('../shared/dates');
const S = (name, kind, doctor, admitted) => ({ name, kind, doctor, room: '1', admitted, state: '입원' });
const off = { '2026-11-09': [{ doctor: '6', pm: false }] };
const r = buildRoster({ status: [S('신환', '뇌손상', '4', '2026-10-27'), S('재원A', 'MSK 60', '6', '2026-08-01'), S('재원B', '뇌손상', '7', '2026-07-01'), S('입력됨', 'MSK 60', '8', '2026-06-01'), S('이력없음', '뇌손상', '9', '2026-09-01')],
  pot: { 재원A: { '2026-10': '2026-10-12' }, 재원B: { '2026-10': '2026-10-26' }, 입력됨: { '2026-10': '2026-10-05', '2026-11': '2026-11-09' } }, from: '2026-10-25', to: '2026-10-31', year: 2026, month: 11, off });
const by = Object.fromEntries(r.rows.map(x => [x.name, x]));
for (const x of r.rows.filter(x => !x.fixed)) { assert.ok(x.date && x.date <= '2026-11-14' && !isWeekend(x.date), x.name + ' 14일·평일'); assert.ok(!(off[x.date] || []).some(o => o.doctor === x.doctor), x.name + ' 주치의 off'); }
assert.strictEqual(by['입력됨'].date, '2026-11-09'); assert.ok(by['입력됨'].notes.some(n => /이미 입력/.test(n)));
assert.ok(by['신환'].isNew && Math.abs(diffDays(by['신환'].date, '2026-11-13')) <= 3, '신환은 입원+17일 부근');
assert.ok(by['재원A'].prev === '2026-10-12' && by['재원A'].date !== '2026-11-09' && Math.abs(diffDays(by['재원A'].date, '2026-11-09')) <= 2, '재원은 직전+28일 부근(주치의 6 off인 11/9는 피함)');
assert.ok(by['재원B'].notes.some(n => /21일|30일/.test(n)), '직전 평가가 가까워 한계에 걸림');
assert.ok(by['이력없음'].notes.some(n => /직전 평가일을 찾지 못함/.test(n)));
assert.deepStrictEqual(buildRoster({ status: [S('a', '뇌손상', '4', '2026-10-27'), S('b', '뇌손상', '4', '2026-08-01')], pot: {}, from: '2026-10-25', to: '2026-10-31', year: 2026, month: 11, scope: 'new' }).rows.map(x => x.name), ['a'], '신환만(2차)');
console.log('평가일 관리 규칙 시험 OK');
