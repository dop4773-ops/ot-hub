// 자동 업데이트 관리자 (electron을 모른다 — 시험하기 쉽게 autoUpdater·알림 함수를 밖에서 받는다).
// GitHub 공개 저장소의 최신 릴리즈(latest.yml)를 보고, 새 버전이 있으면 내려받아 두었다가 '지금 설치'(재시작) 또는 종료 시 설치한다.
// rehab-hub의 main/updater.js와 같은 역할 — 합칠 때는 그쪽 것을 쓰면 된다.
function createUpdateManager({ autoUpdater, send, version, packaged, getAuto = () => true, setTimeoutFn = setTimeout, setIntervalFn = setInterval }) {
  const st = { state: packaged ? 'idle' : 'dev', version, latest: null, percent: 0, message: '', checkedAt: null };
  const push = patch => { Object.assign(st, patch); send({ ...st }); };
  if (packaged) {
    autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => push({ state: 'checking', message: '' }));
    autoUpdater.on('update-available', i => push({ state: 'downloading', latest: i.version, percent: 0 }));
    autoUpdater.on('update-not-available', () => push({ state: 'none', checkedAt: new Date().toISOString() }));
    autoUpdater.on('download-progress', p => push({ state: 'downloading', percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', i => push({ state: 'ready', latest: i.version, percent: 100 }));
    autoUpdater.on('error', e => push({ state: 'error', message: String((e && e.message) || e).split('\n')[0].slice(0, 160) }));
  }
  const check = () => { if (!packaged) return push({ message: '설치본에서만 업데이트를 확인합니다 (개발 실행 중)' }); if (['checking', 'downloading'].includes(st.state)) return; autoUpdater.checkForUpdates().catch(() => {}); };
  const install = () => { if (st.state === 'ready') autoUpdater.quitAndInstall(false, true); };
  const start = () => { if (!packaged) return; setTimeoutFn(() => { if (getAuto()) check(); }, 5000); setIntervalFn(() => { if (getAuto()) check(); }, 4 * 60 * 60 * 1000); };
  return { state: () => ({ ...st }), check, install, start };
}
module.exports = { createUpdateManager };
