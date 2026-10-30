// 확정한 평가일 → 새 .xlsx (원본은 건드리지 않는다)
const ExcelJS = require('exceljs');
const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const wdOf = s => WD[new Date(s + 'T00:00:00Z').getUTCDay()];

function build({ rows, year, month }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${month}월 평가일정`);
  ws.columns = [{ width: 8 }, { width: 8 }, { width: 14 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 40 }];
  ws.getCell('A1').value = `${year}년 ${month}월 평가일정 (초안)`; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getRow(3).values = ['주치의', '병실', '환자명', '평가항목', '직전 평가일', '이번 평가일', '비고'];
  ws.getRow(3).eachCell(c => { c.font = { bold: true }; c.border = box; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; });
  const sorted = [...rows].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : a.date === b.date ? Number(a.doctor) - Number(b.doctor) : 1);
  sorted.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    row.values = [`RM${r.doctor}`, r.room, r.name, r.items, r.prev || '', r.date ? `${r.date} (${wdOf(r.date)})` : '', (r.issues || []).map(x => x.msg).join(' · ')];
    row.eachCell({ includeEmpty: true }, c => c.border = box);
    if ((r.issues || []).some(x => x.level === 'err')) row.getCell(7).font = { color: { argb: 'FFC00000' } };
  });
  const by = wb.addWorksheet('일자별');
  by.columns = [{ width: 16 }, { width: 8 }, { width: 90 }];
  by.getRow(1).values = ['날짜', '인원', '환자'];
  by.getRow(1).eachCell(c => { c.font = { bold: true }; c.border = box; });
  const groups = {}; rows.forEach(r => r.date && (groups[r.date] ??= []).push(`${r.name}(RM${r.doctor})`));
  Object.keys(groups).sort().forEach((d, i) => { by.getRow(2 + i).values = [`${d} (${wdOf(d)})`, groups[d].length, groups[d].join(', ')]; by.getRow(2 + i).eachCell(c => c.border = box); });
  return wb;
}
function buildCycle({ rows, year, month, kind }) {
  const wb = new ExcelJS.Workbook(), title = kind === 'ccrt' ? 'CCRT' : '산재(MMSE/GDS)';
  const ws = wb.addWorksheet(`${month}월 ${title}`);
  ws.columns = [{ width: 8 }, { width: 8 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 10 }, { width: 44 }];
  ws.getCell('A1').value = `${year}년 ${month}월 ${title} 평가일정 (초안)`; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getRow(3).values = ['주치의', '병실', '환자명', '치료요일', '직전 평가일', '이번 평가일', '상태', '비고'];
  ws.getRow(3).eachCell(c => { c.font = { bold: true }; c.border = box; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; });
  const WK = ['일', '월', '화', '수', '목', '금', '토'];
  [...rows].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1).forEach((r, i) => {
    const row = ws.getRow(4 + i);
    row.values = [`RM${r.doctor}`, r.room, r.name, (r.weekdays || []).map(n => WK[n]).join(''), r.prev || '', r.date ? `${r.date} (${wdOf(r.date)})` : '', r.status,
      [r.note, ...(r.issues || []).map(x => x.msg)].filter(Boolean).join(' · ')];
    row.eachCell({ includeEmpty: true }, c => c.border = box);
    if ((r.issues || []).some(x => x.level === 'err')) row.getCell(8).font = { color: { argb: 'FFC00000' } };
  });
  return wb;
}
module.exports = { build, buildCycle };
