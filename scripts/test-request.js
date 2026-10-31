// 청구서 시트 읽기: 정기 물품(이름은 첫 줄만, 규격 여러 줄) / 기타 주문건(한 줄에 전부) / 수량 없는 줄 무시
const assert = require('assert'), ExcelJS = require('exceljs'), os = require('os'), path = require('path');
const { loadRequests } = require('../modules/inventory/request');
(async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('10.29 (10F)');
  ws.getCell('A1').value = '물 품 청 구 서'; ws.getCell('J1').value = new Date(Date.UTC(2026, 9, 29));
  ws.getRow(2).values = ['물품', '규격', '신청수량', '신청사유'];
  ws.getCell('E4').value = '보드마카'; ws.getCell('F4').value = '흑'; ws.getCell('G4').value = 1; ws.getCell('H4').value = '인지치료';   // 정기: 이름 첫 줄
  ws.getCell('F5').value = '청'; ws.getCell('G5').value = 2; ws.getCell('H5').value = '인지치료';                                   // 아랫줄(이름 이어받기)
  ws.getCell('F6').value = '적';                                                                                                    // 수량 없음 → 무시
  ws.getCell('M3').value = '감염관리자원'; ws.getCell('O3').value = '(부서: )';                                                      // 안내 줄 무시
  ws.getCell('M19').value = '↓↓↓<기타 주문건>↓↓↓';
  ws.getCell('M20').value = '관절 각도계'; ws.getCell('N20').value = '개'; ws.getCell('O20').value = 2; ws.getCell('P20').value = '10층 작업치료실';
  ws.getCell('M21').value = '원목 젠가'; ws.getCell('O21').value = 1; ws.getCell('P21').value = '인지치료시 사용';
  ws.getCell('M37').value = '* 매월 2. 4주 수요일';
  wb.addWorksheet('사무용품 등 청구서 (원본)');                                    // 청구 시트가 아님 → 무시
  const f = path.join(os.tmpdir(), 'req-test.xlsx'); await wb.xlsx.writeFile(f);
  const sheets = await loadRequests(f); assert.strictEqual(sheets.length, 1); const s = sheets[0];
  assert.strictEqual(s.date, '2026-10-29'); assert.strictEqual(s.floor, '10F');
  assert.deepStrictEqual(s.items.map(i => `${i.area}:${i.name}/${i.spec}×${i.qty}`), ['standard:보드마카/흑×1', 'standard:보드마카/청×2', 'extra:관절 각도계/개×2', 'extra:원목 젠가/×1']);
  console.log('청구서 읽기 시험 OK');
})();
