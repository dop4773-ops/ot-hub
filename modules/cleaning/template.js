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
  // 칸 만들기: 구역(A) 병합 · 같은 역할이 여러 칸이면 역할(B)도 병합 · 굵은 선은 구역·역할 덩어리 경계, 이름 칸 사이는 얇은 선
  const med = { style: 'medium', color: { argb: 'FF000000' } }, thin = { style: 'thin', color: { argb: 'FF000000' } };
  const widthPx = c => (ws.getColumn(c).width || 9) * 7 + 5, size = cell => (cell.font && cell.font.size) || 18;
  const lineCount = (text, pt, px) => { const per = pt * 96 / 72, avail = Math.max(per, px - 8); let n = 0;      // 글자 폭을 어림해서 줄 수를 센다(한글 = 한 칸, 영문·숫자 약 0.6칸, 괄호·점 약 0.35칸)
    for (const seg of String(text || '').split('\n')) { let w = 0, lines = 1; for (const ch of seg) { const cw = per * (/[가-힣ㄱ-ㅎ]/.test(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? .62 : /\s/.test(ch) ? .3 : /[()\[\],.+\/&·]/.test(ch) ? .35 : .8); if (w + cw > avail) { lines++; w = cw; } else w += cw; } n += lines; } return n; };
  const needPt = (text, pt, px) => text ? lineCount(text, pt, px) * pt * 1.25 + 3 : 0;
  const rowH = {}, spans = []; let r = hdr + 1;
  for (const g of groups) {
    const solo = g.rows.length === 1 && !g.rows[0].role, wide = !!g.wide, r0 = r, r1 = r + g.rows.length - 1;
    g.rows.forEach((x, k) => {
      const a = ws.getCell(r + k, 1), b = ws.getCell(r + k, 2), c = ws.getCell(r + k, 3);
      paint(a, proto.zone); paint(b, proto.role); paint(c, proto.name);
      a.value = k === 0 ? g.zone : null; b.value = solo || wide ? null : x.role; c.value = x.name || null;
      for (const cell of [a, b, c]) cell.alignment = { ...clone(cell.alignment), wrapText: true, vertical: 'middle' };
      rowH[r + k] = Math.max(proto.h || 27, needPt(x.name, size(c), widthPx(3)), solo ? 0 : 0);
    });
    const blocks = []; g.rows.forEach((x, k) => { const l = blocks[blocks.length - 1]; if (l && !solo && !wide && l.role === x.role) l.n++; else blocks.push({ role: x.role, from: r + k, n: 1 }); });
    const edge = (cell, o) => { cell.border = { ...(cell.border || {}), ...o }; };
    for (let rr = r0; rr <= r1; rr++) { edge(ws.getCell(rr, 1), { left: med, right: med, top: rr === r0 ? med : undefined, bottom: rr === r1 ? med : undefined }); }
    for (const bl of blocks) for (let k = 0; k < bl.n; k++) {
      const rr = bl.from + k, first = k === 0, last = k === bl.n - 1;
      edge(ws.getCell(rr, 2), { left: med, right: med, top: first ? med : undefined, bottom: last ? med : undefined });
      edge(ws.getCell(rr, 3), { left: med, right: med, top: first ? med : thin, bottom: last ? med : thin });
    }
    if (wide) {                                                      // 도구장 소독처럼 구역·역할 칸이 한 덩어리(A:B 병합)이고 이름만 줄마다 있는 구역
      for (let rr = r0; rr <= r1; rr++) { edge(ws.getCell(rr, 1), { top: rr === r0 ? med : undefined, bottom: rr === r1 ? med : undefined }); edge(ws.getCell(rr, 2), { top: rr === r0 ? med : undefined, bottom: rr === r1 ? med : undefined, left: undefined }); edge(ws.getCell(rr, 3), { left: med, right: med, top: rr === r0 ? med : thin, bottom: rr === r1 ? med : thin }); }
      ws.mergeCells(r0, 1, r1, 2); spans.push({ from: r0, n: g.rows.length, need: needPt(g.zone, size(ws.getCell(r0, 1)), widthPx(1) + widthPx(2)) });
    } else if (solo) { for (const cc of [1, 2]) edge(ws.getCell(r0, cc), { top: med, bottom: med }); edge(ws.getCell(r0, 3), { top: med, bottom: med }); ws.mergeCells(r0, 1, r0, 2); spans.push({ from: r0, n: 1, need: needPt(g.zone, size(ws.getCell(r0, 1)), widthPx(1) + widthPx(2)) }); }
    else {
      if (g.rows.length > 1) ws.mergeCells(r0, 1, r1, 1);
      spans.push({ from: r0, n: g.rows.length, need: needPt(g.zone, size(ws.getCell(r0, 1)), widthPx(1)) });
      for (const bl of blocks) {
        const bc = ws.getCell(bl.from, 2);
        if (bl.n === 1 && bl.role) { const f = [18, 17, 16, 15].find(z => lineCount(bl.role, z, widthPx(2)) <= 1); bc.font = { ...clone(bc.font), size: f || 15 }; }        // 한 칸짜리 역할은 원본처럼 글자를 줄여 한 줄에 맞추고, 그래도 안 되면 줄바꿈 + 높이
        if (bl.n > 1) ws.mergeCells(bl.from, 2, bl.from + bl.n - 1, 2); spans.push({ from: bl.from, n: bl.n, need: needPt(bl.role, size(ws.getCell(bl.from, 2)), widthPx(2)) }); }
    }
    r += g.rows.length;
  }
  for (const sp of spans) {                                      // 병합된 칸에 글자가 다 들어가도록 모자라는 높이를 그 줄들에 나눠 더한다
    const have = Array.from({ length: sp.n }, (_, k) => rowH[sp.from + k]).reduce((x, y) => x + y, 0);
    if (sp.need > have) for (let k = 0; k < sp.n; k++) rowH[sp.from + k] += (sp.need - have) / sp.n;
  }
  for (const [rr, h] of Object.entries(rowH)) ws.getRow(+rr).height = Math.min(400, Math.ceil(h * 4) / 4);
  if (footerText !== null) {                                                                                   // 맨 아래 안내 줄
    const a = ws.getCell(r, 1), b = ws.getCell(r, 2), c = ws.getCell(r, 3); paint(a, foot.a); paint(b, foot.b); paint(c, foot.c); ws.getRow(r).height = foot.h;
    if (foot.right) c.value = footerText ?? foot.text; else { a.value = footerText ?? foot.text; ws.mergeCells(r, 1, r, 3); }
    r += 1;
  }
  const t = ws.getCell(2, 1); t.value = mapRich(t.value, s => title(s));
  if (date) ws.getCell(3, 3).value = date;
  return { endRow: r - 1 };
}

