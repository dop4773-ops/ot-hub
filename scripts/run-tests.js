// 모든 시험을 순서대로 실행 (Electron 없이 Node만으로). 실제 파일이 필요한 시험은 각 스크립트에 경로를 넘겨 따로 실행.
const { execFileSync } = require('child_process'), path = require('path');
for (const f of ['test-staff', 'test-cleaning', 'test-ccrt', 'test-attendance', 'test-inventory', 'test-request', 'test-fall', 'test-updater']) {
  process.stdout.write(`${f}: `); execFileSync('node', [path.join(__dirname, f + '.js')], { stdio: 'inherit' });
}
