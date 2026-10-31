// CCRT 평가일 화면: 초안(시간표 요일·BETTER/COMCOG 제외·회복기 종료/퇴원 전) / 규칙
Hub.register({ id: 'eval', icon: '🧠', desc: 'CCRT 평가일 — 치료 요일에만, 2개월 루틴 + 회복기 종료 전 + 퇴원 전 (주치의 off 무관)', title: 'CCRT 평가일', render(root) {
  const { esc, invoke, say, opts, wd, tabsHtml } = Hub, nm = Hub.nextMonth();
  const S = { tab: 'plan', year: nm.year, month: nm.month, info: null, rows: null, counts: null, sort: false };
  const sev = r => r.issues.some(x => x.level === 'err') ? 2 : r.issues.length ? 1 : 0;
  const ym = () => ({ year: S.year, month: S.month });
  async function load() {
    if (Hub.needFiles(['eval', 'status']).length) { root.innerHTML = Hub.missingBox(['eval', 'status']); return; }
    root.innerHTML = '<div class="mute">읽는 중…</div>'; S.info = await invoke('eval:load'); if (S.info.error) { root.innerHTML = `<div class="warn">${esc(S.info.error)}</div>`; return; } draw();
  }
  const draw = () => { root.innerHTML = tabsHtml([['plan', 'CCRT 평가일'], ['rules', '규칙']], S.tab) + '<div id="pane"></div>'; (S.tab === 'plan' ? pPlan : pRules)(); };
  const $p = () => root.querySelector('#pane');
  function pPlan() {
    const R = S.rows, ys = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
    const nErr = R ? R.filter(r => sev(r) === 2).length : 0, nWarn = R ? R.filter(r => sev(r) === 1).length : 0, load = {}; (R || []).forEach(r => r.date && (load[r.date] = (load[r.date] || 0) + 1));
    const cnt = R ? R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}) : null, sc = { 제안: '', 입력됨: '', 미배정: 'bad', 제외: 'mute', '대상 아님': 'mute' };
    const view = R ? (S.sort ? [...R].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1) : R) : [];
    $p().innerHTML = `<div class="mute">CCRT 환자와 치료요일은 작업치료현황의 CCRT 스케줄표에서 읽고, BETTER·COMCOG 환자는 제외합니다. 루틴은 2개월에 한 번이며 회복기 종료 전과 퇴원 전(퇴원일은 메신저 DB)에도 평가를 잡습니다. 직전 CCRT 평가일은 재활평가관리 파일의 CCRT명단(${S.info.ccrtListed}명, 가장 최근 ${esc(S.info.latest || '-')})에서 읽습니다.</div>
    <div class="row"><select id="yy">${opts(ys, S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 <button id="run" class="btn primary">${R ? '초안 다시 만들기' : '초안 만들기'}</button>
      ${R ? `<label><input type="checkbox" id="sortD" ${S.sort ? 'checked' : ''}> 날짜순</label><span>${R.length}명 · ${Object.entries(cnt).map(([a, b]) => a + ' ' + b).join(' · ')} · <span class="${nErr ? 'err' : 'ok'}">규칙 위반 ${nErr}건</span> · 확인 권장 ${nWarn}건</span><button id="save" class="btn" style="margin-left:auto">새 엑셀로 저장</button>` : ''}
      ${S.counts ? `<span class="mute">CCRT ${S.counts.ccrt}명 · BETTER ${S.counts.better}명 · COMCOG ${S.counts.comcog}명 ${S.counts.messenger ? '' : '· 메신저 DB 미연결(퇴원 전 평가 못 잡음)'}</span>` : ''}</div>
    ${R ? `<div class="two"><div class="scroll"><table class="data"><tr><th>주치의</th><th>병실</th><th>환자</th><th>치료요일</th><th>직전</th><th>이번 평가일</th><th>상태</th><th>사유 / 점검</th></tr>
    ${view.map(r => { const i = R.indexOf(r), lock = ['제외', '대상 아님'].includes(r.status); return `<tr class="${sev(r) === 2 ? 'bad' : sev(r) ? 'soft' : sc[r.status] || ''}"><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td><td class="nw"><b>${esc(r.name)}</b></td><td class="mute">${esc((r.weekdays || []).map(n => '일월화수목금토'[n]).join(''))}</td><td class="nw mute">${esc(r.prev || '')}</td>
      <td class="nw">${lock ? '' : `<input type="date" data-n="${i}" value="${r.date || ''}"> ${r.date ? wd(r.date) : ''}`}</td><td>${esc(r.status)}</td>
      <td>${[r.note ? `<span class="mute">${esc(r.note)}</span>` : '', ...r.issues.map(x => `<span class="${x.level === 'err' ? 'err' : 'mute'}">${esc(x.msg)}</span>`)].filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</table></div>
    <div><h2>날짜별 인원</h2><table class="data"><tr><th>날짜</th><th>인원</th></tr>${Object.keys(load).sort().map(d => `<tr><td class="nw">${d.slice(5)} (${wd(d)})</td><td>${load[d]}</td></tr>`).join('')}</table></div></div>` : ''}`;
  }
  function pRules() {
    const c = S.info.cfg, num = (k, label, hint) => `<div class="row"><label style="width:260px">${label}</label><input type="number" min="0" data-k="${k}" value="${c.ccrt[k]}"> <span class="mute">${hint}</span></div>`;
    $p().innerHTML = `<div class="mute">바꾼 뒤 저장해야 적용됩니다. CCRT는 14일 제한과 주치의 off를 적용하지 않습니다.</div>${num('gapTarget', '루틴 목표 간격(일)', '2개월 ≈ 60')}${num('minGap', '루틴 최소(일)', '기본 50')}${num('maxGap', '루틴 최대(일)', '기본 70')}
    <h2>휴무일 (한 줄에 하나)</h2><textarea id="holidays" rows="4" cols="28">${esc(c.holidays.join('\n'))}</textarea><div class="row" style="margin-top:14px"><button id="saveRules" class="btn primary">저장</button></div>`;
  }
  root.onclick = async e => {
    const t = e.target, d = t.dataset; if (d.tab) { S.tab = d.tab; return draw(); }
    if (t.id === 'run') { say('만드는 중…'); try { const r = await invoke('eval:ccrt', ym()); if (r.error) return say(r.error, true); S.rows = r.rows; S.counts = r.counts; say('초안을 만들었습니다'); } catch (err) { say('실패: ' + err.message, true); } pPlan(); }
    if (t.id === 'save') { const p = await invoke('eval:save', { rows: S.rows, ...ym() }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
    if (t.id === 'saveRules') { S.info.cfg.holidays = root.querySelector('#holidays').value.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)); await invoke('eval:saveCfg', S.info.cfg); S.rows = null; say('규칙을 저장했습니다'); }
  };
  root.oninput = e => { const k = e.target.dataset.k; if (k) S.info.cfg.ccrt[k] = Number(e.target.value); };
  root.onchange = async e => { const t = e.target;
    if (t.id === 'yy') { S.year = +t.value; S.rows = null; pPlan(); } if (t.id === 'mm') { S.month = +t.value; S.rows = null; pPlan(); } if (t.id === 'sortD') { S.sort = t.checked; pPlan(); }
    if (t.dataset.n != null) { S.rows[+t.dataset.n].date = t.value || null; const iss = await invoke('eval:ccrtCheck', { rows: S.rows, ...ym() }); S.rows.forEach((r, i) => r.issues = iss[i]); const y = scrollY; pPlan(); scrollTo(0, y); } };
  load();
} });
