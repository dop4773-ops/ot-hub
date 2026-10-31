// 도구 목록 화면: ① 목록(검색·필터·상세+청구 이력) ② 청구서 가져오기·분류 ③ 반영·저장
Hub.register({ id: 'inventory', icon: '🧰', desc: '청구서를 읽어 비품·소모품을 분류하고 목록에 정확히 반영', title: '도구 목록', render(root) {
  const { esc, invoke, say, tabsHtml } = Hub;
  const ACT = [['신규', '새 도구 등록'], ['추가', '수량 추가'], ['교체', '폐기 후 보충'], ['소진', '소모품 사용'], ['제외', '목록 대상 아님']];
  const HELP = { 신규: '목록에 없는 새 도구를 등록합니다', 추가: '이미 있는 도구의 수량을 늘립니다', 교체: '낡은 것을 버리고 다시 채운 것 — 재고량은 그대로, 이력만 남깁니다', 소진: '소모품을 쓴 기록만 남깁니다(재고 변화 없음)', 제외: '정기 사무용품 등 이 목록에서 관리하지 않는 것' };
  const CONSUMABLE = /사탕|풍선|건전지|테이프|종이컵|컵|티슈|세제|장갑|마스크|소독|스프레이|분무|라벨|밴드|젤리|물티슈|쿠키|간식/;
  const S = { tab: 'list', items: [], sheets: [], sec: '전체', kind: '전체', q: '', sel: null, pick: '', fl: '전체', view: '전체', act: {}, res: null, hist: [], manual: [] };
  let saveT; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => invoke('inventory:saveDraft', S.act), 400); };
  const byId = id => S.items.find(i => i.id === id);
  const reqs = () => S.sheets.filter(s => s.name === S.pick).flatMap(s => s.items);
  const stateOf = r => { const a = S.act[r.id]; return a ? a : r.area === 'standard' ? { action: '제외', auto: true } : { action: '' }; };

  async function load() {
    if (Hub.needFiles(['tools']).length) { root.innerHTML = Hub.missingBox(['tools']); return; }
    root.innerHTML = '<div class="mute">읽는 중…</div>';
    const r = await invoke('inventory:load'); if (r.error) { root.innerHTML = `<div class="warn">${esc(r.error)}</div>`; return; }
    S.items = r.items; S.sheets = r.sheets; S.act = r.draft || {}; S.hasSupply = r.hasSupply; S.hist = r.history || []; S.manual = [];
    const first = S.sheets.find(s => !s.done) || S.sheets[0]; S.pick = first ? first.name : '';       // 아직 반영하지 않은 가장 최근 청구부터
    draw();
  }
  const draw = () => { root.innerHTML = tabsHtml([['list', '① 목록'], ['imp', `② 청구서 가져오기·분류${pending() ? ` · 미분류 ${pending()}` : ''}`], ['save', '③ 반영·저장']], S.tab) + '<div id="pane"></div>'; ({ list: pList, imp: pImp, save: pSave })[S.tab](); };
  const pane = () => root.querySelector('#pane');
  const pending = () => reqs().filter(r => !stateOf(r).action).length;
  const badge = k => `<span class="badge ${k === '소모품' ? 'orange' : 'blue'}">${esc(k || '-')}</span>`;

  /* ① 목록 */
  const lastOf = it => { const h = S.hist.filter(x => x.name === it.name).sort((a, b) => a.date < b.date ? -1 : 1).pop(); return h ? `${h.date.slice(2)} ${h.kind}` : ''; };
  const manualOf = it => S.manual.find(m => m.id === it.id);
  function histOf(it) { return S.sheets.flatMap(s => s.items.filter(r => r.matchId === it.id).map(r => ({ ...r }))); }
  function pList() {
    const rows = S.items.filter(i => (S.sec === '전체' || i.section === S.sec) && (S.kind === '전체' || i.kind === S.kind) && (S.fl === '전체' || (S.fl === '공통' ? !i.floor : i.floor === S.fl)) && (!S.q || i.name.toLowerCase().includes(S.q.toLowerCase())));
    const cnt = k => S.items.filter(i => i.section === k).length, sel = S.sel && byId(S.sel);
    const seg = (id, list, cur) => `<div class="seg" id="${id}">${list.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    pane().innerHTML = `<div class="row">${seg('secSeg', [['전체', `전체 ${S.items.length}`], ['Activity', `작업치료실 ${cnt('Activity')}`], ['ADL', `ADL ${cnt('ADL')}`], ['RDT', `RDT ${cnt('RDT')}`]], S.sec)}
      ${seg('kindSeg', [['전체', '전체'], ['비품', '비품'], ['소모품', '소모품']], S.kind)}${seg('flSeg', [['전체', '층 전체'], ['10층', '10층'], ['3층', '3층'], ['공통', '공통']], S.fl)}<input id="q" type="search" placeholder="🔍 도구명 검색" value="${esc(S.q)}" style="width:200px"><span class="mute">${rows.length}개</span></div>
    <div class="two"><div class="scroll"><table class="data"><tr><th>도구명</th><th style="width:60px">수량</th><th style="width:70px">구분</th><th>비고</th><th style="width:110px">최근 변경</th></tr>
    ${rows.map(i => `<tr data-row="${i.id}" class="clk ${i.id === S.sel ? 'sel' : ''} ${i.isNew ? 'soft' : ''}"><td><b>${esc(i.name)}</b></td><td class="num">${i.qty}</td><td>${badge(i.kind)}</td><td class="mute">${esc(i.note)}</td><td class="mute nw">${esc(lastOf(i))}${manualOf(i) ? ' <span class="err">변경 예정</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">조건에 맞는 도구가 없습니다</td></tr>'}</table></div>
    <div class="card inner">${sel ? `<h2>${esc(sel.name)}</h2><div class="kv"><span>구역</span><b>${esc(sel.section)}</b>${sel.floor ? `<span>층</span><b>${esc(sel.floor)}</b>` : ''}<span>수량</span><b>${sel.qty}개</b><span>구분</span><b>${badge(sel.kind)}</b>${sel.note ? `<span>비고</span><b>${esc(sel.note)}</b>` : ''}</div>
      <h2>변경</h2><div class="row"><input type="number" min="0" id="mq" value="${manualOf(sel) && manualOf(sel).op === 'qty' ? manualOf(sel).qty : sel.qty}" style="width:70px"><button id="mqBtn">수량 변경</button><button id="retBtn">${manualOf(sel) && manualOf(sel).op === 'retire' ? '폐기 취소' : '폐기(목록에서 삭제)'}</button></div>
      ${manualOf(sel) ? `<div class="mute">③에서 저장하면 반영됩니다: ${manualOf(sel).op === 'retire' ? '폐기' : `수량 ${sel.qty} → ${manualOf(sel).qty}`}</div>` : ''}
      <h2>변경 이력</h2>${S.hist.filter(x => x.name === sel.name).length ? `<table class="data">${S.hist.filter(x => x.name === sel.name).map(h => `<tr><td class="nw">${esc(h.date)}</td><td>${esc(h.kind)}</td><td class="mute">${esc(h.detail)}</td></tr>`).join('')}</table>` : '<div class="mute">저장된 변경 이력이 없습니다 (추가·교체·폐기·수량 변경은 날짜와 함께 기록됩니다)</div>'}
      <h2>청구 이력</h2>${histOf(sel).length ? `<table class="data">${histOf(sel).map(h => `<tr><td class="nw">${esc(h.date.slice(5))} ${esc(h.floor)}</td><td>${esc(h.name)}${h.spec ? ` (${esc(h.spec)})` : ''} ×${h.qty}</td><td class="mute">${esc(h.reason)}</td></tr>`).join('')}</table>` : '<div class="mute">청구서에서 찾은 이력이 없습니다</div>'}`
      : '<div class="mute">왼쪽에서 도구를 누르면 상세와 청구 이력이 보입니다.</div>'}</div></div>`;
  }

  /* ② 청구서 */
  function pImp() {
    if (!S.hasSupply) { pane().innerHTML = Hub.missingBox(['supply']); return; }
    const list = reqs().filter(r => S.view === '전체' || (S.view === '기타' && r.area === 'extra') || (S.view === '미분류' && !stateOf(r).action) || (S.view === '목록에 없음' && r.matchKind === '목록에 없음' && stateOf(r).action !== '제외'));
    const all = reqs(), un = all.filter(r => !stateOf(r).action), miss = all.filter(r => r.matchKind === '목록에 없음' && !['제외', '신규'].includes(stateOf(r).action) && r.area === 'extra');
    pane().innerHTML = `<div class="mute">청구서(사무용품 청구서) 시트마다 한 번의 청구입니다. 인쇄된 정기 사무용품은 자동으로 "목록 대상 아님"이고, <b>기타 주문건</b>만 분류하면 됩니다.</div>
    <h2>청구 날짜 <span class="mute">(눌러서 하나를 고르면 그 청구만 나옵니다)</span></h2>
    ${['10F', '3F'].map(fl => { const list = S.sheets.filter(x => x.floor === fl); return list.length ? `<div class="datebar"><b class="fl">${fl === '10F' ? '10층' : '3층'}</b>${list.map(x => `<button class="datebtn ${x.name === S.pick ? 'on' : ''} ${x.done ? 'done' : ''}" data-sheet="${esc(x.name)}">${esc(x.date.slice(5).replace('-', '/'))}<small>기타 ${x.items.filter(i => i.area === 'extra').length}${x.done ? ' · 반영함' : ''}</small></button>`).join('')}</div>` : ''; }).join('') || '<span class="mute">청구 시트가 없습니다</span>'}
    <div class="strip"><b>${all.length}건</b><span class="${un.length ? 'err' : 'ok'}">미분류 ${un.length}</span><span class="${miss.length ? 'err' : 'ok'}">목록에 없는 기타 품목 ${miss.length}</span>
      <div class="seg" id="viewSeg">${['전체', '기타', '미분류', '목록에 없음'].map(v => `<button data-v="${v}" class="${v === S.view ? 'active' : ''}">${v === '기타' ? '기타 주문건' : v}</button>`).join('')}</div></div>
    <datalist id="itemsList">${S.items.map(i => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
    ${list.length ? `<div class="reqs">${list.map(r => { const st = stateOf(r), tg = st.matchId !== undefined ? byId(st.matchId) : byId(r.matchId);
      return `<div class="req ${!st.action ? 'need' : ''} ${r.area === 'standard' ? 'std' : ''}"><div class="rh"><b>${esc(r.name)}</b>${r.spec ? ` <span class="mute">${esc(r.spec)}</span>` : ''} <span class="qty">×${r.qty}</span>
        <span class="mute">${esc(r.date.slice(5))} ${esc(r.floor)} · ${esc(r.reason) || '사유 없음'}</span><span class="tag ${r.area === 'extra' ? 'a' : 'b'}">${r.area === 'extra' ? '기타 주문건' : '정기 사무용품'}</span></div>
        <div class="rm">${st.auto ? '' : tg ? `<span class="chip">목록: <b>${esc(tg.name)}</b> ${tg.qty}개 · ${esc(tg.kind)}</span>` : '<span class="chip warnchip">목록에 없음</span>'}${st.auto ? '' : `<input class="tgt" data-tgt="${esc(r.id)}" list="itemsList" placeholder="다른 도구 연결…" value="" style="width:150px">`}</div>
        <div class="seg act" data-act="${esc(r.id)}">${ACT.map(([a, l]) => `<button data-a="${a}" title="${esc(HELP[a])}" class="${st.action === a ? 'active' : ''}">${l}</button>`).join('')}</div>
        ${st.action === '신규' ? `<div class="rn">구분 <select data-k="${esc(r.id)}"><option ${((st.kind || (CONSUMABLE.test(r.name) ? '소모품' : '비품')) === '비품') ? 'selected' : ''}>비품</option><option ${((st.kind || (CONSUMABLE.test(r.name) ? '소모품' : '비품')) === '소모품') ? 'selected' : ''}>소모품</option></select>
          구역 <select data-s="${esc(r.id)}">${['Activity', 'ADL', 'RDT'].map(x => `<option ${(st.section || 'Activity') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}${st.auto ? '<div class="mute rn">정기 사무용품이라 자동으로 제외했어요. 필요하면 다른 처리를 고르세요.</div>' : ''}</div>`; }).join('')}</div>` : '<div class="mute" style="margin:14px 0">이 조건에 해당하는 청구가 없습니다.</div>'}`;
  }

  /* ③ 반영·저장 */
  async function pSave() {
    const imported = reqs().map(r => { const st = stateOf(r); return { ...r, action: st.action, matchId: st.matchId !== undefined ? st.matchId : r.matchId, section: st.section, kind: st.kind || (CONSUMABLE.test(r.name) ? '소모품' : '비품') }; });
    S.res = await invoke('inventory:apply', { items: S.items, imported, manual: S.manual });
    const R = S.res, changed = R.items.filter(n => { const o = byId(n.id); return !o || o.qty !== n.qty; });
    pane().innerHTML = `<div class="strip"><b>반영 ${R.log.length}건</b><span class="${R.pending.length ? 'err' : 'ok'}">보류·미분류 ${R.pending.length}건</span><span class="mute">수량이 바뀌는 도구 ${changed.length}개</span></div>
    ${R.pending.length ? `<div class="warn">아래 ${R.pending.length}건은 반영되지 않습니다. ②에서 분류하세요.</div>` : ''}
    <h2>반영 내용</h2><table class="data">${R.log.map(l => `<tr><td><b>${esc(l.name)}</b> <span class="mute">×${l.qty}</span></td><td>${esc(l.result)}</td></tr>`).join('') || '<tr><td class="mute">반영할 내용이 없습니다</td></tr>'}</table>
    ${R.pending.length ? `<h2>보류 / 미분류</h2><table class="data">${R.pending.map(p => `<tr class="soft"><td>${esc(p.name)} <span class="mute">×${p.qty}</span></td><td class="mute">${esc(p.why || '미분류')}</td></tr>`).join('')}</table>` : ''}
    <div class="row" style="margin-top:14px"><button id="save" class="btn primary" ${R.log.length ? '' : 'disabled'}>갱신본을 새 엑셀로 저장</button><span class="mute">원본 도구 목록은 그대로 두고, 갱신된 목록과 변경이력 시트가 든 새 파일을 만듭니다. 저장하면 이 청구들은 "반영함"으로 기억합니다.</span></div>`;
  }

  root.onclick = async e => {
    const t = e.target, d = t.dataset, seg = t.closest('.seg');
    if (d.tab) { S.tab = d.tab; return draw(); }
    if (t.id === 'mqBtn' && S.sel) { const q = Number(root.querySelector('#mq').value); S.manual = S.manual.filter(m => m.id !== S.sel); const it = byId(S.sel); if (Number.isFinite(q) && q !== it.qty) S.manual.push({ id: S.sel, op: 'qty', qty: q }); return pList(); }
    if (t.id === 'retBtn' && S.sel) { const has = S.manual.some(m => m.id === S.sel && m.op === 'retire'); S.manual = S.manual.filter(m => m.id !== S.sel); if (!has) S.manual.push({ id: S.sel, op: 'retire' }); return pList(); }
    const row = t.closest('[data-row]'); if (row) { S.sel = Number(row.dataset.row); return pList(); }
    if (seg && seg.id === 'secSeg' && d.v) { S.sec = d.v; return pList(); }
    if (seg && seg.id === 'kindSeg' && d.v) { S.kind = d.v; return pList(); }
    if (seg && seg.id === 'flSeg' && d.v) { S.fl = d.v; return pList(); }
    if (seg && seg.id === 'viewSeg' && d.v) { S.view = d.v; return pImp(); }
    if (seg && seg.classList.contains('act') && d.a) { const id = seg.dataset.act, cur = S.act[id] || {}; S.act[id] = { ...cur, action: cur.action === d.a ? '' : d.a }; persist(); const y = scrollY; pImp(); draw.tabLabel?.(); root.querySelectorAll('.tabs button')[1].textContent = `② 청구서 가져오기·분류${pending() ? ` · 미분류 ${pending()}` : ''}`; return; }
    const chip = t.closest('[data-sheet]'); if (chip) { S.pick = chip.dataset.sheet; S.view = '전체'; return pImp(); }
    if (t.id === 'save') { const p = await invoke('inventory:save', { items: S.res.items, log: S.res.log, sheets: [S.pick] }); if (p) { Hub.saved(p); S.sheets.forEach(s => { if (s.name === S.pick) s.done = new Date().toISOString().slice(0, 10); }); S.act = {}; S.manual = []; } else say('저장을 취소했습니다'); }
  };
  root.oninput = e => { if (e.target.id === 'q') { S.q = e.target.value; const p = e.target.selectionStart; pList(); const el = root.querySelector('#q'); el.focus(); el.setSelectionRange(p, p); } };
  root.onchange = e => {
    const t = e.target, d = t.dataset;
    if (d.tgt) { const it = S.items.find(i => i.name === t.value.trim()); if (it) { S.act[d.tgt] = { ...(S.act[d.tgt] || { action: '' }), matchId: it.id }; persist(); pImp(); } }
    if (d.k) { S.act[d.k] = { ...S.act[d.k], kind: t.value }; persist(); }
    if (d.s) { S.act[d.s] = { ...S.act[d.s], section: t.value }; persist(); }
  };
  load();
} });
