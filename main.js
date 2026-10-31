const { app, BrowserWindow, ipcMain, dialog: electronDialog, shell } = require('electron');
const fs = require('fs'), path = require('path');
const { ROLES, find, scanAll, defaultRoots } = require('./shared/files');
const { nfc } = require('./shared/xl');
const { createUpdateManager } = require('./shared/updater');
const cache = require('./shared/cache');

// ---- 설정 저장소: { files:{역할:경로}, emr:[…], mod:{모듈id:{…}} } ----
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const read = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } };
const settings = {
  all: () => { const s = read(); return { files: {}, emr: [], pot: [], mod: {}, ...s }; },
  save: s => fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)),
  files: () => settings.all().files,
  emr: () => settings.all().emr,
  pot: () => settings.all().pot,
  holidays: () => settings.all().holidays || {},            // 공통 공휴일 { 'YYYY-MM-DD': '이름' } — 모든 화면이 같이 쓴다
  mod: id => settings.all().mod[id] || {},
  setMod: (id, v) => { const s = settings.all(); s.mod[id] = v; settings.save(s); },
};

// 저장 대화상자는 마지막에 저장한 폴더에서 열린다(파일 이름만 넘기면 그 폴더 + 이름)
const dialog = {
  showSaveDialog: async opts => {
    const dir = settings.mod('app').lastDir; if (dir && opts.defaultPath && !path.isAbsolute(opts.defaultPath) && fs.existsSync(dir)) opts = { ...opts, defaultPath: path.join(dir, opts.defaultPath) };
    const r = await electronDialog.showSaveDialog(opts); if (!r.canceled && r.filePath) settings.setMod('app', { ...settings.mod('app'), lastDir: path.dirname(r.filePath) }); return r;
  },
  showOpenDialog: (...a) => electronDialog.showOpenDialog(...a),
};

function createWindow() {
  if (app.isPackaged || process.env.OTHUB_DISK_CACHE) cache.configure(path.join(app.getPath('userData'), 'parse-cache'), app.getVersion());
  const win = new BrowserWindow({ width: 1360, height: 900, show: false, backgroundColor: '#f4f7fb', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.once('ready-to-show', () => win.show());
  win.loadFile('renderer/index.html');
  setupUpdates(win);
  win.webContents.once('did-finish-load', () => setTimeout(warmUp, 150));
  return win;
}

// ---- 공통 채널 ----
ipcMain.handle('app:settings', () => settings.all());
ipcMain.handle('app:roles', () => ROLES);
ipcMain.handle('app:setHolidays', (_, map) => { const s = settings.all(); s.holidays = map || {}; settings.save(s); return s; });
ipcMain.handle('app:reveal', (_, p) => { if (p && fs.existsSync(p)) shell.showItemInFolder(p); return true; });
// 전체 자동 찾기: folders가 없으면 이 PC의 구글 드라이브·원드라이브·바탕화면·문서·다운로드를 폴더 안의 폴더까지 훑어 아직 연결 안 된 파일을 모두 연결한다.
// folders가 있으면(직접 지정) 그 폴더들만. → { found:[역할], missing:[역할], ms, timedOut }
async function autoFind(folders) {
  const ex = settings.all().findExclude || [], roots = folders && folders.length ? folders : defaultRoots().filter(r => !ex.includes(r)), scan = scanAll(roots, { maxDepth: folders ? 6 : 5, exclude: folders ? [] : ex });
  const s = settings.all(), found = [], missing = [];
  for (const [role, def] of Object.entries(ROLES)) {
    if (def.multi) continue; if (s.files[role] && fs.existsSync(s.files[role])) continue;
    if (scan.files[role]) { s.files[role] = scan.files[role]; found.push(role); } else missing.push(role);
  }
  if (scan.pot.length) { const before = (s.pot || []).length; s.pot = [...new Set([...(s.pot || []), ...scan.pot])]; if (s.pot.length > before) found.push('pot'); }
  settings.save(s); return { found, missing, settings: s, ms: scan.ms, timedOut: scan.timedOut, roots: roots.length };
}
ipcMain.handle('app:autoFind', () => autoFind(null));
// 자동 찾기에서 뺄 폴더(개발용 드라이브 등): 기본 검색 위치 목록 + 제외 목록
ipcMain.handle('app:findRoots', () => ({ roots: defaultRoots(), exclude: settings.all().findExclude || [] }));
ipcMain.handle('app:setFindExclude', (_, list) => { const s = settings.all(); s.findExclude = [...new Set(list || [])]; settings.save(s); return { roots: defaultRoots(), exclude: s.findExclude }; });
ipcMain.handle('app:pickFolder', async () => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('app:findAll', async () => { const r = await dialog.showOpenDialog({ title: '파일이 들어 있는 폴더(여러 개 선택 가능)', properties: ['openDirectory', 'multiSelections'] }); return r.canceled ? null : autoFind(r.filePaths); });
ipcMain.handle('app:setFile', (_, role, p) => { const s = settings.all(); if (p) s.files[role] = p; else delete s.files[role]; settings.save(s); return s; });
ipcMain.handle('app:findFiles', async (_, role) => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled ? null : find(r.filePaths[0], role); });
ipcMain.handle('app:pickFile', async (_, role) => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: ROLES[role] ? ROLES[role].label : '파일', extensions: ROLES[role] ? ROLES[role].exts : ['xlsx'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('app:pickEmr', async () => { const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: '엑셀', extensions: ['xlsx'] }] }); return r.canceled ? null : r.filePaths; });
ipcMain.handle('app:findMulti', async (_, role) => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled ? null : find(r.filePaths[0], role); });
ipcMain.handle('app:setPot', (_, list) => { const s = settings.all(); s.pot = list; settings.save(s); return s; });
ipcMain.handle('app:setEmr', (_, list) => { const s = settings.all(); s.emr = list; settings.save(s); return s; });
ipcMain.handle('app:setMod', (_, id, v) => { settings.setMod(id, v); return true; });
ipcMain.handle('app:saveAs', async (_, { name, build }) => ({ canceled: true }));   // 자리표시 — 각 모듈이 저장 대화상자를 직접 호출한다
ipcMain.handle('app:exportSettings', async () => { const r = await dialog.showSaveDialog({ defaultPath: 'ot-hub_설정.json' }); if (r.canceled) return null; fs.writeFileSync(r.filePath, JSON.stringify(settings.all(), null, 2)); return r.filePath; });
ipcMain.handle('app:importSettings', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null;
  const s = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
  for (const k of Object.keys(s.files || {})) if (!fs.existsSync(s.files[k])) delete s.files[k];   // 이 PC에 없는 경로는 버린다
  settings.save({ files: {}, emr: [], pot: [], mod: {}, ...s, emr: (s.emr || []).filter(f => fs.existsSync(f)), pot: (s.pot || []).filter(f => fs.existsSync(f)) }); return settings.all();
});

