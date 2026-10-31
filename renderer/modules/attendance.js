// 출근부 화면: 층 선택 → 그 층 치료사(시간표) 직급·경력순 → 새 xlsx
Hub.register({ id: 'attendance', icon: '🕘', desc: '층별 직급순 출근부', title: '출근부', render(root) {
  const { esc, invoke, say, opts, wd, pad } = Hub, nm = Hub.nextMonth();
  const S = { year: nm.year, month: nm.month, data: null, floor: '', off: {}, extra: '', holidays: '' };
  const isLeave = n => (S.data.cfg.leave || []).includes(n);
  const names = () => S.data.floors[S.floor].filter(p => !S.off[p.name] && !isLeave(p.name));
  async function load() {
    if (Hub.needFiles(['status']).length) { root.innerHTML = Hub.missingBox(['status']); return; }
    S.data = await invoke('attendance:load'); if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    S.floor = Object.keys(S.data.floors).sort().reverse()[0]; await holidays(); draw();
  }
  const hols = () => new Set(S.holidays.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)));
  function preview() {
    const list = names().slice(0, 6), H = hols(), cls = d => H.has(d) ? 'hol' : new Date(d + 'T00:00:00Z').getUTCDay() === 0 ? 'sun' : new Date(d + 'T00:00:00Z').getUTCDay() === 6 ? 'sat' : '';
    const rows = []; for (let d = 1; d <= 15; d++) { const date = `${S.year}-${pad(S.month)}-${pad(d)}`, c = cls(date), w = Hub.wd(date); rows.push(['출근', '퇴근'].map((k, j) => `<tr class="${c}">${j === 0 ? `<td rowspan="2" class="dcell ${c}">${d}<br><small>(${w})</small></td>` : ''}${list.map(() => `<td>${k}</td><td></td>`).join('')}</tr>`).join('')); }
    return `<div class="scroll sheetwrap"><table class="sheet att"><tr><th rowspan="2">날짜</th>${list.map(p => `<th colspan="2">${esc(p.name)}</th>`).join('')}</tr><tr>${list.map(() => '<th>출,퇴근 시간</th><th>서명</th>').join('')}</tr>${rows.join('')}</table></div>`;
  }
  async function holidays() {                                                // 공통 공휴일(이 연도) + 고정일 공휴일 + (예전에 이 화면에 저장한 것)
    const set = new Set([...(await invoke('attendance:fixedHolidays', S.year)), ...Hub.holidayLines(`${S.year}-`).map(l => l.slice(0, 10)), ...((S.data.cfg.holidays || []).filter(d => d.startsWith(String(S.year))))]);
    S.holidays = [...set].sort().join('\n');
  }
  function draw() {
    const list = S.data.floors[S.floor], dim = new Date(S.year, S.month, 0).getDate();
    root.innerHTML = `<div class="row actionbar"><select id="floor">${opts(Object.keys(S.data.floors), S.floor)}</select> 치료실 · <select id="yy">${opts([S.year - 1, S.year, S.year + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 (${dim}일)</div>
    <div class="mute">평일시간표의 그 층 치료사만 모아, 팀 시트의 직급순(팀장 → 부팀장 → 주임 → 사원 연차순)으로 넣습니다. 토요일·공휴일 근무도 표시하며, 토요일은 <span class="sat">파란색</span>, 일요일·공휴일은 <span class="sun">붉은색</span>, 공휴일은 회색 바탕입니다.</div>
    <h2>${esc(S.floor)} 명단 ${names().length}명 <span class="mute">(이름을 누르면 이번 달만 제외, '휴직'을 체크하면 육아휴직처럼 계속 제외)</span></h2>
    <div class="chips">${list.map(p => `<span class="chip ${S.off[p.name] || isLeave(p.name) ? 'off' : ''}" data-p="${esc(p.name)}">${esc(p.name)} <span class="mute">${esc(p.rank ? p.rank + (p.years ? p.years + '년' : '') : '팀 시트에 없음')}</span><label class="lv" title="육아휴직 등 휴직자 — 체크하면 계속 제외됩니다"><input type="checkbox" data-leave="${esc(p.name)}" ${isLeave(p.name) ? 'checked' : ''}> 휴직</label></span>`).join('')}</div>
    <div class="row"><input id="extra" placeholder="이름 추가" value="${esc(S.extra)}"><span class="mute">시간표에 없는 사람을 맨 뒤에 넣을 때</span></div>
    <h2>공휴일 (한 줄에 하나)</h2><div class="mute">고정일 공휴일만 미리 채웠습니다. 설날·추석·대체공휴일·선거일은 달력과 대조해 추가하세요.</div>
    <textarea id="hol" rows="6" cols="22" style="font:inherit;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px">${esc(S.holidays)}</textarea>
    <h2>미리보기 <span class="mute">(1~15일 · 첫 블록 6명 — 원본 출근부와 같은 양식 — 일요일은 날짜 전체 회색, 토요일 파랑·일요일/공휴일 빨강 글자)</span></h2>${preview()}
    <div class="exportbar"><button id="save" class="pri" style="margin-left:0">새 엑셀로 저장</button><span class="mute">1~15일, 16~말일 두 시트가 만들어집니다</span></div>`;
  }
  root.onchange = async e => { const t = e.target;
    if (t.id === 'floor') { S.floor = t.value; draw(); }
    if (t.id === 'yy') { S.year = +t.value; await holidays(); draw(); }
    if (t.id === 'mm') { S.month = +t.value; draw(); } };
  root.oninput = e => { if (e.target.id === 'extra') S.extra = e.target.value; if (e.target.id === 'hol') S.holidays = e.target.value; };
  root.onclick = async e => {
    if (e.target.dataset.leave) { const n = e.target.dataset.leave, L = new Set(S.data.cfg.leave || []); e.target.checked ? L.add(n) : L.delete(n); S.data.cfg.leave = [...L]; await invoke('attendance:saveCfg', S.data.cfg); draw(); return; }
    const t = e.target.closest('[data-p]'); if (t) { S.off[t.dataset.p] = !S.off[t.dataset.p]; draw(); return; }
    if (e.target.id === 'save') {
      const hol = S.holidays.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
      const list = names().map(p => p.name).concat(S.extra.split(/[,\s]+/).filter(Boolean));
      await Hub.setHolidays(`${S.year}-`, S.holidays);
      const p = await invoke('attendance:save', { year: S.year, month: S.month, floor: S.floor, names: list, holidays: hol, perBlock: 6, workWeekend: true });
      Hub.saved(p);
    }
  };
  load();
} });
