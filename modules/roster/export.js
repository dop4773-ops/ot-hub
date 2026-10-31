// 원본 '환자 평가명단' 시트와 같은 열 구성: 주치의·병동·환자명·평가항목(PT)·평가항목(OT)·당월 평가일·비고·신환
const ExcelJS = require('exceljs');
const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
function build({ month, batch, rows }) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(`${month}월 평가일정`);
  ws.columns = [{ width: 9 }, { width: 8 }, { width: 14 }, { width: 38 }, { width: 28 }, { width: 14 }, { width: 36 }, { width: 28 }];
  ws.mergeCells('A1:F1'); ws.getCell('A1').value = '미래병원 주치의별 평가일정'; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getRow(2).values = ['주치의', '병동', '환자명', '평가항목(PT)', '평가항목(OT)', '당월 평가일', '비고', '신환'];
  ws.getRow(2).eachCell(c => { c.font = { bold: true }; c.border = box; c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; });
  rows.forEach((r, i) => {
    const row = ws.getRow(3 + i);
    const d = r.date ? new Date(r.date + 'T00:00:00Z') : null;
    row.values = [`RM${r.doctor}`, r.room, r.name, r.pt, r.ot, d, r.memo ?? r.notes.join(' · '), i === 0 ? batch || '' : ''];
    row.getCell(6).numFmt = 'yyyy-mm-dd';
    row.eachCell({ includeEmpty: true }, c => c.border = box);
  });
  return wb;
}

// POT 통합 평가명단 파일을 엑셀 파일 안쪽(XML)에서 직접 고쳐 환자 줄(A~H열)만 새로 쓴다.
//  원본에는 표(표1_3)·조건부 서식(FMA·SCI·외래 색)·목록 상자(평가항목 선택)·오른쪽 안내표·인쇄 설정이 있어서 ExcelJS로 다시 쓰면 깨지기 때문.
//  줄 서식(s)은 원본 3번째 줄(가운데 줄)과 마지막 환자 줄(아래 선)의 것을 그대로 쓰고, 남는 줄은 빈 서식으로 비운다.
const fs = require('fs'), JSZip = require('jszip');
const xe = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const serial = d => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5);
const COLS = 'ABCDEFGH';
async function buildFromTemplate({ templateFile, month, batch, rows }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(templateFile));
  const wbx = await zip.file('xl/workbook.xml').async('string'), rid = (wbx.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string'), tg = (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`)) || [''])[0].match(/Target="([^"]+)"/);
  const path = 'xl/' + String(tg ? tg[1] : 'worksheets/sheet1.xml').replace(/^\/?(xl\/)?/, ''); let xml = await zip.file(path).async('string');
  const rowRe = r => new RegExp(`<row r="${r}"([^>]*?)(?:/>|>([\\s\\S]*?)</row>)`);
  const styleAt = (r, c) => { const m = (xml.match(rowRe(r)) || [])[2] || '', x = m.match(new RegExp(`<c r="${c}${r}"([^>]*?)(?:/>|>)`)); return x ? (x[1].match(/\bs="(\d+)"/) || [])[1] : undefined; };
  let tEnd = 3; for (let r = 3; r <= 402; r++) { const m = (xml.match(rowRe(r)) || [])[2] || ''; if (new RegExp(`<c r="C${r}"[^>]*t="s"`).test(m)) tEnd = r; }
  const mid = [...COLS].map(c => styleAt(3, c)), end = [...COLS].map((c, i) => styleAt(tEnd, c) ?? mid[i]), blank = [...COLS].map(c => styleAt(tEnd + 1, c));
  const N = rows.length, last = Math.max(N + 2, tEnd); if (last > 1000) throw new Error('환자가 너무 많습니다');
  for (let r = 3; r <= last; r++) {
    const x = rows[r - 3], sty = r <= N + 2 ? (r === N + 2 ? end : mid) : blank;
    const vals = x ? [`RM${x.doctor}`, Number(x.room) || x.room, x.name, x.pt, x.ot, x.date || null, x.memo ?? (x.notes || []).join(' · '), r === 3 && batch ? batch : x.isNew ? '신환' : ''] : [];
    const cells = [...COLS].map((c, i) => { const v = vals[i], s = sty[i] != null ? ` s="${sty[i]}"` : '';
      if (v == null || v === '') return sty[i] != null ? `<c r="${c}${r}"${s}/>` : '';
      if (typeof v === 'number') return `<c r="${c}${r}"${s}><v>${v}</v></c>`;
      if (i === 5) return `<c r="${c}${r}"${s}><v>${serial(v)}</v></c>`;
      return `<c r="${c}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`; }).join('');
    const re = rowRe(r), m = xml.match(re);
    if (m) { const rest = (m[2] || '').replace(/<c r="[A-H]\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, ''); xml = xml.replace(re, `<row r="${r}"${m[1].replace(/\/$/, '')}>${cells}${rest}</row>`); }
    else xml = xml.replace('</sheetData>', `<row r="${r}" ht="20.25" customHeight="1">${cells}</row></sheetData>`);
  }
  zip.file(path, xml);
  const old = (wbx.match(/<sheet\b[^>]*name="([^"]*)"/) || [])[1] || '', name = `${month}월 평가일정 `;
  zip.file('xl/workbook.xml', wbx.split(old).join(name));
  const app = zip.file('docProps/app.xml'); if (app) zip.file('docProps/app.xml', (await app.async('string')).split(old).join(name));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { build, buildFromTemplate };
