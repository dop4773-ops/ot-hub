// 사용: node scripts/test-inventory.js ["<작업치료 도구 목록.xlsx>"]
const assert = require('assert'), os = require('os'), path = require('path');
const L = require('../modules/inventory/logic'); const ExcelJS = require('exceljs');
const items = [{ id: 1, section: 'Activity', name: '2단 수평 볼트 보드', qty: 1, kind: '비품', note: '' }, { id: 2, section: 'ADL', name: '거울', qty: 4, kind: '비품', note: '' }, { id: 3, section: 'RDT', name: '고무밴드(적색)', qty: 10, kind: '소모품', note: '' }];
assert.strictEqual(L.match('거울', items).exact[0], 2);
assert.deepStrictEqual(L.match('고무밴드', items).near, [3]);
assert.deepStrictEqual(L.match('볼펜', items), { exact: [], near: [] });
const imp = [
  { name: '고무밴드(적색)', qty: 5, matchId: 3, action: '교체' },       // 폐기 후 보충 → 재고량 그대로
  { name: '거울', qty: 2, matchId: 2, action: '추가' },                  // 2개 더 구입 → 4→6
  { name: '신형 퍼즐', qty: 1, matchId: null, action: '신규', section: 'Activity', kind: '비품' },
  { name: '볼펜', qty: 10, matchId: null, action: '' },                  // 미분류
  { name: '거울2', qty: 1, matchId: null, action: '추가' },              // 연결 품목 없음 → 보류
];
const r = L.apply(items, imp);
assert.strictEqual(r.items.find(i => i.id === 3).qty, 10); assert.strictEqual(r.items.find(i => i.id === 2).qty, 6);
assert.ok(r.items.some(i => i.name === '신형 퍼즐' && i.isNew)); assert.strictEqual(r.pending.length, 2);
(async () => {
  const f = path.join(os.tmpdir(), 'inv-test.xlsx'); await L.build({ items: r.items, log: r.log }).xlsx.writeFile(f);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f); assert.deepStrictEqual(wb.worksheets.map(w => w.name), ['도구목록', '변경이력']);
  assert.ok(wb.getWorksheet('변경이력').getCell('C2').value.includes('재고량 10개 그대로'));
  console.log('도구목록 시험 OK');
  if (process.argv[2]) { const t = await L.loadTools(process.argv[2]); const by = {}; t.forEach(i => by[i.section] = (by[i.section] || 0) + 1); console.log('실제 목록:', t.length, '개', JSON.stringify(by), '소모품', t.filter(i => i.kind === '소모품').length); }
})();

(async () => {   // 신청서 가져오기: 머리글 '품 명'(공백 포함) 자동 인식 → 품목 4건만(머리글 제외), 일치 정도 판정
  const f = path.join(os.tmpdir(), 'supply-test.xlsx'); const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('신청서');
  ws.getCell('A1').value = '사무용품 신청서'; ws.getRow(3).values = ['번호', '품 명', '규 격', '수 량', '비 고'];
  [['거울', '소', 2], ['2단 수평 볼트 보드', '', 1], ['A4용지', '80g', 5], ['신규 퍼즐 세트', '', 1]].forEach((r, i) => ws.getRow(4 + i).values = [i + 1, ...r]);
  await wb.xlsx.writeFile(f);
  const pre = await L.previewSupply(f), hdr = pre[0].rows.findIndex(r => r.some(c => /품명|품목|물품/.test(c.replace(/\s+/g, ''))));
  const cols = L.guessCols(pre[0].rows[hdr]); assert.strictEqual(hdr, 2); assert.strictEqual(cols.name, 1); assert.strictEqual(cols.qty, 3);
  const items2 = [{ id: 1, section: 'Activity', name: '2단 수평 볼트 보드', qty: 1, kind: '비품', note: '' }, { id: 2, section: 'ADL', name: '거울', qty: 4, kind: '비품', note: '' }];
  const got = await L.importSupply(f, { sheet: '신청서', headerRow: hdr, cols }, items2);
  assert.deepStrictEqual(got.map(g => g.name), ['거울', '2단 수평 볼트 보드', 'A4용지', '신규 퍼즐 세트']);
  assert.deepStrictEqual(got.map(g => g.matchKind), ['정확히 일치', '정확히 일치', '목록에 없음', '목록에 없음']); assert.strictEqual(got[2].qty, 5);
  console.log('신청서 가져오기 시험 OK');
})();
