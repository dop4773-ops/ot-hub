// 사용: node scripts/test-attendance-template.js "<26년_N월_출근부_자동화.xlsx>"
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), JSZip = require('jszip');
const { build } = require('../modules/attendance/template');
(async () => {
  const names = ['정진우', '정용범', '장연서', '김민정', '최혜빈', '박나연', '이도경', '김가나'];       // 8명 → 2블록
  const buf = await build({ templateFile: process.argv[2], year: 2026, month: 11, floor: '3층', names, holidays: ['2026-11-04', '2026-11-18'] });
  const f = path.join(os.tmpdir(), 'att-tpl.xlsx'); fs.writeFileSync(f, buf);
  const z = await JSZip.loadAsync(buf), get = p => z.file(p).async('string');
  const wb = await get('xl/workbook.xml'); assert.ok(/fullCalcOnLoad="1"/.test(wb));
  assert.ok(/Print_Area" localSheetId="2">'출근부\(1~15일\)'!\$A\$1:\$Z\$36/.test(wb), '인쇄 범위: 2블록=Z열');
  const sheets = Object.keys(z.files).filter(n => /worksheets\/sheet\d+\.xml$/.test(n));
  const s3 = await get('xl/worksheets/sheet3.xml'), s4 = await get('xl/worksheets/sheet4.xml'), s2 = await get('xl/worksheets/sheet2.xml'), s1 = await get('xl/worksheets/sheet1.xml');
  assert.ok(/<c r="B1" s="\d+"><v>2026<\/v>/.test(s1) && /<c r="B2" s="\d+"><v>11<\/v>/.test(s1));
  assert.ok(/<c r="B2"[^>]*t="inlineStr"><is><t[^>]*>정진우/.test(s2) && /<c r="B10" s="\d+"\/>/.test(s2), '이름 입력·남은 칸 비움');
  assert.ok(s3.includes('미래병원 3층 재활치료실') && !s3.includes('10층'), '층 이름');
  assert.strictEqual((s3.match(/<brk /g) || []).length, 1, '쪽 나눔은 블록 수-1');
  assert.ok(s3.includes('1+INT((ROW()-6)/2)=4'), '공휴일 4일 서식');
  assert.ok(s4.includes('16+INT((ROW()-6)/2)=18'), '16~말일 시트의 공휴일 18일');
  assert.ok(s3.includes('FF2563EB') && s3.includes('FFDC2626'));
  assert.ok(!/<c r="B3"[^>]*>[^<]*<f>/.test(s2));
  // 모든 XML이 올바른 형식인지
  for (const n of Object.keys(z.files).filter(n => /\.xml$|\.rels$/.test(n))) { const x = await get(n); assert.ok(x.startsWith('<?xml') || x.startsWith('<'), n); }
  console.log('출근부 원본 서식 시험 OK →', f);
})();
