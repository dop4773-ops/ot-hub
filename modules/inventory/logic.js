// 도구 목록 · 신청서 가져오기 · 분류 반영 (순수 로직 + 엑셀 입출력)
const { txt, open, ExcelJS } = require('../../shared/xl');

const SECTIONS = ['Activity', 'ADL', 'RDT'];
const secOf = s => /Activity/i.test(s) ? 'Activity' : /ADL/i.test(s) ? 'ADL' : /RDT/i.test(s) ? 'RDT' : null;

// '도구목록' 시트: A순번 B도구명 C수량 D구분(비품/소모품) E비고, 구역 머리글 행(병합)이 섹션을 나눈다.
async function loadTools(file) {
  const ws = (await open(file)).worksheets[0], items = []; let sec = 'Activity', id = 0;
  for (let r = 6; r <= ws.rowCount; r++) {
    const a = txt(ws.getCell(r, 1)).trim(), b = txt(ws.getCell(r, 2)).trim();
    if (a && isNaN(Number(a)) && secOf(a)) { sec = secOf(a); continue; }       // 병합된 구역 머리글(병합 셀은 B열도 같은 글자를 돌려준다)
    if (!b || a === '순번' || isNaN(Number(a))) continue;
    items.push({ id: ++id, section: sec, name: b, qty: Number(txt(ws.getCell(r, 3))) || 0, kind: txt(ws.getCell(r, 4)).trim(), note: txt(ws.getCell(r, 5)).trim() });
  }
  return items;
}

const norm = s => String(s || '').toLowerCase().replace(/[\s()\[\]\-_/,.·]/g, '');
// 신청서 품명 → 목록의 같은/비슷한 품목 후보 (정확히 같으면 exact, 한쪽이 다른 쪽을 포함하면 near)
function match(name, items) {
  const n = norm(name); if (!n) return { exact: [], near: [] };
  const exact = items.filter(i => norm(i.name) === n).map(i => i.id);
  const near = exact.length ? [] : items.filter(i => { const m = norm(i.name); return m.length >= 2 && n.length >= 2 && (m.includes(n) || n.includes(m)); }).map(i => i.id);
  return { exact, near };
}

// 신청서 파일 미리보기: 시트별 앞 40행
async function previewSupply(file) {
  const wb = await open(file);
  return wb.worksheets.map(ws => ({ name: ws.name, rows: Array.from({ length: Math.min(ws.rowCount, 40) }, (_, i) => Array.from({ length: Math.min(ws.columnCount, 12) }, (_, j) => txt(ws.getCell(i + 1, j + 1)).replace(/\s+/g, ' ').trim())) }));
}
const GUESS = { name: /품명|품목|물품|명칭|도구/, qty: /수량|개수|\bqty\b/i, spec: /규격|사양|모델/, note: /비고|사유|용도/ };
function guessCols(headerRow) { const c = {}; headerRow.forEach((h, j) => { const t = String(h).replace(/\s+/g, ''); for (const [k, re] of Object.entries(GUESS)) if (c[k] == null && re.test(t)) c[k] = j; }); return c; }

async function importSupply(file, { sheet, headerRow, cols }, items) {
  const ws = (await open(file)).getWorksheet(sheet), out = [];
  for (let r = headerRow + 2; r <= ws.rowCount; r++) {   // headerRow는 0부터 센 미리보기 행 번호 → 엑셀 행은 +1, 그 다음 행부터 품목
    const name = txt(ws.getCell(r, cols.name + 1)).replace(/\s+/g, ' ').trim(); if (!name) continue;
    const m = match(name, items);
    out.push({ key: `${r}`, name, qty: Number(txt(ws.getCell(r, (cols.qty ?? -1) + 1))) || 1, spec: cols.spec != null ? txt(ws.getCell(r, cols.spec + 1)).trim() : '', note: cols.note != null ? txt(ws.getCell(r, cols.note + 1)).trim() : '',
      matchId: m.exact[0] || m.near[0] || null, matchKind: m.exact.length ? '정확히 일치' : m.near.length ? '비슷함' : '목록에 없음', candidates: [...m.exact, ...m.near] });
  }
  return out;
}

