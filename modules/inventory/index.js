// 도구 목록: 사무용품 청구서(시트마다 한 번의 청구)를 읽어 → 사람이 분류(신규/추가/교체/소진/제외) → 갱신본 저장.
// 정기 사무용품(인쇄된 항목)은 목록 대상이 아니라 기본 '제외', 기타 주문건(직접 적은 줄)만 분류가 필요하다.
const L = require('./logic');
const { loadRequests } = require('./request');

module.exports = {
  id: 'inventory', title: '도구 목록',
  register({ ipc, settings, dialog }) {
    const mod = () => ({ done: {}, draft: {}, ...settings.mod('inventory') });
    ipc.handle('inventory:load', async () => {
      const f = settings.files(); if (!f.tools) return { error: '작업치료 도구 목록 파일을 연결하세요' };
      const items = await L.loadTools(f.tools), history = await L.loadHistory(f.tools), m = mod();
      let sheets = [];
      if (f.supply) {
        sheets = (await loadRequests(f.supply)).map(s => ({ name: s.name, date: s.date, floor: s.floor, done: m.done[s.name] || null,
          items: s.items.map(i => { const x = L.match(i.name, items); return { ...i, date: s.date, floor: s.floor, matchId: x.exact[0] || x.near[0] || null, matchKind: x.exact.length ? '정확히 일치' : x.near.length ? '비슷함' : '목록에 없음', candidates: [...x.exact, ...x.near] }; }) }));
      }
      return { items, sheets, draft: m.draft, hasSupply: !!f.supply, history };
    });
    ipc.handle('inventory:saveDraft', (_, draft) => { settings.setMod('inventory', { ...mod(), draft }); return true; });
    ipc.handle('inventory:apply', (_, { items, imported, manual }) => L.apply(items, imported, manual || []));
    ipc.handle('inventory:save', async (_, { items, log, sheets }) => {      // 변경이력 시트에 이번 변경을 이어 붙인 갱신본
      const r = await dialog.showSaveDialog({ defaultPath: '작업치료 도구 목록(갱신).xlsx', filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      const f = settings.files(), hist = await L.loadHistory(f.tools), add = log.map(l => ({ date: l.date, kind: l.kind, name: l.name, qty: l.qty, detail: [l.result, l.reqDate && l.floor ? `(청구 ${l.reqDate.slice(5)} ${l.floor})` : ''].filter(Boolean).join(' ') }));
      const wb = await L.buildInPlace({ templateFile: f.tools, items, history: hist.concat(add) }); await wb.xlsx.writeFile(r.filePath);
      const m = mod(); for (const s of sheets || []) m.done[s] = new Date().toISOString().slice(0, 10);   // 반영한 청구 시트 기억 → 다음에는 새 청구만 보인다
      m.draft = {}; settings.setMod('inventory', m); return r.filePath;
    });
  },
};
