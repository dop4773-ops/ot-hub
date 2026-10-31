// 사용: node scripts/test-roster-template.js "<환자 평가명단 - POT 통합 N월.xlsx>"
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const { buildFromTemplate } = require('../modules/roster/export');
(async () => {
  const rows = Array.from({ length: 24 }, (_, i) => ({ doctor: String(4 + i % 5), room: String(500 + i), name: '가' + String.fromCharCode(0xAC00 + i), pt: '(Stroke) MMT/BBS/ROM/MAS/FAC', ot: 'MFT/HFT/MBI/MMSE/GDS', date: `2026-12-${String(1 + i % 9).padStart(2, '0')}`, notes: i === 3 ? ['추정(EMR 미확인): MAS'] : [], isNew: i < 2 }));
  const buf = await buildFromTemplate({ templateFile: process.argv[2], month: 12, batch: '', rows }), out = path.join(os.tmpdir(), 'pot-tpl.xlsx'); require('fs').writeFileSync(out, buf);
  const Z = await require('jszip').loadAsync(buf); assert.ok(Z.file('xl/tables/table1.xml'), '표 유지'); assert.ok(/conditionalFormatting/.test(await Z.file('xl/worksheets/sheet1.xml').async('string')), '조건부 서식 유지'); assert.ok(/<dataValidations/.test(await Z.file('xl/worksheets/sheet1.xml').async('string')), '목록 상자 유지');
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); const src = new ExcelJS.Workbook(); await src.xlsx.readFile(process.argv[2]); const q = src.worksheets[0], ws = o.worksheets[0];
  assert.strictEqual(o.worksheets.length, 1); assert.strictEqual(ws.name, '12월 평가일정 ');
  for (const c of [1, 2, 3, 4, 5, 6, 7, 8]) assert.strictEqual(ws.getColumn(c).width, q.getColumn(c).width, '열 너비');
  assert.strictEqual(ws.getCell('A1').font.size, 18); assert.strictEqual(ws.getCell('F3').numFmt, q.getCell('F3').numFmt, '날짜 표시 형식'); assert.strictEqual(ws.getCell('C3').font.name, '맑은 고딕');
  assert.strictEqual(ws.getCell('C26').value, rows[23].name); assert.ok(ws.getCell('C26').border && ws.getCell('C26').border.left, '새 줄에도 테두리'); assert.ok(ws.getCell('F26').value instanceof Date);
  assert.strictEqual(ws.getCell('H3').value, '신환'); assert.strictEqual(ws.getCell('G6').value, '추정(EMR 미확인): MAS');
  assert.strictEqual(ws.pageSetup.orientation, q.pageSetup.orientation);
  console.log('POT 통합 서식 추출 시험 OK →', out);
})();
