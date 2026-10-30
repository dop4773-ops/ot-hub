// 평가일 관리: 일반 평가(14일 이전·주치의 off), CCRT(시간표 요일·회복기 종료/퇴원 전), 산재(MMSE/GDS 3개월)
const { loadSchedule, loadCycles } = require('./schedule');
const { planMonth, issuesOf, DEFAULTS } = require('./plan');
const { planCycle, issuesOfCycle, PRESETS } = require('./cycle');
const { loadCcrtSchedule, planCcrt, issuesOfCcrt, DEFAULT: CCRT } = require('./ccrt');
const { build, buildCycle } = require('./export');
const { loadStatus } = require('../../shared/status');
const { loadEmr } = require('../roster/emr');
const { loadDischarges } = require('../../shared/messenger');
const { fromCell } = require('../../shared/dates');

const defaults = () => ({ rules: { ...DEFAULTS }, ccrt: { ...CCRT }, sanjae: { ...PRESETS.sanjae }, offManual: {} });
const merge = (a, b) => { const o = {}; for (const src of [a, b]) for (const [d, l] of Object.entries(src || {})) (o[d] ??= []).push(...l); return o; };

module.exports = {
  id: 'eval', title: '평가일 관리',
  register({ ipc, settings, dialog }) {
    let data = null, ccrtCache = null;
    const cfg = () => { const m = settings.mod('eval'), d = defaults(); return { rules: { ...d.rules, ...m.rules }, ccrt: { ...d.ccrt, ...m.ccrt }, sanjae: { ...d.sanjae, ...m.sanjae }, offManual: m.offManual || {} }; };

    ipc.handle('eval:load', async () => {
      const f = settings.files(); if (!f.eval) return { error: '재활평가관리 파일을 연결하세요' };
      data = await loadSchedule(f.eval); data.cycles = await loadCycles(f.eval);
      const dates = data.patients.flatMap(p => Object.values(p.dates)).sort();
      return { cfg: cfg(), patients: data.patients.length, inpatients: data.patients.filter(p => p.status === '입원').length, latest: dates[dates.length - 1] || '',
        sheetOff: data.calendar.off, calendar: { year: data.calendar.year, month: data.calendar.month }, cycles: { ccrt: data.cycles.ccrt.length, sanjae: data.cycles.sanjae.length } };
    });
    ipc.handle('eval:saveCfg', (_, c) => { settings.setMod('eval', { ...settings.mod('eval'), ...c }); return true; });
    const offOf = () => merge(data.calendar.off, cfg().offManual);

    // ---- 일반 평가: 평가 종류는 EMR 액팅 기록(평가 처방)과 시트의 평가항목을 합쳐 쓴다 ----
    ipc.handle('eval:general', async (_, { year, month }) => {
      const c = cfg(), emr = settings.emr().length ? (await loadEmr(settings.emr())).by : {};
      const pts = data.patients.map(p => {
        const e = emr[p.name]; if (!e) return p;
        const have = new Set(p.items.split('/').map(s => s.trim())), add = [...e.OT].filter(i => !have.has(i) && !(i === 'HFT' && have.has('HFT/MFT')));
        return add.length ? { ...p, items: p.items + (p.items ? '/' : '') + add.join('/'), emrAdded: add } : p;
      });
      const r = planMonth({ patients: pts, year, month, off: offOf(), ...c.rules });
      const iss = issuesOf({ rows: r.rows, year, month, off: offOf(), ...c.rules });
      const by = Object.fromEntries(pts.map(p => [p.name, p]));
      r.rows.forEach((x, i) => { x.issues = iss[i]; x.emrAdded = by[x.name]?.emrAdded || []; });
      return r.rows;
    });
    ipc.handle('eval:generalCheck', (_, { rows, year, month }) => issuesOf({ rows, year, month, off: offOf(), ...cfg().rules }));

    // ---- CCRT ----
    ipc.handle('eval:ccrt', async (_, { year, month }) => {
      const f = settings.files(); if (!f.status) return { error: '작업치료현황 파일을 연결하세요' };
      const [sched, status, disc] = [await loadCcrtSchedule(f.status), await loadStatus(f.status), f.messenger ? await loadDischarges(f.messenger).catch(() => ({})) : {}];
      const st = Object.fromEntries(status.map(s => [s.name, s]));
      const prevBy = Object.fromEntries(data.cycles.ccrt.map(p => [p.name, p]));
      const names = new Set([...Object.keys(sched.ccrt), ...Object.keys(sched.better), ...Object.keys(sched.comcog)]);
      const patients = [...names].map((name, i) => {
        const s = st[name], old = prevBy[name];
        const excluded = sched.better[name] && !sched.ccrt[name] ? 'BETTER — CCRT 평가 안 함' : sched.comcog[name] && !sched.ccrt[name] ? 'COMCOG — CCRT 평가 안 함'
          : !s || !['입원', '재입원'].includes(s.state) ? '입원 중 아님(현황)' : null;
        const d = (disc[name] || []).map(x => x.date).filter(x => x >= (s?.admitted || '')).sort().pop() || null;
        return { name, doctor: s?.doctor || old?.doctor || '', room: s?.room || old?.room || '', row: i, weekdays: [...(sched.ccrt[name] || [])].sort(), dates: old?.dates || {},
          recoveryEnd: s?.recoveryEnd || null, discharge: d, excluded };
      });
      const c = cfg(), r = planCcrt({ patients, year, month, off: offOf(), ...c.ccrt });
      const iss = issuesOfCcrt({ rows: r.rows, year, month, off: offOf(), ...c.ccrt });
      r.rows.forEach((x, i) => x.issues = iss[i]);
      return { rows: r.rows, counts: { ccrt: Object.keys(sched.ccrt).length, better: Object.keys(sched.better).length, comcog: Object.keys(sched.comcog).length, messenger: !!f.messenger } };
    });
    ipc.handle('eval:ccrtCheck', (_, { rows, year, month }) => issuesOfCcrt({ rows, year, month, off: offOf(), ...cfg().ccrt }));

    // ---- 산재 ----
    ipc.handle('eval:sanjae', (_, { year, month }) => {
      const c = cfg(), o = { kind: 'sanjae', holidays: c.rules.holidays, pmBlocks: c.rules.pmBlocks, ...c.sanjae };
      const r = planCycle({ patients: data.cycles.sanjae, year, month, off: offOf(), ...o });
      const iss = issuesOfCycle({ rows: r.rows, year, month, off: offOf(), ...o }); r.rows.forEach((x, i) => x.issues = iss[i]); return r.rows;
    });
    ipc.handle('eval:sanjaeCheck', (_, { rows, year, month }) => { const c = cfg(); return issuesOfCycle({ rows, year, month, off: offOf(), kind: 'sanjae', holidays: c.rules.holidays, pmBlocks: c.rules.pmBlocks, ...c.sanjae }); });

    ipc.handle('eval:save', async (_, { kind, rows, year, month }) => {
      const name = { general: '평가일정', ccrt: 'CCRT평가일정', sanjae: '산재평가일정' }[kind];
      const r = await dialog.showSaveDialog({ defaultPath: `${name}_${year}-${String(month).padStart(2, '0')}.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      const wb = kind === 'general' ? build({ rows, year, month }) : buildCycle({ rows, year, month, kind: kind === 'ccrt' ? 'ccrt' : 'sanjae' });
      await wb.xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
