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
    setHol(); draw();
  }
  const setHol = () => { S.holText = Object.entries(S.data.holidays).filter(([d]) => d.startsWith(`${S.year}-${pad(S.month)}`)).map(([d, n]) => `${d} ${n}`).join('\n'); };
  const holidays = () => Object.fromEntries(S.holText.split('\n').map(l => l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2] || '공휴일']));
  const bad = (date, i) => S.issues.some(x => x.date === date && x.slot === i);
  const calOpen = () => !S.data.calendarUrl && !S.data.calendarFile;

  function draw() {
    const R = S.res, roster = S.data.roster;
    root.innerHTML = `<div class="row"><select id="floor">${opts(['10층', '3층'], S.floor)}</select> <select id="yy">${opts([S.year - 1, S.year, S.year + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월
      <button id="run" class="btn primary">${R ? '다시 배정하기' : '배정하기'}</button>${R ? `<button id="save" class="btn">새 엑셀로 저장</button><span class="${S.issues.length ? 'err' : 'ok'}">${S.issues.length ? `확인 필요 ${S.issues.length}칸` : '빈칸·중복 없음'}</span>` : ''}</div>
    <details ${calOpen() ? 'open' : ''} class="box"><summary><b>구글 캘린더 연결</b> <span class="${S.data.calendarUrl || S.data.calendarFile ? 'ok' : 'warn'}">${S.data.calendarUrl || S.data.calendarFile ? '연결됨' : '연결 안 됨 — 연차를 반영하지 못합니다'}</span> <span class="mute">${esc(S.calMsg)}</span></summary>
      <div class="mute">캘린더 설정의 "비공개 주소(iCal 형식)"를 붙여 넣으세요. 「이름T연차」「이름T오후반차」는 그날 쉬는 사람으로, 「3팀」처럼 팀 이름만 적힌 일정(반복 포함)은 그날 근무하는 팀으로 읽습니다. 읽기만 합니다.</div>
      <div class="row"><input id="calUrl" type="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value="${esc(S.data.calendarUrl)}" style="width:480px"><button id="calSave">저장하고 확인</button><button id="calFile">.ics 파일로 대신</button></div></details>
    <div class="row" style="align-items:flex-start"><label>공휴일 (날짜 이름, 한 줄에 하나)</label><textarea id="hol" rows="3" cols="26" placeholder="2026-11-04 임시공휴일">${esc(S.holText)}</textarea><span class="mute">공휴일은 표에서 비워 두고 이름만 적습니다. 일요일은 표에 없습니다.${S.data.hasSaturday ? '' : ' <span class="warn">「파일 연결」에서 "토요일&공휴일 시간표"를 연결하면 그날 근무 팀과 3층 근무자를 자동으로 반영합니다.</span>'}</span></div>
    ${R ? `${notes()}${special()}<div class="mute" style="margin:8px 0">칸을 누르면 이름 검색 창이 뜹니다(입력 → Enter, 취소·비우기 버튼 있음). 평일 칸은 그 주 월~금이 함께 바뀌고, 토요일 칸은 하루만 바뀝니다. 빨간 칸은 확인이 필요합니다. <span class="cell edited" style="padding:0 6px">주황 테두리</span> = 직접 바꾼 칸(화면 표시일 뿐 저장되는 엑셀에는 나타나지 않습니다).</div>${preview()}` : '<div class="mute" style="margin-top:12px">월·층을 고르고 "배정하기"를 누르면 시트 모양으로 미리 보여 드립니다.</div>'}`;
  }
  const notes = () => S.res.notes.length ? `<div class="box warnbox"><b>확인할 점</b><ul>${S.res.notes.slice(0, 12).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '';
  // 토요일·공휴일 근무자 확인: 누가 어느 층에서 근무하는지(시트의 빨간 테두리), 쉬는 사람. 눌러서 고치면 다시 배정에 반영된다.
  function special() {
    const rows = Object.entries(S.res.info).sort(([a], [b]) => a < b ? -1 : 1);
    return `<details class="box" open><summary><b>토요일·공휴일 근무자</b> <span class="mute">이름을 누르면 10층 ↔ 3층이 바뀝니다 (다시 배정하면 반영)</span></summary>${rows.map(([date, i]) => { const [bg, label] = TEAM[i.team] || ['#d9d9d9', '팀 미확인'];
      return `<div class="sp"><span class="tm2" style="background:${bg}">${esc(date.slice(5))} ${Hub.wd(date)} · ${esc(label)}</span><span class="mute">${esc(i.holiday || '')} 근거: ${esc(i.source)}</span>
      ${i.people.map(p => `<span class="pp ${p.off ? 'off' : p.floor3 ? 'f3' : 'f10'}" data-sp="${date}|${esc(p.name)}" title="${p.off ? '이 날 쉼' : p.floor3 ? '3층 근무' : '10층 근무'} (시트의 빨간 테두리 ${p.red || 0}칸)">${esc(p.name)}${p.floor3 ? ' 3층' : ''}${p.off ? ' 휴가' : ''}</span>`).join('') || '<span class="mute">근무자 정보 없음</span>'}</div>`; }).join('')}</details>`;
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
  async function generate() { say('배정하는 중…'); S.res = await invoke('fall:generate', { year: S.year, month: S.month, floor: S.floor, holidays: holidays(), seed: Date.now() % 1e6, overrides: S.ov }); S.issues = S.res.issues; S.edited.clear(); say('배정했습니다'); draw(); }
  root.oninput = e => { if (e.target.id === 'hol') S.holText = e.target.value; };
  root.onchange = async e => {
    const t = e.target;
    if (t.id === 'yy') { S.year = +t.value; S.res = null; S.ov = {}; setHol(); draw(); } if (t.id === 'mm') { S.month = +t.value; S.res = null; S.ov = {}; setHol(); draw(); } if (t.id === 'floor') { S.floor = t.value; S.res = null; draw(); }
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
