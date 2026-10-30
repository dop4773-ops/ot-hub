// 도구 목록: 사무용품 신청서를 가져와(자동 반영 아님) 내가 분류 → 비품/소모품·위치·교체/추가 구분 → 갱신본 저장. 목록에 없는 품목·미분류는 알려 준다.
const L = require('./logic');

module.exports = {
  id: 'inventory', title: '도구 목록',
  register({ ipc, settings, dialog }) {
    ipc.handle('inventory:load', async () => { const f = settings.files(); if (!f.tools) return { error: '작업치료 도구 목록 파일을 연결하세요' }; return { items: await L.loadTools(f.tools), draft: settings.mod('inventory').draft || null }; });
    ipc.handle('inventory:preview', async () => { const f = settings.files(); if (!f.supply) return { error: '사무용품 신청서 파일을 연결하세요' }; const sheets = await L.previewSupply(f.supply); return { sheets, guess: sheets.map(s => ({ name: s.name, header: s.rows.findIndex(r => r.some(c => /품명|품목|물품/.test(c.replace(/\s+/g, '')))), cols: L.guessCols(s.rows[Math.max(0, s.rows.findIndex(r => r.some(c => /품명|품목|물품/.test(c.replace(/\s+/g, '')))))] || []) })) }; });
    ipc.handle('inventory:import', async (_, { map, items }) => L.importSupply(settings.files().supply, map, items));
    ipc.handle('inventory:apply', (_, { items, imported }) => L.apply(items, imported));
    ipc.handle('inventory:saveDraft', (_, d) => { settings.setMod('inventory', { ...settings.mod('inventory'), draft: d }); return true; });
    ipc.handle('inventory:save', async (_, { items, log }) => {
      const r = await dialog.showSaveDialog({ defaultPath: '작업치료 도구 목록(갱신).xlsx', filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null; await L.build({ items, log, manager: '' }).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
