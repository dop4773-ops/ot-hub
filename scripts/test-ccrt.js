const assert = require('assert');
const { planCcrt } = require('../modules/eval/ccrt');
const { dow } = require('../shared/dates');
const P = (name, over = {}) => ({ name, doctor: '4', room: '501', row: 0, weekdays: [1, 3, 5], dates: { 9: '2026-09-08' }, recoveryEnd: null, discharge: null, excluded: null, ...over });
const r = planCcrt({ patients: [
  P('루틴'),                                                        // 9/8 + 60일 ≈ 11/7 → 11월 월수금
  P('퇴원', { dates: { 10: '2026-10-20' }, discharge: '2026-11-12' }), // 11/12 퇴원 → 그 전 월수금
  P('회복기', { dates: { 10: '2026-10-05' }, recoveryEnd: '2026-11-10' }),
  P('베터', { excluded: 'BETTER — CCRT 평가 안 함' }),
  P('아직', { dates: { 10: '2026-10-25' } }),                       // 다음 루틴은 12월 → 대상 아님
  P('오프', { weekdays: [2], doctor: '9', dates: { 9: '2026-09-15' } }),
], year: 2026, month: 11, off: { '2026-11-17': [{ doctor: '9', pm: false }] } });
const by = Object.fromEntries(r.rows.map(x => [x.name, x]));
assert.ok(dow(by['루틴'].date) !== 0 && [1, 3, 5].includes(dow(by['루틴'].date)));
assert.ok(by['퇴원'].date < '2026-11-12' && [1, 3, 5].includes(dow(by['퇴원'].date)) && /퇴원/.test(by['퇴원'].note));
assert.ok(by['회복기'].date < '2026-11-10' && /회복기/.test(by['회복기'].note));
assert.strictEqual(by['베터'].status, '제외'); assert.strictEqual(by['아직'].status, '대상 아님');
assert.notStrictEqual(by['오프'].date, '2026-11-17');            // 화요일(주치의 9 off)은 피한다
console.log('CCRT 규칙 시험 OK', r.rows.map(x => `${x.name}:${x.date || x.status}`).join(' '));
