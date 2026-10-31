// 청소분담표 내보내기 — 청소분담표 파일의 최신 분기 시트(평일)와 '대청소' 시트의 서식(글꼴 18·행 높이·색·테두리·너비·인쇄 설정)을 그대로 쓰고
// A~C열 표의 줄만 새로 쓴다(층마다 칸 수가 달라서). 오른쪽 안내문(F~H, J열)은 원본 그대로 두거나 값만 바꾼다.
const ExcelJS = require('exceljs');
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const styleOf = c => ({ font: clone(c.font), alignment: clone(c.alignment), border: clone(c.border), fill: clone(c.fill), numFmt: c.numFmt });
const paint = (c, st) => { c.font = clone(st.font); c.alignment = clone(st.alignment); c.border = clone(st.border); c.fill = clone(st.fill); if (st.numFmt) c.numFmt = st.numFmt; };
const plain = v => v == null ? '' : v.richText ? v.richText.map(t => t.text).join('') : String(v.result ?? v);
const mapRich = (v, fn) => v && v.richText ? { richText: v.richText.map(t => ({ ...t, text: fn(t.text) })) } : typeof v === 'string' ? fn(v) : v;

function groupsOf(cells, vac = new Set(), support = {}) {
  const g = [];
  cells.forEach((c, i) => {
    const name = vac.has(i) ? (support[i] ? `${support[i]} (지원)` : '(지원 배치 필요)') : c.name;
    const last = g[g.length - 1];
    if (last && last.zone === c.zone) last.rows.push({ role: c.role, name }); else g.push({ zone: c.zone, rows: [{ role: c.role, name }] });
  });
  return g;
}

// ws의 A~C 표(머리글 다음 줄 ~ 맨 아래 안내 줄 앞)를 지우고 groups로 다시 쓴다
function fillTable(ws, { groups, title, date, footerText }) {
  let hdr = 0; for (let r = 1; r <= 12; r++) if (/(대)?청소\s*구역/.test(plain(ws.getCell(r, 1).value))) { hdr = r; break; }
  if (!hdr) throw new Error('청소분담표 시트에서 "청소구역" 머리글을 찾지 못했습니다');
  let L = hdr; for (let r = ws.rowCount; r > hdr; r--) if ([1, 2, 3].some(c => plain(ws.getCell(r, c).value).trim())) { L = r; break; }       // 맨 아래 안내 줄(분기별 ratation 예정 / 일찍 끝난 구역…)
  const proto = { zone: styleOf(ws.getCell(hdr + 1, 1)), role: styleOf(ws.getCell(hdr + 1, 2)), name: styleOf(ws.getCell(hdr + 1, 3)), h: ws.getRow(hdr + 1).height };
  const foot = { a: styleOf(ws.getCell(L, 1)), b: styleOf(ws.getCell(L, 2)), c: styleOf(ws.getCell(L, 3)), h: ws.getRow(L).height, text: [1, 2, 3].map(c => plain(ws.getCell(L, c).value)).find(x => x.trim()) || '', right: /right/.test((ws.getCell(L, 3).alignment || {}).horizontal || '') };
  const body = Object.values(ws._merges).map(m => m.model).filter(m => m.top > hdr && m.top <= L && m.left <= 3);
  body.forEach(m => ws.unMergeCells(m.top, m.left, m.bottom, m.right));
  const pad = Math.max(L, hdr + 1 + groups.reduce((a, g) => a + g.rows.length, 0) + 2);
  for (let r = hdr + 1; r <= pad; r++) { for (let c = 1; c <= 3; c++) { const cell = ws.getCell(r, c); cell.value = null; cell.style = {}; } ws.getRow(r).height = undefined; }
  let r = hdr + 1;
  for (const g of groups) {
    const solo = g.rows.length === 1 && !g.rows[0].role;                                                    // 도구장·트롤리·냉장고처럼 구역=역할인 줄
    g.rows.forEach((x, k) => {
      const a = ws.getCell(r + k, 1), b = ws.getCell(r + k, 2), c = ws.getCell(r + k, 3);
      paint(a, proto.zone); paint(b, proto.role); paint(c, proto.name); ws.getRow(r + k).height = proto.h;
      a.value = k === 0 ? g.zone : null; b.value = solo ? null : x.role; c.value = x.name || null;
      if (b.value && String(b.value).length > 14) b.font = { ...clone(b.font), size: String(b.value).length > 18 ? 14 : 15 };   // 긴 역할 이름은 원본처럼 글자를 조금 줄인다
    });
    if (solo) { ws.mergeCells(r, 1, r, 2); }
    else if (g.rows.length > 1) ws.mergeCells(r, 1, r + g.rows.length - 1, 1);
    for (let k = 1; k < g.rows.length; k++) paint(ws.getCell(r + k, 1), proto.zone);
    r += g.rows.length;
  }
  if (footerText !== null) {                                                                                   // 맨 아래 안내 줄
    const a = ws.getCell(r, 1), b = ws.getCell(r, 2), c = ws.getCell(r, 3); paint(a, foot.a); paint(b, foot.b); paint(c, foot.c); ws.getRow(r).height = foot.h;
    if (foot.right) c.value = footerText ?? foot.text; else { a.value = footerText ?? foot.text; ws.mergeCells(r, 1, r, 3); }
    r += 1;
  }
  const t = ws.getCell(2, 1); t.value = mapRich(t.value, s => title(s));
  if (date) ws.getCell(3, 3).value = date;
  return { endRow: r - 1 };
}

