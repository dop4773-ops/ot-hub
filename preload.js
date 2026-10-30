const { contextBridge, ipcRenderer } = require('electron');
// 화면은 'hub.invoke("모듈:동작", …)' 한 가지로만 메인과 통신한다 (rehab-hub의 window.rehab.* 과 같은 역할).
contextBridge.exposeInMainWorld('hub', { invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a) });
