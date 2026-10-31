// 평가일 관리 (OT·PT 통합 = "환자 평가명단 - POT 통합"): 재원 환자(직전 평가일 + 한 달)와 신환(입원 후 17일)의 이번 달 평가일·평가항목 초안.
//  · 직전 평가일 = 연결한 POT 통합 파일들, 평가항목 = EMR 평가 처방(액팅 기록) + 환자 구분별 기본 항목
//  · 모든 평가일은 14일 이전, 담당 주치의가 쉬는 날은 평가를 잡지 않는다(일반 평가). CCRT는 별도 기능(주치의 off 무관).
//  · 내보내기는 POT 통합 파일(가장 최근 달)의 시트 서식을 그대로 쓴다.
const { loadStatus } = require('../../shared/status');
const { loadOff } = require('../../shared/off');
const { loadPot } = require('../../shared/pot');
const { loadEmr } = require('./emr');
const { buildRoster } = require('./roster');
const { build, buildFromTemplate } = require('./export');

const merge = (a, b) => { const o = {}; for (const src of [a, b]) for (const [d, l] of Object.entries(src || {})) (o[d] ??= []).push(...l); return o; };
const DEF = { idealGap: 17, lastDay: 14, cap: 0, holidays: [], pmBlocks: true, minGap: 21, maxGap: 30, monthGap: 28 };

module.exports = {
  id: 'roster', title: '평가일 관리',
  register({ ipc, settings, dialog }) {
    const cfg = () => { const m = settings.mod('roster'); return { rules: { ...DEF, ...m.rules }, offManual: m.offManual || {} }; };
    ipc.handle('roster:load', async () => {
      const f = settings.files(), pots = settings.pot(), c = cfg();
      const pot = pots.length ? await loadPot(pots) : { files: [], byName: {} };
      let sheetOff = {}, calendar = null; if (f.eval) { const o = await loadOff(f.eval); sheetOff = o.off; calendar = { year: o.year, month: o.month }; }
      return { ...c, pot: pot.files, potCount: Object.keys(pot.byName).length, sheetOff, calendar, emrFiles: settings.emr().length, hasStatus: !!f.status };
    });
    ipc.handle('roster:saveCfg', (_, c) => { settings.setMod('roster', { ...settings.mod('roster'), ...c }); return true; });
    ipc.handle('roster:run', async (_, { from, to, year, month, scope }) => {
      const f = settings.files(); if (!f.status) return { error: '작업치료현황 파일을 연결하세요' };
      const c = cfg(), status = await loadStatus(f.status);
      const emrData = settings.emr().length ? await loadEmr(settings.emr()) : { by: {}, from: null, to: null };
      const pot = settings.pot().length ? await loadPot(settings.pot()) : { byName: {}, files: [] };
      const off = merge(f.eval ? (await loadOff(f.eval)).off : {}, c.offManual);
      const r = buildRoster({ status, emr: emrData.by, pot: pot.byName, from, to, year, month, off, scope, ...c.rules });
      return { rows: r.rows, off, load: r.load, cap: r.cap, lastDay: c.rules.lastDay, emr: { from: emrData.from, to: emrData.to, patients: Object.keys(emrData.by).length }, potFiles: pot.files.length };
    });
    ipc.handle('roster:save', async (_, { month, batch, rows }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `환자 평가명단 - POT 통합 ${month}월.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      const pots = settings.pot();
      let wb;
      if (pots.length) { const info = (await loadPot(pots)).files.filter(x => x.month).sort((a, b) => b.month.localeCompare(a.month)); wb = await buildFromTemplate({ templateFile: (info[0] || { file: pots[pots.length - 1] }).file, month, batch, rows }); }   // 가장 최근 달 파일의 서식
      else wb = build({ month, batch, rows });
      await wb.xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
