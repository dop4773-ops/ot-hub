// 날짜는 'YYYY-MM-DD' 문자열로만 다룬다 (시간대 어긋남 방지).
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUTC = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fromUTC = t => { const d = new Date(t); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
const addDays = (s, n) => fromUTC(toUTC(s) + n * 864e5);
const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 864e5);
const dow = s => new Date(toUTC(s)).getUTCDay();            // 0=일 … 6=토
const isWeekend = s => dow(s) === 0 || dow(s) === 6;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fromCell = v => v instanceof Date ? v.toISOString().slice(0, 10) : null;   // exceljs 날짜 셀 → ISO (UTC 자정)
module.exports = { iso, addDays, diffDays, dow, isWeekend, daysInMonth, fromCell };
