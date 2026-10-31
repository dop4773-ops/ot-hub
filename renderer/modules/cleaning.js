// 청소분담표 화면: ① 이력 시트 ② 규칙(직책·칸) ③ 이번 분기 배정 ④ 대청소
Hub.register({ id: 'cleaning', icon: '🧹', desc: '팀 시트 직책·과거 이력으로 분기 청소를 공평하게 배정', title: '청소분담표', sep: true, render(root) {
  const { esc, invoke, say, opts, tabsHtml } = Hub;
  const CATS = ['밀대', '쓸기', '닦기', '도구장', '트롤리', '소모품라벨'];
  const S = { floor: '10층', tab: 'plan', data: null, rules: null, use: {}, people: {}, base: '', last: '', plan: null, big: null, q: '', d: '' };
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
    const T = [['hist', '① 이력 시트'], ['rules', '② 규칙'], ['plan', '③ 이번 분기 배정'], ['big', '④ 대청소'], ['map', '⑤ 배치도']];
    root.innerHTML = `<div class="row"><div class="seg" id="floorSeg">${['10층', '3층'].map(f => `<button data-fl="${f}" class="${f === S.floor ? 'active' : ''}">${f}${f === '10층' ? ' (1·2팀)' : ' (3팀)'}</button>`).join('')}</div><span class="mute">층마다 따로 배정하고 따로 저장합니다</span></div>` + tabsHtml(T, S.tab) + `<div id="pane"></div>`;
    ({ hist: pHist, rules: pRules, plan: pPlan, big: pBig, map: pMap })[S.tab]();
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
  function pPlan() {
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
    <h2>저장</h2><div class="row">시트 이름 <input id="qName" value="${esc(S.q)}" placeholder="예: 2027.01~"> 날짜 <input id="qDate" value="${esc(S.d)}" placeholder="예: 2027-01-04~"><button id="save" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  handlers.push(async (t, d) => {
    if (d.p) { S.people[d.p] = !S.people[d.p]; S.plan = S.big = null; pPlan(); }
    if (t.id === 'addP') { const v = root.querySelector('#newP').value.trim(); if (v) { S.people[v] = true; S.plan = S.big = null; pPlan(); } }
    if (t.id === 'run') {
      if (active().length < need()) return say(`인원(${active().length}명)이 칸(${need()})보다 적습니다`, true);
      S.last = root.querySelector('#lastSel').value;
      S.plan = await invoke('cleaning:run', { floor: S.floor, people: active(), useSheets: useNames(), lastSheet: S.last, seed: Date.now() % 1e6 }); S.big = null; say('배정했습니다'); pPlan();
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
    const p = await invoke('cleaning:save', { floor: S.floor, sheetName: S.q.trim(), date: S.d, cells: S.plan.cells, big: S.big });
    say(p ? '저장했습니다: ' + p : '저장을 취소했습니다');
  }

  /* ④ 대청소 */
  function pBig() {
    if (!S.plan) { $p().innerHTML = '<div class="warn">먼저 ③에서 평일 배정을 만드세요. 대청소는 그 배정을 이어받습니다.</div>'; return; }
    const B = S.big, ppl = active(), cells = S.plan.cells;
    $p().innerHTML = `<div class="mute">대청소 = 평일 배정 그대로 + 도구장 정리/소독 담당 추가. 소독 담당이 맡던 평일 칸은 지원배치가 필요합니다.</div>
    <div class="row"><button id="pick" class="pri">${B ? '다시 뽑기' : '소독 담당 뽑기'} (${FR().toolCabinetN}명)</button></div>
    ${B ? `<h2>도구장 정리 / 도구 소독</h2><div class="chips">${B.tool.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
    <h2>지원배치가 필요한 평일 칸 (${B.vacatedIdx.length})</h2>${B.vacatedIdx.length ? `<table>${B.vacatedIdx.map(i => `<tr class="vac"><td>${esc(cells[i].zone)} / ${esc(cells[i].role)}</td><td class="mute">원래 ${esc(cells[i].name)}</td>
    <td><select data-sup="${i}"><option value="">(미정)</option>${opts(ppl.filter(p => !B.tool.includes(p)), B.support[i])}</select></td></tr>`).join('')}</table>` : '<div class="mute">비는 칸이 없습니다.</div>'}
    <h2>에어컨 필터 청소</h2><table>${B.airFilters.map((a, i) => `<tr><td>${esc(a.place)}</td><td>${a.n}개</td><td><select data-air="${i}"><option value="">(미정)</option>${opts(ppl, a.who)}</select></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:14px">③의 시트 이름·날짜로 평일표와 <b>대청소</b> 시트가 함께 저장됩니다. <button id="save2" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  handlers.push(async t => {
    if (t.id === 'pick') { const r = await invoke('cleaning:big', { floor: S.floor, cells: S.plan.cells, useSheets: useNames(), seed: Date.now() % 1e6 }); S.big = { ...r, support: {} }; pBig(); }
    if (t.id === 'save2') save2();
  });

  /* ⑤ 배치도: 청소분담표 파일의 Sheet1 그림 위에 구역별 담당자를 올려 보여 준다 */
  // 배치도 칸의 글자 → 청소 구역(zoneKey)·역할. 위에서부터 먼저 맞는 칸이 담당자를 가져간다(구역당 한 칸).
  const MAP = [
    { re: /OT\s*치료실/, zone: '작업치료실', not: /창틀/ }, { re: /^OT\s*창\s*틀|OT\s*창틀/, zone: '작업치료실', only: /창틀/ },
    { re: /OT\s*station/i, zone: '스테이션' }, { re: /ADL실.*OT|^ADL실/, zone: '인지연하' },
    { re: /도\s*구\s*장/, zone: '도구장', not: /짐볼/ }, { re: /^복도$/, zone: '공용공간', not: /E\/V/ }, { re: /E\/V\s*빗자루/, zone: '공용공간', only: /E\/V/ }];
  const zoneKeyOf = z => /스테이션|복도/.test(z) ? '스테이션' : /인지|연하/.test(z) ? '인지연하' : /도구장/.test(z) ? '도구장' : /공용/.test(z) ? '공용공간' : /작업치료실/.test(z) ? '작업치료실' : /트롤리/.test(z) ? '트롤리' : z;
  async function pMap() {
    if (!S.plan) { $p().innerHTML = '<div class="warn">먼저 ③에서 평일 배정을 만드세요. 배치도에 담당자를 올려 보여 드립니다.</div>'; return; }
    $p().innerHTML = '<div class="mute">배치도를 읽는 중…</div>'; if (!S.fp) S.fp = await invoke('cleaning:floorplan', S.floor);
    const fp = S.fp; if (!fp) { $p().innerHTML = S.floor === '3층' ? '<div class="mute">3층 배치도는 청소분담표 파일에 없습니다(Sheet1은 10층 배치도). 3층 배치도를 시트로 넣어 주시면 같은 방식으로 보여 드릴 수 있어요.</div>' : '<div class="warn">청소분담표 파일에서 배치도(Sheet1)를 찾지 못했습니다.</div>'; return; }
    const big = !!S.big && S.mapMode === 'big', cells = S.plan.cells, vac = new Set(big ? S.big.vacatedIdx : []);
    const by = {}; cells.forEach((c, i) => { (by[zoneKeyOf(c.zone)] ??= []).push({ ...c, i }); });
    const claimed = new Map(), used = new Set();
    fp.blocks.forEach((b, bi) => { for (const m of MAP) { if (used.has(m.zone + '|' + (m.only || '')) || !m.re.test(b.text) || (m.not && m.not.test(b.text))) continue; claimed.set(bi, m); used.add(m.zone + '|' + (m.only || '')); break; } });
    const lines = m => { const g = {}; (by[m.zone] || []).forEach(c => { if (m.only && !m.only.test(c.role)) return; if (m.not && m.not.test(c.role)) return; if (m.zone === '작업치료실' && !m.only && /창틀/.test(c.role)) return;
      const nm = vac.has(c.i) ? `<span class="vacn">${esc((S.big.support || {})[c.i] || '지원 필요')}</span>` : esc(c.name); (g[c.role || '담당'] ??= []).push(nm); });
      return Object.entries(g).map(([r, ns]) => `<div class="pl"><span class="pr">${esc(r.replace(/\(.*\)/, ''))}</span>${ns.join(' · ')}</div>`).join(''); };
    const placed = new Set([...claimed.values()].map(m => m.zone));
    const rest = Object.keys(by).filter(z => !placed.has(z));
    const sum = fp.cols.reduce((a, b) => a + b, 0);
    $p().innerHTML = `<div class="row"><div class="seg" id="mapSeg"><button data-m="week" class="${!big ? 'active' : ''}">평일</button><button data-m="big" class="${big ? 'active' : ''}">대청소</button></div>
      <span class="mute">${big ? '대청소: 도구장 소독 담당이 추가되고, 비는 평일 칸은 지원 배치로 표시됩니다.' : '평일 청소 담당자를 배치도 위에 보여 줍니다.'} (시트의 배치도를 그대로 그렸습니다)</span></div>
      ${S.mapMode === 'big' && !S.big ? '<div class="warn">④에서 소독 담당을 먼저 뽑으면 여기에 같이 나옵니다.</div>' : ''}
      <div class="plan" style="grid-template-columns:${fp.cols.map(w => `minmax(0,${w}fr)`).join(' ')};grid-template-rows:${fp.rows.map(h => h + 'px').join(' ')};aspect-ratio:${sum}/${fp.rows.reduce((a, b) => a + b, 0)}">
      ${fp.blocks.map((b, bi) => { const m = claimed.get(bi), has = m && lines(m);
        return `<div class="pb ${m ? 'mine' : ''}" style="grid-area:${b.r}/${b.c}/span ${b.rs}/span ${b.cs};${b.bg ? `background:${b.bg}` : ''}"><div class="pt">${esc(b.text)}</div>${has || ''}${big && m && m.zone === '도구장' ? `<div class="pl tool"><span class="pr">소독</span>${S.big.tool.map(esc).join(' · ')}</div>` : ''}</div>`; }).join('')}</div>
      ${rest.length ? `<h2>배치도에 칸이 없는 구역</h2>${rest.map(z => `<div class="pl-row"><b>${esc(z)}</b> ${(by[z] || []).map(c => `${esc(c.role || '')} ${vac.has(c.i) ? '<span class="vacn">지원 필요</span>' : esc(c.name)}`).join(' · ')}</div>`).join('')}` : ''}
      ${fp.note ? `<details style="margin-top:10px"><summary class="mute">시트의 안내문 보기</summary><div class="mute" style="white-space:pre-wrap">${esc(fp.note)}</div></details>` : ''}`;
  }
  handlers.push((t, d) => { if (d.m) { S.mapMode = d.m; pMap(); } });
  load();
} });
