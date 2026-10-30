// 출근부 화면: 층 선택 → 그 층 치료사(시간표) 직급·경력순 → 새 xlsx
Hub.register({ id: 'attendance', title: '출근부', render(root) {
  const { esc, invoke, say, opts, wd, pad } = Hub, nm = Hub.nextMonth();
  const S = { year: nm.year, month: nm.month, data: null, floor: '', off: {}, extra: '', holidays: '' };
  const names = () => S.data.floors[S.floor].filter(p => !S.off[p.name]);
  async function load() {
    if (Hub.needFiles(['status']).length) { root.innerHTML = Hub.missingBox(['status']); return; }
    S.data = await invoke('attendance:load'); if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    S.floor = Object.keys(S.data.floors).sort().reverse()[0]; await holidays(); draw();
  }
  async function holidays() {                                                // 설정에 저장된 공휴일이 해당 연도 것이면 쓰고, 없으면 고정일 공휴일만 채운다
    const saved = S.data.cfg.holidays;
    S.holidays = (saved && saved.length ? saved : await invoke('attendance:fixedHolidays', S.year)).filter(d => d.startsWith(String(S.year))).join('\n');
    if (!S.holidays) S.holidays = (await invoke('attendance:fixedHolidays', S.year)).join('\n');
  }
  function draw() {
    const list = S.data.floors[S.floor], dim = new Date(S.year, S.month, 0).getDate();
    root.innerHTML = `<div class="row"><select id="floor">${opts(Object.keys(S.data.floors), S.floor)}</select> 치료실 · <select id="yy">${opts([S.year - 1, S.year, S.year + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 (${dim}일)</div>
    <div class="mute">평일시간표의 그 층 치료사만 모아, 팀 시트의 직급순(팀장 → 부팀장 → 주임 → 사원 연차순)으로 넣습니다. 토요일·공휴일 근무도 표시하며, 토요일은 <span class="sat">파란색</span>, 일요일·공휴일은 <span class="sun">붉은색</span>, 공휴일은 회색 바탕입니다.</div>
    <h2>${esc(S.floor)} 명단 ${names().length}명 <span class="mute">(눌러서 이번 달 제외/포함)</span></h2>
    <div class="chips">${list.map(p => `<span class="chip ${S.off[p.name] ? 'off' : ''}" data-p="${esc(p.name)}">${esc(p.name)} <span class="mute">${esc(p.rank ? p.rank + (p.years ? p.years + '년' : '') : '팀 시트에 없음')}</span></span>`).join('')}</div>
    <div class="row"><input id="extra" placeholder="이름 추가" value="${esc(S.extra)}"><span class="mute">시간표에 없는 사람을 맨 뒤에 넣을 때</span></div>
    <h2>공휴일 (한 줄에 하나)</h2><div class="mute">고정일 공휴일만 미리 채웠습니다. 설날·추석·대체공휴일·선거일은 달력과 대조해 추가하세요.</div>
    <textarea id="hol" rows="6" cols="22" style="font:inherit;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px">${esc(S.holidays)}</textarea>
    <div class="row" style="margin-top:14px"><button id="save" class="pri">새 엑셀로 저장</button><span class="mute">1~15일, 16~말일 두 시트가 만들어집니다</span></div>`;
  }
  root.onchange = async e => { const t = e.target;
    if (t.id === 'floor') { S.floor = t.value; draw(); }
    if (t.id === 'yy') { S.year = +t.value; await holidays(); draw(); }
    if (t.id === 'mm') { S.month = +t.value; draw(); } };
  root.oninput = e => { if (e.target.id === 'extra') S.extra = e.target.value; if (e.target.id === 'hol') S.holidays = e.target.value; };
  root.onclick = async e => {
    const t = e.target.closest('[data-p]'); if (t) { S.off[t.dataset.p] = !S.off[t.dataset.p]; draw(); return; }
    if (e.target.id === 'save') {
      const hol = S.holidays.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
      const list = names().map(p => p.name).concat(S.extra.split(/[,\s]+/).filter(Boolean));
      await invoke('attendance:saveCfg', { ...S.data.cfg, holidays: hol });
      const p = await invoke('attendance:save', { year: S.year, month: S.month, floor: S.floor, names: list, holidays: hol, perBlock: 6, workWeekend: true });
      say(p ? '저장했습니다: ' + p : '저장을 취소했습니다');
    }
  };
  load();
} });
