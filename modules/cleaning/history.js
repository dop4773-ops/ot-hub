// 과거 분기 시트 → [{sheet, zone, role, name, category}] (화면/Electron과 무관한 순수 로직)
const ExcelJS = require('exceljs');

const SHEET_RE = /^(20\d\d\.\d\d|\d분기)/;
const NOT_NAME = /^(X|예비|지원|확인|담당선생님)$/;

// 이름 칸 → 이름 배열. "김선우T, 이혜주T" / "치료테이블: 오승헌T" 같은 표기를 정리한다.
function parseNames(v) {
  if (v == null) return [];
  const s = String(v.richText ? v.richText.map(t => t.text).join('') : v);
  return s.split(/[\n,\/]/)
    .map(t => t.replace(/^.*:/, '').replace(/\s+/g, '').replace(/T$/, ''))
    .filter(t => /^[가-힣]{2,4}$/.test(t) && !NOT_NAME.test(t));
}

// 구역·역할 문구 → 역할 종류
function categoryOf(zone, role) {
  const z = zone || '', r = role || '';
  if (/냉장고/.test(z)) return '냉장고';
  if (/도구장/.test(z)) return '도구장';
  if (/트롤리/.test(z)) return '트롤리';
  if (/소모품/.test(r + z)) return '소모품라벨';
  if (/물밀대/.test(r)) return '밀대';
  if (/빗자루|바닥쓸기|쓸기|마대|스퀴지/.test(r)) return '쓸기';
  if (/손걸레|테이블|창틀|매트|닦/.test(r)) return '닦기';
  return null;
}

const txt = c => (c && c.value != null ? String(c.value.richText ? c.value.richText.map(t => t.text).join('') : c.value).replace(/\s+/g, ' ').trim() : '');

function parseSheet(ws) {
  // "담당선생님" 머리글 위치 = 이름 열. 역할은 그 왼쪽, 구역은 그 왼쪽의 왼쪽.
  let hr = 0, nc = 0;
  for (let r = 1; r <= 8 && !nc; r++)
    ws.getRow(r).eachCell((c, col) => { if (!nc && /담당선생님/.test(txt(c))) { hr = r; nc = col; } });
  if (!nc) return { rows: [], warn: '머리글(담당선생님) 없음' };
  const rows = [];
  let zone = '', role = '';
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const z = txt(ws.getCell(r, nc - 2)), ro = txt(ws.getCell(r, nc - 1));
    if (z) { zone = z; role = ''; }
    if (ro) role = ro;
    for (const name of parseNames(ws.getCell(r, nc).value)) {
      const category = categoryOf(zone, role);
      if (category) rows.push({ sheet: ws.name, zone, role, name, category });
    }
  }
  return { rows };
}

async function loadHistory(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const out = {};
  for (const ws of wb.worksheets) if (SHEET_RE.test(ws.name)) out[ws.name] = parseSheet(ws);
  return out;
}

module.exports = { loadHistory, parseSheet, parseNames, categoryOf };
