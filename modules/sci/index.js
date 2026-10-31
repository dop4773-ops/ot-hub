// SCI 비회복기 명단 = 현황판에서 척수손상 색(주황)으로 칠해진 '일반'(회복기 종료) 환자, 또는 평가항목에 SCIM이 있는 비회복기 환자
const { loadStatus } = require('../../shared/status');
const { loadTimetableCards } = require('../../shared/timetable');
const { loadScimNames, loadPrevList, buildList, sheetNames } = require('./sci');
const { buildFromTemplate } = require('./export');

module.exports = {
  id: 'sci', title: 'SCI 비회복기 명단',
  register({ ipc, settings, dialog }) {
    // 월 시트 순서: 고른 달보다 앞선 가장 가까운 달의 시트를 기준으로 한다(없으면 가장 최근 시트). 사용자가 따로 고르지 않는다.
    const prevOf = (names, month) => { const ms = names.map(n => ({ n, m: (n.match(/^(\d{1,2})월$/) || [])[1] })).filter(x => x.m).map(x => ({ ...x, m: Number(x.m) })).sort((a, b) => a.m - b.m); const before = ms.filter(x => x.m < month); return (before.length ? before[before.length - 1] : ms[ms.length - 1] || {}).n || ''; };
    ipc.handle('sci:sheets', async (_, month) => { const f = settings.files(); const names = f.sci ? await sheetNames(f.sci) : []; return { names, prev: month ? prevOf(names, month) : '' }; });
    ipc.handle('sci:run', async (_, { month }) => {
      const f = settings.files(); if (!f.status || !f.eval) return { error: '작업치료현황과 재활평가관리 파일을 연결하세요' };
      const status = {}; (await loadStatus(f.status)).forEach(s => { status[s.name] = s; });
      const prevSheet = f.sci ? prevOf(await sheetNames(f.sci), month) : '', scim = await loadScimNames(f.eval), prev = prevSheet ? await loadPrevList(f.sci, prevSheet) : [];
      let nonRecovery = null;
      const tts = [f.timetable10, f.timetable3].filter(Boolean);
      if (tts.length) { nonRecovery = new Set(); for (const t of tts) for (const [n, c] of Object.entries(await loadTimetableCards(t))) if (!c.recovery) nonRecovery.add(n); }
      const r = buildList({ status, scim, nonRecovery, prev }); r.timetable = !!nonRecovery;
      const pd = Object.fromEntries(prev.map(p => [p.name, p]));
      r.rows.forEach(x => { const p = pd[x.name]; x.warn = p && p.doctor && p.doctor !== x.doctor ? `이전 명단 RM${p.doctor} ↔ 현황 RM${x.doctor}` : ''; if (p && p.memo && !x.memo) x.memo = p.memo; });
      r.prevSheet = prevSheet; return r;
    });
    ipc.handle('sci:save', async (_, { month, rows }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `SCI 비회복기 명단_${month}월.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null; await (await buildFromTemplate({ templateFile: settings.files().sci, month, rows })).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
