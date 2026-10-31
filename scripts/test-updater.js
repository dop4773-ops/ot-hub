const assert = require('assert'), { EventEmitter } = require('events');
const { createUpdateManager } = require('../shared/updater');
const fake = new EventEmitter(); let installed = 0, checks = 0;
fake.checkForUpdates = () => { checks++; fake.emit('checking-for-update'); return Promise.resolve(); }; fake.quitAndInstall = () => { installed++; };
const seen = []; let timers = [];
const m = createUpdateManager({ autoUpdater: fake, send: s => seen.push(s.state), version: '0.2.0', packaged: true, getAuto: () => true, setTimeoutFn: f => timers.push(f), setIntervalFn: f => timers.push(f) });
m.start(); timers.forEach(f => f()); assert.strictEqual(checks, 1, '시작 시 한 번만 확인');   // 타이머 두 개를 모두 실행해도 확인 중이면 건너뛴다
fake.emit('update-available', { version: '0.3.0' }); fake.emit('download-progress', { percent: 42.4 }); assert.strictEqual(m.state().percent, 42);
m.install(); assert.strictEqual(installed, 0, '내려받는 중에는 설치하지 않는다');
fake.emit('update-downloaded', { version: '0.3.0' }); assert.strictEqual(m.state().state, 'ready'); m.install(); assert.strictEqual(installed, 1);
fake.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED\n at …')); assert.strictEqual(m.state().state, 'error'); assert.ok(!m.state().message.includes('\n'));
const dev = createUpdateManager({ autoUpdater: fake, send() {}, version: '0.2.0', packaged: false }); dev.check(); assert.strictEqual(dev.state().state, 'dev'); assert.ok(/설치본/.test(dev.state().message));
const off = []; createUpdateManager({ autoUpdater: fake, send() {}, version: '1', packaged: true, getAuto: () => false, setTimeoutFn: f => off.push(f), setIntervalFn: () => {} }).start(); const before = checks; off.forEach(f => f()); assert.strictEqual(checks, before, '자동 확인을 끄면 확인 안 함');
console.log('업데이트 관리자 시험 OK:', seen.join(' → '));
