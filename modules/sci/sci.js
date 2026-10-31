// SCI 비회복기 월별 명단 = 작업치료현황의 '입원/재입원' 환자 중 회복기가 끝난 척수손상(구분이 '척수손상'에서 '일반'으로 바뀐 사람) ∧ 평가항목에 SCIM.
// (실제 10→11월 명단 13명을 이 규칙이 그대로 재현함을 core/sci.test.js로 확인)
const ExcelJS = require('exceljs');
const { memo } = require('../../shared/cache');
const { open } = require('../../shared/xl');
const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); if (v.result != null) return String(v.result); return String(v); };
const rm = v => (String(v).match(/\d/) || [''])[0];
const day = c => { const v = c && c.value; return v instanceof Date ? v.toISOString().slice(0, 10) : null; };

// 작업치료현황.xlsx '현황(회복기)': C구분 D진료과 E병실 F성명 G입원일 I입원상태 J특이사항
async function loadStatus(file) {
  const ws = (await new ExcelJS.Workbook().xlsx.readFile(file)).getWorksheet('현황(회복기)');
  if (!ws) throw new Error("'현황(회복기)' 시트를 찾지 못했습니다");
  const out = {};
  for (let r = 3; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, 6)).trim(); if (!name) continue;
    out[name] = { name, kind: txt(ws.getCell(r, 3)).trim(), doctor: rm(txt(ws.getCell(r, 4))), room: txt(ws.getCell(r, 5)).trim(),
      admitted: day(ws.getCell(r, 7)), state: txt(ws.getCell(r, 9)).trim(), memo: txt(ws.getCell(r, 10)).trim() };
  }
  return out;
}

// 2026 재활평가관리 '평가일정': F이름 G평가항목
const loadScimNames = file => memo('scim', file, () => parseScim(file));
async function parseScim(file) {
  const ws = (await open(file)).getWorksheet('평가일정');
  const set = new Set();
  for (let r = 3; r <= ws.rowCount; r++) { const n = txt(ws.getCell(r, 6)).trim(); if (n && /SCIM/.test(txt(ws.getCell(r, 7)))) set.add(n); }
  return set;
}

// 이전 달 명단 파일 시트: B의사 C병실 D성명 E비고 → 순서 유지에 사용
async function loadPrevList(file, sheetName) {
  const ws = (await open(file)).getWorksheet(sheetName);
  if (!ws) return [];
  const out = [];
  for (let r = 3; r <= ws.rowCount; r++) { const n = txt(ws.getCell(r, 4)).trim(); if (n) out.push({ name: n, doctor: rm(txt(ws.getCell(r, 2))), room: txt(ws.getCell(r, 3)).trim(), memo: txt(ws.getCell(r, 5)).trim() }); }
  return out;
}

// asOf: 'YYYY-MM-DD' (월 첫날) — '곧 비회복기로 전환될 사람' 계산에 사용
// nonRecovery: 전체시간표 카드가 '재활치료 스케줄'(회복기 글자 없음)인 환자 이름 집합 — 없으면(시간표 미연결) SCIM만으로 판단
function buildList({ status, scim, nonRecovery = null, prev = [], asOf, recoveryDays = 180 }) {
  const active = s => s && (s.state === '입원' || s.state === '재입원');
  const SCI_COLOR = 'FFFFC000';   // 현황판에서 척수손상을 칠하는 주황색 — 구분이 '일반'이어도 이 색이면 비회복기 SCI
  const via = s => {
    const c = s.kindColor === SCI_COLOR, m = scim.has(s.name), t = nonRecovery ? nonRecovery.has(s.name) : null;
    const ok = c || (m && (t === null || t));                       // 색상(주황) 또는 SCIM + 시간표가 '재활'(비회복기)
    if (!ok) return null;
    return [c ? '색상' : null, m ? 'SCIM' : null, t ? '시간표' : null].filter(Boolean).join('+');
  };
  const members = Object.values(status).filter(s => active(s) && s.kind !== '척수손상' && via(s));
  const order = new Map(prev.map((p, i) => [p.name, i]));
  members.sort((a, b) => (order.has(a.name) ? order.get(a.name) : 1e6) - (order.has(b.name) ? order.get(b.name) : 1e6) || Number(a.doctor) - Number(b.doctor) || a.admitted.localeCompare(b.admitted));
  const prevSet = new Set(prev.map(p => p.name)), cur = new Set(members.map(m => m.name));
  const rows = members.map((m, i) => ({ no: i + 1, doctor: m.doctor, room: m.room, name: m.name, memo: m.memo && /종료|퇴원|전원/.test(m.memo) ? m.memo : '', isNew: !prevSet.has(m.name), via: via(m) }));
  const left = prev.filter(p => !cur.has(p.name)).map(p => ({ name: p.name, why: status[p.name] ? `${status[p.name].state}${status[p.name].memo ? ' · ' + status[p.name].memo : ''}` : '현황에 없음' }));
  // 회복기(척수손상 구분) 입원 중 환자 중 180일에 도달하는 날 — 곧 명단에 들어옴
  const toDay = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const soon = Object.values(status).filter(s => active(s) && s.kind === '척수손상' && s.admitted && scim.has(s.name))
    .map(s => ({ name: s.name, doctor: s.doctor, room: s.room, admitted: s.admitted, until: toDay(s.admitted, recoveryDays) }))
    .sort((a, b) => a.until.localeCompare(b.until));
  return { rows, left, soon };
}

module.exports = { loadStatus, loadScimNames, loadPrevList, buildList };

async function sheetNames(file) { return (await open(file)).worksheets.map(w => w.name); }
module.exports.sheetNames = sheetNames;
