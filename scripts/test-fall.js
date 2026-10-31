// 사용: node scripts/test-fall.js ["<낙상방지 순회 체크리스트.xlsx>"]
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const L = require('../modules/fall/logic');
const pool = Array.from({ length: 26 }, (_, i) => '가' + String.fromCharCode(0xAC00 + i));         // 26명
const teams = { 1: pool.slice(0, 11), 2: pool.slice(11, 21), 3: pool.slice(21) };                    // 2팀 10명, 3팀 5명 → 부족하면 다른 팀에서 채움
const roster = { weekday10: pool, weekday3: [], sat: teams, leave: [{ name: pool[0], period: '', kind: '육아휴직' }] };
const r = L.generate({ year: 2026, month: 11, roster, history: {}, holidays: { '2026-11-04': '임시공휴일' } });
const days = r.weeks.flatMap(w => w.days);
assert.strictEqual(days.filter(d => d.wd === '일').length, 0, '일요일은 표에 없음');
assert.ok(days.find(d => d.date === '2026-11-04').holiday && days.find(d => d.date === '2026-11-04').names.every(n => !n), '공휴일은 비워 둠');
assert.deepStrictEqual(L.check({ weeks: r.weeks, roster }), [], '규칙 위반 없음');
const wk1 = r.weeks[1].days.filter(d => d.wd !== '토'); assert.ok(wk1.every(d => d.names.join() === wk1[0].names.join()), '평일은 한 주 같은 사람');
assert.ok(!days.some(d => d.names.includes(pool[0])), '휴직자 제외');
const sat = days.filter(d => d.wd === '토').map(d => d.names); assert.ok(sat.every(n => n.length === 11 && new Set(n).size === 11));
assert.notDeepStrictEqual(sat[0].slice().sort(), sat[1].slice().sort(), '토요일은 팀이 바뀜');
const cnt = {}; days.filter(d => d.wd !== '토').forEach(d => { if (d.wd === '월' || d.date === days.find(x => x.wd !== '토' && !x.holiday).date) d.names.forEach(n => cnt[n] = (cnt[n] || 0) + 1); });
(async () => { const f = path.join(os.tmpdir(), 'fall-test.xlsx'); await L.build({ year: 2026, month: 11, weeks: r.weeks }).xlsx.writeFile(f);
  const ws = (await new ExcelJS.Workbook().xlsx.readFile(f)).getWorksheet('11월'); assert.ok(String(ws.getCell('D3').value).includes('11/2')); assert.ok(ws.getCell('C6').value === '09:00 ~ 09:05');
  console.log('낙상 순회 시험 OK');
  if (process.argv[2]) {
    const roster2 = await L.loadRoster(process.argv[2]), hist = await L.loadHistory(process.argv[2]);
    console.log('실제 치료사명단: 10층', roster2.weekday10.length, '명 / 3층', roster2.weekday3.length, '명 / 토요일 팀', Object.values(roster2.sat).map(a => a.length).join('·'), '/ 휴직·단축', roster2.leave.map(l => `${l.name}(${l.kind})`).join(' '));
    const h2 = { ...hist }; delete h2[11]; const gen = L.generate({ year: 2026, month: 11, roster: roster2, history: h2, holidays: {} });
    const issues = L.check({ weeks: gen.weeks, roster: roster2 }); console.log('11월 자동 생성: 주', gen.weeks.length, '/ 위반', issues.length, issues.slice(0, 3).map(i => i.msg).join(','));
    const c = {}; gen.weeks.forEach(w => { const wd = w.days.find(d => d.wd !== '토' && !d.holiday); if (wd) wd.names.forEach(n => c[n] = (c[n] || 0) + 1); });
    const real = {}; (hist[11] || []).filter(d => d.wd === '월' || d.day === 3).forEach(d => d.names.forEach(n => n && (real[n] = (real[n] || 0) + 1)));
    const spread = o => { const v = Object.values(o); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
    console.log('평일 주 횟수 편차  자동:', spread(c), ' 실제 11월:', spread(real), '| 자동 배정 인원', Object.keys(c).length, '명(주', gen.weeks.length, '개 × 11칸)');
  }
})();
