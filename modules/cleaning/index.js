// 청소분담표 모듈: 과거 분기 시트 이력 + 팀 시트 직책 → 균등·새 구역 우선 배정, 대청소(소독 담당·지원배치), 새 xlsx 저장
const { loadHistory } = require('./history');
const { assign, countsOf, zoneCounts } = require('./assign');
const { bigClean } = require('./bigclean');
const { build } = require('./export');
const { loadStaff } = require('../../shared/staff');
const defaults = require('./slots.json');

const defaultRules = () => ({
  slots: defaults.weekday, fixed: defaults.fixed, toolCabinetN: defaults.bigClean.toolCabinetN, airFilters: defaults.bigClean.airFilters,
  zoneWeight: 30, zoneNovelty: 3, excludeRanks: ['실장', '팀장'], excludeNames: [],
});
const autoUse = r => !r.warn && r.rows.length >= 20 && r.rows.length <= 35;      // 구조가 다른 옛 시트는 기본 제외

module.exports = {
  id: 'cleaning', title: '청소분담표',
  register({ ipc, settings, dialog }) {
    let hist = {};
    const rowsOf = names => names.flatMap(n => (hist[n] ? hist[n].rows : []));
    const rules = () => ({ ...defaultRules(), ...settings.mod('cleaning').rules });

    ipc.handle('cleaning:load', async () => {
      const f = settings.files(), m = settings.mod('cleaning');
      if (!f.cleaning || !f.status) return { error: '청소분담표와 작업치료현황 파일을 먼저 연결하세요' };
      hist = await loadHistory(f.cleaning);
      const sheets = Object.entries(hist).map(([name, r]) => {
        const cats = {}; r.rows.forEach(x => cats[x.category] = (cats[x.category] || 0) + 1);
        return { name, count: r.rows.length, warn: r.warn || '', cats, auto: autoUse(r), use: m.useSheets?.[name] ?? autoUse(r) };
      });
      return { sheets, staff: await loadStaff(f.status), rules: rules() };
    });
    ipc.handle('cleaning:saveRules', (_, r, useSheets) => { settings.setMod('cleaning', { ...settings.mod('cleaning'), rules: r, useSheets }); return true; });

    ipc.handle('cleaning:run', (_, { people, useSheets, lastSheet, seed }) => {
      const r = rules(), h = rowsOf(useSheets);
      const out = assign({ slots: r.slots, people, history: h, lastRows: rowsOf(lastSheet ? [lastSheet] : []), seed, zoneWeight: r.zoneWeight, zoneNovelty: r.zoneNovelty });
      const cnt = countsOf(h), zc = zoneCounts(h);
      return { cells: out.cells, spare: out.spare, counts: Object.fromEntries(people.map(p => [p, cnt[p] || {}])), zones: Object.fromEntries(people.map(p => [p, zc[p] || {}])) };
    });
    ipc.handle('cleaning:big', (_, { cells, useSheets, seed }) => {
      const r = rules(), b = bigClean({ weekdayCells: cells, history: rowsOf(useSheets), n: r.toolCabinetN, airFilters: r.airFilters, seed });
      return { tool: b.tool, airFilters: b.airFilters, vacatedIdx: b.vacated.map(c => cells.indexOf(c)) };
    });
    ipc.handle('cleaning:save', async (e, { sheetName, date, cells, big }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `청소분담표_${sheetName}.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      let b = null;
      if (big) b = { tool: big.tool, airFilters: big.airFilters, vacated: big.vacatedIdx.map(i => { const c = cells[i]; c.support = big.support?.[i] || ''; return c; }) };
      await build({ title: '미래병원 작업치료실 청소분담표(10층)', sheetName, date, cells, fixed: rules().fixed, big: b }).xlsx.writeFile(r.filePath);
      return r.filePath;
    });
  },
};