// ---- 자동 업데이트 (설치본에서만 동작, GitHub 공개 릴리즈 latest.yml 확인) ----
let upd = null;
const setupUpdates = win => {
  const { autoUpdater } = require('electron-updater');
  upd = createUpdateManager({ autoUpdater, send: st => { if (!win.isDestroyed()) win.webContents.send('app:update', st); }, version: app.getVersion(), packaged: app.isPackaged, getAuto: () => settings.mod('app').autoUpdate !== false });
  upd.start();
};
ipcMain.handle('app:updateState', () => upd ? upd.state() : { state: 'dev', version: app.getVersion() });
ipcMain.handle('app:updateCheck', () => { upd && upd.check(); return true; });
ipcMain.handle('app:updateInstall', () => { upd && upd.install(); return true; });
ipcMain.handle('app:setAutoUpdate', (_, on) => { settings.setMod('app', { ...settings.mod('app'), autoUpdate: !!on }); return true; });
ipcMain.handle('app:autoUpdate', () => settings.mod('app').autoUpdate !== false);

// ---- 시작할 때 연결된 파일을 미리 읽어 둔다 (첫 클릭부터 바로 열리도록; 실패해도 조용히 넘어감) ----
// 설치본: 별도 프로세스가 읽어 결과를 디스크에 저장(본체는 막히지 않음) + 다음 실행부터는 저장분을 바로 꺼내 쓴다. 개발 실행·작업 프로세스 실패 시: 본체에서 직접 읽는다.
const diskCache = app.isPackaged || !!process.env.OTHUB_DISK_CACHE;
async function warmUp() {
  const t0 = Date.now(), run = async () => { for (const t of require('./shared/warm').warmTasks(settings.all())) await t(); console.log(`미리 읽기 완료 ${Date.now() - t0}ms`); };
  if (!diskCache) return run();
  try {
    const { utilityProcess } = require('electron'), child = utilityProcess.fork(path.join(__dirname, 'shared', 'warm-worker.js'), [settingsFile(), path.join(app.getPath('userData'), 'parse-cache'), app.getVersion()], { stdio: 'inherit' });
    child.on('exit', code => { if (code) run(); });
  } catch { run(); }
}

// ---- 모듈 등록 ----
const ctx = { ipc: ipcMain, settings, dialog, ROLES };
for (const m of require('./modules')) m.register(ctx);

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
