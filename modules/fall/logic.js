// 낙상방지 순회 체크리스트 — 읽기(치료사명단·월별 이력)·배정·엑셀 만들기.
//  · 하루 11개 순회 시간(09:00~16:30, 5분씩) 각각에 치료사 한 명. 월~금은 한 주 동안 같은 사람(주 단위), 토요일은 팀(1·2·3팀) 교대.
//  · 평일 후보 = 치료사명단 '평일(10층)' 목록(육아휴직 제외), 토요일 후보 = 그 주 차례인 팀 목록.
//  · 공평: 지난 시트들의 평일 주(週) 횟수·토요일 횟수가 적은 사람 먼저, 같은 시간대를 연달아 맡지 않도록 시간대를 돌린다.
const { txt, open } = require('../../shared/xl');
const { memo } = require('../../shared/cache');
const { iso, addDays, dow, daysInMonth } = require('../../shared/dates');

const SLOTS = ['09:00 ~ 09:05', '09:35 - 09:40', '10:10 - 10:15', '10:45 - 10:50', '11:20 - 11:25', '13:30 - 13:35', '14:05 - 14:10', '14:40 - 14:45', '15:15 - 15:20', '15:50 - 15:55', '16:25 - 16:30'];
const NAME = /^[가-힣]{2,4}\s?[가-힣]?[A-Z]?$/;
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const WD = ['일', '월', '화', '수', '목', '금', '토'];

/* ---------- 읽기 ---------- */
// '치료사명단': B 평일(10층) · E 평일(3층) · G/I/K 토요일 1/2/3팀 · M~O 휴직·단축(이름, 기간, 구분)
async function parseRoster(file) {
  const ws = (await open(file)).getWorksheet('치료사명단'); if (!ws) throw new Error("'치료사명단' 시트를 찾지 못했습니다");
  const col = c => { const out = []; for (let r = 3; r <= ws.rowCount; r++) { const n = clean(txt(ws.getCell(r, c))); if (n && NAME.test(n) && !/^(3층|10층)$/.test(n)) out.push(n); } return out; };
  const leave = []; for (let r = 3; r <= ws.rowCount; r++) { const n = clean(txt(ws.getCell(r, 13))); if (n && NAME.test(n)) leave.push({ name: n, period: clean(txt(ws.getCell(r, 14))), kind: clean(txt(ws.getCell(r, 15))) }); }
  return { weekday10: col(2), weekday3: col(5), sat: { 1: col(7), 2: col(9), 3: col(11) }, leave };
}
// 월별 시트 → 이력. 시트 하나에 날짜 표가 위아래 두 개(3행·20행 머리글 근처). 날짜 열 = D,F,H… (확인 열 사이)
function parseMonth(ws) {
  const days = [];
  for (const top of [3, 20]) {
    for (let c = 4; c <= ws.columnCount; c += 2) {
      const wd = clean(txt(ws.getCell(top + 2, c))), day = Number(txt(ws.getCell(top, c + 1)));
      if (!WD.includes(wd) || !day) continue;
      const names = []; for (let i = 0; i < 11; i++) names.push(clean(txt(ws.getCell(top + 4 + i + (i >= 5 ? 1 : 0), c))));
      days.push({ day, wd, names });
    }
  }
  return days;
}
async function parseHistory(file) {
  const wb = await open(file), out = {};
  for (const ws of wb.worksheets) { const m = ws.name.match(/^(\d{1,2})월$/); if (m) out[Number(m[1])] = parseMonth(ws); }
  return out;
}
const loadRoster = f => memo('fallRoster', f, () => parseRoster(f));
const loadHistory = f => memo('fallHistory', f, () => parseHistory(f));