// 분류 반영: action = 신규 | 추가 | 교체 | 소진 | 제외 | (빈 값 = 미분류)
//  · 교체(폐기 후 보충): 낡은 것을 버리고 새로 채운 것이라 재고량은 그대로 — 변경이력에만 남긴다
//  · 추가: 기존 품목 수량 += 신청 수량 · 신규: 목록에 새 품목 · 소진: 소모품을 쓴 기록(재고 변화 없음)
function apply(items, imported) {
  const next = items.map(i => ({ ...i })), log = [], pending = [];
  let id = Math.max(0, ...next.map(i => i.id));
  for (const r of imported) {
    const a = r.action; if (!a) { pending.push(r); continue; } if (a === '제외') continue;
    const tgt = r.matchId ? next.find(i => i.id === r.matchId) : null;
    if (a === '신규') { next.push({ id: ++id, section: r.section || 'Activity', name: r.name, qty: r.qty, kind: r.kind || '비품', note: [r.floor ? (r.floor === '3F' ? '3층' : '10층') : '', r.note].filter(Boolean).join(' · '), floor: r.floor ? (r.floor === '3F' ? '3층' : '10층') : '', isNew: true }); log.push({ ...r, result: `신규 등록 ${r.qty}개 (${r.section || 'Activity'}·${r.kind || '비품'})` }); }
    else if (!tgt) pending.push({ ...r, why: '연결할 기존 품목이 없음' });
    else if (a === '추가') { tgt.qty += r.qty; log.push({ ...r, result: `${tgt.name} 수량 ${tgt.qty - r.qty} → ${tgt.qty}` }); }
    else if (a === '교체') log.push({ ...r, result: `${tgt.name} 폐기 후 보충 ${r.qty}개 — 재고량 ${tgt.qty}개 그대로` });
    else if (a === '소진') log.push({ ...r, result: `${tgt.name} 소모품 소진 기록(재고 변화 없음)` });
  }
  return { items: next, log, pending };
}

function build({ items, log, title = '작업치료실 도구 통합 목록', manager = '' }) {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('도구목록');
  ws.columns = [{ width: 7 }, { width: 34 }, { width: 8 }, { width: 9 }, { width: 30 }];
  ws.mergeCells('A1:E1'); ws.getCell('A1').value = title; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('D2').value = '업데이트'; ws.getCell('E2').value = new Date().toISOString().slice(0, 10); if (manager) { ws.getCell('D3').value = '관리자'; ws.getCell('E3').value = manager; }
  let r = 5; const thin = { style: 'thin' }, box = { top: thin, left: thin, bottom: thin, right: thin };
  for (const sec of SECTIONS) {
    const list = items.filter(i => i.section === sec); if (!list.length) continue;
    ws.mergeCells(r, 1, r, 5); ws.getCell(r, 1).value = `${sec === 'Activity' ? '작업치료실 Activity' : sec} 도구 | 총 ${list.length}개`; ws.getCell(r, 1).font = { bold: true }; r++;
    ws.getRow(r).values = ['순번', '도구명', '수량', '구분', '비고']; ws.getRow(r).eachCell(c => { c.font = { bold: true }; c.border = box; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; }); r++;
    list.forEach((i, k) => { ws.getRow(r).values = [k + 1, i.name, i.qty, i.kind, i.note]; ws.getRow(r).eachCell({ includeEmpty: true }, c => c.border = box); if (i.isNew) ws.getRow(r).getCell(2).font = { color: { argb: 'FF15803D' } }; r++; });
    r++;
  }
  const lg = wb.addWorksheet('변경이력'); lg.columns = [{ width: 36 }, { width: 8 }, { width: 70 }];
  lg.getRow(1).values = ['신청 품목', '수량', '반영 결과']; lg.getRow(1).font = { bold: true };
  log.forEach((l, k) => lg.getRow(2 + k).values = [l.name, l.qty, l.result]);
  return wb;
}
module.exports = { loadTools, match, previewSupply, guessCols, importSupply, apply, build, SECTIONS };
