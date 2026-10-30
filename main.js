const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs'), path = require('path');
const { ROLES, find } = require('./shared/files');
const { nfc } = require('./shared/xl');

// ---- 설정 저장소: { files:{역할:경로}, emr:[…], mod:{모듈id:{…}} } ----
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const read = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } };
const settings = {
  all: () => { const s = read(); return { files: {}, emr: [], mod: {}, ...s }; },
  save: s => fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2)),
  files: () => settings.all().files,
  emr: () => settings.all().emr,
  mod: id => settings.all().mod[id] || {},
  setMod: (id, v) => { const s = settings.all(); s.mod[id] = v; settings.save(s); },
};

function createWindow() {
  new BrowserWindow({ width: 1360, height: 900, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } })
    .loadFile('renderer/index.html');
}

// ---- 공통 채널 ----
ipcMain.handle('app:settings', () => settings.all());
ipcMain.handle('app:roles', () => ROLES);
ipcMain.handle('app:setFile', (_, role, p) => { const s = settings.all(); if (p) s.files[role] = p; else delete s.files[role]; settings.save(s); return s; });
ipcMain.handle('app:findFiles', async (_, role) => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled ? null : find(r.filePaths[0], role); });
ipcMain.handle('app:pickFile', async (_, role) => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: ROLES[role] ? ROLES[role].label : '파일', extensions: ROLES[role] ? ROLES[role].exts : ['xlsx'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('app:pickEmr', async () => { const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: '엑셀', extensions: ['xlsx'] }] }); return r.canceled ? null : r.filePaths; });
ipcMain.handle('app:setEmr', (_, list) => { const s = settings.all(); s.emr = list; settings.save(s); return s; });
ipcMain.handle('app:setMod', (_, id, v) => { settings.setMod(id, v); return true; });
ipcMain.handle('app:saveAs', async (_, { name, build }) => ({ canceled: true }));   // 자리표시 — 각 모듈이 저장 대화상자를 직접 호출한다
ipcMain.handle('app:exportSettings', async () => { const r = await dialog.showSaveDialog({ defaultPath: 'ot-hub_설정.json' }); if (r.canceled) return null; fs.writeFileSync(r.filePath, JSON.stringify(settings.all(), null, 2)); return r.filePath; });
ipcMain.handle('app:importSettings', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return null;
  const s = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
  for (const k of Object.keys(s.files || {})) if (!fs.existsSync(s.files[k])) delete s.files[k];   // 이 PC에 없는 경로는 버린다
  settings.save({ files: {}, emr: [], mod: {}, ...s, emr: (s.emr || []).filter(f => fs.existsSync(f)) }); return settings.all();
});

// ---- 모듈 등록 ----
const ctx = { ipc: ipcMain, settings, dialog, ROLES };
for (const m of require('./modules')) m.register(ctx);

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