/* ---------- 배정 ---------- */
// 이력 집계: 평일 주 횟수(월~금 중 하루라도 맡은 주를 1로), 토요일 횟수, 사람별 마지막 시간대
function tally(history) {
  const wk = {}, sat = {}, lastSlot = {}, slotCnt = {};
  for (const m of Object.keys(history).map(Number).sort((a, b) => a - b)) {
    let prevWeekKey = null;
    for (const d of history[m]) {
      d.names.forEach((n, i) => { if (!n || !NAME.test(n)) return;
        if (d.wd === '토') sat[n] = (sat[n] || 0) + 1;
        else { const k = `${m}-${weekOf(d)}`; (wk[n] ??= new Set()).add(k); lastSlot[n] = i; (slotCnt[n] ??= Array(11).fill(0))[i]++; } });
    }
  }
  return { wk: Object.fromEntries(Object.entries(wk).map(([n, s]) => [n, s.size])), sat, lastSlot, slotCnt };
}
const weekOf = d => Math.floor((d.day - 1 + 0) / 7);            // 이력 집계용 대략적인 주 구분(같은 요일 묶음)

function weeksOf(year, month, holidays) {
  const dim = daysInMonth(year, month), weeks = []; let cur = null;
  for (let d = 1; d <= dim; d++) {
    const date = iso(year, month, d), w = dow(date);
    if (w === 0) { cur = null; continue; }                          // 일요일은 표에 없다
    if (!cur || w === 1) { cur = { days: [] }; weeks.push(cur); }
    cur.days.push({ day: d, date, wd: WD[w], holiday: holidays[date] || null });
  }
  return weeks;
}

