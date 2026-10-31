// 낙상방지 순회 체크리스트: 치료사명단·월별 이력 + 구글 캘린더(.ics: 연차·팀 표시) + 토요일&공휴일 시간표(그날 근무 팀·3층 근무자)로
// 다음 달 순회 담당을 배정 → 시트 모양 미리보기에서 고치고 → 낙상방지 파일의 '원본' 시트 서식 그대로 새 xlsx로 저장
const fs = require('fs');
const L = require('./logic');
const { loadSaturdays, RED_MIN } = require('./saturday');
const { readCalendar } = require('../../shared/ics');
const { loadStaff } = require('../../shared/staff');
const { memo } = require('../../shared/cache');

module.exports = {
  id: 'fall', title: '낙상 순회',
  register({ ipc, settings, dialog }) {
    const mod = () => ({ calendarUrl: '', holidays: {}, ...settings.mod('fall') });
    // 캘린더: 주소가 있으면 내려받고, 없으면 저장해 둔 .ics 파일. 10분 동안 같은 결과를 쓴다.
    let calCache = null;
    async function calendarText() {
      const m = mod(); if (calCache && calCache.key === (m.calendarUrl || m.calendarFile) && Date.now() - calCache.at < 600000) return calCache.text;
      let text = '';
      if (m.calendarUrl) {
        if (!/^https:\/\//i.test(m.calendarUrl)) throw new Error('캘린더 주소는 https:// 로 시작해야 합니다');
        const { net } = require('electron'), res = await (net && net.fetch ? net.fetch(m.calendarUrl, { headers: { 'Cache-Control': 'no-cache' } }) : fetch(m.calendarUrl));
        if (!res.ok) throw new Error(`캘린더를 가져오지 못했습니다 (HTTP ${res.status}) — 주소와 공개 설정을 확인하세요`);
        text = await res.text(); if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('캘린더(.ics) 주소가 아닙니다');
      } else if (m.calendarFile && fs.existsSync(m.calendarFile)) text = fs.readFileSync(m.calendarFile, 'utf8');
      calCache = { key: m.calendarUrl || m.calendarFile, at: Date.now(), text }; return text;
    }
    ipc.handle('fall:load', async () => {
      const f = settings.files(); if (!f.fall) return { error: '낙상방지 순회 체크리스트 파일을 연결하세요' };
      const [roster, history] = [await L.loadRoster(f.fall), await L.loadHistory(f.fall)], m = mod();
      return { roster, months: Object.keys(history).map(Number), slots: L.SLOTS, holidays: m.holidays, calendarUrl: m.calendarUrl, calendarFile: m.calendarFile || '', hasSaturday: !!f.saturday, teamFill: L.TEAM_FILL };
    });
    ipc.handle('fall:saveCalendar', async (_, { url }) => { settings.setMod('fall', { ...mod(), calendarUrl: String(url || '').trim() }); calCache = null; return true; });
    ipc.handle('fall:pickCalendarFile', async () => { const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '캘린더', extensions: ['ics'] }] }); if (r.canceled) return null; settings.setMod('fall', { ...mod(), calendarFile: r.filePaths[0] }); calCache = null; return r.filePaths[0]; });
    ipc.handle('fall:testCalendar', async (_, { year, month }) => {
      try { const text = await calendarText(); if (!text) return { ok: false, message: '캘린더 주소나 파일을 먼저 넣어 주세요' };
        const from = `${year}-${String(month).padStart(2, '0')}-01`, to = `${year}-${String(month).padStart(2, '0')}-31`, c = readCalendar(text, from, to);
        return { ok: true, leaves: Object.values(c.leaves).flat().length, teams: Object.keys(c.teams).length, unknown: c.unknown };
      } catch (e) { return { ok: false, message: e.message }; }
    });
    ipc.handle('fall:generate', async (_, { year, month, floor, holidays, seed, exclude, overrides }) => {
      const f = settings.files(), [roster, history] = [await L.loadRoster(f.fall), await L.loadHistory(f.fall)];
      const hist = {}; for (const [k, v] of Object.entries(history)) if (Number(k) < month) hist[k] = v;          // 배정하는 달 앞의 달만 이력으로 쓴다(미리 채워 둔 다음 달 시트·같은 달은 제외)
      const from = `${year}-${String(month).padStart(2, '0')}-01`, to = `${year}-${String(month).padStart(2, '0')}-31`;
      let cal = { leaves: {}, teams: {}, unknown: [] }, calWarn = '';
      try { const text = await calendarText(); if (text) cal = readCalendar(text, from, to); else calWarn = '구글 캘린더가 연결되지 않아 연차를 반영하지 못했습니다'; } catch (e) { calWarn = e.message; }
      const sat = f.saturday ? await loadSaturdays(f.saturday) : {};
      let ex = new Set(exclude || []); try { for (const s of await loadStaff(f.status)) if (['실장', '팀장'].includes(s.rank)) ex.add(s.name); } catch { /* 팀 시트가 없어도 계속 */ }
      settings.setMod('fall', { ...mod(), holidays });
      const r = L.generate({ year, month, floor, roster, history: hist, holidays, leaves: cal.leaves, sat, teams: cal.teams, exclude: ex, overrides: overrides || {}, redMin: RED_MIN, seed });
      if (calWarn) r.notes.unshift(calWarn);
      return { ...r, issues: L.check({ weeks: r.weeks, roster }), calendar: { leaves: Object.values(cal.leaves).flat().length, teams: Object.keys(cal.teams).length }, leaves: cal.leaves };
    });
    ipc.handle('fall:check', async (_, { weeks }) => L.check({ weeks, roster: await L.loadRoster(settings.files().fall) }));
    ipc.handle('fall:save', async (_, { year, month, weeks, floor }) => {
      const r = await dialog.showSaveDialog({ defaultPath: `낙상방지 순회 체크리스트_${floor || ''}_${year}-${String(month).padStart(2, '0')}.xlsx`.replace('__', '_'), filters: [{ name: '엑셀', extensions: ['xlsx'] }] });
      if (r.canceled) return null;
      fs.writeFileSync(r.filePath, await L.build({ templateFile: settings.files().fall, year, month, weeks })); return r.filePath;
    });
  },
};
