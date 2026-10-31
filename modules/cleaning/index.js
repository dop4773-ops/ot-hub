// 청소분담표 모듈: 층(10층=1·2팀, 3층=3팀)별로 따로 — 팀 시트 직책(제외)·과거 이력 → 균등·새 구역 우선 배정, 대청소(소독 담당·지원배치), 원본 서식 그대로 새 xlsx 저장
const { loadHistory } = require('./history');
const { assign, countsOf, zoneCounts } = require('./assign');
const { bigClean } = require('./bigclean');
const { loadFloorPlan } = require('./floorplan');
const { buildWorkbook } = require('./template');
const { loadStaff } = require('../../shared/staff');
const { loadFloors } = require('../attendance');
const defaults = require('./slots.json');

const floorDefaults = () => ({ '10층': { slots: defaults.weekday, fixed: defaults.fixed, toolCabinetN: defaults.bigClean.toolCabinetN, airFilters: defaults.bigClean.airFilters, bigSlots: defaults.bigClean.slots },
  '3층': JSON.parse(JSON.stringify(defaults.floor3)) });
const defaultRules = () => ({ floors: floorDefaults(), zoneWeight: 30, zoneNovelty: 3, excludeRanks: ['실장', '팀장'], excludeNames: [] });
const autoUse = r => !r.warn && r.rows.length >= 20 && r.rows.length <= 35;      // 구조가 다른 옛 시트는 기본 제외
function mergeRules(saved) {
  const d = defaultRules(), s = saved || {};
  if (s.slots) s.floors = { '10층': { slots: s.slots, fixed: s.fixed || d.floors['10층'].fixed, toolCabinetN: s.toolCabinetN ?? d.floors['10층'].toolCabinetN, airFilters: s.airFilters || d.floors['10층'].airFilters } };   // 예전(층 구분 없던) 저장값을 10층으로
  return { ...d, ...s, floors: { '10층': { ...d.floors['10층'], ...(s.floors || {})['10층'] }, '3층': { ...d.floors['3층'], ...(s.floors || {})['3층'] } } };
}

module.exports = {
  id: 'cleaning', title: '청소분담표',
  register({ ipc, settings, dialog }) {
    let hist = {};
    const rowsOf = names => names.flatMap(n => (hist[n] ? hist[n].rows : []));
    const rules = () => mergeRules(settings.mod('cleaning').rules);

    ipc.handle('cleaning:load', async () => {
      const f = settings.files(), m = settings.mod('cleaning');
      if (!f.cleaning || !f.status) return { error: '청소분담표와 작업치료현황 파일을 먼저 연결하세요' };
      hist = await loadHistory(f.cleaning);
      const sheets = Object.entries(hist).map(([name, r]) => {
        const cats = {}; r.rows.forEach(x => cats[x.category] = (cats[x.category] || 0) + 1);
        return { name, count: r.rows.length, warn: r.warn || '', cats, auto: autoUse(r), use: m.useSheets?.[name] ?? autoUse(r) };
      });
      // 직원의 층 = 작업치료현황 평일시간표의 층별 치료사 명단(1·2팀 = 10층, 3팀 = 3층)
      const [staff, floors] = [await loadStaff(f.status), await loadFloors(f.status)];
      const floorOf = {}; for (const [fl, list] of Object.entries(floors)) list.forEach(n => { floorOf[n] = fl; });
      return { sheets, staff: staff.map(s => ({ ...s, floor: floorOf[s.name] || (s.team === 3 ? '3층' : s.team ? '10층' : '') })), rules: rules(), hasPlan: { '10층': true, '3층': false } };
    });
    ipc.handle('cleaning:floorplan', async (_, floor) => { const f = settings.files(); return floor === '10층' && f.cleaning ? loadFloorPlan(f.cleaning) : null; });   // 배치도(Sheet1)는 10층 것만 있다
    ipc.handle('cleaning:saveRules', (_, r, useSheets) => { settings.setMod('cleaning', { ...settings.mod('cleaning'), rules: r, useSheets }); return true; });

    ipc.handle('cleaning:run', (_, { floor, people, useSheets, lastSheet, seed }) => {
      const r = rules(), h = rowsOf(useSheets), fr = r.floors[floor];
      const out = assign({ slots: fr.slots, people, history: h, lastRows: rowsOf(lastSheet ? [lastSheet] : []), seed, zoneWeight: r.zoneWeight, zoneNovelty: r.zoneNovelty });
      const cnt = countsOf(h), zc = zoneCounts(h);
      return { cells: out.cells, spare: out.spare, counts: Object.fromEntries(people.map(p => [p, cnt[p] || {}])), zones: Object.fromEntries(people.map(p => [p, zc[p] || {}])) };
    });
    ipc.handle('cleaning:big', (_, { floor, cells, people, useSheets, seed }) => {
      const fr = rules().floors[floor];
      return bigClean({ weekdayCells: cells, bigSlots: fr.bigSlots, people, history: rowsOf(useSheets), n: fr.toolCabinetN, airFilters: fr.airFilters, seed });
    });
    ipc.handle('cleaning:save', async (_, { floor, sheetName, date, cells, big }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `청소분담표_${floor}_${sheetName}.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      const fr = rules().floors[floor];
      const wb = await buildWorkbook({ templateFile: settings.files().cleaning, floor, sheetName, date, cells, fixed: fr.fixed, big: big && { tool: big.tool, cells: big.cells, airFilters: big.airOn === false ? [] : big.airFilters } });
      await wb.xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
