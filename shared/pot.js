// '환자 평가명단 - POT 통합 N월 (N차).xlsx' — OT·PT 통합 평가일. 직전 평가일의 출처(재활평가관리 파일은 CCRT 평가일만 쓴다).
//  시트 한 장(예: '11월 평가일정'): 3행부터 A주치의 B병동 C환자명 D평가항목(PT) E평가항목(OT) F당월 평가일 G비고 H신환
const { open, txt } = require('./xl');
const { memo } = require('./cache');
const day = c => { const v = c && c.value; const x = v && v.result !== undefined ? v.result : v; return x instanceof Date && !isNaN(x) ? x.toISOString().slice(0, 10) : null; };

async function parseOne(file) {
  const ws = (await open(file)).worksheets[0], rows = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, 3)).trim(), date = day(ws.getCell(r, 6)); if (!name) continue;
    rows.push({ name, date, doctor: (txt(ws.getCell(r, 1)).match(/\d/) || [''])[0], room: txt(ws.getCell(r, 2)).trim(), pt: txt(ws.getCell(r, 4)).trim(), ot: txt(ws.getCell(r, 5)).trim(), note: txt(ws.getCell(r, 7)).trim(), tag: txt(ws.getCell(r, 8)).trim() });
  }
  const dates = rows.map(x => x.date).filter(Boolean).sort();
  return { file, sheet: ws.name, rows, month: dates.length ? dates[Math.floor(dates.length / 2)].slice(0, 7) : null };
}
// 여러 파일 → { byName: { 이름: { 'YYYY-MM': 'YYYY-MM-DD' } }, files: [{file, sheet, month, n}] }  (같은 달 파일이 둘이면 더 늦은 날짜는 덮어쓰지 않고 먼저 것을 둔다 — 1차/2차 모두 쓰기 위해 합친다)
async function loadPot(files) {
  const list = []; for (const f of files) list.push(await parseOne(f));
  const byName = {};
  for (const p of list) for (const r of p.rows) if (r.date) (byName[r.name] ??= {})[r.date.slice(0, 7)] = r.date;
  return { byName, files: list.map(p => ({ file: p.file, sheet: p.sheet, month: p.month, n: p.rows.length })) };
}
module.exports = { loadPot: files => memo('pot', files, () => loadPot(files)), parseOne };
