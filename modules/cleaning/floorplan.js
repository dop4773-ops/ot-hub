// 청소분담표 파일의 'Sheet1'(10층 배치도)을 읽어 화면에서 그릴 수 있는 칸 목록으로 바꾼다.
// 병합 범위 하나 = 방/구역 하나(글자·색), 열 너비·행 높이는 시트 그대로. 테마 색은 통합 문서의 테마 팔레트로 풀어 쓴다.
const { open } = require('../../shared/xl');
const { memo } = require('../../shared/cache');

function themeColors(wb) {
  const xml = Object.values(wb._themes || {})[0] || ''; if (!xml) return [];
  const sec = (xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/) || [''])[0];
  const get = tag => { const m = sec.match(new RegExp(`<a:${tag}>\\s*<a:(?:srgbClr val|sysClr val="[^"]*" lastClr)="([0-9A-Fa-f]{6})"`)); return m ? m[1] : '000000'; };
  const [dk1, lt1, dk2, lt2, a1, a2, a3, a4, a5, a6] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map(get);
  return [lt1, dk1, lt2, dk2, a1, a2, a3, a4, a5, a6];            // 엑셀 theme 번호 0~9 순서
}
const tint = (hex, t) => { const ch = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)); const f = c => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)); return '#' + ch.map(c => f(c).toString(16).padStart(2, '0')).join(''); };
function fillOf(cell, theme) {
  const f = cell.fill && cell.fill.fgColor; if (!f || (cell.fill.pattern && cell.fill.pattern === 'none')) return null;
  if (f.argb) { const h = f.argb.slice(-6); return h === '000000' && f.argb.startsWith('00') ? null : '#' + h; }
  if (f.theme != null && theme[f.theme]) { const c = tint(theme[f.theme], f.tint || 0); return c === '#ffffff' ? null : c; }
  return null;
}
const colNum = s => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const parseRef = r => { const m = r.match(/^([A-Z]+)(\d+)$/); return { c: colNum(m[1]), r: +m[2] }; };

async function parsePlan(file) {
  const wb = await open(file), ws = wb.getWorksheet('Sheet1'); if (!ws) throw new Error("'Sheet1'(배치도) 시트를 찾지 못했습니다");
  const theme = themeColors(wb), maxC = Math.max(14, ws.columnCount), maxR = Math.max(60, ws.rowCount);
  const cols = Array.from({ length: maxC }, (_, i) => Math.round(((ws.getColumn(i + 1).width || 8.43) * 7) + 5));
  const rows = Array.from({ length: maxR }, (_, i) => Math.round((ws.getRow(i + 1).height || 15) * 1.33));
  const blocks = [], used = new Set(), merges = (ws.model.merges || []).map(m => { const [a, b] = m.split(':'); return { a: parseRef(a), b: parseRef(b || a) }; });
  for (const { a, b } of merges) {
    const cell = ws.getCell(a.r, a.c), text = String(cell.value && cell.value.richText ? cell.value.richText.map(t => t.text).join('') : cell.value ?? '').replace(/\s*\n\s*/g, ' ').trim();
    blocks.push({ r: a.r, c: a.c, rs: b.r - a.r + 1, cs: b.c - a.c + 1, text, bg: fillOf(cell, theme) });
    for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) used.add(r + ',' + c);
  }
  for (let r = 1; r <= maxR; r++) for (let c = 1; c <= maxC; c++) {
    if (used.has(r + ',' + c)) continue; const cell = ws.getCell(r, c), v = cell.value, bg = fillOf(cell, theme);
    if (v != null && v !== '' || bg) blocks.push({ r, c, rs: 1, cs: 1, text: String(v ?? '').replace(/\s*\n\s*/g, ' ').trim(), bg });
  }
  // 맨 위 긴 안내문(A1:M26 병합)은 그림이 아니라 설명이라 따로 뺀다
  const note = blocks.find(b => b.r === 1 && b.c === 1 && b.cs >= 10 && b.rs >= 10);
  // 안내문이 차지하던 위쪽 빈 행과 아래 빈 행은 그림이 아니라서 잘라 낸다
  const kept = blocks.filter(b => b !== note), top = Math.min(...kept.map(b => b.r)), bottom = Math.max(...kept.map(b => b.r + b.rs - 1));
  return { cols, rows: rows.slice(top - 1, bottom), blocks: kept.map(b => ({ ...b, r: b.r - top + 1 })), note: note ? note.text : '' };
}
module.exports = { loadFloorPlan: f => memo('floorplan', f, () => parsePlan(f)) };
