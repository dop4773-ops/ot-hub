// 배정 결과 → 새 .xlsx (원본 xlsm은 건드리지 않는다). 서식은 기존 '2026.10~' 시트 모양을 따른다.
const ExcelJS = require('exceljs');

const thin = { style: 'thin' };
const box = { top: thin, left: thin, bottom: thin, right: thin };

// rows: [{zone, role, name}] 연속된 같은 zone은 A열을 병합한다.
function writeTable(ws, rows, top) {
  ws.getRow(top).values = ['청소구역', '역할', '담당선생님'];
  ws.getRow(top).font = { bold: true };
  ws.getRow(top).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; c.border = box; c.alignment = { horizontal: 'center' }; });
  let r = top + 1, start = r, prev = null;
  const flush = end => { if (prev != null && end > start) ws.mergeCells(start, 1, end, 1); };
  rows.forEach((x, i) => {
    if (x.zone !== prev) { flush(r - 1); start = r; prev = x.zone; ws.getCell(r, 1).value = x.zone; }
    ws.getCell(r, 2).value = x.role; ws.getCell(r, 3).value = x.name;
    [1, 2, 3].forEach(c => { const cell = ws.getCell(r, c); cell.border = box; cell.alignment = { vertical: 'middle', wrapText: true }; });
    r++;
  });
  flush(r - 1);
  return r;
}

function build({ title, sheetName, date, cells, fixed = [], big = null }) {
  const wb = new ExcelJS.Workbook();
  const sheet = (name, rows, extra) => {
    const ws = wb.addWorksheet(name);
    ws.columns = [{ width: 30 }, { width: 26 }, { width: 22 }, { width: 3 }, { width: 18 }, { width: 14 }];
    ws.getCell('A2').value = title; ws.getCell('A2').font = { bold: true, size: 14 };
    ws.getCell('C3').value = date;
    const end = writeTable(ws, rows, 4);
    extra && extra(ws, end);
  };
  const base = cells.map(c => ({ zone: c.zone, role: c.role, name: c.name }));
  const fx = fixed.map(f => ({ zone: f.zone, role: '', name: f.who }));
  sheet(sheetName, base.concat(fx));
  if (big) {
    const vac = new Map(big.vacated.map(c => [c, c]));
    const rows = [{ zone: '도구장 정리 / 도구 소독', role: '', name: big.tool[0] || '' }]
      .concat(big.tool.slice(1).map(n => ({ zone: '도구장 정리 / 도구 소독', role: '', name: n })))
      .concat(cells.map(c => ({ zone: c.zone, role: c.role,
        name: vac.has(c) ? (c.support ? `${c.support} (지원)` : '(지원배치 필요)') : c.name })))
      .concat(fx);
    sheet('대청소', rows, ws => {
      ws.getCell('E4').value = '에어컨 필터 청소'; ws.getCell('E4').font = { bold: true };
      big.airFilters.forEach((a, i) => { ws.getCell(5 + i, 5).value = a.place; ws.getCell(5 + i, 6).value = a.who ? `${a.n}개 · ${a.who}` : `${a.n}개`; });
      ws.getCell('E13').value = '평일 청소 업무 외 + 보바스매트/매트 사이 먼지 제거, 보바스 프레임 먼지제거와 치료도구소독 추가';
    });
  }
  return wb;
}

module.exports = { build };
