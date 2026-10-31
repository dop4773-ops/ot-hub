// 출근부 xlsx 생성 — 기존 '26년_7월_출근부_자동화.xlsx'와 같은 틀: 반월(1~15일 / 16~말일) 시트, 6명씩 한 블록(날짜 열 + 사람당 [출,퇴근 시간|서명] 2열),
// 날짜마다 출근·퇴근 두 줄. 요일 색: 토 파랑, 일 빨강, 공휴일 빨강+회색 바탕.
const ExcelJS = require('exceljs');
const { daysInMonth, iso, dow } = require('../../shared/dates');

const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const BLUE = 'FF2563EB', RED = 'FFDC2626', GRAY = 'FFD1D5DB';

function dayStyle(date, holidays) {
  if (holidays.has(date)) return { color: RED, fill: GRAY };
  const w = dow(date);
  return w === 0 ? { color: RED, fill: GRAY } : w === 6 ? { color: BLUE } : {};
}

function buildSheet(wb, { year, month, floorLabel, names, half, holidays, perBlock, workWeekend }) {
  const dim = daysInMonth(year, month), from = half === 1 ? 1 : 16, to = half === 1 ? 15 : dim;
  const ws = wb.addWorksheet(half === 1 ? '출근부(1~15일)' : '출근부(16~말일)');
  const blocks = []; for (let i = 0; i < names.length; i += perBlock) blocks.push(names.slice(i, i + perBlock));
  const W = 1 + perBlock * 2;                                  // 블록 폭
  ws.getRow(1).height = 22;
  blocks.forEach((people, b) => {
    const c0 = 1 + b * W;
    ws.getColumn(c0).width = 7;
    for (let k = 0; k < perBlock; k++) { ws.getColumn(c0 + 1 + k * 2).width = 11; ws.getColumn(c0 + 2 + k * 2).width = 9; }
    ws.mergeCells(1, c0, 1, c0 + W - 1);
    const t = ws.getCell(1, c0); t.value = `${year}년 ${month}월 미래병원 ${floorLabel} 재활 출근부`; t.font = { bold: true, size: 13 }; t.alignment = { horizontal: 'center' };
    ws.getCell(4, c0).value = '이름'; ws.getCell(5, c0).value = '날짜';
    people.forEach((n, k) => {
      const c = c0 + 1 + k * 2; ws.mergeCells(4, c, 4, c + 1); ws.getCell(4, c).value = n;
      ws.getCell(5, c).value = '출,퇴근 시간'; ws.getCell(5, c + 1).value = '서명';
    });
    for (const r of [4, 5]) for (let c = c0; c < c0 + W; c++) { const cell = ws.getCell(r, c); cell.border = box; cell.font = { bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; }
    for (let d = from, r = 6; d <= to; d++, r += 2) {
      const date = iso(year, month, d), st = dayStyle(date, holidays), special = st.color && (workWeekend || !st.color);
      ws.mergeCells(r, c0, r + 1, c0);
      const dc = ws.getCell(r, c0); dc.value = `${d}\n(${WD[dow(date)]})`; dc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      dc.font = { bold: true, color: st.color ? { argb: st.color } : undefined };
      for (let rr = r; rr <= r + 1; rr++) for (let c = c0; c < c0 + W; c++) {
        const cell = ws.getCell(rr, c); cell.border = box;
        if (c > c0 && (c - c0) % 2 === 1) { cell.value = rr === r ? '출근' : '퇴근'; cell.alignment = { horizontal: 'center' }; cell.font = { color: st.color ? { argb: st.color } : undefined }; }
        if (st.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } };
      }
      // 빈 명단 칸(마지막 블록의 남는 자리)은 값 없이 둔다
      const used = people.length; for (let k = used; k < perBlock; k++) { ws.getCell(r, c0 + 1 + k * 2).value = null; ws.getCell(r + 1, c0 + 1 + k * 2).value = null; }
    }
  });
  return ws;
}

function build({ year, month, floorLabel, names, holidays = [], perBlock = 6, workWeekend = true }) {
  const wb = new ExcelJS.Workbook(), hs = new Set(holidays);
  for (const half of [1, 2]) buildSheet(wb, { year, month, floorLabel, names, half, holidays: hs, perBlock, workWeekend });
  return wb;
}
// 설정에 공휴일이 없을 때 쓰는 고정일 공휴일(음력·대체·선거일은 사용자가 추가)
const fixedHolidays = year => ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'].map(md => `${year}-${md}`);
module.exports = { build, fixedHolidays, dayStyle };
