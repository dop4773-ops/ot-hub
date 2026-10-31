// 출근부 — 원본 파일(26년_N월_출근부_자동화.xlsx)을 그대로 열어 필요한 칸만 고쳐 저장한다.
// 글꼴·너비·테두리·가로 인쇄(A4 가로, 쪽 나눔, 인쇄 범위)·일요일 회색 음영(조건부 서식)이 전부 원본 그대로 남도록 엑셀 파일 안쪽(XML)을 직접 편집한다.
//   · 설정!B1/B2 = 연·월, 직원명단!B2~ = 이름(직급·경력순) → 원본의 수식이 제목·이름·날짜·요일을 알아서 채운다
//   · 추가한 서식: 공휴일 = 그 날짜 전체 회색(일요일과 같은 색), 날짜 칸 글자색 = 토 파랑 · 일/공휴일 빨강
//   · 층 이름은 제목 수식의 '10층'을 고른 층으로 바꾼다. 쓰지 않는 블록(6명 단위)은 인쇄 범위·쪽 나눔에서 뺀다.
const fs = require('fs'), JSZip = require('jszip');
const PER = 6, BLOCK_W = 13, MAX_BLOCKS = 9;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

async function sheetPaths(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const target = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = (m[0].match(/Id="([^"]+)"/) || [])[1], t = (m[0].match(/Target="([^"]+)"/) || [])[1]; if (id) target[id] = t; }
  const out = {}; for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) { const n = (m[0].match(/name="([^"]+)"/) || [])[1], id = (m[0].match(/r:id="([^"]+)"/) || [])[1]; if (n) out[n.replace(/&apos;/g, "'")] = 'xl/' + String(target[id]).replace(/^\/?(xl\/)?/, ''); }
  return out;
}
// 셀 하나의 값 바꾸기 — 원래 칸의 서식(s)은 그대로. 값이 없으면 빈 칸으로.
function setCell(xml, ref, value) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re); const s = m ? (m[1].match(/\bs="(\d+)"/) || [])[1] : null, sa = s ? ` s="${s}"` : '';
  const cell = value === '' || value == null ? `<c r="${ref}"${sa}/>` : typeof value === 'number' ? `<c r="${ref}"${sa}><v>${value}</v></c>` : `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  if (m) return xml.replace(re, cell);
  const row = ref.match(/(\d+)$/)[1], rre = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
  if (rre.test(xml)) return xml.replace(rre, (_, a, b, c) => a + b + cell + c);                    // 같은 줄 끝에 붙임(열 순서가 어긋나지 않는 자리에서만 쓰인다)
  return xml.replace('</sheetData>', `<row r="${row}">${cell}</row></sheetData>`);
}
const GUID = i => `{0A7B1C00-0000-4000-8000-${String(i).padStart(12, '0')}}`;

function cfRules(year, month, first, last, holidays, dateCols, whole, rowTo, idBase) {
  const D = `${first}+INT((ROW()-6)/2)`, dim = new Date(year, month, 0).getDate();
  const valid = `${D}&lt;=DAY(EOMONTH(DATE(설정!$B$1,설정!$B$2,1),0))`;
  const wd = n => `AND(${valid},WEEKDAY(DATE(설정!$B$1,설정!$B$2,${D}),1)=${n})`;
  const hol = holidays.filter(d => d >= first && d <= last && d <= dim);
  const holF = hol.length ? `OR(${hol.map(d => `${D}=${d}`).join(',')})` : null;
  const dx = (rule, sqref, id, pri) => `<x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:cfRule type="expression" priority="${pri}" id="${GUID(id)}"><xm:f>${rule.f}</xm:f><x14:dxf>${rule.dxf}</x14:dxf></x14:cfRule><xm:sqref>${sqref}</xm:sqref></x14:conditionalFormatting>`;
  const GRAY = '<fill><patternFill patternType="solid"><fgColor indexed="64"/><bgColor rgb="FFD9D9D9"/></patternFill></fill>';
  const RED = '<font><color rgb="FFDC2626"/></font>', BLUE = '<font><color rgb="FF2563EB"/></font>';
  const dc = dateCols.map(c => `${c}6:${c}${rowTo}`).join(' ');
  let out = '', p = 20;
  if (holF) out += dx({ f: holF, dxf: GRAY }, `A6:${whole}${rowTo}`, idBase + 1, p++);
  out += dx({ f: holF ? `OR(${wd(1)},${holF})` : wd(1), dxf: RED }, dc, idBase + 2, p++);
  out += dx({ f: wd(7), dxf: BLUE }, dc, idBase + 3, p++);
  return out;
}

async function build({ templateFile, year, month, floor, names, holidays = [] }) {
  if (names.length > PER * 8) throw new Error(`직원명단 칸(48명)보다 많습니다: ${names.length}명`);
  const zip = await JSZip.loadAsync(fs.readFileSync(templateFile)), P = await sheetPaths(zip);
  const need = ['설정', '직원명단', '출근부(1~15일)', '출근부(16~말일)'].filter(n => !P[n]);
  if (need.length) throw new Error(`원본 출근부 파일에 시트가 없습니다: ${need.join(', ')}`);
  const read = async p => zip.file(p).async('string'), blocks = Math.max(1, Math.min(MAX_BLOCKS, Math.ceil(names.length / PER)));
  const lastCol = colName(blocks * BLOCK_W), dateCols = Array.from({ length: blocks }, (_, b) => colName(b * BLOCK_W + 1));
  const hol = holidays.filter(d => d.startsWith(`${year}-${String(month).padStart(2, '0')}`)).map(d => Number(d.slice(8)));

  let s = await read(P['설정']); s = setCell(s, 'B1', year); s = setCell(s, 'B2', month); zip.file(P['설정'], s);
  let e = await read(P['직원명단']); for (let i = 0; i < 48; i++) e = setCell(e, `B${i + 2}`, names[i] || ''); zip.file(P['직원명단'], e);

  const halves = [{ n: '출근부(1~15일)', first: 1, last: 15, whole: 'DM', rowTo: 35, pa: 36 }, { n: '출근부(16~말일)', first: 16, last: 31, whole: 'DZ', rowTo: 37, pa: 37 }];
  halves.forEach(() => {});
  for (const [k, h] of halves.entries()) {
    let x = await read(P[h.n]);
    x = x.replace(/미래병원 \d+층 재활치료실/g, `미래병원 ${floor} 재활치료실`).replace(/ \d{4}년 \d{1,2}월 미래병원/g, ` ${year}년 ${month}월 미래병원`);   // 제목 수식과 저장된 값
    x = x.replace(/<colBreaks[\s\S]*?<\/colBreaks>/, () => blocks > 1 ? `<colBreaks count="${blocks - 1}" manualBreakCount="${blocks - 1}">${Array.from({ length: blocks - 1 }, (_, i) => `<brk id="${(i + 1) * BLOCK_W}" max="1048575" man="1"/>`).join('')}</colBreaks>` : '');
    const add = cfRules(year, month, h.first, h.last, hol, dateCols, h.whole, h.rowTo, k * 10);
    x = x.replace('</x14:conditionalFormattings>', add + '</x14:conditionalFormattings>');
    zip.file(P[h.n], x);
  }
  let w = await zip.file('xl/workbook.xml').async('string');
  const names2 = [['출근부(1~15일)', 2, 36], ['출근부(16~말일)', 3, 37]];
  w = w.replace(/<definedName name="_xlnm\.Print_Area"[^>]*>[^<]*<\/definedName>/g, '');           // 옛 인쇄 범위를 지우고 새로 넣는다
  const defs = names2.map(([n, id, row]) => `<definedName name="_xlnm.Print_Area" localSheetId="${id}">'${n}'!$A$1:$${lastCol}$${row}</definedName>`).join('');
  w = /<definedNames>/.test(w) ? w.replace('<definedNames>', '<definedNames>' + defs) : w.replace('</sheets>', '</sheets><definedNames>' + defs + '</definedNames>');
  w = w.replace(/<calcPr([^>]*?)\/>/, (_, a) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);       // 열 때 수식을 다시 계산
  zip.file('xl/workbook.xml', w);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { build };
