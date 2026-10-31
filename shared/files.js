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
  pot:       { label: '환자 평가명단 - POT 통합 (월별)', key: '환자 평가명단', hint: 'OT·PT 통합 평가일 — 직전 평가일의 출처이자 내보내기 서식. 지난 달 파일들을 모두 연결하세요', exts: ['xlsx'], multi: true },
  saturday:  { label: '토요일&공휴일 시간표', key: '토요일&공휴일', hint: 'OneDrive › 미래병원(OT) — 시트 이름 "10.24(1팀)" = 그날 근무 팀, 빨간 테두리 = 3층 근무', exts: ['xlsx'] },
  attendance:{ label: '출근부 원본(자동화 양식)', key: '출근부', hint: '설정·직원명단·출근부 시트가 있는 원본 — 이 서식 그대로 내보냅니다', exts: ['xlsx'] },
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

// 여러 폴더를 한 번에 훑어 모든 역할의 파일을 찾는다(폴더 안의 폴더까지 maxDepth단계). 같은 역할 파일이 여럿이면 가장 최근에 고친 것을 쓴다(월별 POT는 전부).
// 백업·휴지통 폴더는 건너뛰고, deadlineMs를 넘기면 거기까지 찾은 것만 돌려준다.
const SKIP = /^(node_modules|\.tmp|\$recycle\.bin|system volume information|appdata|windows|program files.*|programdata|library)$|백업|backup|휴지통/i;
function scanAll(roots, { maxDepth = 5, deadlineMs = 25000, exclude = [] } = {}) {
  const ex = exclude.map(x => path.resolve(x));
  const t0 = Date.now(), best = {}, pot = {}, seen = new Set();
  const roles = Object.entries(ROLES);
  const walk = (dir, depth) => {
    if (Date.now() - t0 > deadlineMs || seen.has(dir) || ex.some(x => dir === x || dir.startsWith(x + path.sep))) return; seen.add(dir);
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const n = nfc(e.name), p = path.join(dir, e.name);
      if (e.isFile()) {
        if (n.startsWith('~$')) continue; const ext = n.split('.').pop().toLowerCase();
        for (const [role, r] of roles) {
          if (!r.exts.includes(ext) || !(r.exact ? n.toLowerCase() === r.key : n.includes(r.key))) continue;
          let mt = 0; try { mt = fs.statSync(p).mtimeMs; } catch { /* 무시 */ }
          if (r.multi) { if (!pot[n] || mt > pot[n].mt) pot[n] = { p, mt }; } else if (!best[role] || mt > best[role].mt) best[role] = { p, mt };
        }
      } else if (e.isDirectory() && depth < maxDepth && !n.startsWith('.') && !SKIP.test(n)) walk(p, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return { files: Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.p])), pot: Object.values(pot).map(v => v.p), ms: Date.now() - t0, timedOut: Date.now() - t0 > deadlineMs };
}
// 이 PC에서 파일이 있을 만한 기본 폴더들(맥·윈도우 공통) — 클라우드 동기화 폴더(구글 드라이브·원드라이브)를 먼저
function defaultRoots() {
  const os = require('os'), home = os.homedir(), out = [], add = d => { try { if (fs.statSync(d).isDirectory()) out.push(d); } catch { /* 없음 */ } };
  const kids = d => { try { return fs.readdirSync(d).map(x => path.join(d, x)); } catch { return []; } };
  kids(path.join(home, 'Library', 'CloudStorage')).forEach(add);
  kids(home).filter(x => /^(OneDrive|Google Drive|구글 드라이브)/i.test(path.basename(x))).forEach(add);
  if (process.platform === 'win32') for (const L of 'GHDEFIJK') { add(`${L}:\\내 드라이브`); add(`${L}:\\My Drive`); add(`${L}:\\`); }
  for (const d of ['Desktop', '바탕 화면', 'Documents', '문서', 'Downloads', '다운로드']) add(path.join(home, d));
  return [...new Set(out)];
}
module.exports = { ROLES, find, scanAll, defaultRoots };
