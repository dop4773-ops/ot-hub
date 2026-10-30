// 평가일 관리 화면: 일반 평가 / CCRT / 산재 / 주치의 off / 규칙
Hub.register({ id: 'eval', icon: '📅', desc: '일반·CCRT·산재 평가일 초안과 규칙 점검', title: '평가일 관리', render(root) {
  const { esc, invoke, say, opts, wd, pad, tabsHtml } = Hub;
  const nm = Hub.nextMonth();
  const S = { tab: 'general', year: nm.year, month: nm.month, info: null, cfg: null, rows: { general: null, ccrt: null, sanjae: null }, counts: null, sort: false };
  const offAll = () => { const o = {}; for (const src of [S.info.sheetOff, S.cfg.offManual]) for (const [d, l] of Object.entries(src || {})) (o[d] ??= []).push(...l); return o; };
  const sev = r => r.issues.some(x => x.level === 'err') ? 2 : r.issues.length ? 1 : 0;
  const persist = () => invoke('eval:saveCfg', S.cfg);
  const ym = () => ({ year: S.year, month: S.month });

  async function load() {
    if (Hub.needFiles(['eval']).length) { root.innerHTML = Hub.missingBox(['eval']); return; }
    root.innerHTML = '<div class="mute">읽는 중…</div>';
    S.info = await invoke('eval:load'); if (S.info.error) { root.innerHTML = `<div class="warn">${esc(S.info.error)}</div>`; return; }
    S.cfg = S.info.cfg; draw();
  }
  function draw() {
    root.innerHTML = tabsHtml([['general', '일반 평가'], ['ccrt', 'CCRT'], ['sanjae', '산재(MMSE/GDS)'], ['off', '주치의 off'], ['rules', '규칙']], S.tab) + '<div id="pane"></div>';
    ({ general: pPlan, ccrt: pPlan, sanjae: pPlan, off: pOff, rules: pRules })[S.tab]();
  }
  const $p = () => root.querySelector('#pane');

  /* 계획 표 (일반·CCRT·산재 공용) */
  const NOTE = { general: '평가 종류는 시트의 평가항목에 EMR 액팅 기록(평가 처방)으로 확인된 항목을 합친 것입니다. 모든 평가일은 매월 14일 이전, 담당 주치의가 쉬는 날은 배정하지 않습니다.',
    ccrt: 'CCRT 환자와 치료요일은 작업치료현황의 CCRT 스케줄표에서, BETTER·COMCOG 환자는 제외합니다. 루틴 2개월 · 회복기 종료 전 · 퇴원 전(퇴원일은 메신저 DB) 평가를 잡습니다.',
    sanjae: '산재 환자의 MMSE/GDS 3개월 루틴입니다.' };
  function pPlan() {
    const k = S.tab, R = S.rows[k], ys = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
    const nErr = R ? R.filter(r => sev(r) === 2).length : 0, nWarn = R ? R.filter(r => sev(r) === 1).length : 0;
    const load = {}; (R || []).forEach(r => r.date && (load[r.date] = (load[r.date] || 0) + 1));
    const off = offAll(), view = R ? (S.sort ? [...R].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1) : R) : [];
    const cnt = R && k !== 'general' ? R.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}) : null;
    const sc = { 제안: '', 입력됨: '', 미배정: 'bad', 제외: 'mute', '대상 아님': 'mute' };
    $p().innerHTML = `<div class="mute">${NOTE[k]}</div>
    <div class="row"><select id="yy">${opts(ys, S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 <button id="run" class="pri">${R ? '초안 다시 만들기' : '초안 만들기'}</button>
    ${R ? `<label><input type="checkbox" id="sortD" ${S.sort ? 'checked' : ''}> 날짜순 보기</label><span>${R.length}명 ${cnt ? '· ' + Object.entries(cnt).map(([a, b]) => a + ' ' + b).join(' · ') : ''} · <span class="${nErr ? 'err' : 'ok'}">규칙 위반 ${nErr}건</span> · 확인 권장 ${nWarn}건</span>` : ''}
    ${S.counts && k === 'ccrt' ? `<span class="mute">CCRT ${S.counts.ccrt}명 · BETTER ${S.counts.better}명 · COMCOG ${S.counts.comcog}명 ${S.counts.messenger ? '' : '· 메신저 DB 미연결(퇴원 전 평가 못 잡음)'}</span>` : ''}</div>
    ${R ? `<div class="two"><div><table><tr><th>주치의</th><th>병실</th><th>환자</th>${k === 'general' ? '<th>평가항목</th>' : k === 'ccrt' ? '<th>치료요일</th>' : ''}<th>직전</th><th>이번 평가일</th>${k !== 'general' ? '<th>상태</th>' : ''}<th>사유 / 점검</th></tr>
    ${view.map(r => { const i = R.indexOf(r); const lock = ['제외', '대상 아님'].includes(r.status);
      return `<tr class="${sev(r) === 2 ? 'bad' : sev(r) ? 'soft' : sc[r.status] || ''}"><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td><td class="nw">${esc(r.name)}</td>
      ${k === 'general' ? `<td class="mute">${esc(r.items)}${r.emrAdded?.length ? ` <span class="ok">+EMR ${esc(r.emrAdded.join('/'))}</span>` : ''}</td>` : k === 'ccrt' ? `<td class="mute">${esc((r.weekdays || []).map(n => '일월화수목금토'[n]).join(''))}</td>` : ''}
      <td class="nw mute">${esc(r.prev || '')}</td><td class="nw">${lock ? '' : `<input type="date" data-n="${i}" value="${r.date || ''}"> ${r.date ? wd(r.date) : ''}`}</td>${k !== 'general' ? `<td>${esc(r.status)}</td>` : ''}
      <td>${[r.note ? `<span class="mute">${esc(r.note)}</span>` : '', ...r.issues.map(x => `<span class="${x.level === 'err' ? 'err' : 'mute'}">${esc(x.msg)}</span>`)].filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</table></div>
    <div><h2>날짜별 인원</h2><table><tr><th>날짜</th><th>인원</th><th>쉬는 주치의</th></tr>${Object.keys(load).sort().map(d => `<tr><td class="nw">${d.slice(5)} (${wd(d)})</td><td>${load[d]}</td><td class="mute">${(off[d] || []).map(x => 'RM' + x.doctor + (x.pm ? '(오후)' : '')).join(' ')}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:14px"><button id="save" class="pri">새 엑셀로 저장</button></div></div></div>` : ''}`;
  }
  async function runPlan() {
    const k = S.tab; say('만드는 중…');
    try {
      if (k === 'general') S.rows.general = await invoke('eval:general', ym());
      else if (k === 'ccrt') { const r = await invoke('eval:ccrt', ym()); if (r.error) return say(r.error, true); S.rows.ccrt = r.rows; S.counts = r.counts; }
      else S.rows.sanjae = await invoke('eval:sanjae', ym());
      say('초안을 만들었습니다');
    } catch (e) { say('실패: ' + e.message, true); }
    pPlan();
  }

  /* 주치의 off */
  function pOff() {
    const items = []; for (const [d, l] of Object.entries(S.info.sheetOff)) l.forEach(x => items.push({ d, ...x, src: 'sheet' }));
    for (const [d, l] of Object.entries(S.cfg.offManual)) l.forEach((x, i) => items.push({ d, ...x, src: 'man', i }));
    items.sort((a, b) => a.d < b.d ? -1 : 1);
    $p().innerHTML = `<div class="mute">쉬는 주치의의 담당 환자는 그날 평가일로 잡지 않습니다. 시트 달력(${S.info.calendar.year}년 ${S.info.calendar.month}월)은 재활평가관리 파일의 U:AA 영역에서 읽습니다.</div>
    <h2>쉬는 날 추가</h2><div class="row"><input type="date" id="offDate"> 주치의 RM <select id="offDoc">${opts(['4', '6', '7', '8', '9'], '4')}</select><label><input type="checkbox" id="offPm"> 오후만</label><button id="addOff" class="pri">추가</button></div>
    <table><tr><th>날짜</th><th>주치의</th><th>구분</th><th>출처</th><th></th></tr>${items.map(x => `<tr><td class="nw">${x.d} (${wd(x.d)})</td><td>RM${esc(x.doctor)}</td><td>${x.pm ? '오후' : '종일'}</td><td>${x.src === 'sheet' ? '시트 달력' : '직접 입력'}</td><td>${x.src === 'man' ? `<button data-del="${x.d}|${x.i}">삭제</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">없음</td></tr>'}</table>`;
  }

  /* 규칙 */
  function pRules() {
    const c = S.cfg, num = (g, k, label, hint = '') => `<div class="row"><label style="width:260px">${label}</label><input type="number" min="0" data-g="${g}" data-k="${k}" value="${c[g][k]}"> <span class="mute">${hint}</span></div>`;
    $p().innerHTML = `<div class="mute">바꾼 뒤 맨 아래 <b>저장</b>을 눌러야 적용됩니다.</div>
    <h2>일반 평가</h2>${num('rules', 'lastDay', '평가일은 매월 몇 일까지', '기본 14')}${num('rules', 'minGap', '직전 평가 후 최소 간격(일)', '기본 21')}${num('rules', 'maxGap', 'MBI 대상 최대 간격(일)', '평가항목에 MBI가 있으면 이 안에 평가 (기본 30)')}${num('rules', 'idealGap', '이상적인 간격(일)', '기본 28')}${num('rules', 'cap', '하루 평가 인원 상한', '0이면 자동')}
    <div class="row"><label style="width:260px">오후만 쉬는 주치의</label><label><input type="checkbox" id="pmBlocks" ${c.rules.pmBlocks ? 'checked' : ''}> 그날 전체를 평가 금지로 처리</label></div>
    <h2>CCRT</h2>${num('ccrt', 'gapTarget', '루틴 목표 간격(일)', '2개월 ≈ 60')}${num('ccrt', 'minGap', '루틴 최소(일)', '')}${num('ccrt', 'maxGap', '루틴 최대(일)', '')}
    <h2>산재(MMSE/GDS)</h2>${num('sanjae', 'gapTarget', '목표 간격(일)', '3개월 ≈ 91')}${num('sanjae', 'minGap', '최소(일)', '')}${num('sanjae', 'maxGap', '최대(일)', '')}${num('sanjae', 'lastDay', '매월 몇 일까지', '')}
    <h2>휴무일 (한 줄에 하나, 예: 2026-12-25)</h2><textarea id="holidays" rows="5" cols="28" style="font:inherit;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:5px;padding:6px">${esc(c.rules.holidays.join('\n'))}</textarea>
    <div class="row" style="margin-top:14px"><button id="saveRules" class="pri">저장</button></div>`;
  }

  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.tab) { S.tab = d.tab; return draw(); }
    if (t.id === 'run') return runPlan();
    if (t.id === 'save') { const k = S.tab, p = await invoke('eval:save', { kind: k, rows: S.rows[k], ...ym() }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
    if (t.id === 'addOff') { const dt = root.querySelector('#offDate').value; if (!dt) return say('날짜를 고르세요', true); (S.cfg.offManual[dt] ??= []).push({ doctor: root.querySelector('#offDoc').value, pm: root.querySelector('#offPm').checked }); await persist(); S.rows = { general: null, ccrt: null, sanjae: null }; pOff(); }
    if (d.del) { const [dt, i] = d.del.split('|'); S.cfg.offManual[dt].splice(+i, 1); if (!S.cfg.offManual[dt].length) delete S.cfg.offManual[dt]; await persist(); S.rows = { general: null, ccrt: null, sanjae: null }; pOff(); }
    if (t.id === 'saveRules') { S.cfg.rules.pmBlocks = root.querySelector('#pmBlocks').checked; S.cfg.rules.holidays = root.querySelector('#holidays').value.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)); await persist(); S.rows = { general: null, ccrt: null, sanjae: null }; say('규칙을 저장했습니다'); }
  };
  root.oninput = e => { const d = e.target.dataset; if (d.g) S.cfg[d.g][d.k] = Number(e.target.value); };
  root.onchange = async e => {
    const t = e.target;
    if (t.id === 'yy') { S.year = +t.value; S.rows = { general: null, ccrt: null, sanjae: null }; pPlan(); }
    if (t.id === 'mm') { S.month = +t.value; S.rows = { general: null, ccrt: null, sanjae: null }; pPlan(); }
    if (t.id === 'sortD') { S.sort = t.checked; pPlan(); }
    if (t.dataset.n != null) {
      const k = S.tab, R = S.rows[k]; R[+t.dataset.n].date = t.value || null;
      const iss = await invoke({ general: 'eval:generalCheck', ccrt: 'eval:ccrtCheck', sanjae: 'eval:sanjaeCheck' }[k], { rows: R, ...ym() }); R.forEach((r, i) => r.issues = iss[i]);
      const y = scrollY; pPlan(); scrollTo(0, y);
    }
  };
  load();
} });
