// '2026 재활평가관리 OT통합.xlsx'의 평가일정 시트 → 환자 목록 + 당직의/오프 달력
const ExcelJS = require('exceljs');
const { memo } = require('../../shared/cache');
const { open } = require('../../shared/xl');
const { iso, fromCell } = require('../../shared/dates');

const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); if (v.result != null) return String(v.result); return String(v); };
const doctorOf = v => (String(v).match(/\d/) || [''])[0];     // 'RM4' / 4 → '4'

// 환자 행: B=입원/퇴원, C=주치의, E=병실, F=이름, G=평가항목, H..S=1~12월 평가일
function parsePatients(ws) {
  const out = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, 6)).trim(); if (!name) continue;
    const dates = {};
    for (let m = 1; m <= 12; m++) { const d = fromCell(ws.getCell(r, 7 + m).value); if (d) dates[m] = d; }
    out.push({ row: r, status: txt(ws.getCell(r, 2)).trim(), doctor: doctorOf(txt(ws.getCell(r, 3))), room: txt(ws.getCell(r, 5)).trim(),
      name, items: txt(ws.getCell(r, 7)).trim(), dates });
  }
  return out;
}

// 주치의 off 달력(U:AA, 요일 머리글 아래 [날짜행, 메모행] 반복). 메모: '8' '4' 'RM7(오후)' 'RM9/RM8(오후)' 'RM7,9'
// 반환: { year, month, off: { 'YYYY-MM-DD': [{doctor:'8', pm:false}] } }
function parseOffCalendar(ws) {
  const year = +txt(ws.getCell('Z3')), month = +txt(ws.getCell('AA3'));
  const off = {};
  if (!year || !month) return { year, month, off };
  for (let r = 5; r <= 30; r += 2) {
    if (/비고/.test(txt(ws.getCell(r, 21)))) break;
    for (let c = 21; c <= 27; c++) {                           // U..AA = 일..토
      const day = +txt(ws.getCell(r, c)); if (!day) continue;
      const first = r === 5;                                    // 첫 주의 큰 숫자는 전달, 마지막 주의 작은 숫자는 다음 달
      const mm = first && day > 7 ? month - 1 : (!first && r >= 13 && day < 8 ? month + 1 : month);
      const y = mm < 1 ? year - 1 : mm > 12 ? year + 1 : year, m = mm < 1 ? 12 : mm > 12 ? 1 : mm;
      const memo = txt(ws.getCell(r + 1, c)).trim(); if (!memo) continue;
      for (const tok of memo.split(/[\/,]+/)) {
        const d = tok.match(/\d/); if (!d) continue;
        (off[iso(y, m, day)] ??= []).push({ doctor: d[0], pm: /오후/.test(tok) });
      }
    }
  }
  return { year, month, off };
}

const loadSchedule = file => memo('schedule', file, () => parseSchedule(file));
async function parseSchedule(file) {
  const wb = await open(file);
  const ws = wb.getWorksheet('평가일정'); if (!ws) throw new Error("'평가일정' 시트를 찾지 못했습니다");
  return { patients: parsePatients(ws), calendar: parseOffCalendar(ws) };
}

module.exports = { loadSchedule, parsePatients, parseOffCalendar };

// CCRT명단: B치료실 C병실 D이름 E RM F치료요일(월화목) G..R 1~12월 S퇴원예정(YY.MM.DD)
// 산재명단: B병실 C이름 D RM E비고 F..Q 1~12월
const WD_ALL = '일월화수목금토';
const ymd = v => { const m = String(v || '').match(/^(\d{2})\.(\d{2})\.(\d{2})$/); return m ? `20${m[1]}-${m[2]}-${m[3]}` : null; };
function parseCycle(ws, kind) {
  const c = kind === 'ccrt' ? { room: 3, name: 4, doc: 5, note: 6, m1: 7, dis: 19 } : { room: 2, name: 3, doc: 4, note: 5, m1: 6, dis: 0 };
  const out = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, c.name)).trim(); if (!name) continue;
    const dates = {}; for (let m = 1; m <= 12; m++) { const d = fromCell(ws.getCell(r, c.m1 + m - 1).value); if (d) dates[m] = d; }
    const note = txt(ws.getCell(r, c.note)).trim();
    const weekdays = kind === 'ccrt' ? [...note].map(ch => WD_ALL.indexOf(ch)).filter(i => i > 0) : [];
    out.push({ row: r, name, room: txt(ws.getCell(r, c.room)).trim(), doctor: doctorOf(txt(ws.getCell(r, c.doc))), note, weekdays,
      dates, discharge: c.dis ? ymd(txt(ws.getCell(r, c.dis)).trim()) : null,
      skip: kind === 'sanjae' && /시행X|중단/.test(note) });
  }
  return out;
}
const loadCycles = file => memo('cycles', file, () => parseCycles(file));
async function parseCycles(file) {
  const wb = await open(file);
  return { ccrt: parseCycle(wb.getWorksheet('CCRT명단'), 'ccrt'), sanjae: parseCycle(wb.getWorksheet('산재명단'), 'sanjae') };
}
module.exports.loadCycles = loadCycles; module.exports.parseCycle = parseCycle;
