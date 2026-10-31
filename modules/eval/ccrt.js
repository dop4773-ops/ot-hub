// CCRT 평가 계획 — 요구 규칙:
//  · 대상/치료요일 = 작업치료현황 '평일시간표(원본)'의 "10F) CCRT" 스케줄표(월~금 칸에 이름). BETTER·COMCOG 환자는 CCRT 평가 안 함.
//  · 루틴 2개월에 한 번(직전 평가 후 50~70일, 목표 60일), 회복기 종료 전에 평가, 퇴원 전에 평가.
//  · 회복기 종료일 = 현황판 '회복기 기간' 칸, 퇴원일 = 메신저 DB 퇴원 일정. 주치의 off·주말·휴무일 회피, 치료요일에만 배정.
const { txt, open } = require('../../shared/xl');
const { iso, addDays, diffDays, dow, isWeekend, daysInMonth } = require('../../shared/dates');

const DAYS = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
const NAME = /^[가-힣]{2,4}[A-Z]?$/, NOT_NAME = /^(점심시간|치료시간|치료사|전산화인지|외래|평가|신환)$/;

// '평일시간표(원본)' 시트에서 "10F) CCRT / 3F) BETTER / 3F) COMCOG" 블록을 찾아 이름 → 치료요일 집합
const { memo } = require('../../shared/cache');
const loadCcrtSchedule = f => memo('ccrtSchedule', f, () => parseCcrtSchedule(f));
async function parseCcrtSchedule(statusFile) {
  const ws = (await open(statusFile)).worksheets.find(w => /평일시간표/.test(w.name));
  if (!ws) throw new Error("'평일시간표(원본)' 시트를 찾지 못했습니다");
  const out = { ccrt: {}, better: {}, comcog: {} };
  for (let r = 1; r <= 60; r++) for (let c = 1; c <= ws.columnCount; c++) {
    const m = txt(ws.getCell(r, c)).trim().match(/^(\d+F\)?)?\s*\)?\s*(CCRT|BETTER|COMCOG)\s*$/i); if (!m) continue;
    const kind = m[2].toLowerCase();
    // 머리글 다음 행에서 월~금 열 찾기 (블록 폭 안)
    const cols = {};
    for (let cc = c; cc <= c + 10; cc++) { const d = DAYS[txt(ws.getCell(r + 1, cc)).trim()]; if (d) cols[cc] = d; }
    if (!Object.keys(cols).length) continue;
    for (let rr = r + 2; rr <= r + 22; rr++) for (const [cc, d] of Object.entries(cols)) {
      const n = txt(ws.getCell(rr, +cc)).trim(); if (NAME.test(n) && !NOT_NAME.test(n)) (out[kind][n] ??= new Set()).add(d);
    }
  }
  return out;
}

const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const DEFAULT = { gapTarget: 60, minGap: 50, maxGap: 70, preDays: 14, lastDay: 31, holidays: [], pmBlocks: true, loadWeight: 2, recoveryLead: 7, dischargeLead: 2, mergeWithin: 14 };

