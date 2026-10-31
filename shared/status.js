// 작업치료현황.xlsx '현황(회복기)'(현황판): B순번 C구분(+색) D진료과 E병실 F성명 G입원일 H회복기 기간(종료일 또는 '-') I입원상태 J특이사항 O CCRT
const { txt, rm, open } = require('./xl');
const day = c => { const v = c && c.value; const x = v && v.result !== undefined ? v.result : v; return x instanceof Date && !isNaN(x) ? x.toISOString().slice(0, 10) : null; };
const argb = c => { const f = c && c.fill && c.fill.fgColor; return f && f.argb ? f.argb.toUpperCase() : ''; };

const { memo } = require('./cache');
const loadStatus = file => memo('status', file, () => parseStatus(file));
async function parseStatus(file) {
  const ws = (await open(file)).getWorksheet('현황(회복기)');
  if (!ws) throw new Error("'현황(회복기)' 시트를 찾지 못했습니다");
  const out = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const name = txt(ws.getCell(r, 6)).trim(); if (!name) continue;
    out.push({ name, kind: txt(ws.getCell(r, 3)).trim(), kindColor: argb(ws.getCell(r, 3)), doctor: rm(txt(ws.getCell(r, 4))), room: txt(ws.getCell(r, 5)).trim(),
      admitted: day(ws.getCell(r, 7)), recoveryEnd: day(ws.getCell(r, 8)), state: txt(ws.getCell(r, 9)).trim(), memo: txt(ws.getCell(r, 10)).trim() });
  }
  return out;
}
module.exports = { loadStatus };
