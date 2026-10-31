// 청소분담표 화면: ① 이력 시트 ② 규칙(직책·칸) ③ 이번 분기 배정 ④ 대청소
Hub.register({ id: 'cleaning', icon: '🧹', desc: '팀 시트 직책·과거 이력으로 분기 청소를 공평하게 배정', title: '청소분담표', sep: true, render(root) {
  const { esc, invoke, say, opts, tabsHtml } = Hub;
  const CATS = ['밀대', '쓸기', '닦기', '도구장', '트롤리', '소모품라벨'];
  const S = { inc: { week: true, big: true, mapWeek: false, mapBig: false }, floor: '10층', tab: 'plan', data: null, rules: null, use: {}, people: {}, base: '', last: '', plan: null, big: null, q: '', d: '' };
  const active = () => Object.keys(S.people).filter(p => S.people[p]);
  const useNames = () => S.data.sheets.filter(s => S.use[s.name]).map(s => s.name);
  const FR = () => S.rules.floors[S.floor];                       // 지금 층의 칸·고정·대청소 설정
  const need = () => FR().slots.reduce((a, s) => a + Number(s.n), 0);
  const initPeople = () => { S.people = {}; S.data.staff.filter(p => p.floor === S.floor).forEach(p => S.people[p.name] = !S.rules.excludeRanks.includes(p.rank) && !S.rules.excludeNames.includes(p.name)); };

  async function load() {
    root.innerHTML = Hub.missingBox(['cleaning', 'status']) || '<div class="mute">읽는 중…</div>';
    if (Hub.needFiles(['cleaning', 'status']).length) return;
    S.data = await invoke('cleaning:load');
    if (S.data.error) { root.innerHTML = `<div class="warn">${esc(S.data.error)}</div>`; return; }
    S.rules = S.data.rules; S.use = {}; S.data.sheets.forEach(s => S.use[s.name] = s.use);
    const used = useNames(); S.base = used[used.length - 1] || ''; S.last = S.base; S.plan = S.big = null;
    // 이번 분기 명단 = 팀 시트의 직원에서 제외 직책·제외 이름을 뺀 사람
    initPeople();
    draw();
  }
  const rankOf = n => (S.data.staff.find(s => s.name === n) || {}).rank || '';
  const save = async () => { await invoke('cleaning:saveRules', S.rules, S.use); };

  function draw() {
    const T = [['plan', '평일 배정'], ['big', '대청소'], ['map', '배치도'], ['hist', '⚙ 이력 시트'], ['rules', '⚙ 규칙']];
    root.innerHTML = `<div class="row"><div class="seg" id="floorSeg">${['10층', '3층'].map(f => `<button data-fl="${f}" class="${f === S.floor ? 'active' : ''}">${f}${f === '10층' ? ' (1·2팀)' : ' (3팀)'}</button>`).join('')}</div><span class="mute">층마다 따로 배정하고 따로 저장합니다</span></div>` + tabsHtml(T, S.tab) + `<div id="pane"></div>`;
    ({ hist: pHist, rules: pRules, plan: pPlan, big: pBig, map: pMap })[S.tab]();
    drawBar();
  }
  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.fl) { S.floor = d.fl; S.plan = S.big = null; S.fp = undefined; initPeople(); S.last = S.base; return draw(); }
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
    const r = S.rules, fr = FR(), ranks = ['실장', '팀장', '부팀장', '주임', '사원'];
    const slotRow = (s, i) => `<tr><td><input data-s="${i}" data-k="zone" value="${esc(s.zone)}" size="32"></td><td><input data-s="${i}" data-k="role" value="${esc(s.role)}" size="22"></td>
      <td><select data-s="${i}" data-k="category">${opts(CATS, s.category)}</select></td><td><input type="number" min="1" data-s="${i}" data-k="n" value="${s.n}"></td><td><button data-del="s${i}">삭제</button></td></tr>`;
    $p().innerHTML = `<div class="mute">바꾼 뒤 맨 아래 <b>저장</b>을 눌러야 적용됩니다.</div>
    <h2>청소를 하지 않는 직책</h2><div class="mute">팀 시트의 직책을 보고 이 직책은 청소 명단에서 뺍니다. 예: 팀장까지는 청소하지 않는다 → 실장·팀장 체크.</div>
    <div class="row">${ranks.map(k => `<label><input type="checkbox" data-rank="${k}" ${r.excludeRanks.includes(k) ? 'checked' : ''}> ${k}</label>`).join(' ')}</div>
    <h2>평일 청소 칸 (합계 ${need()}칸)</h2><table><tr><th>구역</th><th>역할</th><th>종류</th><th>인원</th><th></th></tr>${fr.slots.map(slotRow).join('')}</table>
    <div class="row"><button id="addSlot">+ 칸 추가</button></div>
    <h2>고정 배정 (로테이션 제외)</h2><table>${fr.fixed.map((f, i) => `<tr><td><input data-f="${i}" data-k="zone" value="${esc(f.zone)}" size="32"></td><td><input data-f="${i}" data-k="who" value="${esc(f.who)}" size="22"></td><td><button data-del="f${i}">삭제</button></td></tr>`).join('')}</table>
    <div class="row"><button id="addFixed">+ 고정 추가</button></div>
    <h2>배정 옵션</h2>
    <div class="row">해 보지 않은 구역 우선 강도 <input type="number" min="0" data-g="zoneNovelty" value="${r.zoneNovelty}"> <span class="mute">클수록 같은 구역을 많이 해 본 사람을 그 구역에서 멀리합니다 (0이면 무시)</span></div>
    <div class="row">직전 분기와 같은 구역 회피 강도 <input type="number" min="0" data-g="zoneWeight" value="${r.zoneWeight}"></div>
    <div class="row">대청소 도구장 소독 인원 <input type="number" min="0" data-g="toolCabinetN" value="${fr.toolCabinetN}">명</div>
    <table><tr><th>에어컨 필터 위치</th><th>개수</th><th></th></tr>${fr.airFilters.map((a, i) => `<tr><td><input data-a="${i}" data-k="place" value="${esc(a.place)}"></td><td><input type="number" min="1" data-a="${i}" data-k="n" value="${a.n}"></td><td><button data-del="a${i}">삭제</button></td></tr>`).join('')}</table>
    <div class="row"><button id="addAir">+ 위치 추가</button></div>
    <div class="row" style="margin-top:14px"><button id="saveRules" class="pri">저장</button></div>`;
  }
  root.oninput = e => {
    const d = e.target.dataset, r = S.rules; if (!r) return; const v = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    const fr = FR(); if (d.s != null) fr.slots[d.s][d.k] = v; else if (d.f != null) fr.fixed[d.f][d.k] = v; else if (d.a != null) fr.airFilters[d.a][d.k] = v; else if (d.g) (d.g === 'toolCabinetN' ? fr : r)[d.g] = v;
    if (d.memo != null) S.plan.cells[d.memo].memo = v;
    if (e.target.id === 'qName') S.q = v; if (e.target.id === 'qDate') S.d = v;
  };
  handlers.push((t, d) => {
    const r = S.rules, id = t.id;
    if (d.rank) { r.excludeRanks = t.checked ? [...new Set([...r.excludeRanks, d.rank])] : r.excludeRanks.filter(x => x !== d.rank); }
    const fr = FR();
    if (id === 'addSlot') { fr.slots.push({ zone: '', role: '', category: '닦기', n: 1 }); pRules(); }
    if (id === 'addFixed') { fr.fixed.push({ zone: '', who: '' }); pRules(); }
    if (id === 'addAir') { fr.airFilters.push({ place: '', n: 1 }); pRules(); }
    if (d.del) { ({ s: fr.slots, f: fr.fixed, a: fr.airFilters })[d.del[0]].splice(+d.del.slice(1), 1); pRules(); }
    if (id === 'saveRules') { initPeople(); save(); S.plan = S.big = null; say('규칙을 저장했습니다'); }
  });

  /* ③ 배정 */
  const groups = cells => { const g = []; cells.forEach((c, i) => { const last = g[g.length - 1]; if (last && last.zone === c.zone) last.rows.push({ ...c, i }); else g.push({ zone: c.zone, rows: [{ ...c, i }] }); }); return g; };
  async function pPlan() {
    if (!S.plan) { if (!(await runPlan(true))) return; }
    const used = useNames(), P = S.plan, all = Object.keys(S.people), cells = P ? P.cells : []; let zone = '';
    $p().innerHTML = `<h2>${esc(S.floor)} 이번 분기 명단 <span class="mute">(팀 시트 기준 · 제외 직책: ${esc(S.rules.excludeRanks.join(', ') || '없음')})</span></h2>
    <div class="row">직전 분기 시트(구역 반복 회피) <select id="lastSel"><option value="">없음</option>${opts(used, S.last)}</select></div>
    <div class="chips">${all.map(p => `<span class="chip ${S.people[p] ? '' : 'off'}" data-p="${esc(p)}" title="${esc(rankOf(p))}">${esc(p)}<span class="mute"> ${esc(rankOf(p))}</span></span>`).join('')}</div>
    <div class="row"><input id="newP" placeholder="이름 추가"><button id="addP">추가</button><span class="mute">눌러서 이번 분기 제외/포함 · 현재 ${active().length}명 / 필요 ${need()}칸</span></div>
    <div class="row"><button id="run" class="pri">${P ? '다시 배정하기' : '배정하기'}</button></div>
    ${P ? `<div class="two"><div><h2>배정 결과 <span class="mute">(실제 분담표 모양 그대로 — 이름을 눌러 바꾸면 서로 자리가 바뀝니다)</span></h2>
      <table class="sheet left"><tr><th>청소구역</th><th>역할</th><th>담당선생님</th></tr>${groups(cells).map(g => g.rows.map((c, k) => `<tr>${k === 0 ? `<td rowspan="${g.rows.length}" class="zcell">${esc(g.zone)}</td>` : ''}<td class="tm">${esc(c.role) || '<span class="mute">—</span>'}</td><td><select class="plain" data-c="${c.i}">${opts(active(), c.name)}</select></td></tr>`).join('')).join('')}
      ${FR().fixed.map(f => `<tr><td class="zcell">${esc(f.zone)}</td><td class="tm mute">고정</td><td>${esc(f.who)}</td></tr>`).join('')}</table></div>
    <div><h2>과거 횟수 (종류 / 구역)</h2><table><tr><th>이름</th>${CATS.slice(0, 3).map(k => `<th>${k}</th>`).join('')}<th>구역</th></tr>
    ${active().map(p => `<tr><td>${esc(p)}</td>${CATS.slice(0, 3).map(k => `<td>${P.counts[p]?.[k] || 0}</td>`).join('')}<td class="mute">${Object.entries(P.zones[p] || {}).map(([z, n]) => z + n).join(' ')}</td></tr>`).join('')}</table></div></div>
` : ''}`;
  }
  handlers.push(async (t, d) => {
    if (d.p) { S.people[d.p] = !S.people[d.p]; S.plan = S.big = null; pPlan(); }
    if (t.id === 'addP') { const v = root.querySelector('#newP').value.trim(); if (v) { S.people[v] = true; S.plan = S.big = null; pPlan(); } }
    if (t.id === 'run') { const l = root.querySelector('#lastSel'); if (l) S.last = l.value; S.plan = null; await runPlan(false); pPlan(); }
    if (t.id === 'save2') save2();
    if (d.inc) { S.inc[d.inc] = t.checked; if (t.checked && /big|Big/.test(d.inc) && S.plan && !S.big) { await ensureBig(); if (S.tab === 'big' || S.tab === 'map') draw(); } }
  });
  root.onchange = e => {
    const d = e.target.dataset;
    if (d.c != null) { const cs = S.plan.cells, i = +d.c, j = cs.findIndex((c, k) => k !== i && c.name === e.target.value); if (j >= 0) cs[j].name = cs[i].name; cs[i].name = e.target.value; S.big = null; pPlan(); }
    if (d.bc != null) { const c = S.big.cells[+d.bc]; c.name = e.target.value; c.from = c.name ? '지원' : (c.vacated ? '비움' : '신규'); pBig(); }
    if (d.air != null) S.big.airFilters[d.air].who = e.target.value;
  };
  // 배정·대청소는 탭을 열면 바로 만든다(버튼을 따로 누를 필요 없음). 다시 만들고 싶으면 '다시 배정'.
  async function runPlan(quiet) {
    if (active().length < need()) { $p().innerHTML = `<div class="warn">인원(${active().length}명)이 칸(${need()})보다 적습니다. 아래 명단에서 사람을 더하거나 ⚙규칙에서 칸 수를 고치세요.</div>`; return false; }
    S.plan = await invoke('cleaning:run', { floor: S.floor, people: active(), useSheets: useNames(), lastSheet: S.last, seed: Date.now() % 1e6 }); S.big = null; if (!quiet) say('다시 배정했습니다'); return true;
  }
  async function ensureBig() { if (!S.plan) await runPlan(true); if (S.plan && !S.big) S.big = await invoke('cleaning:big', { floor: S.floor, cells: S.plan.cells, people: active(), useSheets: useNames(), seed: Date.now() % 1e6 }); return !!S.big; }
  // 아래 고정 줄: 시트 이름·날짜 + 무엇을 내보낼지 고르고 한 번에 저장
  function drawBar() {
    let bar = root.querySelector('#bar'); if (bar) bar.remove(); if (S.tab === 'hist' || S.tab === 'rules') return;
    const maps = S.floor === '10층', ck = (k, label, off) => `<label class="${off ? 'mute' : ''}"><input type="checkbox" data-inc="${k}" ${S.inc[k] && !off ? 'checked' : ''} ${off ? 'disabled' : ''}> ${label}</label>`;
    bar = document.createElement('div'); bar.id = 'bar'; bar.className = 'exportbar';
    bar.innerHTML = `<b>내보내기</b> 시트 이름 <input id="qName" value="${esc(S.q)}" placeholder="예: 2027.01~" size="10"> 날짜 <input id="qDate" value="${esc(S.d)}" placeholder="예: 2027-01-04~" size="12">
      ${ck('week', '평일표')}${ck('big', '대청소표')}${ck('mapWeek', '평일 배치도', !maps)}${ck('mapBig', '대청소 배치도', !maps)}<button id="save2" class="pri">엑셀로 저장</button>${maps ? '' : '<span class="mute">3층은 배치도 시트가 없습니다</span>'}`;
    root.appendChild(bar);
  }
  async function save2() {
    if (!S.q.trim()) return say('시트 이름을 입력하세요 (예: 2027.01~)', true);
    const inc = { ...S.inc }; if (S.floor !== '10층') inc.mapWeek = inc.mapBig = false;
    if (!inc.week && !inc.big && !inc.mapWeek && !inc.mapBig) return say('내보낼 것을 하나 이상 고르세요', true);
    if (!S.plan && !(await runPlan(true))) return;
    if ((inc.big || inc.mapBig) && !(await ensureBig())) return;
    const p = await invoke('cleaning:save', { floor: S.floor, sheetName: S.q.trim(), date: S.d, cells: S.plan.cells, big: S.big, include: { week: !!inc.week, big: !!inc.big, mapWeek: !!inc.mapWeek, mapBig: !!inc.mapBig } });
    say(p ? '저장했습니다: ' + p : '저장을 취소했습니다');
  }

  /* ④ 대청소 */
  async function pBig() {
    if (!S.big && !(await ensureBig())) { return; }
    if (!S.plan) { $p().innerHTML = '<div class="warn">먼저 ③에서 평일 배정을 만드세요. 대청소는 그 배정을 이어받습니다.</div>'; return; }
    const B = S.big, ppl = active();
    const open = B ? B.cells.map((c, i) => i).filter(i => B.cells[i].from === '신규' || B.cells[i].from === '비움' || B.cells[i].from === '지원') : [];
    const hold = i => ({ '신규': '대청소에만 있는 칸', '비움': `소독 담당이라 비움 (원래 ${B.cells[i].vacated})`, '지원': '' })[B.cells[i].from] || '';
    $p().innerHTML = `<div class="mute">대청소 시트는 원본 '대청소' 시트의 칸 구성으로 만듭니다. 평일과 같은 구역·역할 칸은 평일 담당자를 이어받고,
    <b>도구장 소독 담당</b>(${FR().toolCabinetN}명)이 따로 추가됩니다. <b>지원배치</b> = 소독 담당으로 뽑힌 사람이 원래 맡던 칸, 그리고 대청소에만 있는 칸(보바스매트 등)을 채울 사람을 뜻하며,
    아무 칸도 안 맡은 여유 인원이 있으면 자동으로 추천합니다(아래에서 바꿀 수 있어요).</div>
    <div class="row"><button id="pick" class="pri">${B ? '다시 뽑기' : '소독 담당 뽑기'}</button>
      <label><input type="checkbox" id="airOn" ${B && B.airOn === false ? '' : 'checked'}> 에어컨 필터 청소 포함(원본 대청소 시트 오른쪽 목록)</label></div>
    ${B ? `<h2>도구장 정리 / 도구 소독</h2><div class="chips">${B.tool.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
    <h2>지원배치가 필요한 칸 (${open.length})</h2>${open.length ? `<table>${open.map(i => `<tr class="vac"><td>${esc(B.cells[i].zone)} / ${esc(B.cells[i].role)}</td><td class="mute">${esc(hold(i))}</td>
    <td><select data-bc="${i}"><option value="">(미정)</option>${opts(ppl.filter(p => !B.tool.includes(p)), B.cells[i].name)}</select></td></tr>`).join('')}</table>` : '<div class="mute">비는 칸이 없습니다.</div>'}
    ${B.spare.length ? `<div class="mute">남는 여유 인원: ${B.spare.map(esc).join(', ')}</div>` : ''}
    <h2>대청소 전체 배정 (${B.cells.length}칸)</h2><table>${B.cells.map(c => `<tr><td>${esc(c.zone)}</td><td>${esc(c.role)}</td><td>${c.name ? esc(c.name) : '<span class="vacn">지원 필요</span>'}</td></tr>`).join('')}</table>
    ${B.airOn === false ? '' : `<h2>에어컨 필터 청소</h2><table>${B.airFilters.map((a, i) => `<tr><td>${esc(a.place)}</td><td>${a.n}개</td><td><select data-air="${i}"><option value="">(미정)</option>${opts(ppl, a.who)}</select></td></tr>`).join('')}</table>`}` : ''}`;
  }
  handlers.push(async t => {
    if (t.id === 'pick') { S.big = await invoke('cleaning:big', { floor: S.floor, cells: S.plan.cells, people: active(), useSheets: useNames(), seed: Date.now() % 1e6 }); pBig(); }
    if (t.id === 'airOn' && S.big) { S.big.airOn = t.checked; pBig(); }
  });

  /* 배치도: 청소분담표 파일의 Sheet1 그림 위에 구역별 담당자를 올려 보여 준다 (칸 ↔ 담당 구역 연결은 main 쪽 floorplan.place — 엑셀 내보내기와 같은 결과) */
  async function pMap() {
    if (S.floor !== '10층') { $p().innerHTML = '<div class="mute">3층 배치도는 청소분담표 파일에 없습니다(Sheet1은 10층 배치도). 3층 배치도를 시트로 넣어 주시면 같은 방식으로 보여 드릴 수 있어요.</div>'; return; }
    if (!S.plan && !(await runPlan(true))) return;
    if (S.mapMode === 'big') await ensureBig();
    $p().innerHTML = '<div class="mute">배치도를 읽는 중…</div>';
    const big = S.mapMode === 'big' && !!S.big, cells = big ? S.big.cells : S.plan.cells, R = await invoke('cleaning:place', { floor: S.floor, cells, tool: big ? S.big.tool : [] });
    if (!R) { $p().innerHTML = '<div class="warn">청소분담표 파일에서 배치도(Sheet1)를 찾지 못했습니다.</div>'; return; }
    const fp = R.fp, sum = fp.cols.reduce((a, b) => a + b, 0), nm = x => x.vac ? '<span class="vacn">지원 필요</span>' : esc(x.n);
    $p().innerHTML = `<div class="row"><div class="seg" id="mapSeg"><button data-m="week" class="${!big ? 'active' : ''}">평일</button><button data-m="big" class="${big ? 'active' : ''}">대청소</button></div>
      <span class="mute">${big ? '원본 대청소 시트의 칸 구성 + 도구장 소독 담당' : '평일 청소 담당자'} — 위 「내보내기」에서 배치도 시트로 저장할 수 있습니다</span></div>
      <div class="plan" style="grid-template-columns:${fp.cols.map(w => `minmax(0,${w}fr)`).join(' ')};grid-template-rows:${fp.rows.map(h => h + 'px').join(' ')};aspect-ratio:${sum}/${fp.rows.reduce((a, b) => a + b, 0)}">
      ${fp.blocks.map((b, bi) => { const L = R.blocks[bi], has = L.lines.length || L.tool;
        return `<div class="pb ${has ? 'mine' : ''}" style="grid-area:${b.r}/${b.c}/span ${b.rs}/span ${b.cs};${b.bg ? `background:${b.bg}` : ''}"><div class="pt">${esc(b.text)}</div>${L.lines.map(l => `<div class="pl"><span class="pr">${esc(l.role)}</span>${l.names.map(nm).join(' · ')}</div>`).join('')}${L.tool ? `<div class="pl tool"><span class="pr">소독</span>${R.tool.map(esc).join(' · ')}</div>` : ''}</div>`; }).join('')}</div>
      ${R.rest.length ? `<h2>배치도에 칸이 없는 구역</h2>${R.rest.map(z => `<div class="pl-row"><b>${esc(z.zone)}</b> ${z.items.map(c => `${esc(c.role)} ${nm(c)}`).join(' · ')}</div>`).join('')}` : ''}
      ${fp.note ? `<details style="margin-top:10px"><summary class="mute">시트의 안내문 보기</summary><div class="mute" style="white-space:pre-wrap">${esc(fp.note)}</div></details>` : ''}`;
  }
  handlers.push((t, d) => { if (d.m) { S.mapMode = d.m; pMap(); } });
  load();
} });
