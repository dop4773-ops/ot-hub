// 신환 평가명단: 현황 입원일이 지정 기간인 입원 환자 → 평가항목(EMR 평가 처방 + 구분별 기본) · 평가일(14일 이전·주치의 off 회피)
const { loadStatus } = require('../../shared/status');
const { loadOff } = require('../../shared/off');
const { loadEmr } = require('./emr');
const { buildRoster } = require('./roster');
const { build } = require('./export');

const merge = (a, b) => { const o = {}; for (const src of [a, b]) for (const [d, l] of Object.entries(src || {})) (o[d] ??= []).push(...l); return o; };

module.exports = {
  id: 'roster', title: '신환 평가명단',
  register({ ipc, settings, dialog }) {
    ipc.handle('roster:run', async (_, { from, to, year, month }) => {
      const f = settings.files(); if (!f.status) return { error: '작업치료현황 파일을 연결하세요' };
      const ev = settings.mod('eval'), rules = { idealGap: 17, lastDay: 14, cap: 0, holidays: [], pmBlocks: true, ...ev.rules };
      const status = await loadStatus(f.status);
      const emrData = settings.emr().length ? await loadEmr(settings.emr()) : { by: {}, from: null, to: null };
      const off = merge(f.eval ? (await loadOff(f.eval)).off : {}, ev.offManual);
      const r = buildRoster({ status, emr: emrData.by, from, to, year, month, off, ...rules });
      return { rows: r.rows, off, emr: { from: emrData.from, to: emrData.to, patients: Object.keys(emrData.by).length }, lastDay: rules.lastDay };
    });
    ipc.handle('roster:save', async (_, { month, batch, rows }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `환자 평가명단_${month}월.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      await build({ month, batch, rows }).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
