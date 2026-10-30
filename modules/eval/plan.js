// 월 평가일 초안. 규칙(모두 설정 가능):
//  · 평가일은 매월 lastDay(14)일 이전, 평일, 휴무일 아님
//  · 담당 주치의가 쉬는 날은 배정 금지 (오후만 쉬는 날도 기본은 금지: pmBlocks)
//  · 직전 평가일 + minGap(21)일 이후, MBI 대상(평가항목에 MBI)은 + maxGap(30)일 이내 ("MBI 30일 넘기지 않기")
//  · 가능하면 직전 + idealGap(28)일에 가깝게, 하루 인원은 cap까지 분산
const { iso, addDays, diffDays, isWeekend, daysInMonth } = require('../../shared/dates');

const DEFAULTS = { lastDay: 14, minGap: 21, maxGap: 30, idealGap: 28, cap: 0, holidays: [], pmBlocks: true, loadWeight: 2 };

function planMonth({ patients, year, month, off = {}, ...opt }) {
  const o = { ...DEFAULTS, ...opt };
  const first = iso(year, month, 1), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const offBy = (d, doc) => (off[d] || []).some(x => x.doctor === doc && (o.pmBlocks || !x.pm));
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) if (!isWeekend(d) && !o.holidays.includes(d)) days.push(d);

  const targets = patients.filter(p => p.status === '입원').map(p => {
    const prev = Object.values(p.dates).filter(d => d < first).sort().pop() || null;
    const ok = days.filter(d => !offBy(d, p.doctor));
    const mbi = /MBI/.test(p.items || '');
    let lo = prev ? addDays(prev, o.minGap) : first, hi = prev && mbi ? addDays(prev, o.maxGap) : last, note = '';
    let cand = ok.filter(d => d >= lo && d <= hi);
    if (!cand.length) { cand = ok.filter(d => d <= hi); if (cand.length) note = `직전+${o.minGap}일 이전이지만 가능한 날로 배정`; }
    if (!cand.length) { cand = ok; if (cand.length) note = prev ? `직전 평가(${prev})로부터 ${o.maxGap}일 초과 — 확인 필요` : ''; }
    return { p, prev, cand, note, ideal: prev ? addDays(prev, o.idealGap) : addDays(first, 7) };
  });

  const cap = o.cap || Math.ceil(targets.length / days.length * 1.25);
  const load = Object.fromEntries(days.map(d => [d, 0]));
  const rows = [];
  for (const t of targets.sort((a, b) => a.cand.length - b.cand.length || a.p.row - b.p.row)) {
    let best = null, over = false;
    const pool = t.cand.filter(d => load[d] < cap);
    const list = pool.length ? pool : (over = true, t.cand);
    for (const d of list) {
      const cost = Math.abs(diffDays(d, t.ideal)) + o.loadWeight * load[d];
      if (!best || cost < best.cost) best = { d, cost };
    }
    let note = t.note;
    if (!best) note = (note ? note + ' · ' : '') + '배정 가능한 날 없음(주치의 off·기한 확인)';
    else { load[best.d]++; if (over) note = (note ? note + ' · ' : '') + `하루 ${cap}명 초과`; }
    rows.push({ mbi: /MBI/.test(t.p.items || ''), name: t.p.name, doctor: t.p.doctor, room: t.p.room, items: t.p.items, prev: t.prev, date: best ? best.d : null, note, row: t.p.row });
  }
  return { rows: rows.sort((a, b) => a.row - b.row), load, cap, days };
}

// 사람이 날짜를 고친 뒤 규칙 위반을 다시 점검. level: 'err' = 규칙 위반, 'warn' = 확인 권장
function issuesOf({ rows, year, month, off = {}, ...opt }) {
  const o = { ...DEFAULTS, ...opt };
  const mm = String(month).padStart(2, '0'), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const load = {}; rows.forEach(r => r.date && (load[r.date] = (load[r.date] || 0) + 1));
  const weekdays = []; for (let d = iso(year, month, 1); d <= last; d = addDays(d, 1)) if (!isWeekend(d)) weekdays.push(d);
  const cap = o.cap || Math.ceil(rows.length / (weekdays.length || 1) * 1.25);
  return rows.map(r => {
    const out = [], d = r.date;
    if (!d) return [{ level: 'err', msg: '날짜 없음' }];
    if (d.slice(0, 7) !== `${year}-${mm}`) out.push({ level: 'err', msg: '다른 달' });
    else if (d > last) out.push({ level: 'err', msg: `${o.lastDay}일 초과` });
    if (isWeekend(d)) out.push({ level: 'err', msg: '주말' });
    if (o.holidays.includes(d)) out.push({ level: 'err', msg: '휴무일' });
    if ((off[d] || []).some(x => x.doctor === r.doctor && (o.pmBlocks || !x.pm))) out.push({ level: 'err', msg: `주치의 RM${r.doctor} off` });
    if (r.prev) { const g = diffDays(d, r.prev);
      if (r.mbi && g > o.maxGap) out.push({ level: 'err', msg: `직전 평가로부터 ${g}일 (MBI ${o.maxGap}일 초과)` });
      else if (g < o.minGap) out.push({ level: 'warn', msg: `직전 평가로부터 ${g}일 (간격 짧음)` }); }
    if (load[d] > cap) out.push({ level: 'warn', msg: `그날 ${load[d]}명 (상한 ${cap})` });
    return out;
  });
}

module.exports = { planMonth, issuesOf, DEFAULTS };
