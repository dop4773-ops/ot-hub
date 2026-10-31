// 엑셀 파일 안쪽(XML)을 직접 고치는 공용 도구 — ExcelJS로 다시 쓰면 깨지는 원본(그림·표·조건부 서식·인쇄 설정이 든 파일)용.
//  keepOnlySheet: 시트 하나만 남기고 나머지 시트·그림·계산 순서 파일을 정리(남은 시트는 원본 그대로)
//  setCell: 칸 값만 바꾸고 서식(s)은 그대로 · fills(): 칸 서식을 복제해 배경색만 바꾼 새 서식 번호를 만든다
const fs = require('fs'), JSZip = require('jszip');
const xe = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (tag, n) => (String(tag).match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];

const loadZip = file => JSZip.loadAsync(fs.readFileSync(file));
const save = zip => zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

async function sheetTable(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string'), tg = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) tg[attr(m[0], 'Id')] = attr(m[0], 'Target');
  return [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ tag: m[0], name: attr(m[0], 'name').replace(/&apos;/g, "'").replace(/&amp;/g, '&'), rid: attr(m[0], 'r:id'), path: 'xl/' + String(tg[attr(m[0], 'r:id')]).replace(/^\/?(xl\/)?/, '') }));
}
async function keepOnlySheet(zip, name, newName) {
  const sheets = await sheetTable(zip), keep = sheets.find(s => s.name === name); if (!keep) throw new Error(`'${name}' 시트를 찾지 못했습니다`);
  let wb = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string'), ct = await zip.file('[Content_Types].xml').async('string');
  const drop = new Set(); const dropFile = p => { if (zip.file(p)) zip.remove(p); };
  const dropSheet = async s => { dropFile(s.path); const rp = s.path.replace(/([^/]+)$/, '_rels/$1.rels'), r = zip.file(rp);
    if (r) { for (const m of (await r.async('string')).matchAll(/<Relationship\b[^>]*>/g)) if (/\/(drawing|printerSettings)$/.test(attr(m[0], 'Type'))) { const t = new URL(attr(m[0], 'Target'), 'http://x/' + s.path).pathname.slice(1); drop.add(t); dropFile(t); dropFile(t.replace(/([^/]+)$/, '_rels/$1.rels')); } dropFile(rp); } };
  const keepRels = zip.file(keep.path.replace(/([^/]+)$/, '_rels/$1.rels')); const keepTargets = new Set();
  if (keepRels) for (const m of (await keepRels.async('string')).matchAll(/<Relationship\b[^>]*Target="([^"]+)"/g)) keepTargets.add(new URL(m[1], 'http://x/' + keep.path).pathname.slice(1));
  for (const s of sheets) if (s !== keep) {
    await dropSheet(s); wb = wb.replace(s.tag, ''); rels = rels.replace(new RegExp(`<Relationship\\b[^>]*Id="${s.rid}"[^>]*/>`), '');
    ct = ct.replace(new RegExp(`<Override\\b[^>]*PartName="/${s.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`), '');
  }
  for (const t of keepTargets) drop.delete(t);
  for (const t of drop) ct = ct.replace(new RegExp(`<Override\\b[^>]*PartName="/${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`), '');
  dropFile('xl/calcChain.xml'); rels = rels.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ''); ct = ct.replace(/<Override\b[^>]*calcChain[^>]*\/>/, '');
  wb = wb.replace(/<definedNames>[\s\S]*?<\/definedNames>/, '').replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1"/>');       // 이름 정의는 지운 시트를 가리키므로 함께 지운다
  wb = wb.replace(/(<workbookView\b[^>]*?)\s+(?:activeTab|firstSheet)="\d+"/g, '$1');
  if (newName) wb = wb.replace(keep.tag, keep.tag.replace(/name="[^"]*"/, `name="${xe(newName)}"`));
  zip.file('xl/workbook.xml', wb); zip.file('xl/_rels/workbook.xml.rels', rels); zip.file('[Content_Types].xml', ct);
  zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
  return keep.path;
}

