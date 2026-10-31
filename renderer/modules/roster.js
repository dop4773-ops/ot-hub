// 평가일 관리 화면 (OT·PT 통합 = POT 통합 평가명단): 평가일 명단 / 주치의 off / 규칙
Hub.register({ id: 'roster', icon: '📅', desc: '재원·신환 환자의 이번 달 평가일 — 직전 평가일은 POT 통합 파일, 14일 이전·주치의 off 회피', title: '평가일 관리', render(root) {
  const { esc, invoke, say, opts, wd, pad, tabsHtml } = Hub, now = new Date(), nm = Hub.nextMonth();
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const S = { tab: 'list', year: nm.year, month: nm.month, scope: 'all', from: ymd(new Date(nm.year, nm.month - 2, 25)), to: ymd(new Date(nm.year, nm.month - 1, 0)), res: null, info: null, sort: false };
  const offAll = () => { const o = {}; for (const src of [S.info.sheetOff, S.info.offManual]) for (const [d, l] of Object.entries(src || {})) (o[d] ??= []).push(...l); return o; };
  const persist = () => invoke('roster:saveCfg', { rules: S.info.rules, offManual: S.info.offManual });
  const issues = r => {
    const out = [], d = r.date, last = `${S.year}-${pad(S.month)}-${pad(S.info.rules.lastDay)}`; if (!d) return [{ msg: '날짜 없음' }];
    if (d.slice(0, 7) !== `${S.year}-${pad(S.month)}`) out.push({ msg: '다른 달' }); else if (d > last) out.push({ msg: `${S.info.rules.lastDay}일 초과` });
    const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w === 0 || w === 6) out.push({ msg: '주말' });
    if (S.info.rules.holidays.includes(d)) out.push({ msg: '휴무일' });
    if ((offAll()[d] || []).some(x => x.doctor === r.doctor && (S.info.rules.pmBlocks || !x.pm))) out.push({ msg: `주치의 RM${r.doctor} off` });
    if (r.prev && r.mbi && Math.round((new Date(d) - new Date(r.prev)) / 864e5) > S.info.rules.maxGap) out.push({ msg: `직전 평가로부터 ${Math.round((new Date(d) - new Date(r.prev)) / 864e5)}일 (MBI ${S.info.rules.maxGap}일 초과)` });
    return out;
  };
  async function load() { root.innerHTML = '<div class="mute">읽는 중…</div>'; S.info = await invoke('roster:load'); draw(); }
  function draw() { root.innerHTML = tabsHtml([['list', '평가일 명단'], ['off', '주치의 off'], ['rules', '규칙']], S.tab) + '<div id="pane"></div>'; ({ list: pList, off: pOff, rules: pRules })[S.tab](); }
  const $p = () => root.querySelector('#pane');

  function pList() {
    if (Hub.needFiles(['status']).length) { $p().innerHTML = Hub.missingBox(['status']); return; }
    const R = S.res, nErr = R ? R.rows.filter(r => issues(r).length).length : 0, noPot = !S.info.pot.length;
    const view = R ? (S.sort ? R.rows : R.rows) : [];
    $p().innerHTML = `${noPot ? '<div class="box warnbox"><b>POT 통합 평가명단 파일이 연결되지 않았습니다.</b> 「파일 연결」에서 지난 달 파일들을 연결하면 재원 환자의 직전 평가일을 읽고, 내보낼 때 그 서식을 그대로 씁니다.</div>' : `<div class="mute">직전 평가일: POT 통합 파일 ${S.info.pot.length}개(${S.info.pot.map(p => esc(p.month || '?')).join(', ')} · 환자 ${S.info.potCount}명) · EMR 평가 기록 파일 ${S.info.emrFiles}개</div>`}
    <div class="row"><select id="yy">${opts([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 평가일
      <div class="seg" id="scopeSeg">${[['all', '전체'], ['existing', '재원(1차)'], ['new', '신환(2차)']].map(([v, l]) => `<button data-v="${v}" class="${v === S.scope ? 'active' : ''}">${l}</button>`).join('')}</div>
      신환 입원일 <input type="date" id="from" value="${S.from}"> ~ <input type="date" id="to" value="${S.to}"><button id="run" class="btn primary">${R ? '다시 만들기' : '명단 만들기'}</button></div>
    ${R ? `<div class="strip"><b>${R.rows.length}명</b><span>재원 ${R.rows.filter(r => !r.isNew).length} · 신환 ${R.rows.filter(r => r.isNew).length}</span><span class="${nErr ? 'err' : 'ok'}">규칙 위반 ${nErr}건</span><span class="mute">EMR 평가 확인 ${R.emr.patients}명${R.emr.from ? ` (${esc(R.emr.from)}${R.emr.to && R.emr.to !== R.emr.from ? '~' + esc(R.emr.to) : ''})` : ''}</span><button id="save" class="btn primary" style="margin-left:auto">POT 통합 서식으로 저장</button></div>
    <div class="scroll"><table class="data"><tr><th>주치의</th><th>병실</th><th>환자</th><th></th><th>직전</th><th>평가항목(PT)</th><th>평가항목(OT)</th><th>평가일</th><th>비고 / 점검</th></tr>
    ${view.map((r, i) => { const is = issues(r); return `<tr class="${is.length ? 'bad' : r.notes.filter(n => !/이미 입력|EMR 평가 기록 없음/.test(n)).length ? 'soft' : ''}"><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td><td class="nw"><b>${esc(r.name)}</b></td><td>${r.isNew ? '<span class="badge orange">신환</span>' : ''}</td><td class="nw mute">${esc(r.prev || '')}</td>
      <td><input data-f="pt|${i}" value="${esc(r.pt)}" size="32"></td><td><input data-f="ot|${i}" value="${esc(r.ot)}" size="22"></td><td class="nw"><input type="date" data-d="${i}" value="${r.date || ''}"> ${r.date ? wd(r.date) : ''}</td>
      <td>${is.map(x => `<span class="err">${esc(x.msg)}</span>`).join(' · ')} ${r.notes.map(n => `<span class="mute">${esc(n)}</span>`).join(' · ')}</td></tr>`; }).join('')}</table></div>` : '<div class="mute" style="margin-top:12px">월을 고르고 "명단 만들기"를 누르세요. 재원 환자는 직전 평가일에서 한 달 뒤쯤, 신환은 입원 후 17일쯤으로 14일 이전 평일에 잡습니다.</div>'}`;
  }
  function pOff() {
    const I = S.info, items = []; for (const [d, l] of Object.entries(I.sheetOff)) l.forEach(x => items.push({ d, ...x, src: 'sheet' })); for (const [d, l] of Object.entries(I.offManual)) l.forEach((x, i) => items.push({ d, ...x, src: 'man', i })); items.sort((a, b) => a.d < b.d ? -1 : 1);
    $p().innerHTML = `<div class="mute">쉬는 주치의의 담당 환자는 그날 평가일로 잡지 않습니다(일반 평가만 — CCRT는 해당 없음). 시트 달력${I.calendar ? `(${I.calendar.year}년 ${I.calendar.month}월)` : ''}은 재활평가관리 파일의 당직의/오프 칸에서 읽습니다.</div>
    <h2>쉬는 날 추가</h2><div class="row"><input type="date" id="offDate"> 주치의 RM <select id="offDoc">${opts(['4', '6', '7', '8', '9'], '4')}</select><label><input type="checkbox" id="offPm"> 오후만</label><button id="addOff" class="btn primary">추가</button></div>
    <table class="data"><tr><th>날짜</th><th>주치의</th><th>구분</th><th>출처</th><th></th></tr>${items.map(x => `<tr><td class="nw">${x.d} (${wd(x.d)})</td><td>RM${esc(x.doctor)}</td><td>${x.pm ? '오후' : '종일'}</td><td>${x.src === 'sheet' ? '시트 달력' : '직접 입력'}</td><td>${x.src === 'man' ? `<button data-del="${x.d}|${x.i}">삭제</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">없음</td></tr>'}</table>`;
  }
  function pRules() {
    const r = S.info.rules, num = (k, label, hint) => `<div class="row"><label style="width:260px">${label}</label><input type="number" min="0" data-k="${k}" value="${r[k]}"> <span class="mute">${hint}</span></div>`;
    $p().innerHTML = `<div class="mute">바꾼 뒤 맨 아래 <b>저장</b>을 눌러야 적용됩니다.</div>${num('lastDay', '평가일은 매월 몇 일까지', '기본 14')}${num('monthGap', '재원 환자 이상적 간격(일)', '직전 평가일 + 약 한 달 (기본 28)')}${num('minGap', '직전 평가 후 최소 간격(일)', '기본 21')}${num('maxGap', 'MBI 대상 최대 간격(일)', '평가항목에 MBI가 있으면 이 안에 (기본 30)')}${num('idealGap', '신환: 입원 후 며칠째', '기본 17')}${num('cap', '하루 평가 인원 상한', '0이면 자동')}
    <div class="row"><label style="width:260px">오후만 쉬는 주치의</label><label><input type="checkbox" id="pmBlocks" ${r.pmBlocks ? 'checked' : ''}> 그날 전체를 평가 금지로 처리</label></div>
    <h2>휴무일 (한 줄에 하나, 예: 2026-12-25)</h2><textarea id="holidays" rows="5" cols="28">${esc(r.holidays.join('\n'))}</textarea>
    <div class="row" style="margin-top:14px"><button id="saveRules" class="btn primary">저장</button></div>`;
  }
  root.onclick = async e => {
    const t = e.target, d = t.dataset, seg = t.closest('.seg');
    if (d.tab) { S.tab = d.tab; return draw(); }
    if (seg && seg.id === 'scopeSeg' && d.v) { S.scope = d.v; S.res = null; return pList(); }
    if (t.id === 'run') { say('만드는 중…'); try { const r = await invoke('roster:run', { from: S.from, to: S.to, year: S.year, month: S.month, scope: S.scope }); if (r.error) return say(r.error, true); S.res = r; say(`${r.rows.length}명의 초안을 만들었습니다`); } catch (err) { say('실패: ' + err.message, true); } pList(); }
    if (t.id === 'save') { const p = await invoke('roster:save', { month: S.month, batch: S.scope === 'new' ? `2차 명단(${+S.from.slice(8)}일~${+S.to.slice(8)}일 입원자)` : '', rows: S.res.rows }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
    if (t.id === 'addOff') { const dt = root.querySelector('#offDate').value; if (!dt) return say('날짜를 고르세요', true); (S.info.offManual[dt] ??= []).push({ doctor: root.querySelector('#offDoc').value, pm: root.querySelector('#offPm').checked }); await persist(); S.res = null; pOff(); }
    if (d.del) { const [dt, i] = d.del.split('|'); S.info.offManual[dt].splice(+i, 1); if (!S.info.offManual[dt].length) delete S.info.offManual[dt]; await persist(); S.res = null; pOff(); }
    if (t.id === 'saveRules') { const r = S.info.rules; r.pmBlocks = root.querySelector('#pmBlocks').checked; r.holidays = root.querySelector('#holidays').value.split('\n').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)); await persist(); S.res = null; say('규칙을 저장했습니다'); }
  };
  root.oninput = e => { const d = e.target.dataset; if (d.k) S.info.rules[d.k] = Number(e.target.value); if (d.f) { const [k, i] = d.f.split('|'); S.res.rows[+i][k] = e.target.value; } };
  root.onchange = e => { const t = e.target;
    if (t.id === 'from') S.from = t.value; if (t.id === 'to') S.to = t.value; if (t.id === 'yy') { S.year = +t.value; S.res = null; } if (t.id === 'mm') { S.month = +t.value; S.res = null; }
    if (t.dataset.d != null) { S.res.rows[+t.dataset.d].date = t.value || null; const y = scrollY; pList(); scrollTo(0, y); } };
  load();
} });
