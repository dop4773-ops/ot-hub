// 사용: node scripts/test-sci-template.js "<SCI 비회복기 명단.xlsx>"
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const { buildFromTemplate } = require('../modules/sci/export');
(async () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ doctor: String(4 + i % 5), room: String(500 + i), name: '가' + String.fromCharCode(0xAC00 + i), memo: i === 2 ? '10/5종료' : '' }));
  const wb = await buildFromTemplate({ templateFile: process.argv[2], month: 12, rows }), out = path.join(os.tmpdir(), 'sci-tpl.xlsx'); await wb.xlsx.writeFile(out);
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); const src = new ExcelJS.Workbook(); await src.xlsx.readFile(process.argv[2]), q = src.getWorksheet('11월'); const ws = o.worksheets[0];
  assert.strictEqual(o.worksheets.length, 1); assert.strictEqual(ws.name, '12월'); assert.ok(/^12월 SCI/.test(String(ws.getCell('A1').value.richText ? ws.getCell('A1').value.richText.map(t => t.text).join('') : ws.getCell('A1').value)));
  for (const c of [1, 2, 3, 4, 5]) assert.strictEqual(ws.getColumn(c).width, q.getColumn(c).width, '열 너비');
  assert.strictEqual(ws.getCell('D3').font.name, q.getCell('D3').font.name); assert.strictEqual(ws.getCell('D3').font.size, q.getCell('D3').font.size);
  assert.strictEqual(ws.getCell('D17').value, rows[14].name); assert.strictEqual(ws.getCell('E5').value, '10/5종료'); assert.strictEqual(ws.getCell('A3').value, 1);
  console.log('SCI 명단 원본 서식 추출 시험 OK →', out);
})();
