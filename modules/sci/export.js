// SCI 비회복기 명단 내보내기 — 명단 파일의 가장 최근 월 시트(제목·글꼴·열 너비·테두리·행 높이)를 그대로 쓰고 줄만 새로 쓴다.
const ExcelJS = require('exceljs');
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const sty = c => ({ font: clone(c.font), alignment: clone(c.alignment), border: clone(c.border), fill: clone(c.fill), numFmt: c.numFmt });
const paint = (c, st) => { c.font = clone(st.font); c.alignment = clone(st.alignment); c.border = clone(st.border); c.fill = clone(st.fill); if (st.numFmt) c.numFmt = st.numFmt; };
const plain = v => v == null ? '' : v.richText ? v.richText.map(t => t.text).join('') : String(v.result ?? v);

async function buildFromTemplate({ templateFile, month, rows }) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templateFile);
  const months = wb.worksheets.filter(w => /^\d{1,2}월$/.test(w.name)).sort((a, b) => parseInt(a.name) - parseInt(b.name)), ws = months[months.length - 1];
  if (!ws) throw new Error("명단 파일에서 'N월' 시트를 찾지 못했습니다");
  const proto = Array.from({ length: 5 }, (_, i) => sty(ws.getCell(3, i + 1))), h = ws.getRow(3).height;
  const last = Math.max(ws.rowCount, rows.length + 2);
  Object.values(ws._merges).map(m => m.model).filter(m => m.top >= 3).forEach(m => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
  for (let r = 3; r <= last; r++) for (let c = 1; c <= 8; c++) { const cell = ws.getCell(r, c); cell.value = null; if (r > rows.length + 2) cell.style = {}; }
  rows.forEach((x, i) => {
    const r = 3 + i; [i + 1, Number(x.doctor) || x.doctor, Number(x.room) || x.room, x.name, x.memo || null].forEach((v, c) => { const cell = ws.getCell(r, c + 1); paint(cell, proto[c]); cell.value = v; });
    if (h) ws.getRow(r).height = h;
  });
  const t = ws.getCell(1, 1); t.value = plain(t.value).replace(/^\d{1,2}월/, `${month}월`);
  for (const other of wb.worksheets.filter(x => x !== ws)) wb.removeWorksheet(other.id);
  ws.name = `${month}월`;
  return wb;
}
module.exports = { buildFromTemplate };
