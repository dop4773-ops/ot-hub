const assert = require('assert'), os = require('os'), path = require('path');
const ExcelJS = require('exceljs');
const { build, dayStyle } = require('../modules/attendance/build');
(async () => {
  const names = ['가', '나', '다', '라', '마', '바', '사'];                 // 7명 → 블록 2개(6+1)
  const f = path.join(os.tmpdir(), 'att-test.xlsx');
  await build({ year: 2026, month: 11, floorLabel: '10층', names, holidays: ['2026-11-04'] }).xlsx.writeFile(f);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f);
  assert.deepStrictEqual(wb.worksheets.map(w => w.name), ['출근부(1~15일)', '출근부(16~말일)']);
  const ws = wb.getWorksheet('출근부(1~15일)');
  assert.strictEqual(ws.getCell('B4').value, '가'); assert.strictEqual(ws.getCell('N4').value, '이름');   // 2블록의 날짜 열(1블록은 6명)
  assert.strictEqual(ws.getCell('O4').value, '사');                                                          // 2블록 첫 사람
  assert.ok(/^1\n\(일\)/.test(ws.getCell('A6').value));                                                      // 2026-11-01은 일요일
  assert.strictEqual(ws.getCell('A6').font.color.argb, 'FFDC2626');                                          // 일요일 빨강
  assert.strictEqual(ws.getCell('A8').font.color, undefined);                                                // 11-02 월요일: 색 없음
  assert.strictEqual(ws.getCell('A18').font.color.argb, 'FF2563EB');                                         // 11-07 토요일 파랑
  assert.strictEqual(ws.getCell('B12').fill.fgColor.argb, 'FFD1D5DB');                                       // 11-04 공휴일 회색 칠
  const w2 = wb.getWorksheet('출근부(16~말일)'); assert.ok(/^30\n/.test(w2.getCell('A34').value));           // 16~30 → 15일치
  assert.deepStrictEqual(dayStyle('2026-11-04', new Set(['2026-11-04'])), { color: 'FFDC2626', fill: 'FFD1D5DB' });
  console.log('출근부 시험 OK');
})();
