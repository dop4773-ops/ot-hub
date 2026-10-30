// CCRT·산재처럼 '일정 주기'로 도는 평가. 직전 평가일에서 [minGap, maxGap]일 사이, 주기 목표(gapTarget)에 가깝게.
// CCRT는 치료 요일(weekdays)에만 평가. 주치의 off·휴무일·주말 회피. 이미 그 달에 날짜가 있으면 그대로 두고 점검만 한다.
const { iso, addDays, diffDays, dow, isWeekend, daysInMonth } = require('../../shared/dates');

const PRESETS = {
  ccrt:   { gapTarget: 60, minGap: 50, maxGap: 70, lastDay: 31, useWeekdays: true },    // 2개월 루틴 (실데이터: 56~69일 69%)
  sanjae: { gapTarget: 91, minGap: 80, maxGap: 100, lastDay: 14, useWeekdays: false },  // MMSE/GDS 3개월 루틴
};
const COMMON = { holidays: [], pmBlocks: true, loadWeight: 2 };

function planCycle({ patients, year, month, off = {}, kind = 'ccrt', ...opt }) {
  const o = { ...COMMON, ...PRESETS[kind], ...opt };
  const first = iso(year, month, 1), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const isOff = (d, doc) => (off[d] || []).some(x => x.doctor === doc && (o.pmBlocks || !x.pm));
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) if (!isWeekend(d) && !o.holidays.includes(d)) days.push(d);
  const load = Object.fromEntries(days.map(d => [d, 0]));
  const rows = [];
  for (const p of patients) {
    const base = { name: p.name, doctor: p.doctor, room: p.room, note: '', weekdays: p.weekdays, row: p.row };
    const prev = Object.values(p.dates).filter(d => d < first).sort().pop() || null;
    const existing = p.dates[month] || null;
    if (p.skip) { rows.push({ ...base, prev, date: null, status: '제외', note: p.note }); continue; }
    if (p.discharge && p.discharge < first) { rows.push({ ...base, prev, date: null, status: '제외', note: `퇴원(${p.discharge})` }); continue; }
    if (existing) { rows.push({ ...base, prev, date: existing, status: '입력됨', note: '' }); load[existing] !== undefined && load[existing]++; continue; }
    if (prev && addDays(prev, o.minGap) > iso(year, month, daysInMonth(year, month))) { rows.push({ ...base, prev, date: null, status: '대상 아님', note: `다음 평가 ${addDays(prev, o.minGap)} 이후` }); continue; }
    const lo = prev ? addDays(prev, o.minGap) : first, hi = prev ? addDays(prev, o.maxGap) : last;
    let ok = days.filter(d => !isOff(d, p.doctor) && (!o.useWeekdays || !p.weekdays.length || p.weekdays.includes(dow(d))) && (!p.discharge || d <= p.discharge));
    let note = prev ? '' : '이력 없음(첫 평가)';
    let cand = ok.filter(d => d >= lo && d <= hi);
    if (!cand.length) { cand = ok.filter(d => d <= hi); if (cand.length) note = '간격이 짧아도 가능한 날로 배정'; }
    if (!cand.length) { cand = ok; if (cand.length) note = `직전(${prev})로부터 ${o.maxGap}일 초과 — 확인 필요`; }
    const ideal = prev ? addDays(prev, o.gapTarget) : addDays(first, 7);
    let best = null; for (const d of cand) { const c = Math.abs(diffDays(d, ideal)) + o.loadWeight * load[d]; if (!best || c < best.c) best = { d, c }; }
    if (best) load[best.d]++; else note = (note ? note + ' · ' : '') + '배정 가능한 날 없음(치료요일·off·기한 확인)';
    rows.push({ ...base, prev, date: best ? best.d : null, status: best ? '제안' : '미배정', note });
  }
  return { rows, load, days };
}

// 사람이 고친 날짜 점검. err = 규칙 위반, warn = 확인 권장
function issuesOfCycle({ rows, year, month, off = {}, kind = 'ccrt', ...opt }) {
  const o = { ...COMMON, ...PRESETS[kind], ...opt };
  const mm = String(month).padStart(2, '0'), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const load = {}; rows.forEach(r => r.date && (load[r.date] = (load[r.date] || 0) + 1));
  return rows.map(r => {
    const d = r.date, out = [];
    if (!d) return out;
    if (d.slice(0, 7) !== `${year}-${mm}`) out.push({ level: 'err', msg: '다른 달' });
    else if (d > last) out.push({ level: 'err', msg: `${o.lastDay}일 초과` });
    if (isWeekend(d)) out.push({ level: 'err', msg: '주말' });
    if (o.holidays.includes(d)) out.push({ level: 'err', msg: '휴무일' });
    if ((off[d] || []).some(x => x.doctor === r.doctor && (o.pmBlocks || !x.pm))) out.push({ level: 'err', msg: `주치의 RM${r.doctor} off` });
    if (o.useWeekdays && r.weekdays && r.weekdays.length && !r.weekdays.includes(dow(d))) out.push({ level: 'warn', msg: '치료 요일이 아님' });
    if (r.prev) { const g = diffDays(d, r.prev); if (g < o.minGap || g > o.maxGap) out.push({ level: 'warn', msg: `직전 평가로부터 ${g}일 (권장 ${o.minGap}~${o.maxGap}일)` }); }
    return out;
  });
}

module.exports = { planCycle, issuesOfCycle, PRESETS };
