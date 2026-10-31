const assert = require('assert'); const { readCalendar, occurrences, parseEvents } = require('../shared/ics');
const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:김현규T연차
DTSTART;VALUE=DATE:20261112
DTEND;VALUE=DATE:20261114
END:VEVENT
BEGIN:VEVENT
SUMMARY:이소정T오후반차
DTSTART:20261105T060000Z
DTEND:20261105T090000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:3팀
DTSTART;VALUE=DATE:20261107
DTEND;VALUE=DATE:20261108
RRULE:FREQ=WEEKLY;INTERVAL=3;BYDAY=SA
EXDATE;VALUE=DATE:20261128
END:VEVENT
BEGIN:VEVENT
SUMMARY:1팀
DTSTART;VALUE=DATE:20261114
DTEND;VALUE=DATE:20261115
RRULE:FREQ=WEEKLY;INTERVAL=3;BYDAY=SA
END:VEVENT
BEGIN:VEVENT
SUMMARY:회의 (전체)
DTSTART;VALUE=DATE:20261110
END:VEVENT
END:VCALENDAR`;
const r = readCalendar(ics, '2026-11-01', '2026-11-30');
assert.deepStrictEqual(Object.keys(r.leaves).sort(), ['2026-11-05', '2026-11-12', '2026-11-13']);      // 종일 연차는 끝날(다음 날 0시) 하루 전까지
assert.strictEqual(r.leaves['2026-11-05'][0].half, 'PM'); assert.strictEqual(r.leaves['2026-11-12'][0].name, '김현규');
assert.deepStrictEqual(r.teams, { '2026-11-07': 3, '2026-11-14': 1 });                                  // 3주마다 반복: 11/7(3팀), 11/28은 EXDATE로 제외, 11/14(1팀)
assert.deepStrictEqual(r.unknown, ['회의 (전체)']);
const w = occurrences({ start: '2026-10-03', end: '2026-10-03', rrule: 'FREQ=WEEKLY;INTERVAL=3;BYDAY=SA', ex: [] }, '2026-10-01', '2026-11-30');
assert.deepStrictEqual(w, ['2026-10-03', '2026-10-24', '2026-11-14']);
console.log('캘린더(.ics) 읽기 시험 OK');