// 배치도 시트: 원본 'Sheet1'(10층 그림)의 칸 글자 아래에 담당자를 적는다. fp = floorplan.js의 읽은 결과, pl = place() 결과
function writeMap(ws, fp, pl, tool) {
  fp.blocks.forEach((b, i) => {
    const bl = pl.blocks[i]; if (!bl || (!bl.lines.length && !bl.tool)) return;
    const cell = ws.getCell(b.r + fp.top - 1, b.c), base = clone(cell.font) || {}, txt = plain(cell.value).replace(/\s*\n\s*/g, ' ').trim();
    const body = bl.lines.map(l => `${l.role} ${l.names.map(x => x.vac ? '(지원 필요)' : x.n).join(' · ')}`).concat(bl.tool ? [`소독 ${tool.join(' · ')}`] : []).join('\n');
    cell.value = { richText: [{ text: txt + '\n', font: { ...base, bold: true } }, { text: body, font: { ...base, size: 10, bold: false } }] };
    cell.alignment = { ...clone(cell.alignment), wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  if (pl.rest.length) { let r = fp.top + fp.rows.length + 2; ws.getCell(r++, 2).value = '배치도에 칸이 없는 구역'; for (const z of pl.rest) ws.getCell(r++, 2).value = `${z.zone}: ` + z.items.map(x => `${x.role} ${x.vac ? '(지원 필요)' : x.n}`.trim()).join(' · '); }
}
function cloneSheet(wb, src, name) { const ws = wb.addWorksheet(name); ws.model = Object.assign({}, src.model, { name, mergeCells: src.model.merges }); return ws; }

// include: 내보낼 것 { week: 평일표, big: 대청소표, mapWeek: 평일 배치도, mapBig: 대청소 배치도 }, maps: { fp, week: place결과, big: place결과 }
async function buildWorkbook({ templateFile, floor, sheetName, date, cells, fixed = [], big = null, include = { week: true, big: true }, maps = null }) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templateFile);
  const quarter = wb.worksheets.filter(w => /^\d{4}\.\d{2}/.test(w.name) && [5, 6, 7, 8].filter(r => plain(w.getCell(r, 3).value).trim()).length >= 3).pop();     // 이름이 채워진 가장 최근 분기 시트
  if (!quarter) throw new Error('이름이 적힌 분기 시트(예: 2026.10~)를 찾지 못했습니다');
  const bigSheet = wb.getWorksheet('대청소');
  const fx = fixed.map(f => ({ zone: f.zone, rows: [{ role: '', name: f.who }] }));
  const retitle = s => s.replace(/\((\d+층)\)/, `(${floor})`);
  const keep = []; if (include.week !== false) keep.push(quarter);
  fillTable(quarter, { groups: groupsOf(cells).concat(fx), title: retitle, date: date || null });
  if (floor !== '10층') for (const a of ['F', 'G', 'H']) for (let r = 4; r <= 40; r++) { const c = quarter.getCell(`${a}${r}`); if (c.value != null) c.value = null; }       // 10층 전용 안내문은 지운다
  const wantBig = big && bigSheet && include.big !== false; if (wantBig) keep.push(bigSheet);
  const mapSrc = maps && maps.fp && wb.getWorksheet('Sheet1'), wantMap = mapSrc && (include.mapWeek || (include.mapBig && big)), mapSheets = [];
  if (wantMap) {
    const both = include.mapWeek && maps.week && include.mapBig && big && maps.big;
    if (include.mapWeek && maps.week) mapSheets.push({ ws: mapSrc, pl: maps.week, name: `${sheetName} 배치도`, tool: [] });
    if (include.mapBig && big && maps.big) mapSheets.push({ ws: both ? cloneSheet(wb, mapSrc, '_big') : mapSrc, pl: maps.big, name: `${sheetName} 대청소 배치도`, tool: big.tool });
  }
  for (const m of mapSheets) keep.push(m.ws);
  for (const w of wb.worksheets.filter(x => !keep.includes(x))) wb.removeWorksheet(w.id);      // 이름이 겹치는 옛 시트(예: 같은 이름의 빈 분기 시트)부터 없앤다
  if (include.week !== false) quarter.name = sheetName;
  for (const m of mapSheets) { writeMap(m.ws, maps.fp, m.pl, m.tool); m.ws.name = m.name; }
  if (wantBig) {
    const vac = new Set(big.cells.map((c, i) => c.name ? -1 : i));       // 이름이 안 정해진 칸 = 지원 배치 필요
    const groups = [{ zone: '도구장 정리 / 도구 소독', wide: true, rows: big.tool.map(n => ({ role: '', name: n })) }].concat(groupsOf(big.cells, vac), fx);
    fillTable(bigSheet, { groups, title: retitle, date: date || null, footerText: undefined });
    const J = 10, head = bigSheet.getCell(7, J), item = styleOf(bigSheet.getCell(8, J));
    for (let r = 8; r <= 20; r++) { bigSheet.getCell(r, J).value = null; }
    big.airFilters.forEach((a, i) => { const c = bigSheet.getCell(8 + i, J); paint(c, item); c.value = `${a.place} ${a.n > 1 ? '1-' + a.n : a.n}${a.who ? ' · ' + a.who : ''}`; });
    head.value = big.airFilters.length ? '에어컨 필터 청소' : null;
    if (date) { const m = String(date).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); const f = bigSheet.getCell(7, 6); f.value = mapRich(f.value, s => s.replace(/\d{1,2}\/\d{1,2}\([가-힣]\)/, `${+m[2]}/${+m[3]}(${WD[d.getUTCDay()]})`)); } }
    bigSheet.name = `${sheetName} 대청소`;
  }
  return wb;
}
module.exports = { buildWorkbook, groupsOf };