// 칸 하나의 값만 바꾼다(서식 s 유지). 칸이 없으면 줄 안에 열 순서대로 끼워 넣는다.
const colNum = c => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
function setCell(xml, ref, value, newStyle) {
  const [, col, row] = ref.match(/^([A-Z]+)(\d+)$/), re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`), m = xml.match(re);
  const s = m ? attr('<c ' + m[1], 's') : newStyle, sa = s ? ` s="${s}"` : '';
  const cell = value === '' || value == null ? `<c r="${ref}"${sa}/>` : typeof value === 'number' ? `<c r="${ref}"${sa}><v>${value}</v></c>` : `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xe(value)}</t></is></c>`;
  if (m) return xml.replace(re, cell);
  const rre = new RegExp(`(<row r="${row}"[^>]*?)(/>|>([\\s\\S]*?)</row>)`), rm = xml.match(rre);
  if (!rm) return xml.replace('</sheetData>', `<row r="${row}">${cell}</row></sheetData>`);
  const body = rm[3] || '', cells = [...body.matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)], after = cells.find(x => colNum(x[1]) > colNum(col));
  const nb = after ? body.slice(0, after.index) + cell + body.slice(after.index) : body + cell;
  return xml.replace(rre, `${rm[1].replace(/\/$/, '')}>${nb}</row>`);
}
// 칸의 서식 번호만 바꾼다(칸이 없으면 아무것도 안 함)
function setStyle(xml, ref, s) { return xml.replace(new RegExp(`<c r="${ref}"([^>]*?)(/?>)`), (all, a, e) => /\bs="\d+"/.test(a) ? `<c r="${ref}"${a.replace(/\bs="\d+"/, `s="${s}"`)}${e}` : `<c r="${ref}" s="${s}"${a}${e}`); }
const styleOf = (xml, ref) => { const m = xml.match(new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>)`)); return m ? attr('<c ' + m[1], 's') : undefined; };

// 서식 복제: 칸 서식 s의 테두리·글꼴은 그대로, 배경만 argb로 바꾼 새 서식 번호를 돌려준다.
function fills(stylesXml) {
  let fillsXml = stylesXml.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/), xfsXml = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  const xfs = [...xfsXml[2].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m => m[0]), addedFills = [], addedXfs = [], fillId = {}, memo = {};
  let nFills = Number(fillsXml[1]);
  return {
    get(s, argb) {
      const k = `${s}|${argb}`; if (memo[k] != null) return memo[k];
      if (fillId[argb] == null) { fillId[argb] = nFills + addedFills.length; addedFills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${argb}"/><bgColor indexed="64"/></patternFill></fill>`); }
      let xf = xfs[Number(s || 0)] || xfs[0]; xf = xf.replace(/\bfillId="\d+"/, `fillId="${fillId[argb]}"`).replace(/\bapplyFill="\d"/, '').replace(/^<xf\b/, '<xf applyFill="1"');
      memo[k] = xfs.length + addedXfs.length; addedXfs.push(xf); return memo[k];
    },
    finish() { return stylesXml.replace(fillsXml[0], `<fills count="${nFills + addedFills.length}">${fillsXml[2]}${addedFills.join('')}</fills>`).replace(xfsXml[0], `<cellXfs count="${xfs.length + addedXfs.length}">${xfsXml[2]}${addedXfs.join('')}</cellXfs>`); },
  };
}
// 공유 문자열 표(글자 칸이 가리키는 실제 글자)
async function sharedStrings(zip) {
  const f = zip.file('xl/sharedStrings.xml'); if (!f) return [];
  return [...(await f.async('string')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}
// 칸의 글자(공유 문자열·직접 문자열·숫자 모두)
function cellValue(xml, ref, ss) {
  const m = xml.match(new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`)); if (!m || !m[2]) return '';
  const t = attr('<c ' + m[1], 't'), v = (m[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  if (t === 's') return ss[Number(v)] || ''; if (t === 'inlineStr') return [...m[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''); return v == null ? '' : v;
}
// 새 시트 하나를 덧붙인다(단순 표: 값만, 첫 줄은 굵게 하지 않음)
async function addSheet(zip, name, rows, widths = []) {
  let wb = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string'), ct = await zip.file('[Content_Types].xml').async('string');
  const n = 1 + Math.max(0, ...Object.keys(zip.files).map(f => Number((f.match(/^xl\/worksheets\/sheet(\d+)\.xml$/) || [])[1] || 0))), rid = 'rIdX' + n, sid = 1 + Math.max(0, ...[...wb.matchAll(/sheetId="(\d+)"/g)].map(m => +m[1]));
  const col = i => String.fromCharCode(65 + i), body = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => v == null || v === '' ? '' : typeof v === 'number' ? `<c r="${col(j)}${i + 1}"><v>${v}</v></c>` : `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`).join('')}</row>`).join('');
  zip.file(`xl/worksheets/sheet${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`.replace('<cols></cols>', ''));
  wb = wb.replace('</sheets>', `<sheet name="${xe(name)}" sheetId="${sid}" r:id="${rid}"/></sheets>`);
  rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
  ct = ct.replace('</Types>', `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file('xl/workbook.xml', wb); zip.file('xl/_rels/workbook.xml.rels', rels); zip.file('[Content_Types].xml', ct);
}
module.exports = { sharedStrings, cellValue, addSheet, loadZip, save, keepOnlySheet, setCell, setStyle, styleOf, fills, sheetTable };
