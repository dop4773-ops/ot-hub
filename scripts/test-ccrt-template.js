// 사용: node scripts/test-ccrt-template.js "<2026 재활평가관리 OT통합.xlsx>" — 'CCRT명단' 원본 구조 그대로 채우는지 확인
const assert = require('assert'), os = require('os'), path = require('path'), fs = require('fs'), ExcelJS = require('exceljs');
const { buildCcrtTemplate } = require('../modules/eval/export'), { parseCycle } = require('../modules/eval/schedule');
(async () => {
  const f = process.argv[2], pre = new ExcelJS.Workbook(); await pre.xlsx.readFile(f); const P0 = parseCycle(pre.getWorksheet('CCRT명단'), 'ccrt').find(p => !p.dates[11] && !pre.getWorksheet('CCRT명단').getRow(p.row).hidden), N = P0.name, rows = [
    { name: N, doctor: '4', room: '814', weekdays: [1, 2, 4], kind: '루틴', date: '2026-11-09', status: '제안', note: '2개월 루틴' },
    { name: N, doctor: '4', room: '814', weekdays: [1, 2, 4], kind: '회복기 종료 전', date: '2026-11-03', status: '제안', note: 'COSAS', recoveryEnd: '2026-11-10' },
    { name: '신규환자', doctor: '8', room: '905', weekdays: [2, 4], kind: '루틴', date: '2026-11-12', status: '제안', note: '첫 평가', recoveryEnd: '2027-03-01' }];
  const { buffer, added } = await buildCcrtTemplate({ templateFile: f, rows, year: 2026, month: 11, today: '2026-10-31' }), out = path.join(os.tmpdir(), 'ccrt-tpl.xlsx'); fs.writeFileSync(out, buffer);
  assert.deepStrictEqual(added, ['신규환자']);
  const o = new ExcelJS.Workbook(), q = new ExcelJS.Workbook(); await o.xlsx.readFile(out); await q.xlsx.readFile(f);
  assert.deepStrictEqual(o.worksheets.map(w => w.name), ['CCRT명단', '11월 상세']); const ws = o.getWorksheet('CCRT명단'), src = q.getWorksheet('CCRT명단');
  for (const c of [2, 3, 4, 19, 20]) assert.strictEqual(ws.getColumn(c).width, src.getColumn(c).width, '열 너비');
  assert.strictEqual(ws.getCell('B2').value, src.getCell('B2').value);
  const list = parseCycle(ws, 'ccrt'), orig = parseCycle(src, 'ccrt'), hn = list.find(p => p.name === N), h0 = orig.find(p => p.name === N);
  assert.strictEqual(hn.dates[11], '2026-11-09'); assert.strictEqual(hn.dates[9], h0.dates[9], '이미 적힌 달은 그대로');
  const nw = list.find(p => p.name === '신규환자'); assert.ok(nw && nw.dates[11] === '2026-11-12' && nw.weekdays.join() === '2,4', '새 환자 줄');
  assert.ok(String(ws.getCell(`T${hn.row}`).value).includes('26.11.03'), 'COSAS 열');
  assert.strictEqual(ws.getCell(`Q${hn.row}`).numFmt, src.getCell(`Q${hn.row}`).numFmt, '날짜 표시 형식 유지');
  console.log('CCRT명단 원본 구조 추출 시험 OK →', out);
})();
