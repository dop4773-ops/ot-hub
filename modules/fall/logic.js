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

// 입력: roster(치료사명단) · history(월별 이력) · holidays{date:이름} · leaves{date:[{name}]} · sat{date:{team,people:[{name,extra,red}]}}(토요일 시트) · teams{date:팀}(캘린더) · floor('10층'|'3층') · overrides{date:{exclude:[]},week:{...}}
// 평일: 그 주 월~금 중 하루라도 쉬는 사람은 그 주 담당에서 뺀다. 토요일: 그날 근무 팀(토요일 시트 → 캘린더 → 순환 순)의 선생님만, 3층 근무자(빨간 테두리)는 10층에서 뺀다.
function generate({ year, month, floor = '10층', roster, history = {}, holidays = {}, leaves = {}, sat = {}, teams = {}, exclude = new Set(), overrides = {}, redMin = 8, seed = 1 }) {
  const rnd = (() => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const T = tally(history), onLeave = new Set(roster.leave.filter(l => /휴직/.test(l.kind)).map(l => l.name));
  const base = (floor === '3층' ? roster.weekday3 : roster.weekday10).filter(n => !onLeave.has(n) && !exclude.has(n));
  const weeks = weeksOf(year, month, holidays), wcnt = { ...T.wk }, scnt = { ...T.sat }, last = { ...T.lastSlot }, notes = [], info = {};
  const leaveOn = (n, d) => (leaves[d] || []).some(l => l.name === n) || ((overrides[d] || {}).exclude || []).includes(n);
  // 가장 최근 토요일 팀 → 다음 팀 (순환) — 토요일 시트·캘린더에 없는 날의 마지막 수단
  let rot = null; { const ms = Object.keys(history).map(Number).sort((a, b) => b - a); for (const m of ms) { const sats = history[m].filter(d => d.wd === '토' && d.names.some(Boolean)); if (sats.length) { const who = sats[sats.length - 1].names.find(n => n && NAME.test(n)); const t = who ? [1, 2, 3].find(k => roster.sat[k].includes(who)) : 0; rot = ((t || 0) % 3) + 1; break; } } if (!rot) rot = 1; }
  // 토요일 순번: 팀 명단 순서대로 돌아가며 11칸을 채우고, 사람이 모자라면 처음부터 다시(1234567123…).
  // 같은 팀의 직전 토요일(지난 달 이력 포함)에서 마지막으로 들어간 사람 다음부터 이어간다.
  const lastSat = {}; { for (const m of Object.keys(history).map(Number).sort((a, b) => a - b)) for (const d of history[m]) { if (d.wd !== '토') continue; const nm = d.names.filter(n => n && NAME.test(n)); if (!nm.length) continue; const t = [1, 2, 3].find(k => roster.sat[k].includes(nm[0])); if (t) lastSat[t] = nm[nm.length - 1]; } }
  const cyc = (team, eligible, n) => {
    const base = [...(roster.sat[team] || [])]; eligible.forEach(e => { if (!base.includes(e)) base.push(e); });
    const start = base.indexOf(lastSat[team]) + 1, list = []; for (let k = 0; k < base.length; k++) { const x = base[(start + k) % base.length]; if (eligible.includes(x)) list.push(x); }
    const out = list.length ? Array.from({ length: n }, (_, i) => list[i % list.length]) : []; if (out.length) lastSat[team] = out[out.length - 1]; return { out, list };
  };
  const out = [];
  for (const wk of weeks) {
    const weekdays = wk.days.filter(d => d.wd !== '토' && !d.holiday), satDay = wk.days.find(d => d.wd === '토' && !d.holiday);
    const slotsOf = {};
    if (weekdays.length) {
      const avail = base.filter(n => !weekdays.some(d => leaveOn(n, d.date)));
      const skipped = base.filter(n => !avail.includes(n));
      if (skipped.length) notes.push(`${month}/${weekdays[0].day}~ 주: 쉬는 날이 있어 제외 — ${skipped.join(', ')}`);
      const order = [...avail].sort((a, b) => (wcnt[a] || 0) - (wcnt[b] || 0) || rnd() - 0.5), chosen = order.slice(0, 11);
      if (chosen.length < 11) notes.push(`${month}/${weekdays[0].day}~ 주: 후보가 ${chosen.length}명뿐이라 빈칸이 생깁니다`);
      const free = new Set(SLOTS.map((_, i) => i)), assign = {};
      for (const n of chosen.sort((a, b) => (T.slotCnt[b] ? 1 : 0) - (T.slotCnt[a] ? 1 : 0) || rnd() - 0.5)) {
        let best = null; for (const i of free) { const c = (last[n] === i ? 100 : 0) + ((T.slotCnt[n] || [])[i] || 0) + rnd() * 0.5; if (!best || c < best.c) best = { i, c }; }
        assign[best.i] = n; free.delete(best.i); wcnt[n] = (wcnt[n] || 0) + 1; last[n] = best.i;
      }
      for (let i = 0; i < 11; i++) slotsOf[i] = assign[i] || '';
    }
    // 토요일·공휴일 근무자 정보(화면에 보여 주고 고칠 수 있게 날짜마다 남긴다)
    const special = wk.days.filter(d => d.wd === '토' || d.holiday), satNames = {};
    for (const d of special) {
      let sheet = sat[d.date], team = sheet ? sheet.team : teams[d.date] || (d.wd === '토' ? rot : null), source = sheet ? '토요일 시트' : teams[d.date] ? '캘린더' : '순환(추정)';
      let people = [];
      if (sheet) people = sheet.people.filter(p => !p.extra && !exclude.has(p.name)).map(p => ({ name: p.name, floor3: p.red >= redMin, red: p.red }));
      else if (team) people = roster.sat[team].filter(n => !exclude.has(n)).map(n => ({ name: n, floor3: false, red: 0 }));
      const ov = overrides[d.date] || {};
      people.forEach(p => { if (ov.floor3 && p.name in ov.floor3) p.floor3 = !!ov.floor3[p.name]; p.off = !!leaveOn(p.name, d.date) || onLeave.has(p.name); });
      info[d.date] = { team, source, holiday: d.holiday, people };
      if (d.wd === '토' && !d.holiday) {
        const pool = people.filter(p => (floor === '3층' ? p.floor3 : !p.floor3) && !p.off).map(p => p.name);
        let pick;
        if (team) { const c = cyc(team, pool, 11); pick = c.out; if (c.list.length && c.list.length < 11) notes.push(`${month}/${d.day}(토): 근무 가능한 ${floor} 선생님이 ${c.list.length}명이라 처음부터 다시 채웠습니다`); }
        else { pick = [...pool].sort((a, b) => (scnt[a] || 0) - (scnt[b] || 0) || rnd() - 0.5).slice(0, 11); if (pick.length < 11) notes.push(`${month}/${d.day}(토): 근무 팀을 몰라 ${pick.length}명만 넣었습니다 — 직접 채워 주세요`); }
        if (!pick.length) notes.push(`${month}/${d.day}(토): 근무 가능한 ${floor} 선생님이 없습니다 (${source}) — 직접 채워 주세요`);
        pick.forEach(n => scnt[n] = (scnt[n] || 0) + 1); satNames[d.date] = pick;
        if (source.startsWith('순환(추정)')) notes.push(`${month}/${d.day}(토): 근무 팀을 찾지 못해 순환으로 ${team}팀으로 추정했습니다 — 확인하세요`);
      }
    }
    out.push({ team: satDay && info[satDay.date] ? info[satDay.date].team : null, days: wk.days.map(d => ({ ...d, team: (info[d.date] || {}).team || null,
      names: d.holiday ? Array(11).fill('') : d.wd === '토' ? Array.from({ length: 11 }, (_, i) => (satNames[d.date] || [])[i] || '') : SLOTS.map((_, i) => slotsOf[i] || '') })) });
    if (satDay) rot = (rot % 3) + 1;
  }
  return { weeks: out, info, notes };
}

// 점검: 하루에 같은 사람이 두 번, 휴직자, 빈칸
function check({ weeks, roster }) {
  const leave = new Set(roster.leave.filter(l => /휴직/.test(l.kind)).map(l => l.name)), issues = [];
  for (const wk of weeks) for (const d of wk.days) {
    if (d.holiday) continue;
    const seen = new Set(), sat = d.wd === '토'; d.names.forEach((n, i) => { if (!n) issues.push({ date: d.date, slot: i, msg: '빈칸' }); else { if (seen.has(n) && !sat) issues.push({ date: d.date, slot: i, msg: `${n} 하루에 두 번` }); seen.add(n); if (leave.has(n)) issues.push({ date: d.date, slot: i, msg: `${n} 휴직 중` }); } });
  }
  return issues;
}

/* ---------- 엑셀: 낙상방지 파일의 '원본' 시트(서식·너비·글꼴·로고·가로 인쇄)를 그대로 열어 이름만 채운다 ---------- */
const TEAM_FILL = { 1: 'FFFFF2CC', 2: 'FFE2EFDA', 3: 'FFDDEBF7' }, HOLIDAY_FILL = 'FFD9D9D9';
const colOf = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const TABLE = [{ dateRow: 3, dow: 5, first: 7, cols: 13 }, { dateRow: 20, dow: 22, first: 24, cols: 14 }];       // 위/아래 표: 날짜 머리글 행, 요일 행, 첫 순회 행, 한 표의 날짜 칸 수
const slotRow = (t, i) => TABLE[t].first + i + (i >= 5 ? 1 : 0);                                            // 6번째(13:30)부터 점심시간 한 줄을 건너뛴다

// 낙상방지 파일의 '원본' 시트(서식·너비·글꼴·로고·가로 인쇄)를 엑셀 파일 안쪽(XML)에서 직접 고쳐 이름만 채운다 — ExcelJS로 다시 쓰면 "내용에 문제가 있습니다" 복구 창이 뜨던 문제를 피한다.
async function build({ templateFile, year, month, weeks }) {
  const Z = require('../../shared/zipx'), zip = await Z.loadZip(templateFile);
  const path = await Z.keepOnlySheet(zip, '원본', `${month}월`); let xml = await zip.file(path).async('string'); const st = Z.fills(await zip.file('xl/styles.xml').async('string'));
  xml = Z.setCell(xml, 'A1', month); xml = Z.setCell(xml, 'AA2', year);                                    // 원본의 수식이 날짜·요일을 채운다(일요일 건너뜀)
  const days = weeks.flatMap(w => w.days);
  days.forEach((d, k) => {
    const t = k < TABLE[0].cols ? 0 : 1, c = 4 + (t === 0 ? k : k - TABLE[0].cols) * 2;                      // D, F, H, …
    for (let i = 0; i < 11; i++) xml = Z.setCell(xml, `${colOf(c)}${slotRow(t, i)}`, d.holiday ? (i === 0 ? d.holiday : null) : (d.names[i] || null));
    if (d.wd === '토' || d.holiday) {                                                                         // 토요일·공휴일은 근무 팀 색으로 열 전체
      const argb = d.team ? TEAM_FILL[d.team] : HOLIDAY_FILL;
      for (const col of [c, c + 1]) for (let r = TABLE[t].dateRow; r <= slotRow(t, 10); r++) { const ref = `${colOf(col)}${r}`, s = Z.styleOf(xml, ref); if (s != null) xml = Z.setStyle(xml, ref, st.get(s, argb)); }
    }
  });
  zip.file(path, xml); zip.file('xl/styles.xml', st.finish());
  return Z.save(zip);
}
module.exports = { SLOTS, loadRoster, loadHistory, generate, check, build, weeksOf, tally, parseMonth, TEAM_FILL };
