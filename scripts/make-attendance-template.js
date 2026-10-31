// 원본 출근부 파일에서 직원 이름(공유 문자열 포함)과 작성자 정보를 지워 앱에 넣을 '빈 양식'을 만든다.
// 사용: node scripts/make-attendance-template.js "<26년_N월_출근부_자동화.xlsx>"   → assets/attendance-template.xlsx
const fs = require('fs'), path = require('path'), JSZip = require('jszip');
(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(process.argv[2]));
  const wb = await zip.file('xl/workbook.xml').async('string'), rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const target = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = (m[0].match(/Id="([^"]+)"/) || [])[1], t = (m[0].match(/Target="([^"]+)"/) || [])[1]; if (id) target[id] = t; }
  const sheets = {}; for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) { const n = (m[0].match(/name="([^"]+)"/) || [])[1], id = (m[0].match(/r:id="([^"]+)"/) || [])[1]; sheets[n] = 'xl/' + String(target[id]).replace(/^\/?(xl\/)?/, ''); }
  const staffXml = await zip.file(sheets['직원명단']).async('string'), nameIdx = new Set(), nameTexts = [];
  for (const m of staffXml.matchAll(/<c r="B(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g)) if (Number(m[1]) >= 2) nameIdx.add(Number(m[2]));
  { const ssx = await zip.file('xl/sharedStrings.xml').async('string'); let k = 0; for (const m of ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)) { if (nameIdx.has(k)) nameTexts.push((m[1].match(/<t[^>]*>([^<]*)<\/t>/) || [])[1]); k++; } }
  // 다른 시트에서 같은 문자열을 쓰는지 확인(쓰면 지우지 않는다)
  const used = new Set(); for (const [n, p] of Object.entries(sheets)) { if (n === '직원명단') continue; const x = await zip.file(p).async('string'); for (const m of x.matchAll(/t="s"[^>]*><v>(\d+)<\/v>/g)) used.add(Number(m[1])); }
  let ss = await zip.file('xl/sharedStrings.xml').async('string'), i = 0;
  ss = ss.replace(/<si>[\s\S]*?<\/si>/g, si => { const k = i++; return nameIdx.has(k) && !used.has(k) ? '<si><t></t></si>' : si; });
  zip.file('xl/sharedStrings.xml', ss);
  // 직원명단 B열 값 비우기(서식 s 유지)
  let sx = staffXml.replace(/<c r="B(\d+)"([^>]*?)\s+t="s"([^>]*)><v>\d+<\/v><\/c>/g, (m, r, a, b) => Number(r) >= 2 ? `<c r="B${r}"${a}${b}/>` : m); zip.file(sheets['직원명단'], sx);
  for (const n of ['출근부(1~15일)', '출근부(16~말일)']) { let x = await zip.file(sheets[n]).async('string'); x = x.replace(/(<c r="[A-Z]+4"[^>]*t="str"[^>]*><f>[^<]*직원명단[^<]*<\/f>)<v[^>]*>[^<]*<\/v>/g, '$1<v></v>'); zip.file(sheets[n], x); }   // 계산해 둔 이름 값
  for (const core of ['docProps/core.xml', 'docProps/app.xml']) if (zip.file(core)) { let x = await zip.file(core).async('string'); x = x.replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator></dc:creator>').replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy></cp:lastModifiedBy>').replace(/<Company>[^<]*<\/Company>/, '<Company></Company>'); zip.file(core, x); }
  let left = 0; for (const [fn, f] of Object.entries(zip.files)) if (!f.dir && /\.(xml|rels)$/.test(fn)) { const x = await f.async('string'); for (const t of nameTexts) if (t && x.includes(t)) { left++; console.log('남은 이름:', t, fn); } }
  if (left) throw new Error('이름이 남아 있습니다'); // 공개 저장소에 올리는 양식에는 직원 이름이 없어야 한다
  const out = path.join(__dirname, '..', 'assets', 'attendance-template.xlsx'); fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('만듦:', out, '/ 지운 이름 문자열', [...nameIdx].filter(k => !used.has(k)).length, '개');
})();
