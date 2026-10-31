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

// 재활평가관리 파일의 'CCRT명단' 시트(원본 구조: B치료실 C병실 D이름 E RM F요일 G~R 1~12월 S회복기 종료 T COSAS)를 엑셀 파일 안쪽에서 직접 고쳐 이번 달 평가일만 채운다.
//  · 루틴/퇴원 전 → 이번 달 칸, 회복기 종료 전(COSAS) → T열(yy.MM.dd 글자, 원본과 같은 모양) · 명단에 없는 환자는 맨 아래에 새 줄 · 이미 적힌 날짜는 건드리지 않는다
//  · 같은 달에 평가가 둘 이상(루틴 + 사건)이면 이번 달 칸에는 앞선 것을 넣고, 전부는 '이번 달 상세' 시트에 적는다
const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const serial = d => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5);
const yymmdd = d => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
async function buildCcrtTemplate({ templateFile, rows, year, month, today = new Date().toISOString().slice(0, 10) }) {
  const Z = require('../../shared/zipx'), zip = await Z.loadZip(templateFile), ss = await Z.sharedStrings(zip);
  const path = await Z.keepOnlySheet(zip, 'CCRT명단', 'CCRT명단'); let xml = await zip.file(path).async('string');
  const rowOf = {}; let last = 2; for (let r = 3; r <= 400; r++) { const n = Z.cellValue(xml, `D${r}`, ss).trim(); if (n) { (rowOf[n] ??= r); last = r; } }
  const mc = colName(7 + month - 1), WK = ['일', '월', '화', '수', '목', '금', '토'], put = (ref, v) => { xml = Z.setCell(xml, ref, v, Z.styleOf(xml, ref.replace(/\d+$/, '3')) || Z.styleOf(xml, ref.replace(/\d+$/, '4'))); }, empty = ref => !Z.cellValue(xml, ref, ss).trim();
  const planned = rows.filter(x => x.date && x.status !== '제외'), added = [];
  for (const x of [...planned].sort((a, b) => a.date < b.date ? -1 : 1)) {
    let r = rowOf[x.name];
    if (!r) { r = rowOf[x.name] = ++last; added.push(x.name); put(`B${r}`, 10); put(`C${r}`, Number(x.room) || x.room); put(`D${r}`, x.name); put(`E${r}`, Number(x.doctor) || x.doctor); put(`F${r}`, (x.weekdays || []).map(n => WK[n]).join('')); if (x.recoveryEnd) put(`S${r}`, yymmdd(x.recoveryEnd)); }
    if (x.kind === '회복기 종료 전') put(`T${r}`, yymmdd(x.date));
    else if (x.status !== '입력됨' && empty(`${mc}${r}`)) put(`${mc}${r}`, serial(x.date));
  }
  put('V1', serial(today)); zip.file(path, xml);
  const wd = d => WK[new Date(d + 'T00:00:00Z').getUTCDay()];
  const detail = [['날짜', '요일', '환자', 'RM', '병실', '종류', '치료요일', '직전 평가', '비고'],
    ...[...rows].filter(x => x.date).sort((a, b) => a.date < b.date ? -1 : 1).map(x => [x.date, wd(x.date), x.name, `RM${x.doctor}`, x.room, x.kind, (x.weekdays || []).map(n => WK[n]).join(''), x.prev || '', [x.note, x.ttMsg, ...(x.issues || []).map(i => i.msg)].filter(Boolean).join(' · ')])];
  if (added.length) detail.push([], ['명단에 없어 새 줄로 추가한 환자: ' + added.join(', ')]);
  await Z.addSheet(zip, `${month}월 상세`, detail, [12, 6, 12, 6, 7, 14, 10, 12, 60]);
  return { buffer: await Z.save(zip), added };
}
module.exports = { build, buildCycle, buildCcrtTemplate };
