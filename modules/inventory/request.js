// '사무용품 청구서(OT).xlsx' 읽기.
//  · 청구 시트: 이름이 'M.DD (3F)' / 'MM.DD (10F)' 꼴 — 한 번의 청구(날짜·층). 맨 위 1행에 부서·날짜.
//  · 칸 배치: 4개 블록(A-D, E-H, I-L, M-P) × [물품 | 규격 | 신청수량 | 신청사유]. 인쇄된 정기 물품(규격이 여러 줄이면 물품 이름은 첫 줄에만 있음).
//  · 4번 블록 19행 근처의 '기타 주문건' 아래(~'* 매월' 안내 위)는 직접 적는 칸 — 한 줄에 물품·규격·수량·사유가 모두 있다. 도구(비품) 구입은 주로 여기.
//  · 신청수량이 숫자로 적힌 줄만 청구 건으로 본다.
const { txt, open } = require('../../shared/xl');
const { memo } = require('../../shared/cache');

const SHEET = /^\s*(\d{1,2})\.(\d{1,2})\s*\((\d+F)\)/;
const BLOCKS = [1, 5, 9, 13];
const clean = s => String(s ?? '').replace(/_x000D_/g, '').replace(/\s+/g, ' ').trim();
const num = v => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) && n > 0 && String(v).trim() !== '' ? n : null; };
const iso = d => d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null;

function parseSheet(ws, year) {
  const m = ws.name.match(SHEET); if (!m) return null;
  let date = null;
  for (let c = 1; c <= 16 && !date; c++) { const v = ws.getCell(1, c).value; date = iso(v && v.result !== undefined ? v.result : v); }
  if (!date) date = `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  // '기타 주문건' 시작·끝 행(4번 블록)
  let extraFrom = null, extraTo = ws.rowCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const t = clean(txt(ws.getCell(r, 13)));
    if (/기타\s*주문건/.test(t)) extraFrom = r + 1; else if (extraFrom && /^\*/.test(t)) { extraTo = r - 1; break; }
  }
  const items = [], seen = new Set();
  BLOCKS.forEach((c0, b) => {
    let name = '';
    for (let r = 3; r <= ws.rowCount; r++) {
      const extra = b === 3 && extraFrom && r >= extraFrom && r <= extraTo;
      const n = clean(txt(ws.getCell(r, c0)));
      if (extra) name = n; else if (n) name = n;                 // 정기 물품은 이름이 첫 줄에만 있어 아래 줄로 이어 쓴다
      const qty = num(txt(ws.getCell(r, c0 + 2)));
      if (!qty || !name || /^\(?부서/.test(name)) continue;
      const key = `${b}:${r}`; if (seen.has(key)) continue; seen.add(key);
      items.push({ id: `${ws.name}|${b}|${r}`, sheet: ws.name, area: extra ? 'extra' : 'standard', name, spec: clean(txt(ws.getCell(r, c0 + 1))), qty, reason: clean(txt(ws.getCell(r, c0 + 3))) });
    }
  });
  return { name: ws.name, date, floor: m[3], items };
}

async function parseRequests(file) {
  const wb = await open(file), year = new Date().getFullYear(), sheets = [];
  for (const ws of wb.worksheets) { const s = parseSheet(ws, year); if (s) sheets.push(s); }
  sheets.sort((a, b) => b.date.localeCompare(a.date) || a.floor.localeCompare(b.floor));
  return sheets;
}
const loadRequests = file => memo('requests', file, () => parseRequests(file));
module.exports = { loadRequests, parseSheet };
