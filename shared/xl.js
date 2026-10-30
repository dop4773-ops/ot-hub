// 엑셀 읽기 공용 도우미. rehab-hub로 합칠 때는 이 파일(과 modules/*/reader 성격의 코드)만 SheetJS+window.rehab.folders.readFile로 바꾸면 된다.
const ExcelJS = require('exceljs');
const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); if (v.result != null) return String(v.result); if (v instanceof Date) return v.toISOString().slice(0, 10); return String(v); };
const rm = v => (String(v).match(/\d/) || [''])[0];            // 'RM4' / 4 → '4'
const nfc = s => String(s).normalize('NFC');
const cache = new Map();
async function open(file) {                                      // 같은 파일을 여러 모듈이 읽을 때 한 번만 연다(수정 시각이 바뀌면 다시)
  const fs = require('fs'), m = fs.statSync(file).mtimeMs, hit = cache.get(file);
  if (hit && hit.m === m) return hit.wb;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  cache.set(file, { m, wb }); return wb;
}
module.exports = { txt, rm, nfc, open, ExcelJS };
