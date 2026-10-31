// 파일을 읽어 분석한 결과를 (경로+수정시각+크기)로 기억해 두고 다시 쓴다 — 파일이 바뀌면 자동으로 다시 읽는다.
//  · 메모리: 같은 파일을 여러 기능이 읽어도 앱을 다시 열기 전까지 한 번만 읽는다(동시에 두 번 요청돼도 읽기는 한 번)
//  · 디스크(설치본): 분석 결과를 앱 데이터 폴더에 저장해 두어, 앱을 다시 켜도 파일이 안 바뀌었으면 읽지 않고 바로 꺼내 쓴다(수 초 → 수십 ms).
//    앱 버전이 바뀌면 옛 저장분은 쓰지 않는다. 저장분이 깨졌거나 없으면 그냥 새로 읽는다.
const fs = require('fs'), path = require('path'), v8 = require('v8'), crypto = require('crypto');
const store = new Map();
let disk = null;
const configure = (dir, version) => { try { fs.mkdirSync(dir, { recursive: true }); disk = { dir, version: String(version || '') }; } catch { disk = null; } };
function stamp(files) { return [].concat(files).map(f => { try { const s = fs.statSync(f); return f + '@' + s.mtimeMs + ':' + s.size; } catch { return f + '@x'; } }).join('|'); }
const fileOf = (tag, key) => path.join(disk.dir, `${tag}-${crypto.createHash('sha1').update(disk.version + '#' + key).digest('hex').slice(0, 20)}.bin`);
function readDisk(tag, key) { if (!disk) return null; try { return { v: v8.deserialize(fs.readFileSync(fileOf(tag, key))) }; } catch { return null; } }
function writeDisk(tag, key, value) {
  if (!disk) return;
  try {
    const f = fileOf(tag, key), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, v8.serialize(value)); fs.renameSync(tmp, f);
    for (const n of fs.readdirSync(disk.dir)) if (n.startsWith(tag + '-') && path.join(disk.dir, n) !== f && !n.endsWith('.tmp')) { try { fs.unlinkSync(path.join(disk.dir, n)); } catch { /* 무시 */ } }
  } catch { /* 저장 못 해도 동작에는 영향 없음 */ }
}
function memo(tag, files, fn) {
  const key = tag + '#' + stamp(files), hit = store.get(key);
  if (hit) return hit;
  for (const k of [...store.keys()]) if (k.startsWith(tag + '#')) store.delete(k);   // 같은 이름표의 옛 결과는 버린다
  const cached = readDisk(tag, key);
  const p = cached ? Promise.resolve(cached.v) : Promise.resolve().then(fn).then(v => { writeDisk(tag, key, v); return v; });
  p.catch(() => store.delete(key));
  store.set(key, p); return p;
}
module.exports = { memo, configure };
