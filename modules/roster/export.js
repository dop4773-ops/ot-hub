// 원본 '환자 평가명단' 시트와 같은 열 구성: 주치의·병동·환자명·평가항목(PT)·평가항목(OT)·당월 평가일·비고·신환
const ExcelJS = require('exceljs');
const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
function build({ month, batch, rows }) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(`${month}월 평가일정`);
  ws.columns = [{ width: 9 }, { width: 8 }, { width: 14 }, { width: 38 }, { width: 28 }, { width: 14 }, { width: 36 }, { width: 28 }];
  ws.mergeCells('A1:F1'); ws.getCell('A1').value = '미래병원 주치의별 평가일정'; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getRow(2).values = ['주치의', '병동', '환자명', '평가항목(PT)', '평가항목(OT)', '당월 평가일', '비고', '신환'];
  ws.getRow(2).eachCell(c => { c.font = { bold: true }; c.border = box; c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; });
  rows.forEach((r, i) => {
    const row = ws.getRow(3 + i);
    const d = r.date ? new Date(r.date + 'T00:00:00Z') : null;
    row.values = [`RM${r.doctor}`, r.room, r.name, r.pt, r.ot, d, r.memo ?? r.notes.join(' · '), i === 0 ? batch || '' : ''];
    row.getCell(6).numFmt = 'yyyy-mm-dd';
    row.eachCell({ includeEmpty: true }, c => c.border = box);
  });
  return wb;
}

// POT 통합 평가명단 파일의 시트(글꼴·너비·테두리·날짜 표시 형식·오른쪽 안내표)를 그대로 열어 환자 줄만 새로 채운다.
async function buildFromTemplate({ templateFile, month, batch, rows }) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templateFile);
  const ws = wb.worksheets[0];
  const styleOf = c => ({ font: c.font, alignment: c.alignment, border: c.border, fill: c.fill, numFmt: c.numFmt });
  const base = Array.from({ length: 8 }, (_, i) => styleOf(ws.getCell(3, i + 1))), baseH = ws.getRow(3).height;
  for (let r = 3; r <= Math.max(ws.rowCount, rows.length + 2); r++) for (let c = 1; c <= 8; c++) { const cell = ws.getCell(r, c); cell.value = null; }
  rows.forEach((x, i) => {
    const r = 3 + i, vals = [`RM${x.doctor}`, x.room, x.name, x.pt, x.ot, x.date ? new Date(x.date + 'T00:00:00Z') : null, x.memo ?? (x.notes || []).join(' · '), i === 0 && batch ? batch : x.isNew ? '신환' : ''];
    vals.forEach((v, c) => { const cell = ws.getCell(r, c + 1); cell.value = v; if (r > 18 || !cell.border || !cell.border.left) Object.assign(cell, { font: base[c].font, alignment: base[c].alignment, border: base[c].border, fill: base[c].fill, numFmt: base[c].numFmt }); });
    if (baseH) ws.getRow(r).height = baseH;
  });
  for (const other of wb.worksheets.slice(1)) wb.removeWorksheet(other.id);
  ws.name = `${month}월 평가일정 `;
  return wb;
}
module.exports = { build, buildFromTemplate };