function generate({ year, month, roster, history = {}, holidays = {}, startTeam = null, seed = 1 }) {
  const rnd = (() => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const T = tally(history), onLeave = new Set(roster.leave.filter(l => /휴직/.test(l.kind)).map(l => l.name));
  const pool = roster.weekday10.filter(n => !onLeave.has(n));
  const weeks = weeksOf(year, month, holidays), wcnt = { ...T.wk }, scnt = { ...T.sat }, last = { ...T.lastSlot };
  // 마지막 토요일 팀(이력의 가장 마지막 달 마지막 토요일) 다음 팀부터
  let team = startTeam;
  if (!team) { const ms = Object.keys(history).map(Number).sort((a, b) => b - a); let lastSat = null; for (const m of ms) { const sats = history[m].filter(d => d.wd === '토' && d.names.some(Boolean)); if (sats.length) { lastSat = sats[sats.length - 1]; break; } }
    const who = lastSat && lastSat.names.find(n => n && NAME.test(n)); const t = who ? [1, 2, 3].find(k => roster.sat[k].includes(who)) : 0; team = (t % 3) + 1; }
  const out = [];
  for (const wk of weeks) {
    const weekdays = wk.days.filter(d => d.wd !== '토' && !d.holiday), sat = wk.days.find(d => d.wd === '토' && !d.holiday);
    const slotsOf = { };                                           // 평일 11칸: 시간대 i → 사람
    if (weekdays.length) {
      const order = [...pool].sort((a, b) => (wcnt[a] || 0) - (wcnt[b] || 0) || rnd() - 0.5), chosen = order.slice(0, 11);
      // 사람마다 지난번 맡은 시간대와 다른 칸, 그리고 그 시간대를 적게 맡은 칸으로 — 사람 순서대로 가장 알맞은 빈 칸을 고른다
      const free = new Set(SLOTS.map((_, i) => i)), assign = {};
      for (const n of chosen.sort((a, b) => (T.slotCnt[b] ? 1 : 0) - (T.slotCnt[a] ? 1 : 0) || rnd() - 0.5)) {
        let best = null; for (const i of free) { const c = (last[n] === i ? 100 : 0) + ((T.slotCnt[n] || [])[i] || 0) + rnd() * 0.5; if (!best || c < best.c) best = { i, c }; }
        assign[best.i] = n; free.delete(best.i); wcnt[n] = (wcnt[n] || 0) + 1; last[n] = best.i;
      }
      for (let i = 0; i < 11; i++) slotsOf[i] = assign[i] || '';
    }
    const satNames = [];
    if (sat) {
      const mine = roster.sat[team].filter(n => !onLeave.has(n)), others = [1, 2, 3].filter(t => t !== team).flatMap(t => roster.sat[t]).filter(n => !onLeave.has(n) && !mine.includes(n));
      const pick = [...mine].sort((a, b) => (scnt[a] || 0) - (scnt[b] || 0) || rnd() - 0.5).slice(0, 11);
      if (pick.length < 11) pick.push(...others.sort((a, b) => (scnt[a] || 0) - (scnt[b] || 0)).slice(0, 11 - pick.length));
      pick.forEach(n => scnt[n] = (scnt[n] || 0) + 1); satNames.push(...pick);
    }
    out.push({ team: sat ? team : null, days: wk.days.map(d => ({ ...d, names: d.holiday ? Array(11).fill('') : d.wd === '토' ? (d.date === sat?.date ? satNames.slice(0, 11) : Array(11).fill('')) : SLOTS.map((_, i) => slotsOf[i] || '') })) });
    if (sat) team = (team % 3) + 1;
  }
  return { weeks: out, team };
}

// 점검: 하루에 같은 사람이 두 번, 휴직자, 빈칸
function check({ weeks, roster }) {
  const leave = new Set(roster.leave.filter(l => /휴직/.test(l.kind)).map(l => l.name)), issues = [];
  for (const wk of weeks) for (const d of wk.days) {
    if (d.holiday) continue;
    const seen = new Set(); d.names.forEach((n, i) => { if (!n) issues.push({ date: d.date, slot: i, msg: '빈칸' }); else { if (seen.has(n)) issues.push({ date: d.date, slot: i, msg: `${n} 하루에 두 번` }); seen.add(n); if (leave.has(n)) issues.push({ date: d.date, slot: i, msg: `${n} 휴직 중` }); } });
  }
  return issues;
}

/* ---------- 엑셀 ---------- */
const ExcelJS = require('exceljs');
function build({ year, month, weeks }) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(`${month}월`), thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
  const days = weeks.flatMap(w => w.days), halves = [days.filter(d => d.day <= 15), days.filter(d => d.day > 15)];
  ws.getColumn(1).width = 3; ws.getColumn(2).width = 5; ws.getColumn(3).width = 15;
  let top = 1;
  for (const half of halves) {
    if (!half.length) continue;
    ws.mergeCells(top, 4, top, 4 + half.length * 2 - 1); const t = ws.getCell(top, 4); t.value = `작업치료실 낙상방지 순회 체크리스트 (${year}년 ${month}월)`; t.font = { bold: true, size: 14 }; t.alignment = { horizontal: 'center' };
    ws.getCell(top + 2, 3).value = '날짜'; ws.getCell(top + 4, 3).value = '시간';
    half.forEach((d, k) => {
      const c = 4 + k * 2; ws.mergeCells(top + 2, c, top + 2, c + 1); ws.mergeCells(top + 3, c, top + 3, c + 1);
      ws.getCell(top + 2, c).value = `${month}/${d.day}`; ws.getCell(top + 3, c).value = d.wd; ws.getCell(top + 4, c).value = '치료사'; ws.getCell(top + 4, c + 1).value = '확인';
      const color = d.holiday || d.wd === '일' ? 'FFDC2626' : d.wd === '토' ? 'FF2563EB' : null;
      for (const r of [top + 2, top + 3]) ws.getCell(r, c).font = { bold: true, color: color ? { argb: color } : undefined };
      ws.getColumn(c).width = 9; ws.getColumn(c + 1).width = 5;
      SLOTS.forEach((_, i) => { const r = top + 5 + i + (i >= 5 ? 1 : 0); ws.getCell(r, c).value = d.holiday && i === 0 ? d.holiday : d.names[i] || ''; ws.getCell(r, c).alignment = { horizontal: 'center' }; });
    });
    SLOTS.forEach((s, i) => { const r = top + 5 + i + (i >= 5 ? 1 : 0); ws.getCell(r, 3).value = s; });
    ws.getCell(top + 10, 3).value = '점심시간';
    for (let r = top + 2; r <= top + 15; r++) for (let c = 3; c < 4 + half.length * 2; c++) { const cell = ws.getCell(r, c); cell.border = box; if (r >= top + 2 && r <= top + 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; }
    top += 18;
  }
  return wb;
}
module.exports = { SLOTS, loadRoster, loadHistory, generate, check, build, weeksOf, tally, parseMonth };
