// 낙상방지 순회 체크리스트: 치료사명단·월별 이력으로 다음 달 순회 담당을 공평하게 배정 → 미리보기에서 고쳐서 새 엑셀로 저장
const L = require('./logic');

module.exports = {
  id: 'fall', title: '낙상 순회',
  register({ ipc, settings, dialog }) {
    ipc.handle('fall:load', async () => {
      const f = settings.files(); if (!f.fall) return { error: '낙상방지 순회 체크리스트 파일을 연결하세요' };
      const [roster, history] = [await L.loadRoster(f.fall), await L.loadHistory(f.fall)];
      return { roster, months: Object.keys(history).map(Number), slots: L.SLOTS, holidays: settings.mod('fall').holidays || {} };
    });
    ipc.handle('fall:generate', async (_, { year, month, holidays, seed }) => {
      const f = settings.files(), [roster, history] = [await L.loadRoster(f.fall), await L.loadHistory(f.fall)];
      const hist = {}; for (const [m, v] of Object.entries(history)) if (Number(m) !== month) hist[m] = v;       // 같은 달의 기존 내용은 이력에서 뺀다
      settings.setMod('fall', { ...settings.mod('fall'), holidays });
      const r = L.generate({ year, month, roster, history: hist, holidays, seed });
      return { ...r, issues: L.check({ weeks: r.weeks, roster }) };
    });
    ipc.handle('fall:check', async (_, { weeks }) => L.check({ weeks, roster: await L.loadRoster(settings.files().fall) }));
    ipc.handle('fall:save', async (_, { year, month, weeks }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `낙상방지 순회 체크리스트_${year}-${String(month).padStart(2, '0')}.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null; await L.build({ year, month, weeks }).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
