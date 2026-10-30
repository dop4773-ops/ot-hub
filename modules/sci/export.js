// 명단 → 새 .xlsx. 기존 'N월' 시트와 같은 열(번호·의사·병실·성명·비고).
const ExcelJS = require('exceljs');
const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };

function build({ month, rows }) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(`${month}월`);
  ws.columns = [{ width: 7 }, { width: 8 }, { width: 9 }, { width: 14 }, { width: 28 }];
  ws.mergeCells('A1:E1'); ws.getCell('A1').value = `${month}월 SCI 비회복기 명단(재원환자)`;
  ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A1').alignment = { horizontal: 'center' };
  ws.getRow(2).values = ['번호', '의사', '병실', '성명', '비고'];
  ws.getRow(2).eachCell(c => { c.font = { bold: true }; c.border = box; c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; });
  rows.forEach((r, i) => {
    const row = ws.getRow(3 + i); row.values = [i + 1, Number(r.doctor) || r.doctor, Number(r.room) || r.room, r.name, r.memo || ''];
    row.eachCell({ includeEmpty: true }, c => { c.border = box; c.alignment = { horizontal: 'center' }; });
  });
  return wb;
}
module.exports = { build };
