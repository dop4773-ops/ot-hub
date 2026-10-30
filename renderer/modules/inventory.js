// 도구 목록 화면: 목록 보기 / 신청서 가져오기·분류 / 반영·저장
Hub.register({ id: 'inventory', icon: '🧰', desc: '신청서를 가져와 비품·소모품 분류', title: '도구 목록', render(root) {
  const { esc, invoke, say, opts, tabsHtml } = Hub;
  const ACTIONS = ['', '신규', '추가', '교체', '소진', '제외'];
  const AHELP = { '': '미분류', 신규: '신규 등록(목록에 새 품목)', 추가: '추가 구입(수량 +)', 교체: '폐기 후 보충(재고량 그대로)', 소진: '소모품 사용 기록', 제외: '목록과 무관(제외)' };
  const S = { tab: 'list', items: [], sec: '전체', q: '', pre: null, map: null, imp: null, res: null };
  const label = a => AHELP[a];
  async function load() {
    if (Hub.needFiles(['tools']).length) { root.innerHTML = Hub.missingBox(['tools']); return; }
    const r = await invoke('inventory:load'); if (r.error) { root.innerHTML = `<div class="warn">${esc(r.error)}</div>`; return; }
    S.items = r.items; draw();
  }
  function draw() {
    root.innerHTML = tabsHtml([['list', '목록 보기'], ['imp', '신청서 가져오기·분류'], ['save', '반영·저장']], S.tab) + '<div id="pane"></div>';
    ({ list: pList, imp: pImp, save: pSave })[S.tab]();
  }
  const $p = () => root.querySelector('#pane');

  function pList() {
    const rows = S.items.filter(i => (S.sec === '전체' || i.section === S.sec) && (!S.q || i.name.includes(S.q)));
    $p().innerHTML = `<div class="row"><select id="sec">${opts(['전체', 'Activity', 'ADL', 'RDT'], S.sec)}</select><input id="q" placeholder="도구명 검색" value="${esc(S.q)}"><span class="mute">${rows.length}개 · 소모품 ${rows.filter(i => i.kind === '소모품').length}개</span></div>
    <table><tr><th>구역</th><th>도구명</th><th>수량</th><th>구분</th><th>비고</th></tr>${rows.map(i => `<tr class="${i.isNew ? 'soft' : ''}"><td class="mute">${esc(i.section)}</td><td>${esc(i.name)}</td><td>${i.qty}</td><td>${esc(i.kind)}</td><td class="mute">${esc(i.note)}</td></tr>`).join('')}</table>`;
  }

  async function pImp() {
    if (Hub.needFiles(['supply']).length) { $p().innerHTML = Hub.missingBox(['supply']); return; }
    if (!S.imp) {
      if (!S.pre) { $p().innerHTML = '<div class="mute">신청서를 읽는 중…</div>'; S.pre = await invoke('inventory:preview'); if (S.pre.error) { $p().innerHTML = `<div class="warn">${esc(S.pre.error)}</div>`; S.pre = null; return; }
        S.map = { sheet: S.pre.sheets[0].name, headerRow: Math.max(0, S.pre.guess[0].header), cols: { ...S.pre.guess[0].cols } }; }
      const sh = S.pre.sheets.find(s => s.name === S.map.sheet), colOpt = j => `<option value="">(없음)</option>${(sh.rows[S.map.headerRow] || []).map((h, k) => `<option value="${k}" ${S.map.cols[j] === k ? 'selected' : ''}>${k + 1}열 ${esc(h)}</option>`).join('')}`;
      $p().innerHTML = `<div class="mute">신청서 형식을 자동으로 추측했습니다. 틀리면 머리글 행과 열을 고르세요. 가져오기만 하고 자동 반영은 하지 않습니다.</div>
      <div class="row">시트 <select id="shSel">${opts(S.pre.sheets.map(s => s.name), S.map.sheet)}</select> 머리글 행 <input type="number" min="1" id="hdr" value="${S.map.headerRow + 1}" style="width:60px">
        품명 <select data-col="name">${colOpt('name')}</select> 수량 <select data-col="qty">${colOpt('qty')}</select> 규격 <select data-col="spec">${colOpt('spec')}</select> 비고 <select data-col="note">${colOpt('note')}</select></div>
      <table><tr>${(sh.rows[0] || []).map((_, j) => `<th>${j + 1}열</th>`).join('')}</tr>${sh.rows.slice(0, 12).map((r, i) => `<tr class="${i === S.map.headerRow ? 'soft' : ''}">${r.map(c => `<td class="mute">${esc(c.slice(0, 24))}</td>`).join('')}</tr>`).join('')}</table>
      <div class="row" style="margin-top:10px"><button id="doImp" class="pri" ${S.map.cols.name == null ? 'disabled' : ''}>가져오기</button></div>`;
      return;
    }
    const R = S.imp, miss = R.filter(r => r.matchKind === '목록에 없음'), un = R.filter(r => !r.action);
    $p().innerHTML = `<div class="row"><b>${R.length}건</b> · <span class="${un.length ? 'err' : 'ok'}">미분류 ${un.length}건</span> · <span class="${miss.length ? 'err' : 'ok'}">목록에 없는 품목 ${miss.length}건</span>
      <button id="reImp">다른 신청서/열로 다시 가져오기</button></div>
    <div class="mute">목록에 없는 품목은 "신규"로 등록하거나 "제외"해야 누락이 없어집니다. 폐기하고 다시 채운 것은 "교체"로 분류하면 재고량이 그대로 유지됩니다.</div>
    <table><tr><th>신청 품목</th><th>수량</th><th>목록과의 일치</th><th>연결 품목</th><th>처리</th><th>구분·위치(신규)</th></tr>
    ${R.map((r, i) => `<tr class="${!r.action ? 'soft' : ''}"><td>${esc(r.name)} <span class="mute">${esc(r.spec)}</span></td><td><input type="number" min="1" data-q="${i}" value="${r.qty}" style="width:56px"></td>
      <td class="${r.matchKind === '목록에 없음' ? 'err' : 'mute'}">${esc(r.matchKind)}</td>
      <td><select data-m="${i}"><option value="">(없음)</option>${r.candidates.map(id => `<option value="${id}" ${r.matchId === id ? 'selected' : ''}>${esc(S.items.find(x => x.id === id).name)}</option>`).join('')}</select></td>
      <td><select data-a="${i}">${ACTIONS.map(a => `<option value="${a}" ${r.action === a ? 'selected' : ''}>${esc(label(a))}</option>`).join('')}</select></td>
      <td>${r.action === '신규' ? `<select data-k="${i}">${opts(['비품', '소모품'], r.kind || '비품')}</select> <select data-s="${i}">${opts(['Activity', 'ADL', 'RDT'], r.section || 'Activity')}</select>` : ''}</td></tr>`).join('')}</table>`;
  }

  async function pSave() {
    if (!S.imp) { $p().innerHTML = '<div class="warn">먼저 「신청서 가져오기·분류」에서 신청서를 가져오세요.</div>'; return; }
    S.res = await invoke('inventory:apply', { items: S.items, imported: S.imp });
    const R = S.res;
    $p().innerHTML = `<div class="row"><b>반영 ${R.log.length}건</b> · <span class="${R.pending.length ? 'err' : 'ok'}">보류/미분류 ${R.pending.length}건</span></div>
    <h2>반영 결과</h2><table><tr><th>신청 품목</th><th>수량</th><th>결과</th></tr>${R.log.map(l => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${esc(l.result)}</td></tr>`).join('') || '<tr><td colspan="3" class="mute">없음</td></tr>'}</table>
    <h2>보류 / 미분류 (저장하면 반영되지 않습니다)</h2><table>${R.pending.map(p => `<tr class="soft"><td>${esc(p.name)}</td><td>${p.qty}</td><td class="mute">${esc(p.why || '미분류')}</td></tr>`).join('') || '<tr><td class="mute">없음</td></tr>'}</table>
    <div class="row" style="margin-top:14px"><button id="save" class="pri">갱신본을 새 엑셀로 저장</button><span class="mute">원본 도구 목록은 건드리지 않고, 갱신된 목록과 변경이력 시트를 새 파일로 만듭니다</span></div>`;
  }

  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.tab) { S.tab = d.tab; return draw(); }
    if (t.id === 'doImp') { say('가져오는 중…'); S.imp = await invoke('inventory:import', { map: S.map, items: S.items }); say(`${S.imp.length}건을 가져왔습니다`); pImp(); }
    if (t.id === 'reImp') { S.imp = null; pImp(); }
    if (t.id === 'save') { const p = await invoke('inventory:save', { items: S.res.items, log: S.res.log }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
  };
  root.oninput = e => { const d = e.target.dataset;
    if (d.q != null) S.imp[+d.q].qty = Number(e.target.value) || 1;
    if (e.target.id === 'q') { S.q = e.target.value; const p = e.target.selectionStart; pList(); const el = root.querySelector('#q'); el.focus(); el.setSelectionRange(p, p); }
    if (e.target.id === 'hdr') { S.map.headerRow = Math.max(0, Number(e.target.value) - 1); } };
  root.onchange = e => { const t = e.target, d = t.dataset;
    if (t.id === 'sec') { S.sec = t.value; pList(); }
    if (t.id === 'shSel') { S.map.sheet = t.value; const g = S.pre.guess.find(x => x.name === t.value); S.map.headerRow = Math.max(0, g.header); S.map.cols = { ...g.cols }; pImp(); }
    if (t.id === 'hdr') pImp();
    if (d.col) { S.map.cols[d.col] = t.value === '' ? null : Number(t.value); pImp(); }
    if (d.m != null) { S.imp[+d.m].matchId = t.value ? Number(t.value) : null; }
    if (d.a != null) { S.imp[+d.a].action = t.value; pImp(); }
    if (d.k != null) S.imp[+d.k].kind = t.value; if (d.s != null) S.imp[+d.s].section = t.value; };
  load();
} });
