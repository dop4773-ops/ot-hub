// 사용: node scripts/test-inventory-template.js "<작업치료 도구 목록(최신).xlsx>" — 원본 서식 그대로 채우는지 확인
const assert = require('assert'), os = require('os'), path = require('path'), ExcelJS = require('exceljs');
const L = require('../modules/inventory/logic');
(async () => {
  const f = process.argv[2], items = await L.loadTools(f), n0 = items.length;
  const first = items[0], adl = items.find(i => i.section === 'ADL');
  const r = L.apply(items, [{ id: 'a', name: '새 도구 시험', qty: 3, action: '신규', section: 'RDT', kind: '비품', floor: '3F' }, { id: 'b', name: first.name, qty: 2, action: '추가', matchId: first.id, date: '2026-10-01', floor: '10F' }],
    [{ id: adl.id, op: 'retire', reason: '파손' }], '2026-10-31');
  assert.strictEqual(r.items.length, n0 + 1 - 1); assert.strictEqual(r.log.length, 3); assert.ok(r.items.find(i => i.name === '새 도구 시험').note.includes('26.10.31 신규'));
  const out = path.join(os.tmpdir(), 'inv-tpl.xlsx'), wb = await L.buildInPlace({ templateFile: f, items: r.items, history: r.log.map(l => ({ date: l.date, kind: l.kind, name: l.name, qty: l.qty, detail: l.result })), today: '2026-10-31' });
  await wb.xlsx.writeFile(out);
  const o = new ExcelJS.Workbook(); await o.xlsx.readFile(out); const q = new ExcelJS.Workbook(); await q.xlsx.readFile(f), a = o.worksheets[0], b = q.worksheets[0];
  assert.deepStrictEqual(o.worksheets.map(w => w.name), ['도구목록', '변경이력']);
  for (let c = 1; c <= 5; c++) assert.strictEqual(a.getColumn(c).width, b.getColumn(c).width, '열 너비');
  assert.strictEqual(a.pageSetup.orientation, b.pageSetup.orientation); assert.strictEqual(a.pageSetup.fitToPage, b.pageSetup.fitToPage);
  const mg = w => Object.values(w._merges).map(m => m.model).filter(m => m.bottom > m.top || m.right > m.left).map(m => `${m.top}:${m.left}-${m.bottom}:${m.right}`).sort(); assert.deepStrictEqual(mg(a), mg(b), '병합 유지');
  for (const r of [1, 6, 7, 8, 192]) assert.strictEqual(a.getRow(r).height, b.getRow(r).height, '행 높이 ' + r);
  assert.strictEqual(a.getCell('B8').font.name, b.getCell('B8').font.name); assert.ok(a.getCell('A8').value && a.getCell('A8').value.formula, '순번 수식 유지');
  const names = []; for (let r = 8; r <= a.rowCount; r++) { const v = a.getCell(r, 2).value; if (v) names.push(String(v)); }
  assert.ok(names.includes('새 도구 시험')); assert.ok(!names.includes(adl.name)); assert.strictEqual(a.getCell('E2').value instanceof Date, true);
  const lg = o.getWorksheet('변경이력'); assert.strictEqual(lg.getCell('B2').value, '신규'); assert.strictEqual(lg.getCell('A2').value, '2026-10-31');
  console.log('도구 목록 원본 서식 추출 시험 OK →', out);
})();
