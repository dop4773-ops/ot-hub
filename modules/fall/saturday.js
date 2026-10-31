// '작업치료실 토요일&공휴일 시간표.xlsx' — 시트 이름 'M.DD(N팀)'이 그날 근무하는 팀, 2행이 근무 치료사 줄.
//  · 이름 뒤 'OT'가 붙은 사람은 그 팀이 아닌 지원(제외)
//  · 그 치료사의 환자 칸에 빨간 굵은 테두리가 많으면(기본 5칸 이상 — 시험한 시트에서 3층 근무자는 7~23칸, 다른 용도로 칠한 칸은 1~4칸이었다) 그날은 3층에서 근무 → 10층 낙상 순회에서 뺀다
const ExcelJS = require('exceljs');
const { memo } = require('../../shared/cache');
const SHEET = /^\s*(\d{1,2})\.(\d{1,2})\s*\(.*?([1-3])\s*팀.*\)\s*$/;
const isRed = c => { const b = c.border || {}; return ['left', 'right', 'top', 'bottom'].some(k => b[k] && b[k].color && /FF0000$/i.test(String(b[k].color.argb || ''))); };
const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); return String(v.result ?? v); };

async function parse(file) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file), out = {};
  for (const ws of wb.worksheets) {
    const m = ws.name.match(SHEET); if (!m) continue;
    const a1 = txt(ws.getCell(1, 1)), y = (a1.match(/^(\d{4})-/) || [])[1] || String(new Date().getFullYear());
    const date = `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`, people = [];
    for (let c = 2; c <= 40; c++) {
      const h = txt(ws.getCell(2, c)).replace(/\s+/g, ' ').trim(); if (/치료시간/.test(h) && c > 2) break; if (!h || /^S\d|^s\d|^V\d|치료사/.test(h)) continue;
      let total = 0, red = 0; for (let r = 3; r <= 27; r++) { const cell = ws.getCell(r, c); if (cell.value != null && cell.value !== '') { total++; if (isRed(cell)) red++; } }
      people.push({ name: h.replace(/OT$/, ''), extra: /OT$/.test(h), red, total });
    }
    out[date] = { team: Number(m[3]), sheet: ws.name, people };
  }
  return out;
}
module.exports = { loadSaturdays: f => memo('saturdays', f, () => parse(f)), RED_MIN: 5 };
