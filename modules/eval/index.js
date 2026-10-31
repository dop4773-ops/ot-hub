// CCRT 평가일 — 재활평가관리 OT통합 파일은 CCRT 평가일만 쓴다(일반 평가일은 '평가일 관리'의 POT 통합 파일).
//  · 명단·치료요일 = 작업치료현황 CCRT 스케줄표, BETTER·COMCOG 제외, 2개월 루틴 + 회복기 종료 전 + 퇴원 전(메신저 DB)
//  · 주치의 off는 일반 평가에만 적용 — CCRT 평가는 주치의가 쉬는 날에도 잡을 수 있다.
const { loadCycles } = require('./schedule');
const { loadCcrtSchedule, planCcrt, issuesOfCcrt, DEFAULT: CCRT } = require('./ccrt');
const { buildCycle } = require('./export');
const { loadStatus } = require('../../shared/status');
const { loadDischarges } = require('../../shared/messenger');

module.exports = {
  id: 'eval', title: 'CCRT 평가일',
  register({ ipc, settings, dialog }) {
    const cfg = () => { const m = settings.mod('eval'); return { ccrt: { ...CCRT, ...m.ccrt }, holidays: (m.rules && m.rules.holidays) || [] }; };
    ipc.handle('eval:load', async () => {
      const f = settings.files(); if (!f.eval) return { error: '재활평가관리 파일을 연결하세요' };
      const cy = await loadCycles(f.eval); const dates = cy.ccrt.flatMap(p => Object.values(p.dates)).sort();
      return { cfg: cfg(), ccrtListed: cy.ccrt.length, latest: dates[dates.length - 1] || '' };
    });
    ipc.handle('eval:saveCfg', (_, c) => { settings.setMod('eval', { ...settings.mod('eval'), ccrt: c.ccrt, rules: { holidays: c.holidays } }); return true; });
    const opts = () => { const c = cfg(); return { ...c.ccrt, holidays: c.holidays }; };
    ipc.handle('eval:ccrt', async (_, { year, month }) => {
      const f = settings.files(); if (!f.status || !f.eval) return { error: '작업치료현황과 재활평가관리 파일을 연결하세요' };
      const [sched, status, cy, disc] = [await loadCcrtSchedule(f.status), await loadStatus(f.status), await loadCycles(f.eval), f.messenger ? await loadDischarges(f.messenger).catch(() => ({})) : {}];
      const st = Object.fromEntries(status.map(s => [s.name, s])), prevBy = Object.fromEntries(cy.ccrt.map(p => [p.name, p]));
      const names = new Set([...Object.keys(sched.ccrt), ...Object.keys(sched.better), ...Object.keys(sched.comcog)]);
      const patients = [...names].map((name, i) => {
        const s = st[name], old = prevBy[name];
        const excluded = sched.better[name] && !sched.ccrt[name] ? 'BETTER — CCRT 평가 안 함' : sched.comcog[name] && !sched.ccrt[name] ? 'COMCOG — CCRT 평가 안 함' : !s || !['입원', '재입원'].includes(s.state) ? '입원 중 아님(현황)' : null;
        const d = (disc[name] || []).map(x => x.date).filter(x => x >= (s?.admitted || '')).sort().pop() || null;
        return { name, doctor: s?.doctor || old?.doctor || '', room: s?.room || old?.room || '', row: i, weekdays: [...(sched.ccrt[name] || [])].sort(), dates: old?.dates || {}, recoveryEnd: s?.recoveryEnd || null, discharge: d, excluded };
      });
      const o = opts(), r = planCcrt({ patients, year, month, off: {}, ...o });          // off = {} : 주치의 off와 무관
      const iss = issuesOfCcrt({ rows: r.rows, year, month, off: {}, ...o }); r.rows.forEach((x, i) => x.issues = iss[i]);
      return { rows: r.rows, counts: { ccrt: Object.keys(sched.ccrt).length, better: Object.keys(sched.better).length, comcog: Object.keys(sched.comcog).length, messenger: !!f.messenger } };
    });
    ipc.handle('eval:ccrtCheck', (_, { rows, year, month }) => issuesOfCcrt({ rows, year, month, off: {}, ...opts() }));
    ipc.handle('eval:save', async (_, { rows, year, month }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `CCRT평가일정_${year}-${String(month).padStart(2, '0')}.xlsx`, filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null; await buildCycle({ rows, year, month, kind: 'ccrt' }).xlsx.writeFile(r.filePath); return r.filePath;
    });
  },
};
