// 청소분담표 화면: ① 이력 시트 ② 규칙(직책·칸) ③ 이번 분기 배정 ④ 대청소
Hub.register({ id: 'cleaning', icon: '🧹', desc: '팀 시트 직책·과거 이력으로 분기 청소를 공평하게 배정', title: '청소분담표', sep: true, render(root) {
  const { esc, invoke, say, opts, tabsHtml } = Hub;
  const CATS = ['밀대', '쓸기', '닦기', '도구장', '트롤리', '소모품라벨'];
  const S = { tab: 'plan', data: null, rules: null, use: {}, people: {}, base: '', last: '', plan: null, big: null, q: '', d: '' };
  const active = () => Object.keys(S.people).filter(p => S.people[p]);
  const useNames = () => S.data.sheets.filter(s => S.use[s.name]).map(s => s.name);
  const need = () => S.rules.slots.reduce((a, s) => a + Number(s.n), 0);

  async function load() {
    root.innerHTML = Hub.missingBox(['cleaning', 'status']) || '<div class="mute">읽는 중…</div>';
    if (Hub.needFiles(['cleaning', 'status']).length) return;
    S.data = await invoke('cleaning:load');
    if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    S.rules = S.data.rules; S.use = {}; S.data.sheets.forEach(s => S.use[s.name] = s.use);
    const used = useNames(); S.base = used[used.length - 1] || ''; S.last = S.base; S.plan = S.big = null;
    // 이번 분기 명단 = 팀 시트의 직원에서 제외 직책·제외 이름을 뺀 사람
    S.people = {}; S.data.staff.forEach(p => S.people[p.name] = !S.rules.excludeRanks.includes(p.rank) && !S.rules.excludeNames.includes(p.name));
    draw();
  }
  const rankOf = n => (S.data.staff.find(s => s.name === n) || {}).rank || '';
  const save = async () => { await invoke('cleaning:saveRules', S.rules, S.use); };

  function draw() {
    const T = [['hist', '① 이력 시트'], ['rules', '② 규칙'], ['plan', '③ 이번 분기 배정'], ['big', '④ 대청소']];
    root.innerHTML = tabsHtml(T, S.tab) + `<div id="pane"></div>`;
    ({ hist: pHist, rules: pRules, plan: pPlan, big: pBig })[S.tab]();
  }
  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.tab) { S.tab = d.tab; return draw(); }
    handlers.forEach(h => h(t, d));
  };
  const handlers = [];

  /* ① 이력 */
  function pHist() {
    $p().innerHTML = `<div class="mute">체크한 시트만 "사람별 역할·구역 횟수"에 반영합니다. 구조가 달라 잘못 읽힌 시트는 기본으로 뺍니다.</div>
    <table><tr><th>사용</th><th>시트</th><th>읽은 인원</th><th>종류별</th><th>비고</th></tr>${S.data.sheets.map(s => `<tr><td><input type="checkbox" data-sh="${esc(s.name)}" ${S.use[s.name] ? 'checked' : ''}></td><td>${esc(s.name)}</td><td>${s.count}명</td>
    <td class="mute">${Object.entries(s.cats).map(([k, v]) => k + v).join(' ')}</td><td class="warn">${esc(s.warn || (s.auto ? '' : '인원 수가 평소와 달라 기본 제외'))}</td></tr>`).join('')}</table>`;
  }
  const $p = () => root.querySelector('#pane');
  handlers.push((t, d) => { if (d.sh) { S.use[d.sh] = t.checked; save(); S.plan = S.big = null; } });

  /* ② 규칙 */
  function pRules() {
    const r = S.rules, ranks = ['실장', '팀장', '부팀장', '주임', '사원'];
    const slotRow = (s, i) => `<tr><td><input data-s="${i}" data-k="zone" value="${esc(s.zone)}" size="32"></td><td><input data-s="${i}" data-k="role" value="${esc(s.role)}" size="22"></td>
      <td><select data-s="${i}" data-k="category">${opts(CATS, s.category)}</select></td><td><input type="number" min="1" data-s="${i}" data-k="n" value="${s.n}"></td><td><button data-del="s${i}">삭제</button></td></tr>`;
    $p().innerHTML = `<div class="mute">바꾼 뒤 맨 아래 <b>저장</b>을 눌러야 적용됩니다.</div>
    <h2>청소를 하지 않는 직책</h2><div class="mute">팀 시트의 직책을 보고 이 직책은 청소 명단에서 뺍니다. 예: 팀장까지는 청소하지 않는다 → 실장·팀장 체크.</div>
    <div class="row">${ranks.map(k => `<label><input type="checkbox" data-rank="${k}" ${r.excludeRanks.includes(k) ? 'checked' : ''}> ${k}</label>`).join(' ')}</div>
    <h2>평일 청소 칸 (합계 ${need()}칸)</h2><table><tr><th>구역</th><th>역할</th><th>종류</th><th>인원</th><th></th></tr>${r.slots.map(slotRow).join('')}</table>
    <div class="row"><button id="addSlot">+ 칸 추가</button></div>
    <h2>고정 배정 (로테이션 제외)</h2><table>${r.fixed.map((f, i) => `<tr><td><input data-f="${i}" data-k="zone" value="${esc(f.zone)}" size="32"></td><td><input data-f="${i}" data-k="who" value="${esc(f.who)}" size="22"></td><td><button data-del="f${i}">삭제</button></td></tr>`).join('')}</table>
    <div class="row"><button id="addFixed">+ 고정 추가</button></div>
    <h2>배정 옵션</h2>
    <div class="row">해 보지 않은 구역 우선 강도 <input type="number" min="0" data-g="zoneNovelty" value="${r.zoneNovelty}"> <span class="mute">클수록 같은 구역을 많이 해 본 사람을 그 구역에서 멀리합니다 (0이면 무시)</span></div>
    <div class="row">직전 분기와 같은 구역 회피 강도 <input type="number" min="0" data-g="zoneWeight" value="${r.zoneWeight}"></div>
    <div class="row">대청소 도구장 소독 인원 <input type="number" min="0" data-g="toolCabinetN" value="${r.toolCabinetN}">명</div>
    <table><tr><th>에어컨 필터 위치</th><th>개수</th><th></th></tr>${r.airFilters.map((a, i) => `<tr><td><input data-a="${i}" data-k="place" value="${esc(a.place)}"></td><td><input type="number" min="1" data-a="${i}" data-k="n" value="${a.n}"></td><td><button data-del="a${i}">삭제</button></td></tr>`).join('')}</table>
    <div class="row"><button id="addAir">+ 위치 추가</button></div>
    <div class="row" style="margin-top:14px"><button id="saveRules" class="pri">저장</button></div>`;
  }
  root.oninput = e => {
    const d = e.target.dataset, r = S.rules; if (!r) return; const v = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    if (d.s != null) r.slots[d.s][d.k] = v; else if (d.f != null) r.fixed[d.f][d.k] = v; else if (d.a != null) r.airFilters[d.a][d.k] = v; else if (d.g) r[d.g] = v;
    if (d.memo != null) S.plan.cells[d.memo].memo = v;
    if (e.target.id === 'qName') S.q = v; if (e.target.id === 'qDate') S.d = v;
  };
  handlers.push((t, d) => {
    const r = S.rules, id = t.id;
    if (d.rank) { r.excludeRanks = t.checked ? [...new Set([...r.excludeRanks, d.rank])] : r.excludeRanks.filter(x => x !== d.rank); }
    if (id === 'addSlot') { r.slots.push({ zone: '', role: '', category: '닦기', n: 1 }); pRules(); }
    if (id === 'addFixed') { r.fixed.push({ zone: '', who: '' }); pRules(); }
    if (id === 'addAir') { r.airFilters.push({ place: '', n: 1 }); pRules(); }
    if (d.del) { ({ s: r.slots, f: r.fixed, a: r.airFilters })[d.del[0]].splice(+d.del.slice(1), 1); pRules(); }
    if (id === 'saveRules') { S.people = {}; S.data.staff.forEach(p => S.people[p.name] = !r.excludeRanks.includes(p.rank) && !r.excludeNames.includes(p.name)); save(); S.plan = S.big = null; say('규칙을 저장했습니다'); }
  });

  /* ③ 배정 */
  function pPlan() {
    const used = useNames(), P = S.plan, all = Object.keys(S.people), cells = P ? P.cells : []; let zone = '';
    $p().innerHTML = `<h2>이번 분기 명단 <span class="mute">(팀 시트 기준 · 제외 직책: ${esc(S.rules.excludeRanks.join(', ') || '없음')})</span></h2>
    <div class="row">직전 분기 시트(구역 반복 회피) <select id="lastSel"><option value="">없음</option>${opts(used, S.last)}</select></div>
    <div class="chips">${all.map(p => `<span class="chip ${S.people[p] ? '' : 'off'}" data-p="${esc(p)}" title="${esc(rankOf(p))}">${esc(p)}<span class="mute"> ${esc(rankOf(p))}</span></span>`).join('')}</div>
    <div class="row"><input id="newP" placeholder="이름 추가"><button id="addP">추가</button><span class="mute">눌러서 이번 분기 제외/포함 · 현재 ${active().length}명 / 필요 ${need()}칸</span></div>
    <div class="row"><button id="run" class="pri">${P ? '다시 배정하기' : '배정하기'}</button></div>
    ${P ? `<div class="two"><div><h2>배정 결과 <span class="mute">(이름을 바꾸면 서로 자리가 바뀝니다)</span></h2><table>${cells.map((c, i) => { const h = c.zone !== zone ? `<tr class="zone"><td colspan="3">${esc(zone = c.zone)}</td></tr>` : '';
      return h + `<tr><td>${esc(c.role) || '<span class="mute">—</span>'} <span class="mute">${c.category}</span></td><td><select data-c="${i}">${opts(active(), c.name)}</select></td></tr>`; }).join('')}
      ${S.rules.fixed.map(f => `<tr class="zone"><td colspan="3">${esc(f.zone)}: ${esc(f.who)} <span class="mute">(고정)</span></td></tr>`).join('')}</table></div>
    <div><h2>과거 횟수 (종류 / 구역)</h2><table><tr><th>이름</th>${CATS.slice(0, 3).map(k => `<th>${k}</th>`).join('')}<th>구역</th></tr>
    ${active().map(p => `<tr><td>${esc(p)}</td>${CATS.slice(0, 3).map(k => `<td>${P.counts[p]?.[k] || 0}</td>`).join('')}<td class="mute">${Object.entries(P.zones[p] || {}).map(([z, n]) => z + n).join(' ')}</td></tr>`).join('')}</table></div></div>
    <h2>저장</h2><div class="row">시트 이름 <input id="qName" value="${esc(S.q)}" placeholder="예: 2027.01~"> 날짜 <input id="qDate" value="${esc(S.d)}" placeholder="예: 2027-01-04~"><button id="save" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  handlers.push(async (t, d) => {
    if (d.p) { S.people[d.p] = !S.people[d.p]; S.plan = S.big = null; pPlan(); }
    if (t.id === 'addP') { const v = root.querySelector('#newP').value.trim(); if (v) { S.people[v] = true; S.plan = S.big = null; pPlan(); } }
    if (t.id === 'run') {
      if (active().length < need()) return say(`인원(${active().length}명)이 칸(${need()})보다 적습니다`, true);
      S.last = root.querySelector('#lastSel').value;
      S.plan = await invoke('cleaning:run', { people: active(), useSheets: useNames(), lastSheet: S.last, seed: Date.now() % 1e6 }); S.big = null; say('배정했습니다'); pPlan();
    }
    if (t.id === 'save') save2();
  });
  root.onchange = e => {
    const d = e.target.dataset;
    if (d.c != null) { const cs = S.plan.cells, i = +d.c, j = cs.findIndex((c, k) => k !== i && c.name === e.target.value); if (j >= 0) cs[j].name = cs[i].name; cs[i].name = e.target.value; S.big = null; pPlan(); }
    if (d.sup != null) S.big.support[d.sup] = e.target.value;
    if (d.air != null) S.big.airFilters[d.air].who = e.target.value;
  };
  async function save2() {
    if (!S.plan) return say('먼저 배정하세요', true);
    if (!S.q.trim()) return say('시트 이름을 입력하세요', true);
    const p = await invoke('cleaning:save', { sheetName: S.q.trim(), date: S.d, cells: S.plan.cells, big: S.big });
    say(p ? '저장했습니다: ' + p : '저장을 취소했습니다');
  }

  /* ④ 대청소 */
  function pBig() {
    if (!S.plan) { $p().innerHTML = '<div class="warn">먼저 ③에서 평일 배정을 만드세요. 대청소는 그 배정을 이어받습니다.</div>'; return; }
    const B = S.big, ppl = active(), cells = S.plan.cells;
    $p().innerHTML = `<div class="mute">대청소 = 평일 배정 그대로 + 도구장 정리/소독 담당 추가. 소독 담당이 맡던 평일 칸은 지원배치가 필요합니다.</div>
    <div class="row"><button id="pick" class="pri">${B ? '다시 뽑기' : '소독 담당 뽑기'} (${S.rules.toolCabinetN}명)</button></div>
    ${B ? `<h2>도구장 정리 / 도구 소독</h2><div class="chips">${B.tool.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
    <h2>지원배치가 필요한 평일 칸 (${B.vacatedIdx.length})</h2>${B.vacatedIdx.length ? `<table>${B.vacatedIdx.map(i => `<tr class="vac"><td>${esc(cells[i].zone)} / ${esc(cells[i].role)}</td><td class="mute">원래 ${esc(cells[i].name)}</td>
    <td><select data-sup="${i}"><option value="">(미정)</option>${opts(ppl.filter(p => !B.tool.includes(p)), B.support[i])}</select></td></tr>`).join('')}</table>` : '<div class="mute">비는 칸이 없습니다.</div>'}
    <h2>에어컨 필터 청소</h2><table>${B.airFilters.map((a, i) => `<tr><td>${esc(a.place)}</td><td>${a.n}개</td><td><select data-air="${i}"><option value="">(미정)</option>${opts(ppl, a.who)}</select></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:14px">③의 시트 이름·날짜로 평일표와 <b>대청소</b> 시트가 함께 저장됩니다. <button id="save2" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  handlers.push(async t => {
    if (t.id === 'pick') { const r = await invoke('cleaning:big', { cells: S.plan.cells, useSheets: useNames(), seed: Date.now() % 1e6 }); S.big = { ...r, support: {} }; pBig(); }
    if (t.id === 'save2') save2();
  });

  load();
} });
