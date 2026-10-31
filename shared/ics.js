// 구글 캘린더 공개 주소(.ics) 읽기 — 연차·반차(누가 쉬는가)와 팀 표시(몇 팀이 일하는가). 읽기 전용.
//  · 제목 「이름T연차」「이름T오후반차」(작업치료) 또는 「이름 연차」(물리치료 방식) → 휴가, 제목이 「3팀」→ 그날의 근무 팀
//  · 반복 일정(RRULE: 매주/N주마다, 요일 지정, UNTIL/COUNT, EXDATE)을 날짜 범위 안에서 펼친다. rehab-hub의 main/leaveIcs.js와 같은 읽기 규칙.
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return isoOf(new Date(Date.UTC(y, m - 1, d + n))); };
const dowOf = s => new Date(s + 'T00:00:00Z').getUTCDay();
const unesc = s => String(s || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

function dateOf(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(String(v || '').trim()); if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  if (m[7]) { const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 9, +m[5], +(m[6] || 0))); return { date: isoOf(t), time: `${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}` }; }   // UTC → 한국 시간
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}${m[5]}` };
}
function parseEvents(text) {
  const body = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r\n/g, '\n'), out = [];
  for (const block of body.split('BEGIN:VEVENT').slice(1)) {
    const ev = block.split('END:VEVENT')[0], line = k => { const m = new RegExp('^' + k + '((?:;[^:\\n]*)?):(.*)$', 'm').exec(ev); return m ? m[2] : null; };
    if (/^STATUS:CANCELLED/m.test(ev)) continue;
    const s = dateOf(line('DTSTART')), e = dateOf(line('DTEND')); if (!s) continue;
    let end = e ? e.date : s.date; if (e && (e.time === '' || e.time === '0000') && end > s.date) end = addDays(end, -1); if (end < s.date) end = s.date;
    const ex = []; for (const m of ev.matchAll(/^EXDATE[^:\n]*:(.*)$/gm)) for (const v of m[1].split(',')) { const d = dateOf(v); if (d) ex.push(d.date); }
    out.push({ title: unesc(line('SUMMARY')), start: s.date, end, rrule: line('RRULE'), ex });
  }
  return out;
}
// 반복 일정 하나를 [from,to] 안의 (시작일) 목록으로 펼친다. 지원: FREQ=DAILY|WEEKLY, INTERVAL, BYDAY, UNTIL, COUNT
function occurrences(ev, from, to) {
  if (!ev.rrule) return ev.end >= from && ev.start <= to ? [ev.start] : [];
  const r = Object.fromEntries(ev.rrule.split(';').map(x => x.split('='))), iv = Number(r.INTERVAL || 1), until = r.UNTIL ? (dateOf(r.UNTIL) || {}).date : null, cnt = r.COUNT ? Number(r.COUNT) : Infinity;
  const days = r.BYDAY ? r.BYDAY.split(',').map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(d.replace(/[^A-Z]/g, ''))) : [dowOf(ev.start)], out = []; let n = 0;
  if (r.FREQ === 'DAILY') { for (let d = ev.start; d <= to && (!until || d <= until) && n < cnt; d = addDays(d, iv)) { n++; if (d >= from && !ev.ex.includes(d)) out.push(d); } return out; }
  if (r.FREQ !== 'WEEKLY') return [];
  const week0 = addDays(ev.start, -dowOf(ev.start));                                          // 시작일이 속한 주(일요일)
  for (let w = week0; w <= to && (!until || w <= until) && n < cnt; w = addDays(w, 7 * iv)) for (const dw of [...days].sort()) { const d = addDays(w, dw); if (d < ev.start) continue; if (until && d > until) continue; if (n >= cnt) break; n++; if (d >= from && d <= to && !ev.ex.includes(d)) out.push(d); }
  return out;
}
const LEAVE_T = /^\s*([가-힣A-Za-z]{2,6}?)\s*T\s*(.*?)\s*$/, LEAVE_SP = /^([가-힣]{2,4})\s+(연차|반차|오전반차|오후반차|휴가|병가|출산휴가|공가|교육|예비군|경조|오프)\b/;
function leaveOf(title) { const m = LEAVE_T.exec(title) || LEAVE_SP.exec(title); if (!m) return null; const label = m[2] || '부재'; return { name: m[1], label, half: /오전/.test(label) ? 'AM' : /오후/.test(label) ? 'PM' : '' }; }
const teamOf = title => { const m = /^\s*([1-3])\s*팀\s*$/.exec(title); return m ? Number(m[1]) : null; };

// → { leaves: { 'YYYY-MM-DD': [{name,label,half}] }, teams: { 'YYYY-MM-DD': 1|2|3 }, unknown: [제목…] }
function readCalendar(text, from, to) {
  const leaves = {}, teams = {}, unknown = new Set();
  for (const ev of parseEvents(text)) {
    const t = teamOf(ev.title), lv = t ? null : leaveOf(ev.title);
    if (!t && !lv) { if (ev.title && !ev.rrule) unknown.add(ev.title); continue; }
    const span = ev.end > ev.start ? Math.round((new Date(ev.end) - new Date(ev.start)) / 864e5) : 0;
    for (const st of occurrences(ev, addDays(from, -span), to)) for (let k = 0; k <= span; k++) { const d = addDays(st, k); if (d < from || d > to) continue; if (t) teams[d] = t; else (leaves[d] ??= []).push(lv); }
  }
  return { leaves, teams, unknown: [...unknown].slice(0, 10) };
}
module.exports = { parseEvents, occurrences, readCalendar, leaveOf, teamOf };
