// 낙상 순회: 월·층을 고르면 치료사명단·월별 이력·구글 캘린더(연차)·토요일 시간표(근무 팀·3층 근무자)로 배정 →
// 시트 모양 미리보기에서 칸을 눌러 고치고 → 낙상방지 파일 '원본' 서식 그대로 새 엑셀로 저장
Hub.register({ id: 'fall', icon: '🚶', desc: '평일은 주 단위, 토요일·공휴일은 그날 근무 팀 — 캘린더 연차·3층 근무자 반영', title: '낙상 순회', render(root) {
  const { esc, invoke, say, opts, pad } = Hub, nm = Hub.nextMonth();
  const S = { edited: new Set(), year: nm.year, month: nm.month, floor: '10층', data: null, res: null, holText: '', issues: [], ov: {}, calMsg: '' };
  const TEAM = { 1: ['#fff2cc', '1팀'], 2: ['#e2efda', '2팀'], 3: ['#ddebf7', '3팀'] };
  const names = () => [...new Set([...S.data.roster.weekday10, ...S.data.roster.weekday3, ...Object.values(S.data.roster.sat).flat()])].sort((a, b) => a.localeCompare(b, 'ko'));
  async function load() {
    if (Hub.needFiles(['fall']).length) { root.innerHTML = Hub.missingBox(['fall']); return; }
    S.data = await invoke('fall:load'); if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    setHol(); draw(); generate(true);
  }
  const setHol = () => { S.holText = Object.entries(S.data.holidays).filter(([d]) => d.startsWith(`${S.year}-${pad(S.month)}`)).map(([d, n]) => `${d} ${n}`).join('\n'); };
  const holidays = () => Object.fromEntries(S.holText.split('\n').map(l => l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2] || '공휴일']));
  const bad = (date, i) => S.issues.some(x => x.date === date && x.slot === i);
  const calOpen = () => !S.data.calendarUrl && !S.data.calendarFile;

  function draw() {
    const R = S.res, cal = S.data.calendarUrl || S.data.calendarFile, nNote = R ? R.notes.length : 0;
    root.innerHTML = `<div class="row actionbar"><select id="floor">${opts(['10층', '3층'], S.floor)}</select><select id="yy">${opts([S.year - 1, S.year, S.year + 1], S.year)}</select>년<select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월
      <button id="run" class="btn">↻ 다시 배정</button>${R ? '<button id="save" class="btn primary">엑셀로 저장</button>' : ''}
      ${R ? `<span class="${S.issues.length ? 'err' : 'ok'}">${S.issues.length ? `확인 필요 ${S.issues.length}칸` : '빈칸 없음'}</span>` : ''}
      <span class="${cal ? 'ok' : 'warn'}" style="margin-left:auto">${cal ? '캘린더 연결됨' : '캘린더 연결 안 됨(연차 미반영)'}</span></div>
    <details class="box slim" ${calOpen() ? 'open' : ''}><summary>⚙ 설정 — 구글 캘린더 · 공휴일 <span class="mute">${esc(S.calMsg)}</span></summary>
      <div class="row"><input id="calUrl" type="url" placeholder="구글 캘린더 비공개 iCal 주소 https://…/basic.ics" value="${esc(S.data.calendarUrl)}" style="flex:1;min-width:260px"><button id="calSave">저장하고 확인</button><button id="calFile">.ics 파일로</button></div>
      <div class="mute">「이름T연차」「이름T오후반차」는 그날 쉬는 사람, 「3팀」처럼 팀만 적힌 일정은 그날 근무 팀으로 읽습니다(읽기만 함).</div>
      <div class="row"><label>공휴일</label><textarea id="hol" rows="2" cols="30" placeholder="2026-11-04 임시공휴일">${esc(S.holText)}</textarea><span class="mute">날짜 이름, 한 줄에 하나 · 표에서는 비우고 이름만 적습니다${S.data.hasSaturday ? '' : ' · <span class="warn">「파일 연결」에서 토요일&공휴일 시간표를 연결하면 근무 팀·3층 근무자를 자동 반영</span>'}</span></div></details>
    ${R ? `${notes()}${special()}<div class="mute small">칸을 누르면 이름 검색 창이 뜹니다. 평일 칸은 그 주 월~금이, 토요일 칸은 하루만 바뀝니다. <span class="cell edited" style="padding:0 5px">주황 테두리</span>는 직접 바꾼 칸(화면 표시일 뿐 엑셀에는 안 나옵니다).</div>${preview()}` : '<div class="mute" style="margin-top:12px">배정하는 중…</div>'}`;
  }
  const notes = () => S.res.notes.length ? `<details class="box slim warnbox"><summary><b>확인할 점 ${S.res.notes.length}건</b> <span class="mute">${esc(S.res.notes[0])}${S.res.notes.length > 1 ? ' …' : ''}</span></summary><ul>${S.res.notes.slice(0, 14).map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : '';
  // 토요일·공휴일 근무자: 날짜마다 한 줄(왼쪽 = 날짜·팀·근거, 오른쪽 = 이름). 이름을 누르면 10층 ↔ 3층, 다시 배정하면 반영.
  function special() {
    const rows = Object.entries(S.res.info).sort(([a], [b]) => a < b ? -1 : 1), SRC = { '토요일 시트': '시트', '캘린더': '캘린더', '순환(추정)': '추정' };
    return `<details class="box slim" open><summary><b>토요일·공휴일 근무자</b> <span class="mute">이름을 누르면 10층 ↔ 3층 (다시 배정하면 반영)</span></summary><div class="spgrid">${rows.map(([date, i]) => { const [bg, label] = TEAM[i.team] || ['#d9d9d9', '팀 ?'], src = SRC[i.source.split(' ')[0]] || i.source;
      return `<div class="spl"><span class="tm2" style="background:${bg}">${+date.slice(5, 7)}/${+date.slice(8)} ${Hub.wd(date)} · ${esc(label)}</span><span class="src ${src === '추정' ? 'warn' : ''}" title="${esc(i.source)}">${esc(i.holiday || src)}</span></div>
      <div class="spn">${i.people.map(p => `<span class="pp ${p.off ? 'off' : p.floor3 ? 'f3' : 'f10'}" data-sp="${date}|${esc(p.name)}" title="${p.off ? '이 날 쉼' : p.floor3 ? '3층 근무' : '10층 근무'} (시트의 빨간 테두리 ${p.red || 0}칸)">${esc(p.name)}${p.floor3 ? ' · 3층' : ''}${p.off ? ' · 휴가' : ''}</span>`).join('') || '<span class="mute">근무자 정보 없음</span>'}</div>`; }).join('')}</div></details>`;
  }
  function preview() {
    const days = S.res.weeks.flatMap(w => w.days), halves = [days.filter(d => d.day <= 15), days.filter(d => d.day > 15)].filter(h => h.length);
    const th = d => { const t = d.team && (d.wd === '토' || d.holiday) ? TEAM[d.team][0] : d.holiday ? '#d9d9d9' : ''; return `<th class="${d.holiday ? 'sun' : d.wd === '토' ? 'sat' : ''}" style="${t ? `background:${t}` : ''}">${S.month}/${d.day}<br><small>${d.wd}${d.team && d.wd === '토' ? ' ' + d.team + '팀' : ''}</small></th>`; };
    const td = (d, i) => d.holiday ? `<td class="hol" style="${d.team ? `background:${TEAM[d.team][0]}` : ''}">${i === 0 ? esc(d.holiday) : ''}</td>` : `<td class="cell ${bad(d.date, i) ? 'badcell' : ''} ${S.edited.has(d.date + '|' + i) ? 'edited' : ''}" style="${d.wd === '토' && d.team ? `background:${TEAM[d.team][0]}` : ''}" data-date="${d.date}" data-i="${i}">${esc(d.names[i])}</td>`;
    return halves.map(half => `<div class="scroll sheetwrap"><table class="sheet"><tr><th class="tm">날짜</th>${half.map(th).join('')}</tr>${S.data.slots.map((s, i) => `${i === 5 ? `<tr><td class="tm mute">점심시간</td><td colspan="${half.length}" class="lunch"></td></tr>` : ''}<tr><td class="tm">${esc(s)}</td>${half.map(d => td(d, i)).join('')}</tr>`).join('')}</table></div>`).join('')
      + `<div class="mute">토요일·공휴일 열 색: ${Object.values(TEAM).map(([bg, l]) => `<span class="tm2" style="background:${bg}">${l}</span>`).join(' ')}</div>`;
  }
  // 칸 바꾸기: 칸을 누르면 이름 검색 창이 뜬다(입력하면 바로 걸러지고 Enter = 첫 번째, Esc/바깥 클릭 = 취소, 비우기 = 칸을 빈칸으로)
  async function setCell(date, i, value) {
    const wk = S.res.weeks.find(w => w.days.some(d => d.date === date)), day = wk.days.find(d => d.date === date);
    (day.wd === '토' ? [day] : wk.days.filter(d => d.wd !== '토' && !d.holiday)).forEach(d => { d.names[+i] = value; S.edited.add(d.date + '|' + i); });
    await recheck(); draw();
  }
  let pop = null; const closePop = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener('mousedown', outside, true); } };
  const outside = e => { if (pop && !pop.contains(e.target)) closePop(); };
  function openPick(cell) {
    closePop(); const date = cell.dataset.date, i = cell.dataset.i, cur = cell.textContent.trim(), box = cell.getBoundingClientRect();
    pop = document.createElement('div'); pop.className = 'pickpop'; pop.style.cssText = `left:${Math.min(box.left, innerWidth - 230)}px;top:${Math.min(box.bottom + 2, innerHeight - 330)}px`;
    pop.innerHTML = `<input placeholder="이름 검색…" value=""><div class="pl"></div><div class="pbtn"><button data-x="clear">비우기</button><button data-x="cancel">취소</button></div>`;
    document.body.appendChild(pop); const inp = pop.querySelector('input'), list = pop.querySelector('.pl');
    const show = () => { const q = inp.value.trim(), m = names().filter(n => !q || n.includes(q)); list.innerHTML = m.map(n => `<div class="pi ${n === cur ? 'cur' : ''}" data-n="${esc(n)}">${esc(n)}</div>`).join('') || '<div class="mute" style="padding:6px">없음</div>'; };
    show(); inp.focus(); inp.oninput = show;
    inp.onkeydown = e => { if (e.key === 'Escape') closePop(); if (e.key === 'Enter') { const f = list.querySelector('.pi'); if (f) { closePop(); setCell(date, i, f.dataset.n); } } };
    pop.onclick = e => { const n = e.target.closest('.pi'), x = e.target.dataset.x; if (n) { closePop(); setCell(date, i, n.dataset.n); } else if (x === 'clear') { closePop(); setCell(date, i, ''); } else if (x === 'cancel') closePop(); };
    setTimeout(() => document.addEventListener('mousedown', outside, true));
  }
  async function recheck() { S.issues = await invoke('fall:check', { weeks: S.res.weeks }); }
  async function generate(quiet) { if (!quiet) say('배정하는 중…'); S.res = await invoke('fall:generate', { year: S.year, month: S.month, floor: S.floor, holidays: holidays(), seed: Date.now() % 1e6, overrides: S.ov }); S.issues = S.res.issues; S.edited.clear(); if (!quiet) say('배정했습니다'); draw(); }
  root.oninput = e => { if (e.target.id === 'hol') S.holText = e.target.value; };
  root.onchange = async e => {
    const t = e.target;
    if (t.id === 'yy') { S.year = +t.value; S.res = null; S.ov = {}; setHol(); draw(); generate(true); } if (t.id === 'mm') { S.month = +t.value; S.res = null; S.ov = {}; setHol(); draw(); generate(true); } if (t.id === 'floor') { S.floor = t.value; S.res = null; draw(); generate(true); }
  };
  root.onclick = async e => {
    const t = e.target, c = t.closest('.cell');
    if (c) return openPick(c);
    const sp = t.closest('[data-sp]'); if (sp) { const [date, name] = sp.dataset.sp.split('|'), p = S.res.info[date].people.find(x => x.name === name); ((S.ov[date] ??= {}).floor3 ??= {})[name] = !p.floor3; p.floor3 = !p.floor3; draw(); say('다시 배정하면 반영됩니다'); return; }
    if (t.id === 'run') generate();
    if (t.id === 'save') { const p = await invoke('fall:save', { year: S.year, month: S.month, weeks: S.res.weeks, floor: S.floor }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
    if (t.id === 'calSave') { await invoke('fall:saveCalendar', { url: root.querySelector('#calUrl').value }); S.data.calendarUrl = root.querySelector('#calUrl').value.trim(); const r = await invoke('fall:testCalendar', { year: S.year, month: S.month }); S.calMsg = r.ok ? `${S.month}월 연차 ${r.leaves}건 · 팀 표시 ${r.teams}일을 읽었습니다${r.unknown.length ? ` · 못 읽은 일정 예: ${r.unknown.slice(0, 3).join(', ')}` : ''}` : r.message; draw(); }
    if (t.id === 'calFile') { const f = await invoke('fall:pickCalendarFile'); if (f) { S.data.calendarFile = f; S.calMsg = '파일을 연결했습니다'; draw(); } }
  };
  load();
} });
