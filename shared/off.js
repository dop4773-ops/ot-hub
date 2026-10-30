// '2026 재활평가관리' 평가일정 시트 오른쪽 당직의/오프 달력(U:AA) → { 'YYYY-MM-DD': [{doctor, pm}] }  (eval-schedule과 같은 방식)
const ExcelJS = require('exceljs');
const { iso } = require('./dates');
const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); if (v.result != null) return String(v.result); return String(v); };

async function loadOff(file) {
  const ws = (await new ExcelJS.Workbook().xlsx.readFile(file)).getWorksheet('평가일정');
  const year = +txt(ws.getCell('Z3')), month = +txt(ws.getCell('AA3')), off = {};
  if (!year || !month) return { year, month, off };
  for (let r = 5; r <= 30; r += 2) {
    if (/비고/.test(txt(ws.getCell(r, 21)))) break;
    for (let c = 21; c <= 27; c++) {
      const day = +txt(ws.getCell(r, c)); if (!day) continue;
      const first = r === 5, mm = first && day > 7 ? month - 1 : (!first && r >= 13 && day < 8 ? month + 1 : month);
      const y = mm < 1 ? year - 1 : mm > 12 ? year + 1 : year, m = mm < 1 ? 12 : mm > 12 ? 1 : mm;
      const memo = txt(ws.getCell(r + 1, c)).trim(); if (!memo) continue;
      for (const tok of memo.split(/[\/,]+/)) { const d = tok.match(/\d/); if (d) (off[iso(y, m, day)] ??= []).push({ doctor: d[0], pm: /오후/.test(tok) }); }
    }
  }
  return { year, month, off };
}
module.exports = { loadOff };
