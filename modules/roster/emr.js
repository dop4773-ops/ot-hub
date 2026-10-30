// EMR '물리치료 내역' 엑셀(액팅오류 파일) → 평가 처방만 추려 환자별 평가항목 {PT:Set, OT:Set}
// 평가 처방 코드와 치료내용(항목명)으로 판별. 기간은 파일 머리의 '검색일자'를 따른다(하루~여러 날).
const ExcelJS = require('exceljs');
const { fromCell } = require('../../shared/dates');

const txt = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); return String(v.result ?? v); };
const clean = s => String(s).replace(/_x000D_/g, '').replace(/\s+/g, ' ').trim();

// 코드 → [쪽, 항목]. EX780(수지기능검사)은 치료내용의 HFT/MFT로 세부 판별.
function itemsOf(order, text) {
  const code = clean(order).split(' ')[0], t = clean(text).toUpperCase();
  switch (code) {
    case 'E6612': return [['PT', 'MMT']];
    case 'EX773': return [['PT', 'ROM']];
    case 'E6613': return [['PT', 'BBS']];
    case 'E6641': return [[/-OT\s*$/.test(clean(order)) ? 'OT' : 'PT', 'FMA']];
    case 'EY772': return [['OT', 'MBI']];
    case 'EY773': return [['OT', 'SCIM']];
    case 'F6216': return [['OT', 'MMSE']];
    case 'F6221': return [['OT', 'GDS']];
    case 'EX780': { const o = []; if (/HFT/.test(t)) o.push(['OT', 'HFT']); if (/MFT/.test(t)) o.push(['OT', 'MFT']); return o.length ? o : [['OT', 'HFT'], ['OT', 'MFT']]; }
    default: return [];
  }
}

// 환자별 평가항목과 처방일. 열: B처방일자 D환자성명 E처방명칭 H치료내용 (머리글 '순번' 행 아래)
async function loadEmr(files) {
  const by = {};   // name → { PT:Set, OT:Set, dates:Set }
  let from = null, to = null;
  for (const f of files) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f);
    const ws = wb.worksheets[0];
    let hdr = 0; for (let r = 1; r <= 10; r++) if (clean(txt(ws.getCell(r, 1))) === '순번') { hdr = r; break; }
    if (!hdr) throw new Error(`${f}: '순번' 머리글을 찾지 못했습니다 (EMR 물리치료 내역 파일이 맞나요?)`);
    for (let r = hdr + 1; r <= ws.rowCount; r++) {
      const name = clean(txt(ws.getCell(r, 4))); if (!name) continue;
      const date = fromCell(ws.getCell(r, 2).value) || clean(txt(ws.getCell(r, 2))).slice(0, 10);
      if (date) { if (!from || date < from) from = date; if (!to || date > to) to = date; }
      for (const [side, item] of itemsOf(txt(ws.getCell(r, 5)), txt(ws.getCell(r, 8)))) {
        const p = (by[name] ??= { PT: new Set(), OT: new Set(), dates: new Set() });
        p[side].add(item); p.dates.add(date);
      }
    }
  }
  return { by, from, to };
}

module.exports = { loadEmr, itemsOf };
