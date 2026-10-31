// 시작할 때 연결된 파일을 미리 읽어 두는 목록(앱 본체 또는 별도 작업 프로세스가 실행). 하나씩 읽는다 — 동시에 많이 읽으면 오히려 느려진다.
function warmTasks({ files: f, emr = [], pot = [] }) {
  const t = [], add = fn => t.push(() => Promise.resolve().then(fn).catch(() => {}));
  if (f.status) { add(() => require('./status').loadStatus(f.status)); add(() => require('./staff').loadStaff(f.status)); add(() => require('../modules/eval/ccrt').loadCcrtSchedule(f.status)); add(() => require('../modules/attendance').loadFloors(f.status)); }
  if (f.eval) { add(() => require('../modules/eval/schedule').loadSchedule(f.eval)); add(() => require('../modules/eval/schedule').loadCycles(f.eval)); add(() => require('../modules/sci/sci').loadScimNames(f.eval)); add(() => require('./off').loadOff(f.eval)); }
  if (f.cleaning) { add(() => require('../modules/cleaning/history').loadHistory(f.cleaning)); add(() => require('../modules/cleaning/floorplan').loadFloorPlan(f.cleaning)); }
  if (f.tools) add(() => require('../modules/inventory/logic').loadTools(f.tools));
  if (f.supply) add(() => require('../modules/inventory/request').loadRequests(f.supply));
  if (f.fall) { add(() => require('../modules/fall/logic').loadRoster(f.fall)); add(() => require('../modules/fall/logic').loadHistory(f.fall)); }
  if (f.saturday) add(() => require('../modules/fall/saturday').loadSaturdays(f.saturday));
  for (const k of ['timetable10', 'timetable3']) if (f[k]) add(() => require('./timetable').loadTimetableCards(f[k]));
  if (emr.length) add(() => require('../modules/roster/emr').loadEmr(emr));
  if (pot.length) add(() => require('./pot').loadPot(pot));
  if (f.messenger) add(() => require('./messenger').loadDischarges(f.messenger));
  return t;
}
module.exports = { warmTasks };
