// 신환 평가명단 초안: 입원일이 [from,to]인 입원 환자 → 주치의·병실·이름·PT/OT 평가항목·평가일
//  · 평가항목 = EMR에서 실제 확인된 평가 처방(액팅) ∪ 환자 구분별 기본 항목. EMR에 없는 항목은 '추정'으로 비고에 표시
//  · 평가일 = 입원 후 약 17일에 가깝게, 월 14일 이전·평일·주치의 off 회피, 하루 인원 분산
const { iso, addDays, diffDays, isWeekend, daysInMonth } = require('../../shared/dates');

const PT_ORDER = ['MMT', 'BBS', 'ROM', 'MAS', 'FAC', 'FMA'];
const OT_ORDER = ['FMA', 'SCIM', 'MFT', 'HFT', 'MBI', 'MMSE', 'GDS'];
// 구분 → 진단 라벨과 기본 항목 (신환 16명 중 14명이 이 표와 일치했음; 구분이 '일반' 등 불명이면 뇌손상으로 가정하고 표시)
const DEFAULTS = {
  '뇌손상': { dx: 'Stroke', PT: ['MMT', 'BBS', 'ROM', 'MAS', 'FAC'], OT: ['MFT', 'HFT', 'MBI', 'MMSE', 'GDS'] },
  'MSK': { dx: 'MSK', PT: ['MMT', 'ROM', 'FAC'], OT: ['MBI'] },
  '척수손상': { dx: 'SCI', PT: ['MMT', 'BBS', 'ROM', 'MAS', 'FAC'], OT: ['SCIM', 'HFT', 'MFT'] },
};
const kindKey = k => /MSK/.test(k) ? 'MSK' : DEFAULTS[k] ? k : null;
const sortBy = (set, order) => [...set].sort((a, b) => order.indexOf(a) - order.indexOf(b));

const DEFAULT_OPT = { idealGap: 17, lastDay: 14, cap: 0, holidays: [], pmBlocks: true, loadWeight: 2 };

function buildRoster({ status, emr = {}, from, to, year, month, off = {}, ...opt }) {
  const o = { ...DEFAULT_OPT, ...opt };
  const targets = status.filter(s => (s.state === '입원' || s.state === '재입원') && s.admitted && s.admitted >= from && s.admitted <= to);
  const first = iso(year, month, 1), last = iso(year, month, Math.min(o.lastDay, daysInMonth(year, month)));
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) if (!isWeekend(d) && !o.holidays.includes(d)) days.push(d);
  const cap = o.cap || Math.ceil(targets.length / (days.length || 1) * 1.5), load = Object.fromEntries(days.map(d => [d, 0]));
  const isOff = (d, doc) => (off[d] || []).some(x => x.doctor === doc && (o.pmBlocks || !x.pm));

  const rows = targets.map(s => {
    const key = kindKey(s.kind), assumed = !key, def = DEFAULTS[key || '뇌손상'], e = emr[s.name] || { PT: new Set(), OT: new Set() };
    const pt = new Set([...e.PT, ...(def ? def.PT : [])]), ot = new Set([...e.OT, ...(def ? def.OT : [])]);
    const est = [...[...pt].filter(i => !e.PT.has(i)), ...[...ot].filter(i => !e.OT.has(i))];
    // 진단 라벨: 구분이 모호하면(일반 등) EMR 평가로 추정(BBS/FMA가 있으면 Stroke), 그래도 모르면 확인 표시
    let dx = def.dx;
    if (dx === 'Stroke' && (pt.has('FMA') || ot.has('FMA'))) dx = 'Stroke/FMA';
    const notes = []; if (assumed) notes.push('구분 불명 → 뇌손상(Stroke)으로 가정, 진단 확인 필요'); if (!e.PT.size && !e.OT.size) notes.push('EMR 평가 기록 없음 — 구분별 기본 항목');
    else if (est.length) notes.push(`추정(EMR 미확인): ${est.join(',')}`);
    const ptTxt = `(${dx}) ${sortBy(pt, PT_ORDER).join('/')}`;
    return { name: s.name, doctor: s.doctor, room: s.room, admitted: s.admitted, kind: s.kind, pt: ptTxt, ot: sortBy(ot, OT_ORDER).join('/'), notes, date: null };
  });

  // 평가일 배정: 선택지가 적은 환자부터
  const plan = rows.map(r => {
    const ideal = addDays(r.admitted, o.idealGap), ok = days.filter(d => !isOff(d, r.doctor));
    return { r, ok, ideal };
  }).sort((a, b) => a.ok.length - b.ok.length);
  for (const { r, ok, ideal } of plan) {
    const pool = ok.filter(d => load[d] < cap), list = pool.length ? pool : ok;
    let best = null; for (const d of list) { const c = Math.abs(diffDays(d, ideal)) + o.loadWeight * load[d]; if (!best || c < best.c) best = { d, c }; }
    if (best) { r.date = best.d; load[best.d]++; if (!pool.length) r.notes.push(`하루 ${cap}명 초과`); } else r.notes.push('배정 가능한 날 없음(주치의 off·기한)');
  }
  rows.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || Number(a.doctor) - Number(b.doctor) || a.room.localeCompare(b.room));
  return { rows, load, cap, days };
}

module.exports = { buildRoster, DEFAULTS, PT_ORDER, OT_ORDER };
