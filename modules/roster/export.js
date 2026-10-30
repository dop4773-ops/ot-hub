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
module.exports = { build };
