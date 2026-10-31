// 파일 연결: 모든 모듈이 같이 쓰는 파일 역할(작업치료현황, 재활평가관리 …)을 한 곳에서 지정한다.
Hub.register({ id: 'files', icon: '📦', desc: '모든 기능이 같은 파일 연결을 씁니다', title: '파일 연결', render(root) {
  const { esc, invoke, say, state } = Hub, R = state.roles;
  const draw = () => {
    const S = state.settings; Hub.invalidate(); Hub.refreshStatus();                          // 파일 연결이 바뀌면 다른 화면은 다음에 열 때 새로 읽는다
    const missing = Object.entries(R).filter(([k, r]) => !r.multi && !S.files[k]).map(([, r]) => r.label);
    const row = (title, desc, body, btns) => `<div class="st-row"><div class="st-line"><div class="t"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}${body || ''}</div><div class="st-btns">${btns || ''}</div></div></div>`;
    const list = (arr, attr) => arr.map((f, i) => `<div class="st-fold"><code>${esc(f)}</code><button class="btn" data-${attr}="${i}">빼기</button></div>`).join('') || '<div class="st-note warn">없음</div>';
    root.innerHTML = `<div class="st-panel">
    ${row('전체 자동 찾기', missing.length ? `아직 연결 안 된 파일 ${missing.length}개를 이 PC의 구글 드라이브·원드라이브·바탕화면·문서·다운로드 안(폴더 속 폴더까지)에서 찾습니다. 못 찾으면 「폴더 직접 지정」. <span class="warn">${missing.map(esc).join(' · ')}</span>` : '필요한 파일이 모두 연결되어 있습니다.', '', `<button id="autoFind" data-key="run" class="btn primary">${missing.length ? '자동으로 찾기' : '다시 찾기'}</button><button id="findAll" class="btn">폴더 직접 지정…</button>`)}
    <div class="st-sec">필요한 파일 — PC마다 경로가 달라서 여기서 한 번만 지정하면 됩니다</div>
    ${Object.entries(R).filter(([, r]) => !r.multi).map(([k, r]) => row(`${esc(r.label)} <span class="chip ${S.files[k] ? 'ok' : 'off'}"><i></i>${S.files[k] ? '연결됨' : '연결 안 됨'}</span>`, esc(r.hint),
      (S.files[k] ? `<code>${esc(S.files[k])}</code>` : '') + ((draw.cand?.[k] || []).length > 1 ? `<div class="row">후보 <select data-cand="${k}">${draw.cand[k].map(f => `<option>${esc(f)}</option>`).join('')}</select></div>` : ''),
      `<button data-find="${k}" class="btn primary">폴더에서 찾기</button><button data-pick="${k}" class="btn">파일 직접 선택</button>${S.files[k] ? `<button data-clr="${k}" class="btn">연결 해제</button>` : ''}`)).join('')}
    <div class="st-sec">월별·여러 개 파일</div>
    ${row('환자 평가명단 - POT 통합 (월별 파일)', 'OT·PT 통합 평가일입니다. <b>직전 평가일</b>을 여기서 읽고, 내보낼 때는 이 파일의 서식을 그대로 씁니다. 지난 달 파일들을 모두 올려 두세요(1차·2차 모두).', list(S.pot, 'rmp'), '<button id="addPot" class="btn primary">폴더에서 찾기</button><button id="addPotF" class="btn">파일 추가</button><button id="clrPot" class="btn">모두 지우기</button>')}
    ${row('EMR 치료 내역 (액팅오류 파일)', '신환 평가항목·평가 액팅 확인에 씁니다. 기간을 정해 뽑은 파일을 여러 개 올릴 수 있습니다.', list(S.emr, 'rm'), '<button id="addEmr" class="btn primary">파일 추가</button><button id="clrEmr" class="btn">모두 지우기</button>')}
    <div class="st-sec">공통 공휴일 — 출근부·낙상·평가일·CCRT가 모두 이 목록을 씁니다</div>
    ${row('공휴일·휴무일', '한 줄에 하나: <b>2026-12-25 성탄절</b> (이름은 생략 가능). 설날·추석·대체공휴일·선거일처럼 매년 바뀌는 날을 여기 한 번만 적으세요. 각 화면에서 고친 날짜도 이곳에 모입니다.', `<textarea id="hols" rows="6" cols="34" style="margin-top:6px">${esc(Hub.holidayLines('').join('\n'))}</textarea>`, '<button id="saveHols" class="btn primary">저장</button>')}
    <div class="st-sec">업데이트·정보</div>
    ${row('현재 버전 <span id="curVer">-</span>', '설치본은 시작할 때와 4시간마다 GitHub 릴리즈를 확인해 새 버전을 받아 둡니다. 받아 두면 위쪽 버전 표시를 눌러 재시작·설치합니다.', '<span id="updMsg" class="st-note"></span><label class="st-note"><input type="checkbox" id="autoUpd"> 자동으로 확인·받기</label>', '<button id="updCheck" class="btn">지금 확인</button><button id="updInstall" class="btn primary" hidden>재시작하고 설치</button>')}
    <div class="st-sec">설정 옮기기</div>
    ${row('설정 내보내기·가져오기', '다른 PC로 옮길 때 — 그 PC에 없는 경로는 자동으로 빠집니다', '', '<button id="exp" class="btn">설정 내보내기</button><button id="imp" class="btn">설정 가져오기</button>')}
    </div>`;
    if (typeof paintUpd === 'function') { paintUpd({ version: '-', ...Hub.upd }); invoke('app:updateState').then(paintUpd); invoke('app:autoUpdate').then(v => { const c = root.querySelector('#autoUpd'); if (c) c.checked = v; }); }
  };
  const paintUpd = u => { const g = id => root.querySelector(id); if (!g('#curVer')) return;
    g('#curVer').textContent = 'v' + u.version; g('#updInstall').hidden = u.state !== 'ready';
    g('#updMsg').textContent = ({ dev: '개발 실행 중이라 업데이트 확인을 건너뜁니다', idle: '', checking: '확인 중…', none: '최신 버전입니다', downloading: `새 버전 ${u.latest} 받는 중 ${u.percent}%`, ready: `새 버전 ${u.latest} 준비 완료`, error: '확인 실패 — ' + (u.message || '') })[u.state] || ''; };
  const set = async (k, p) => { state.settings = await invoke('app:setFile', k, p); draw(); };
  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.find) { const r = await invoke('app:findFiles', d.find); if (!r) return; (draw.cand ??= {})[d.find] = r; r.length ? set(d.find, r[0]) : (say('파일을 찾지 못했습니다', true), draw()); }
    if (d.pick) { const f = await invoke('app:pickFile', d.pick); f && set(d.pick, f); }
    if (d.clr) set(d.clr, null);
    if (d.rm != null) { const l = state.settings.emr.filter((_, i) => i !== +d.rm); state.settings = await invoke('app:setEmr', l); draw(); }
    if (t.id === 'addPot') { const r = await invoke('app:findMulti', 'pot'); if (r) { state.settings = await invoke('app:setPot', [...new Set([...state.settings.pot, ...r])]); draw(); } }
    if (t.id === 'addPotF') { const f = await invoke('app:pickEmr'); if (f) { state.settings = await invoke('app:setPot', [...new Set([...state.settings.pot, ...f])]); draw(); } }
    if (t.id === 'clrPot') { state.settings = await invoke('app:setPot', []); draw(); }
    if (d.rmp != null) { state.settings = await invoke('app:setPot', state.settings.pot.filter((_, i) => i !== +d.rmp)); draw(); }
    if (t.id === 'addEmr') { const f = await invoke('app:pickEmr'); if (f) { state.settings = await invoke('app:setEmr', [...new Set([...state.settings.emr, ...f])]); draw(); } }
    if (t.id === 'clrEmr') { state.settings = await invoke('app:setEmr', []); draw(); }
    if (t.id === 'exp') { const p = await invoke('app:exportSettings'); p && Hub.saved(p); }
    if (t.id === 'saveHols') { await Hub.setHolidays('', root.querySelector('#hols').value); say('공통 공휴일을 저장했습니다'); draw(); }
    if (t.id === 'autoFind') { say('이 PC에서 찾는 중…'); const r = await invoke('app:autoFind'); state.settings = r.settings; say(`${r.found.length}개 연결 (${(r.ms / 1000).toFixed(1)}초)${r.missing.length ? ` · 못 찾은 파일 ${r.missing.length}개` : ''}${r.timedOut ? ' · 시간이 걸려 일부만 훑었습니다' : ''}`, !!r.missing.length); draw(); }
    if (t.id === 'findAll') { const r = await invoke('app:findAll'); if (r) { state.settings = r.settings; say(`${r.found.length}개 연결${r.missing.length ? ` · 못 찾은 파일 ${r.missing.length}개` : ''}`, !!r.missing.length); draw(); } }
    if (t.id === 'imp') { const s = await invoke('app:importSettings'); if (s) { state.settings = s; say('설정을 가져왔습니다'); draw(); } }
  };
  root.addEventListener('click', e => { if (e.target.id === 'updCheck') { invoke('app:updateCheck'); } if (e.target.id === 'updInstall') invoke('app:updateInstall'); });
  root.addEventListener('change', async e => { if (e.target.id === 'autoUpd') invoke('app:setAutoUpdate', e.target.checked); });
  root.onchange = e => e.target.dataset.cand && set(e.target.dataset.cand, e.target.value);
  draw(); if (!Object.keys(state.settings.files).length && !sessionStorage.getItem('othub.autoFound')) { try { sessionStorage.setItem('othub.autoFound', '1'); } catch { /* 무시 */ } root.querySelector('#autoFind')?.click(); }      // 처음 열었는데 연결된 파일이 하나도 없으면 바로 자동으로 찾는다
  Hub.upd && paintUpd({ version: '-', ...Hub.upd }); invoke('app:updateState').then(paintUpd); invoke('app:autoUpdate').then(v => { const c = root.querySelector('#autoUpd'); if (c) c.checked = v; });
  hub.on('app:update', paintUpd);
} });
