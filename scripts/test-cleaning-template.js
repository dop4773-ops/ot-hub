// 사용: node scripts/test-cleaning-template.js "<청소분담(ot원본).xlsm>"
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const { buildWorkbook } = require('../modules/cleaning/template');
const slots3 = require('../modules/cleaning/slots.json').floor3, { expand } = require('../modules/cleaning/assign');
(async () => {
  const f = process.argv[2]; const names = Array.from({ length: 14 }, (_, i) => '가' + String.fromCharCode(0xAC00 + i));
  const cells = expand(slots3.slots).map((c, i) => ({ ...c, name: names[i] }));
  const wb = await buildWorkbook({ templateFile: f, floor: '3층', sheetName: '2027.01~', date: '2027-01-04~', cells, fixed: slots3.fixed,
    big: { tool: ['가가', '나나', '다다'], airFilters: [{ place: '작업치료실', n: 2 }, { place: '스테이션', n: 1, who: '라라' }], vacatedIdx: [0, 5], support: { 0: '마마' } } });
  const out = path.join(os.tmpdir(), 'clean-tpl.xlsx'); await wb.xlsx.writeFile(out);
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); const src = new ExcelJS.Workbook(); await src.xlsx.readFile(f); const q = src.getWorksheet('2026.10~');
  assert.deepStrictEqual(o.worksheets.map(w => w.name), ['2027.01~', '2027.01~ 대청소']);
  const ws = o.worksheets[0], bg = o.worksheets[1];
  assert.ok(String(ws.getCell('A2').value.richText ? ws.getCell('A2').value.richText.map(t => t.text).join('') : ws.getCell('A2').value).includes('(3층)'), '제목에 3층');
  for (const c of [1, 2, 3]) assert.strictEqual(ws.getColumn(c).width, q.getColumn(c).width, '열 너비 유지');
  assert.strictEqual(ws.getCell('C5').font.size, q.getCell('C5').font.size); assert.strictEqual(ws.getCell('C5').font.name, q.getCell('C5').font.name);
  assert.strictEqual(ws.getRow(5).height, q.getRow(5).height); assert.strictEqual(ws.pageSetup.orientation, q.pageSetup.orientation);
  assert.strictEqual(ws.getCell('C5').value, names[0]); assert.strictEqual(ws.getCell('C8').value, names[3]);
  assert.ok(ws.getCell('C3').value === '2027-01-04~');
  // 표가 14칸 + 고정 1줄 + 안내 1줄로 끝나고, 아래 옛 줄은 비어 있어야 한다
  assert.ok(!ws.getCell('C25').value && !ws.getCell('A30').value, '옛 줄 정리');
  let last = 0; for (let r = 5; r <= 40; r++) if (ws.getCell(r, 3).value) last = r; assert.strictEqual(last, 20, '14칸+고정 1줄(5~19) 다음 줄(20)이 안내 줄'); assert.strictEqual(ws.getCell('C19').value, '1년차 선생님들'); assert.ok(String(ws.getCell('C20').value).includes('ratation'), '안내 줄 유지');
  assert.strictEqual(bg.getCell('C5').value, '가가'); assert.strictEqual(bg.getCell('C7').value, '다다');
  const vacCell = [...Array(40).keys()].map(i => bg.getCell(5 + i, 3).value).filter(Boolean); assert.ok(vacCell.includes('마마 (지원)') && vacCell.includes('(지원 배치 필요)'), '지원 배치 표시');
  assert.ok(String(bg.getCell('J8').value).includes('작업치료실 1-2') && String(bg.getCell('J9').value).includes('라라'), '에어컨 필터');
  console.log('청소분담표 원본 서식 추출 시험 OK →', out);
})();
