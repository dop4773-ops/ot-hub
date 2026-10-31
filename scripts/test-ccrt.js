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
const by = {}; r.rows.forEach(x => (by[x.name] ??= []).push(x));
const one = n => by[n][0], kind = (n, k) => by[n].find(x => x.kind === k);
assert.ok(dow(one('루틴').date) !== 0 && [1, 3, 5].includes(dow(one('루틴').date)));
assert.strictEqual(by['퇴원'].length, 1); assert.ok(kind('퇴원', '퇴원 전').date < '2026-11-12' && [1, 3, 5].includes(dow(kind('퇴원', '퇴원 전').date)));
assert.ok(kind('회복기', '회복기 종료 전').date < '2026-11-10' && /COSAS/.test(kind('회복기', '회복기 종료 전').note));
assert.ok(kind('회복기', '루틴') && kind('회복기', '루틴').date >= '2026-11-24', '루틴은 사건과 별개로 하나 더');          // 직전 10/5 + 50일 이후
assert.strictEqual(one('베터').status, '제외'); assert.strictEqual(one('아직').status, '대상 아님');
assert.notStrictEqual(one('오프').date, '2026-11-17');            // 화요일(주치의 9 off)은 피한다
console.log('CCRT 규칙 시험 OK', r.rows.map(x => `${x.name}/${x.kind || '-'}:${x.date || x.status}`).join(' '));
