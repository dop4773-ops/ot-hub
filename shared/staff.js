// 작업치료현황 '팀' 시트 → 직원 명단. 위쪽 표: 팀별 팀장·부팀장·주임·사원(B..), 아래쪽 표: 이름 | 직책 또는 연차.
const { txt, open } = require('./xl');

const RANKS = ['실장', '팀장', '부팀장', '주임', '사원'];

const { memo } = require('./cache');
const loadStaff = file => memo('staff', file, () => parseStaff(file));
async function parseStaff(file) {
  const ws = (await open(file)).getWorksheet('팀');
  if (!ws) throw new Error("'팀' 시트를 찾지 못했습니다");
  const team = {};                                            // 이름 → 팀 번호 (위쪽 표: A열에 '1팀' 같은 값)
  for (let r = 1; r <= 8; r++) {
    const m = txt(ws.getCell(r, 1)).match(/^(\d)팀$/); if (!m) continue;
    for (let c = 2; c <= 30; c++) { const n = txt(ws.getCell(r, c)).trim(); if (n) team[n] = +m[1]; }
  }
  const staff = []; let rank = null;
  for (let r = 9; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, 1)).trim(), b = txt(ws.getCell(r, 2)).trim();
    if (!name || /전체|인원/.test(name)) continue;
    let years = null;
    if (RANKS.includes(b)) rank = b; else if (/^\d+$/.test(b)) { rank = '사원'; years = +b; } else continue;
    staff.push({ name, rank, years, team: team[name] || null });
  }
  return staff;
}

// 직급·경력순: 실장 → 팀장(1,2,3팀) → 부팀장(1,2,3팀) → 주임(1,2,3팀) → 사원(연차 높은 순, 같으면 팀 번호순)
function seniority(a, b) {
  const ra = RANKS.indexOf(a.rank), rb = RANKS.indexOf(b.rank);
  return ra - rb || (b.years || 0) - (a.years || 0) || (a.team || 9) - (b.team || 9);
}
const sortSeniority = staff => [...staff].sort(seniority);

module.exports = { loadStaff, sortSeniority, RANKS };