// 평가 종류: 루틴(2개월마다) · 회복기 종료 전(COSAS, 종료 1주일 전) · 퇴원 전 — 사건 평가는 루틴과 별개로 하나 더 잡는다.
// (단, 루틴 날짜가 사건 평가 날짜와 mergeWithin일 이내면 한 번으로 합쳐 사건 평가가 루틴을 겸한다)
// patients: [{ name, doctor, room, weekdays:[1..5], dates:{월:'YYYY-MM-DD'}, recoveryEnd, discharge, excluded }]
function planCcrt({ patients, year, month, off = {}, ...opt }) {
  const o = { ...DEFAULT, ...opt };
  const first = iso(year, month, 1), eom = iso(year, month, daysInMonth(year, month)), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) if (!isWeekend(d) && !o.holidays.includes(d)) days.push(d);
  const isOff = (d, doc) => (off[d] || []).some(x => x.doctor === doc && (o.pmBlocks || !x.pm));
  const load = Object.fromEntries(days.map(d => [d, 0])); const rows = [];
  const okDays = p => days.filter(d => !isOff(d, p.doctor) && (!p.weekdays.length || p.weekdays.includes(dow(d))));
  const pick = (cands, ideal) => { let b = null; for (const d of cands) { const c = Math.abs(diffDays(d, ideal)) + o.loadWeight * load[d]; if (!b || c < b.c) b = { d, c }; } return b && b.d; };

  for (const p of patients) {
    const base = { name: p.name, doctor: p.doctor, room: p.room, weekdays: p.weekdays, row: p.row, prev: null, recoveryEnd: p.recoveryEnd || null, discharge: p.discharge || null, ttMsg: p.ttMsg || '', ttOk: p.ttOk };
    const prev = Object.values(p.dates || {}).filter(d => d < first).sort().pop() || null; base.prev = prev;
    if (p.excluded) { rows.push({ ...base, kind: '', date: null, status: '제외', note: p.excluded }); continue; }
    if (p.discharge && p.discharge < first) { rows.push({ ...base, kind: '', date: null, status: '제외', note: `퇴원(${p.discharge})` }); continue; }
    const ok = okDays(p), existing = (p.dates || {})[month] || null, mine = [];
    const place = (kind, why, cands, ideal, fallback) => {
      let list = cands, note = ''; if (!list.length) { list = fallback; if (list.length) note = '조건에 맞는 치료요일이 없어 가능한 날로 완화'; }
      const d = pick(list, ideal);
      if (d) { load[d]++; mine.push({ ...base, kind, date: d, status: '제안', note: [why, note].filter(Boolean).join(' · ') }); }
      else mine.push({ ...base, kind, date: null, status: '미배정', note: `${why} · 배정 가능한 날 없음(치료요일 확인)` });
    };
    // 사건 평가: 퇴원 전 / 회복기 종료 전(COSAS)
    if (p.discharge && p.discharge >= first && p.discharge <= eom) place('퇴원 전', `퇴원(${p.discharge}) 전 평가`, ok.filter(d => d < p.discharge), addDays(p.discharge, -o.dischargeLead), ok.filter(d => d < p.discharge));
    if (p.recoveryEnd && p.recoveryEnd >= first && p.recoveryEnd <= eom) place('회복기 종료 전', `회복기 종료(${p.recoveryEnd}) ${o.recoveryLead}일 전 COSAS 평가`, ok.filter(d => d < p.recoveryEnd), addDays(p.recoveryEnd, -o.recoveryLead), ok.filter(d => d < p.recoveryEnd));
    // 루틴: 이번 달에 직전 평가 +50~70일 창이 걸치면 대상(처음이면 첫 평가)
    const due = prev ? addDays(prev, o.minGap) <= eom : true;
    if (existing) { mine.unshift({ ...base, kind: '루틴', date: existing, status: '입력됨', note: '' }); if (load[existing] !== undefined) load[existing]++; }
    else if (due) {
      const near = mine.filter(x => x.date).find(x => prev ? Math.abs(diffDays(x.date, addDays(prev, o.gapTarget))) <= o.mergeWithin || x.date >= addDays(prev, o.minGap) : true);
      if (near) near.note = [near.note, '루틴 평가를 겸함'].filter(Boolean).join(' · ');
      else { const win = ok.filter(d => !prev || (d >= addDays(prev, o.minGap) && d <= addDays(prev, o.maxGap))); const ideal = prev ? addDays(prev, o.gapTarget) : addDays(first, 7);
        const r = { ...base, kind: '루틴' }, d = pick(win.length ? win : ok.filter(x => !prev || x <= addDays(prev, o.maxGap)), ideal);
        if (d) { load[d]++; mine.unshift({ ...r, date: d, status: '제안', note: prev ? `2개월 루틴(직전 ${prev})${win.length ? '' : ' · 조건에 맞는 치료요일이 없어 가능한 날로 완화'}` : '첫 평가' }); }
        else mine.unshift({ ...r, date: null, status: '미배정', note: '2개월 루틴 · 배정 가능한 날 없음(치료요일 확인)' }); }
    }
    if (!mine.length) { rows.push({ ...base, kind: '', date: null, status: '대상 아님', note: `다음 루틴 평가 ${addDays(prev, o.minGap)} 이후` }); continue; }
    rows.push(...mine);
  }
  return { rows, load, days };
}

// 사람이 고친 날짜 점검
function issuesOfCcrt({ rows, year, month, off = {}, ...opt }) {
  const o = { ...DEFAULT, ...opt }, mm = String(month).padStart(2, '0'), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  return rows.map(r => {
    const d = r.date, out = []; if (!d) return out;
    if (d.slice(0, 7) !== `${year}-${mm}`) out.push({ level: 'err', msg: '다른 달' }); else if (d > last) out.push({ level: 'err', msg: `${o.lastDay}일 초과` });
    if (isWeekend(d)) out.push({ level: 'err', msg: '주말' });
    if (o.holidays.includes(d)) out.push({ level: 'err', msg: '휴무일' });
    if ((off[d] || []).some(x => x.doctor === r.doctor && (o.pmBlocks || !x.pm))) out.push({ level: 'err', msg: `주치의 RM${r.doctor} off` });
    if (r.weekdays && r.weekdays.length && !r.weekdays.includes(dow(d))) out.push({ level: 'warn', msg: '치료 요일이 아님' });
    if (r.prev && r.kind === '루틴') { const g = diffDays(d, r.prev); if (g < o.minGap || g > o.maxGap) out.push({ level: 'warn', msg: `직전 평가로부터 ${g}일 (권장 ${o.minGap}~${o.maxGap}일)` }); }
    return out;
  });
}
module.exports = { loadCcrtSchedule, planCcrt, issuesOfCcrt, DEFAULT };
