# 사용: python3 scripts/check-xlsx.py 파일.xlsx — 엑셀 "복구" 창이 뜨는 흔한 원인(깨진 XML·없는 부품 참조·개수 불일치)을 점검
import sys, zipfile, re, posixpath
import xml.dom.minidom as md
z = zipfile.ZipFile(sys.argv[1]); names = set(z.namelist()); bad = []
for n in names:
    if n.endswith(('.xml', '.rels')):
        try: md.parseString(z.read(n))
        except Exception as e: bad.append(f'XML 오류 {n}: {e}')
ct = z.read('[Content_Types].xml').decode()
for m in re.finditer(r'<Override[^>]*PartName="/([^"]+)"', ct):
    if m.group(1) not in names: bad.append('콘텐츠 형식이 없는 부품을 가리킴: ' + m.group(1))
for n in names:
    if n.endswith('.rels'):
        base = posixpath.dirname(posixpath.dirname(n))
        for m in re.finditer(r'<Relationship\b[^>]*>', z.read(n).decode()):
            t = re.search(r'Target="([^"]+)"', m.group(0)).group(1)
            if 'TargetMode="External"' in m.group(0): continue
            p = t.lstrip('/') if t.startswith('/') else posixpath.normpath(posixpath.join(base, t))
            if p not in names: bad.append(f'{n} → 없는 부품 {t}')
st = z.read('xl/styles.xml').decode()
for tag, item in (('fills', 'fill'), ('cellXfs', 'xf'), ('borders', 'border'), ('fonts', 'font')):
    m = re.search(rf'<{tag} count="(\d+)">(.*?)</{tag}>', st, re.S)
    if m:
        c = len(re.findall(rf'<{item}\b', m.group(2)));
        if c != int(m.group(1)): bad.append(f'styles {tag} 개수 {m.group(1)} ≠ 실제 {c}')
maxs = int(re.search(r'<cellXfs count="(\d+)"', st).group(1))
for n in names:
    if re.match(r'xl/worksheets/sheet\d+\.xml$', n):
        x = z.read(n).decode()
        mx = max([int(v) for v in re.findall(r'<c [^>]*\bs="(\d+)"', x)] or [0])
        if mx >= maxs: bad.append(f'{n}: 서식 번호 {mx} ≥ {maxs}')
wb = z.read('xl/workbook.xml').decode()
if re.search(r'localSheetId="(\d+)"', wb) and len(re.findall('<sheet ', wb)) <= max(int(i) for i in re.findall(r'localSheetId="(\d+)"', wb)): bad.append('이름 정의가 없는 시트를 가리킴')
print('OK' if not bad else '\n'.join(bad)); sys.exit(1 if bad else 0)
