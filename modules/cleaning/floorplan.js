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
  return { top, cols, rows: rows.slice(top - 1, bottom), blocks: kept.map(b => ({ ...b, r: b.r - top + 1 })), note: note ? note.text : '' };
}

// 배치도 칸의 글자 → 청소 구역(zoneKey)·역할. 위에서부터 먼저 맞는 칸이 담당자를 가져간다(구역당 한 칸).
const MAP = [
  { re: /OT\s*치료실/, zone: '작업치료실', not: /창틀/ }, { re: /^OT\s*창\s*틀|OT\s*창틀/, zone: '작업치료실', only: /창틀/ },
  { re: /OT\s*station/i, zone: '스테이션' }, { re: /ADL실.*OT|^ADL실/, zone: '인지연하' },
  { re: /도\s*구\s*장/, zone: '도구장', not: /짐볼/ }, { re: /^복도$/, zone: '공용공간', not: /E\/V/ }, { re: /E\/V\s*빗자루/, zone: '공용공간', only: /E\/V/ }];
const { zoneKey } = require('./assign');
// cells: [{zone, role, name}] — 이름이 없으면 '지원 필요'. 돌려주는 값: blocks[i] = 그 칸에 올릴 줄들 [{role, names:[{n, vac}]}], tool(도구장 칸 여부), rest = 배치도에 칸이 없는 구역
function place(fp, cells, tool = []) {
  const by = {}; cells.forEach((c, i) => { (by[zoneKey(c.zone)] ??= []).push({ ...c, i }); });
  const claimed = new Map(), used = new Set();
  fp.blocks.forEach((b, bi) => { for (const m of MAP) { if (used.has(m.zone + '|' + (m.only || '')) || !m.re.test(b.text) || (m.not && m.not.test(b.text))) continue; claimed.set(bi, m); used.add(m.zone + '|' + (m.only || '')); break; } });
  const lines = m => { const g = {}; (by[m.zone] || []).forEach(c => { if (m.only && !m.only.test(c.role)) return; if (m.not && m.not.test(c.role)) return; if (m.zone === '작업치료실' && !m.only && /창틀/.test(c.role)) return;
    (g[c.role || '담당'] ??= []).push({ n: c.name || '', vac: !c.name }); }); return Object.entries(g).map(([role, names]) => ({ role: role.replace(/\(.*\)/, ''), names })); };
  const blocks = fp.blocks.map((b, bi) => { const m = claimed.get(bi); return { lines: m ? lines(m) : [], tool: !!(m && m.zone === '도구장' && tool.length) }; });
  const placed = new Set([...claimed.values()].map(m => m.zone));
  const rest = Object.keys(by).filter(z => !placed.has(z)).map(z => ({ zone: z, items: by[z].map(c => ({ role: c.role || '', n: c.name || '', vac: !c.name })) }));
  return { blocks, rest, tool };
}
module.exports = { loadFloorPlan: f => memo('floorplan', f, () => parsePlan(f)), place };
