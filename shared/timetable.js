// 환자 전체시간표(10F/3F '환자전체시간표(원본)'): 환자마다 26행짜리 카드. 카드 윗줄 오른쪽(M열)에
//  '회복기 재활치료 스케줄' = 회복기 환자, '재활치료 스케줄'(회복기 글자 없음) = 비회복기 환자.
// 카드 아랫줄(+1행) A열 = 이름, G열 = 병실. 읽는 시트: 입원, 병동 시트(예: 7병동). 외래·퇴원·인쇄는 제외.
// 파일이 커서(수천 행×백여 열) 통째로 열면 느려서 스트리밍으로 필요한 열만 읽는다.
const { ExcelJS } = require('./xl');
const HEAD = /재활치료\s*스케줄/;
const cellText = c => { const v = c && c.value; if (v == null) return ''; if (v.richText) return v.richText.map(t => t.text).join(''); return String(v.result ?? v); };

const { memo } = require('./cache');
const loadTimetableCards = file => memo('timetable', file, () => parseCards(file));
async function parseCards(file) {
  const out = {};
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { worksheets: 'emit', sharedStrings: 'cache', styles: 'ignore', hyperlinks: 'ignore', entries: 'ignore' });
  for await (const ws of reader) {
    if (!/^입원$|병동$/.test(ws.name)) { for await (const _ of ws) { /* 건너뜀 */ } continue; }
    let pending = null;
    for await (const row of ws) {
      if (pending && row.number === pending.row + 1) {
        const name = cellText(row.getCell(1)).trim();
        if (name) out[name] = { recovery: pending.recovery, room: cellText(row.getCell(7)).trim(), sheet: ws.name };
        pending = null;
      }
      const h = cellText(row.getCell(13)).replace(/\s+/g, ' ').trim();
      if (HEAD.test(h)) pending = { row: row.number, recovery: /회복기/.test(h) };
    }
  }
  return out;
}
module.exports = { loadTimetableCards };
