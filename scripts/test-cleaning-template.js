// 사용: node scripts/test-cleaning-template.js "<청소분담(ot원본).xlsm>"
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const { buildWorkbook } = require('../modules/cleaning/template');
const { bigClean } = require('../modules/cleaning/bigclean');
const { bigClean: _b } = {}; const slots3 = require('../modules/cleaning/slots.json').floor3, { expand } = require('../modules/cleaning/assign');
(async () => {
  const f = process.argv[2]; const names = Array.from({ length: 14 }, (_, i) => '가' + String.fromCharCode(0xAC00 + i));
  const cells = expand(slots3.slots).map((c, i) => ({ ...c, name: names[i] }));
  const people = names.concat(['여유1', '여유2']);
  const B = bigClean({ weekdayCells: cells, bigSlots: slots3.bigSlots, people, history: [], n: 3, airFilters: [{ place: '작업치료실', n: 2 }, { place: '스테이션', n: 1, who: '라라' }], seed: 3 });
  assert.strictEqual(B.tool.length, 3); assert.ok(B.cells.every(c => c.name), '여유 인원이 충분하면 빈 칸이 없다'); assert.ok(!B.cells.some(c => B.tool.includes(c.name)), '소독 담당은 다른 칸에 없다');
  const wb = await buildWorkbook({ templateFile: f, floor: '3층', sheetName: '2027.01~', date: '2027-01-04~', cells, fixed: slots3.fixed,
    big: B });
  const out = path.join(os.tmpdir(), 'clean-tpl.xlsx'); await wb.xlsx.writeFile(out);
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); const src = new ExcelJS.Workbook(); await src.xlsx.readFile(f); const q = src.getWorksheet('2026.10~');
  assert.deepStrictEqual(o.worksheets.map(w => w.name), ['2027.01~', '2027.01~ 대청소']);
  const ws = o.worksheets[0], bg = o.worksheets[1];
  assert.ok(String(ws.getCell('A2').value.richText ? ws.getCell('A2').value.richText.map(t => t.text).join('') : ws.getCell('A2').value).includes('(3층)'), '제목에 3층');
  for (const c of [1, 2, 3]) assert.strictEqual(ws.getColumn(c).width, q.getColumn(c).width, '열 너비 유지');
  assert.strictEqual(ws.getCell('C5').font.size, q.getCell('C5').font.size); assert.strictEqual(ws.getCell('C5').font.name, q.getCell('C5').font.name);
  assert.ok(ws.getRow(5).height >= q.getRow(5).height - 1, '행 높이는 원본 이상'); assert.strictEqual(ws.pageSetup.orientation, q.pageSetup.orientation);
  assert.strictEqual(ws.getCell('C5').value, names[0]); assert.strictEqual(ws.getCell('C8').value, names[3]);
  assert.ok(ws.getCell('C3').value === '2027-01-04~');
  // 표가 14칸 + 고정 1줄 + 안내 1줄로 끝나고, 아래 옛 줄은 비어 있어야 한다
  assert.ok(!ws.getCell('C25').value && !ws.getCell('A30').value, '옛 줄 정리');
  let last = 0; for (let r = 5; r <= 40; r++) if (ws.getCell(r, 3).value) last = r; assert.strictEqual(last, 20, '14칸+고정 1줄(5~19) 다음 줄(20)이 안내 줄'); assert.strictEqual(ws.getCell('C19').value, '1년차 선생님들'); assert.ok(String(ws.getCell('C20').value).includes('ratation'), '안내 줄 유지');
  assert.deepStrictEqual([5, 6, 7].map(r => bg.getCell(r, 3).value), B.tool);
  const all = [...Array(40).keys()].map(i => bg.getCell(5 + i, 3).value).filter(Boolean); assert.ok(B.cells.every(c => all.includes(c.name)), '대청소 칸 담당자 모두 기록');
  assert.ok(String(bg.getCell('J8').value).includes('작업치료실 1-2') && String(bg.getCell('J9').value).includes('라라'), '에어컨 필터');
  console.log('청소분담표 원본 서식 추출 시험 OK →', out);
})();
// 배치도 시트까지 함께 내보내기 (10층 · 원본 파일에 Sheet1이 있을 때)
(async () => {
  const { loadFloorPlan, place } = require('../modules/cleaning/floorplan'), d = require('../modules/cleaning/slots.json'), f = process.argv[2];
  const names = Array.from({ length: 30 }, (_, i) => '나' + String.fromCharCode(0xAC00 + i)), cells = expand(d.weekday).map((c, i) => ({ ...c, name: names[i] }));
  const B = bigClean({ weekdayCells: cells, bigSlots: d.bigClean.slots, people: names, history: [], n: 5, airFilters: [], seed: 2 }), fp = await loadFloorPlan(f);
  const wb = await buildWorkbook({ templateFile: f, floor: '10층', sheetName: '2027.01~', date: '2027-01-04~', cells, fixed: d.fixed, big: B, include: { week: true, big: true, mapWeek: true, mapBig: true }, maps: { fp, week: place(fp, cells), big: place(fp, B.cells, B.tool) } });
  const out = path.join(os.tmpdir(), 'clean-map.xlsx'); await wb.xlsx.writeFile(out);
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); assert.deepStrictEqual(o.worksheets.map(w => w.name), ['2027.01~', '2027.01~ 대청소', '2027.01~ 배치도', '2027.01~ 대청소 배치도']);
  const txt = ws => { let t = ''; ws.eachRow(r => r.eachCell(c => { t += JSON.stringify(c.value); })); return t; };
  assert.ok(names.some(n => txt(o.worksheets[2]).includes(n)), '평일 배치도에 이름'); assert.ok(names.some(n => txt(o.worksheets[3]).includes(n)) && txt(o.worksheets[3]).includes('소독'), '대청소 배치도에 이름·소독');
  const only = await buildWorkbook({ templateFile: f, floor: '10층', sheetName: 'X', date: null, cells, fixed: d.fixed, big: B, include: { week: false, big: false, mapBig: true }, maps: { fp, week: place(fp, cells), big: place(fp, B.cells, B.tool) } });
  assert.deepStrictEqual(only.worksheets.map(w => w.name), ['X 대청소 배치도']);
  console.log('청소분담표 배치도 포함 추출 시험 OK →', out);
})();
