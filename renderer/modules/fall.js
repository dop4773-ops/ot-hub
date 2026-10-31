// 낙상 순회: 월을 고르면 치료사명단·월별 이력으로 순회 담당을 배정 → 시트 모양 미리보기에서 칸을 눌러 고치고 → 새 엑셀 저장
Hub.register({ id: 'fall', icon: '🚶', desc: '하루 11번 순회 담당을 공평하게 — 평일은 주 단위, 토요일은 팀 교대', title: '낙상 순회', render(root) {
  const { esc, invoke, say, opts, pad } = Hub, nm = Hub.nextMonth();
  const S = { year: nm.year, month: nm.month, data: null, res: null, holText: '', issues: [] };
  const allNames = () => [...new Set([...S.data.roster.weekday10, ...Object.values(S.data.roster.sat).flat()])].sort((a, b) => a.localeCompare(b, 'ko'));
  async function load() {
    if (Hub.needFiles(['fall']).length) { root.innerHTML = Hub.missingBox(['fall']); return; }
    S.data = await invoke('fall:load'); if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    S.holText = Object.entries(S.data.holidays).filter(([d]) => d.startsWith(`${S.year}-${pad(S.month)}`)).map(([d, n]) => `${d} ${n}`).join('\n'); draw();
  }
  const holidays = () => Object.fromEntries(S.holText.split('\n').map(l => l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2] || '공휴일']));
  const bad = (date, i) => S.issues.some(x => x.date === date && x.slot === i);
  function draw() {
    const R = S.res, roster = S.data.roster;
    root.innerHTML = `<div class="row"><select id="yy">${opts([S.year - 1, S.year, S.year + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월
      <button id="run" class="btn primary">${R ? '다시 배정하기' : '배정하기'}</button>${R ? `<button id="save" class="btn">새 엑셀로 저장</button><span class="${S.issues.length ? 'err' : 'ok'}">${S.issues.length ? `확인 필요 ${S.issues.length}건` : '규칙 위반 없음'}</span>` : ''}
      <span class="mute">평일 후보 ${roster.weekday10.length}명 · 토요일 1팀 ${roster.sat[1].length} · 2팀 ${roster.sat[2].length} · 3팀 ${roster.sat[3].length}${roster.leave.length ? ` · 휴직·단축 ${roster.leave.map(l => esc(l.name + '(' + l.kind + ')')).join(' ')}` : ''}</span></div>
    <div class="row" style="align-items:flex-start"><label>공휴일 (날짜 이름, 한 줄에 하나)</label><textarea id="hol" rows="3" cols="26" placeholder="2026-11-04 임시공휴일">${esc(S.holText)}</textarea><span class="mute">공휴일은 표에서 비워 두고 이름만 적습니다. 일요일은 표에 없습니다.</span></div>
    ${R ? `<div class="mute" style="margin:8px 0">칸을 누르면 사람을 바꿀 수 있습니다. 평일 칸은 그 주 월~금이 함께 바뀌고, 토요일 칸은 하루만 바뀝니다. 빨간 칸은 확인이 필요합니다.</div>${preview()}` : '<div class="mute" style="margin-top:12px">월을 고르고 "배정하기"를 누르면 시트 모양으로 미리 보여 드립니다.</div>'}`;
  }
  function preview() {
    const days = S.res.weeks.flatMap(w => w.days.map(d => ({ ...d, wk: w }))), halves = [days.filter(d => d.day <= 15), days.filter(d => d.day > 15)].filter(h => h.length);
    return halves.map(half => `<div class="scroll sheetwrap"><table class="sheet"><tr><th class="tm">날짜</th>${half.map(d => `<th class="${d.holiday ? 'sun' : d.wd === '토' ? 'sat' : ''}">${S.month}/${d.day}<br><small>${d.wd}</small></th>`).join('')}</tr>
      ${S.data.slots.map((s, i) => `${i === 5 ? `<tr><td class="tm mute">점심시간</td><td colspan="${half.length}" class="lunch"></td></tr>` : ''}<tr><td class="tm">${esc(s)}</td>${half.map(d => d.holiday ? `<td class="hol">${i === 0 ? esc(d.holiday) : ''}</td>` : `<td class="cell ${bad(d.date, i) ? 'badcell' : ''} ${d.wd === '토' ? 'satc' : ''}" data-date="${d.date}" data-i="${i}">${esc(d.names[i])}</td>`).join('')}</tr>`).join('')}</table></div>`).join('');
  }
  async function recheck() { S.issues = await invoke('fall:check', { weeks: S.res.weeks }); }
  root.oninput = e => { if (e.target.id === 'hol') S.holText = e.target.value; };
  root.onchange = async e => {
    const t = e.target;
    if (t.id === 'yy') { S.year = +t.value; S.res = null; draw(); } if (t.id === 'mm') { S.month = +t.value; S.res = null; draw(); }
    if (t.dataset.pick) {                                                    // 칸 편집
      const [date, i] = t.dataset.pick.split('|'), wk = S.res.weeks.find(w => w.days.some(d => d.date === date)), day = wk.days.find(d => d.date === date);
      const targets = day.wd === '토' ? [day] : wk.days.filter(d => d.wd !== '토' && !d.holiday);
      targets.forEach(d => { d.names[+i] = t.value; }); await recheck(); draw();
    }
  };
  root.onclick = async e => {
    const c = e.target.closest('.cell');
    if (c && !c.querySelector('select')) { const cur = c.textContent; c.innerHTML = `<select data-pick="${c.dataset.date}|${c.dataset.i}"><option value=""></option>${allNames().map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`; c.querySelector('select').focus(); return; }
    if (e.target.id === 'run') { say('배정하는 중…'); S.res = await invoke('fall:generate', { year: S.year, month: S.month, holidays: holidays(), seed: Date.now() % 1e6 }); S.issues = S.res.issues; say('배정했습니다'); draw(); }
    if (e.target.id === 'save') { const p = await invoke('fall:save', { year: S.year, month: S.month, weeks: S.res.weeks }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
  };
  load();
} });
