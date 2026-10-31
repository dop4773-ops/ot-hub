// 파일을 읽어 분석한 결과를 (경로+수정시각+이름표)로 기억해 두고 다시 쓴다 — 파일이 바뀌면 자동으로 다시 읽는다.
// 같은 파일을 여러 기능이 읽어도, 앱을 다시 열기 전까지 한 번만 읽는다. 시작할 때 미리 읽어 두면(warmUp) 첫 클릭도 바로 열린다.
const fs = require('fs');
const store = new Map();
function stamp(files) { return [].concat(files).map(f => { try { return f + '@' + fs.statSync(f).mtimeMs; } catch { return f + '@x'; } }).join('|'); }
// 같은 호출이 동시에 두 번 오면(미리 읽기 + 화면 요청) 읽기를 한 번만 하고 결과를 나눠 쓴다
function memo(tag, files, fn) {
  const key = tag + '#' + stamp(files), hit = store.get(key);
  if (hit) return hit;
  const p = Promise.resolve().then(fn).catch(e => { store.delete(key); throw e; });
  for (const k of [...store.keys()]) if (k.startsWith(tag + '#')) store.delete(k);   // 같은 이름표의 옛 결과는 버린다
  store.set(key, p); return p;
}
module.exports = { memo };
