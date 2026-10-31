// 앱 전체가 공유하는 '파일 역할' 목록. 모듈은 역할 이름(status, eval …)으로 경로를 받는다 — 폴더 경로는 PC마다 달라 설정에서 지정.
const fs = require('fs'), path = require('path');
const { nfc } = require('./xl');

const ROLES = {
  status:    { label: '작업치료현황', key: '작업치료현황', hint: 'OneDrive › 미래병원(OT) — 팀 시트·현황판·평일시간표(CCRT) 포함', exts: ['xlsx'] },
  eval:      { label: '2026 재활평가관리 OT통합', key: '재활평가관리', hint: '평가일정·산재·CCRT 명단·주치의 off 달력', exts: ['xlsx'] },
  cleaning:  { label: '청소분담표', key: '청소분담', hint: '과거 분기 시트 = 배정 이력', exts: ['xlsx', 'xlsm'] },
  sci:       { label: 'SCI 비회복기 명단', key: 'SCI 비회복기', hint: '월별 시트', exts: ['xlsx'] },
  timetable10: { label: '10F 환자전체시간표(원본)', key: '10F 환자전체시간표', hint: 'OneDrive › 시간표 및 현황 — 카드의 "회복기 재활치료 스케줄"/"재활치료 스케줄"로 비회복기 판별', exts: ['xlsx'] },
  timetable3:  { label: '3F 환자전체시간표(원본)', key: '3F 환자전체시간표', hint: '10F와 같은 형식', exts: ['xlsx'] },
  fall:      { label: '낙상방지 순회 체크리스트', key: '낙상방지', hint: '월별 시트 + 치료사명단 시트', exts: ['xlsx'] },
  tools:     { label: '작업치료 도구 목록', key: '도구 목록', hint: '비품·소모품·수량', exts: ['xlsx'] },
  supply:    { label: '사무용품 청구서(OT)', key: '청구서', hint: '청구 시트(M.DD (3F/10F))에서 도구 목록 반영 대상을 가져옵니다', exts: ['xlsx', 'xlsm'] },
  messenger: { label: '메신저 DB (messenger.db)', key: 'messenger.db', hint: '퇴원 일정 읽기용 — 읽기만 합니다', exts: ['db'], exact: true },
};

function find(dir, role, depth = 0) {
  const r = ROLES[role]; let out = [], ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name), n = nfc(e.name);
    if (e.isFile()) {
      const ext = n.split('.').pop().toLowerCase();
      if (!r.exts.includes(ext) || n.startsWith('~$')) continue;
      if (r.exact ? n.toLowerCase() === r.key : n.includes(r.key)) out.push(p);
    } else if (e.isDirectory() && depth < 2 && !n.startsWith('.') && !/^(node_modules|\.tmp)$/.test(n)) out = out.concat(find(p, role, depth + 1));
  }
  return out;
}
module.exports = { ROLES, find };
