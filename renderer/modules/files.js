// 파일 연결: 모든 모듈이 같이 쓰는 파일 역할(작업치료현황, 재활평가관리 …)을 한 곳에서 지정한다.
Hub.register({ id: 'files', title: '파일 연결', render(root) {
  const { esc, invoke, say, state } = Hub, R = state.roles;
  const draw = () => {
    const S = state.settings;
    root.innerHTML = `<div class="mute">모든 기능이 같은 파일 연결을 씁니다. PC마다 경로가 달라서 여기서 한 번만 지정하면 됩니다.</div>
    ${Object.entries(R).map(([k, r]) => `<h2>${esc(r.label)}</h2><div class="mute">${esc(r.hint)}</div>
      <div class="row"><button data-find="${k}" class="pri">폴더에서 찾기</button><button data-pick="${k}">파일 직접 선택</button>${S.files[k] ? `<button data-clr="${k}">연결 해제</button>` : ''}
      <span class="${S.files[k] ? 'ok' : 'mute'}">${esc(S.files[k] || '연결 안 됨')}</span></div>
      ${(draw.cand?.[k] || []).length > 1 ? `<div class="row">후보 <select data-cand="${k}">${draw.cand[k].map(f => `<option>${esc(f)}</option>`).join('')}</select></div>` : ''}`).join('')}
    <h2>EMR 치료 내역 (액팅오류 파일)</h2><div class="mute">신환 평가항목·평가 액팅 확인에 씁니다. 기간을 정해 뽑은 파일을 여러 개 올릴 수 있습니다.</div>
    <div class="row"><button id="addEmr" class="pri">파일 추가</button><button id="clrEmr">모두 지우기</button></div>
    <table>${S.emr.map((f, i) => `<tr><td>${esc(f)}</td><td><button data-rm="${i}">빼기</button></td></tr>`).join('') || '<tr><td class="mute">없음</td></tr>'}</table>
    <h2>설정 옮기기</h2><div class="row"><button id="exp">설정 내보내기</button><button id="imp">설정 가져오기</button><span class="mute">다른 PC로 옮길 때 — 그 PC에 없는 경로는 자동으로 빠집니다</span></div>`;
  };
  const set = async (k, p) => { state.settings = await invoke('app:setFile', k, p); draw(); };
  root.onclick = async e => {
    const t = e.target, d = t.dataset;
    if (d.find) { const r = await invoke('app:findFiles', d.find); if (!r) return; (draw.cand ??= {})[d.find] = r; r.length ? set(d.find, r[0]) : (say('파일을 찾지 못했습니다', true), draw()); }
    if (d.pick) { const f = await invoke('app:pickFile', d.pick); f && set(d.pick, f); }
    if (d.clr) set(d.clr, null);
    if (d.rm != null) { const l = state.settings.emr.filter((_, i) => i !== +d.rm); state.settings = await invoke('app:setEmr', l); draw(); }
    if (t.id === 'addEmr') { const f = await invoke('app:pickEmr'); if (f) { state.settings = await invoke('app:setEmr', [...new Set([...state.settings.emr, ...f])]); draw(); } }
    if (t.id === 'clrEmr') { state.settings = await invoke('app:setEmr', []); draw(); }
    if (t.id === 'exp') { const p = await invoke('app:exportSettings'); p && say('저장했습니다: ' + p); }
    if (t.id === 'imp') { const s = await invoke('app:importSettings'); if (s) { state.settings = s; say('설정을 가져왔습니다'); draw(); } }
  };
  root.onchange = e => e.target.dataset.cand && set(e.target.dataset.cand, e.target.value);
  draw();
} });
