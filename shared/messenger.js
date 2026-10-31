// 메신저 DB(messenger.db) 읽기 전용 — 퇴원 일정만 읽는다. sql.js(순수 JS)로 파일을 메모리에 올려 읽으므로 원본은 건드리지 않는다.
// rehab-hub에는 이미 main/messenger/reader.js(better-sqlite3)가 있으니 합칠 때는 이 함수만 그쪽 호출로 바꾸면 된다.
const fs = require('fs');
let SQL = null;

const { memo } = require('./cache');
const loadDischarges = dbPath => dbPath && fs.existsSync(dbPath) ? memo('discharges', dbPath, () => readDischarges(dbPath)) : Promise.resolve({});
async function readDischarges(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return {};
  SQL ??= await require('sql.js')();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  try {
    const r = db.exec("SELECT patient_name, event_date, rm, room FROM admission_discharge_entries WHERE is_deleted = 0 AND event_type = '퇴원' ORDER BY event_date");
    const out = {};      // 이름 → 가장 늦은 퇴원일(재입원 구분은 호출 쪽이 입원일과 비교)
    for (const [name, date, rm, room] of (r[0] ? r[0].values : [])) (out[String(name).trim()] ??= []).push({ date: String(date).slice(0, 10), rm, room });
    return out;
  } finally { db.close(); }
}
module.exports = { loadDischarges };
