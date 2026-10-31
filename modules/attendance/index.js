// 출근부: 층을 고르면 작업치료현황 평일시간표에서 그 층 치료사만 모아, 팀 시트 직급·경력순(팀장→부팀장→주임→사원 연차순)으로 출근부를 만든다.
const { loadStaff, sortSeniority } = require('../../shared/staff');
const { txt, open } = require('../../shared/xl');
const { build, fixedHolidays } = require('./build');
const tpl = require('./template');
const fs = require('fs');

// '평일시간표(원본)': 2행 '10층 치료실'/'3층 치료실'(병합 범위가 열 범위), 4행 치료사 이름
const { memo } = require('../../shared/cache');
const loadFloors = f => memo('floors', f, () => parseFloors(f));
async function parseFloors(statusFile) {
  const ws = (await open(statusFile)).worksheets.find(w => /평일시간표/.test(w.name));
  if (!ws) throw new Error("'평일시간표(원본)' 시트를 찾지 못했습니다");
  const heads = [];
  for (let c = 1; c <= ws.columnCount; c++) { const m = txt(ws.getCell(2, c)).match(/(\d+)층/); if (m && !(heads.length && heads[heads.length - 1].floor === m[1] + '층')) heads.push({ floor: m[1] + '층', c }); }   // 병합 셀은 범위의 모든 열이 같은 글자를 돌려주므로 처음 열만
  const floors = {};
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].c - 1 : ws.columnCount; floors[h.floor] = [];
    for (let c = Math.max(2, h.c - 1); c <= end; c++) { const n = txt(ws.getCell(4, c)).trim(); if (/^[가-힣]{2,4}$/.test(n) && !/빈타임|타임별/.test(n)) floors[h.floor].push(n); }
  });
  return floors;
}

module.exports = {
  id: 'attendance', title: '출근부',
  register({ ipc, settings, dialog }) {
    const cfg = () => ({ holidays: null, perBlock: 6, ...settings.mod('attendance') });
    ipc.handle('attendance:load', async () => {
      const f = settings.files(); if (!f.status) return { error: '작업치료현황 파일을 연결하세요' };
      const [floors, staff] = [await loadFloors(f.status), await loadStaff(f.status)];
      const by = Object.fromEntries(staff.map(s => [s.name, s])), order = {};
      for (const [fl, names] of Object.entries(floors)) {
        const known = sortSeniority(names.filter(n => by[n]).map(n => by[n])), unknown = names.filter(n => !by[n]);
        order[fl] = [...known.map(s => ({ name: s.name, rank: s.rank, years: s.years, team: s.team })), ...unknown.map(n => ({ name: n, rank: '', years: null, team: null, unknown: true }))];
      }
      return { floors: order, cfg: cfg() };
    });
    ipc.handle('attendance:saveCfg', (_, c) => { settings.setMod('attendance', c); return true; });
    ipc.handle('attendance:save', async (_, { year, month, floor, names, holidays, perBlock, workWeekend }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `${year}년_${month}월_${floor}_출근부.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      const t = settings.files().attendance;
      if (t) { fs.writeFileSync(r.filePath, await tpl.build({ templateFile: t, year, month, floor, names, holidays })); return r.filePath; }          // 원본 서식 그대로(권장)
      await build({ year, month, floorLabel: floor, names, holidays, perBlock, workWeekend }).xlsx.writeFile(r.filePath); return r.filePath;     // 원본이 없으면 간이 서식
    });
    ipc.handle('attendance:fixedHolidays', (_, year) => fixedHolidays(year));
  },
};
module.exports.loadFloors = loadFloors;
