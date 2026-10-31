// 별도 작업 프로세스: 앱 본체가 화면을 그리고 클릭에 답하는 동안, 여기서 파일을 읽어 분석한 결과를 디스크에 저장해 둔다.
// 본체는 같은 파일을 부르면 그 저장분을 바로 꺼내 쓴다. 인자: 설정 JSON(파일 경로들), 저장 폴더, 앱 버전.
const fs = require('fs'), { configure } = require('./cache'), { warmTasks } = require('./warm');
const [settingsFile, cacheDir, version] = process.argv.slice(2);
(async () => {
  configure(cacheDir, version); const t0 = Date.now();
  let s = {}; try { s = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { /* 설정 없음 */ }
  for (const t of warmTasks({ files: s.files || {}, emr: s.emr || [], pot: s.pot || [] })) await t();
  console.log(`[warm-worker] 완료 ${Date.now() - t0}ms`); process.exit(0);
})();
