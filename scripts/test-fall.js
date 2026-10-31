// 사용: node scripts/test-fall.js ["<2026작업치료실 낙상방지 순회 체크리스트.xlsx>"]
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const L = require('../modules/fall/logic');
const pool = Array.from({ length: 26 }, (_, i) => '가' + String.fromCharCode(0xAC00 + i));
const teams = { 1: pool.slice(0, 11), 2: pool.slice(11, 21), 3: pool.slice(21) };
const roster = { weekday10: pool, weekday3: ['다' + pool[0], '다' + pool[1]], sat: teams, leave: [{ name: pool[0], period: '', kind: '육아휴직' }] };
const sat = { '2026-11-07': { team: 2, people: [...teams[2].map(n => ({ name: n, extra: false, red: n === teams[2][0] ? 13 : 0 })), { name: '지원OT', extra: true, red: 0 }] } };
const leaves = { '2026-11-04': [{ name: pool[5] }] };                                   // 수요일 하루 쉬는 사람
const r = L.generate({ year: 2026, month: 11, roster, history: {}, holidays: { '2026-11-03': '임시공휴일' }, leaves, sat, teams: { '2026-11-14': 3 }, exclude: new Set([pool[25]]) });
const days = r.weeks.flatMap(w => w.days);
assert.strictEqual(days.filter(d => d.wd === '일').length, 0, '일요일은 표에 없음');
assert.ok(days.find(d => d.date === '2026-11-03').names.every(n => !n), '공휴일은 비워 둠');
assert.deepStrictEqual(L.check({ weeks: r.weeks, roster }).filter(i => i.msg !== '빈칸'), [], '규칙 위반 없음');   // 팀 인원이 11명보다 적은 토요일의 빈칸은 의도한 동작(메모로 알림)
const s14 = r.weeks.flatMap(w => w.days).find(d => d.date === '2026-11-14'); assert.ok(s14.names.every(Boolean) && r.notes.some(x => /14\(토\)/.test(x)), '인원 부족은 처음부터 다시 채움+메모');
const hc = L.generate({ year: 2026, month: 11, roster, history: { 10: [{ day: 17, wd: '토', names: teams[2].slice(0, 4).concat(Array(7).fill('')) }] }, holidays: {}, sat, exclude: new Set() }).weeks.flatMap(w => w.days).find(d => d.date === '2026-11-07');
assert.strictEqual(hc.names[0], teams[2][4], '같은 팀의 직전 토요일 마지막 사람 다음부터 이어서');
const wk1 = r.weeks[1].days.filter(d => d.wd !== '토' && !d.holiday); assert.ok(wk1.every(d => d.names.join() === wk1[0].names.join()), '평일은 한 주 같은 사람');
const wk0 = r.weeks[0].days.filter(d => d.wd !== '토' && !d.holiday); assert.ok(wk0.length && wk0.every(d => !d.names.includes(pool[5])), '그 주(11/2~)에 하루라도 쉬는 사람은 그 주 담당에서 제외');
assert.ok(!days.some(d => d.names.includes(pool[0]) || d.names.includes(pool[25])), '휴직자·제외자');
const s7 = days.find(d => d.date === '2026-11-07'); assert.ok(!s7.names.includes(teams[2][0]) && !s7.names.includes('지원'), '3층 근무(빨간 테두리)·지원(OT) 제외'); assert.ok(s7.names.every(n => !n || teams[2].includes(n)), '토요일 시트의 팀 선생님만'); assert.strictEqual(s7.team, 2);
assert.strictEqual(r.info['2026-11-14'].source, '캘린더'); assert.ok(days.find(d => d.date === '2026-11-14').names.every(n => !n || teams[3].includes(n) || teams[3].length < 11), '캘린더 팀');
assert.strictEqual(r.info['2026-11-21'].source, '순환(추정)'); assert.ok(r.notes.some(x => /순환/.test(x)));
const f3 = L.generate({ year: 2026, month: 11, floor: '3층', roster, history: {}, holidays: {}, sat }); assert.ok(f3.weeks[1].days[0].names.every(n => !n || roster.weekday3.includes(n)), '3층은 3층 명단');
console.log('낙상 순회 규칙 시험 OK');
(async () => {
  if (!process.argv[2]) return;
  const roster2 = await L.loadRoster(process.argv[2]), hist = await L.loadHistory(process.argv[2]);
  const h2 = { ...hist }; delete h2[11]; const gen = L.generate({ year: 2026, month: 11, roster: roster2, history: h2, holidays: {} });
  console.log('11월 생성: 주', gen.weeks.length, '/ 위반', L.check({ weeks: gen.weeks, roster: roster2 }).length, '/ 메모', gen.notes.length);
  const buf = await L.build({ templateFile: process.argv[2], year: 2026, month: 11, weeks: gen.weeks }), f = path.join(os.tmpdir(), 'fall-tpl.xlsx'); require('fs').writeFileSync(f, buf);
  const Z = await require('jszip').loadAsync(buf), names = Object.keys(Z.files); assert.ok(!names.some(n => /calcChain/.test(n)) && names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).length === 1, '시트 하나만'); assert.ok(!/definedName/.test(await Z.file('xl/workbook.xml').async('string')), '이름 정의 정리');
  const out = new ExcelJS.Workbook(); await out.xlsx.readFile(f); const ws = out.worksheets[0], src = new ExcelJS.Workbook(); await src.xlsx.readFile(process.argv[2]); const o = src.getWorksheet('원본');
  assert.strictEqual(out.worksheets.length, 1); assert.strictEqual(ws.name, '11월'); assert.strictEqual(ws.getCell('A1').value, 11);
  for (const c of ['A', 'C', 'D', 'E', 'AB']) assert.strictEqual(ws.getColumn(c).width, o.getColumn(c).width, '열 너비 유지 ' + c);
  assert.strictEqual(ws.pageSetup.orientation, 'landscape'); assert.strictEqual(ws.getCell('D7').font.name, o.getCell('D7').font.name); assert.strictEqual(ws.getCell('D7').alignment.horizontal, o.getCell('D7').alignment.horizontal);
  assert.strictEqual(ws.getImages().length, 1, '로고 그림 유지'); assert.ok(ws.getCell('D7').value, '이름이 들어감');
  const satCol = gen.weeks[0].days.findIndex(d => d.wd === '토'); const sc = ws.getCell(7, 4 + satCol * 2); assert.ok(sc.fill && sc.fill.fgColor, '토요일 열 색');
  console.log('낙상 원본 서식 추출 시험 OK →', f);
})();