async function buildWorkbook({ templateFile, floor, sheetName, date, cells, fixed = [], big = null }) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templateFile);
  const quarter = wb.worksheets.filter(w => /^\d{4}\.\d{2}/.test(w.name) && [5, 6, 7, 8].filter(r => plain(w.getCell(r, 3).value).trim()).length >= 3).pop();     // 이름이 채워진 가장 최근 분기 시트
  if (!quarter) throw new Error('이름이 적힌 분기 시트(예: 2026.10~)를 찾지 못했습니다');
  const bigSheet = wb.getWorksheet('대청소');
  const fx = fixed.map(f => ({ zone: f.zone, rows: [{ role: '', name: f.who }] }));
  const retitle = s => s.replace(/\((\d+층)\)/, `(${floor})`);
  const keep = [quarter];
  fillTable(quarter, { groups: groupsOf(cells).concat(fx), title: retitle, date: date || null });
  if (floor !== '10층') for (const a of ['F', 'G', 'H']) for (let r = 4; r <= 40; r++) { const c = quarter.getCell(`${a}${r}`); if (c.value != null) c.value = null; }       // 10층 전용 안내문은 지운다
  const wantBig = big && bigSheet; if (wantBig) keep.push(bigSheet);
  for (const w of wb.worksheets.filter(x => !keep.includes(x))) wb.removeWorksheet(w.id);      // 이름이 겹치는 옛 시트(예: 같은 이름의 빈 분기 시트)부터 없앤다
  quarter.name = sheetName;
  if (wantBig) {
    const vac = new Set(big.vacatedIdx), tool = { zone: '도구장 정리 / 도구 소독', rows: big.tool.map(n => ({ role: '', name: n })) };
    const groups = [{ ...tool, rows: tool.rows.map(x => ({ role: '도구장 정리 / 도구 소독', name: x.name })) }].concat(groupsOf(cells, vac, big.support), fx);
    fillTable(bigSheet, { groups, title: retitle, date: date || null, footerText: undefined });
    const J = 10, head = bigSheet.getCell(7, J), item = styleOf(bigSheet.getCell(8, J));
    for (let r = 8; r <= 20; r++) { bigSheet.getCell(r, J).value = null; }
    big.airFilters.forEach((a, i) => { const c = bigSheet.getCell(8 + i, J); paint(c, item); c.value = `${a.place} ${a.n > 1 ? '1-' + a.n : a.n}${a.who ? ' · ' + a.who : ''}`; });
    head.value = '에어컨 필터 청소';
    if (date) { const m = String(date).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); const f = bigSheet.getCell(7, 6); f.value = mapRich(f.value, s => s.replace(/\d{1,2}\/\d{1,2}\([가-힣]\)/, `${+m[2]}/${+m[3]}(${WD[d.getUTCDay()]})`)); } }
    bigSheet.name = `${sheetName} 대청소`;
  }
  return wb;
}
module.exports = { buildWorkbook, groupsOf };
