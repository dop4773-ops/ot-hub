// SCI 비회복기 명단 = 현황판에서 척수손상 색(주황)으로 칠해진 '일반'(회복기 종료) 환자, 또는 평가항목에 SCIM이 있는 비회복기 환자
const { loadStatus } = require('../../shared/status');
const { loadScimNames, loadPrevList, buildList, sheetNames } = require('./sci');
const { build } = require('./export');

module.exports = {
  id: 'sci', title: 'SCI 비회복기 명단',
  register({ ipc, settings, dialog }) {
    ipc.handle('sci:sheets', async () => { const f = settings.files(); return f.sci ? sheetNames(f.sci) : []; });
    ipc.handle('sci:run', async (_, { prevSheet }) => {
      const f = settings.files(); if (!f.status || !f.eval) return { error: '작업치료현황과 재활평가관리 파일을 연결하세요' };
      const status = {}; (await loadStatus(f.status)).forEach(s => { status[s.name] = s; });
      const scim = await loadScimNames(f.eval), prev = prevSheet && f.sci ? await loadPrevList(f.sci, prevSheet) : [];
      const r = buildList({ status, scim, prev });
      const pd = Object.fromEntries(prev.map(p => [p.name, p]));
      r.rows.forEach(x => { const p = pd[x.name]; x.warn = p && p.doctor && p.doctor !== x.doctor ? `이전 명단 RM${p.doctor} ↔ 현황 RM${x.doctor}` : ''; if (p && p.memo && !x.memo) x.memo = p.memo; });
      return r;
    });
    ipc.handle('sci:save', async (_, { month, rows }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `SCI 비회복기 명단_${month}월.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null; await build({ month, rows }).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
