// SCI 비회복기 명단 화면
Hub.register({ id: 'sci', title: 'SCI 비회복기 명단', render(root) {
  const { esc, invoke, say, opts } = Hub, S = { month: Hub.nextMonth().month, sheets: [], prev: '', res: null };
  async function load() {
    if (Hub.needFiles(['status', 'eval']).length) { root.innerHTML = Hub.missingBox(['status', 'eval']); return; }
    S.sheets = await invoke('sci:sheets'); const p = `${S.month - 1 || 12}월`; S.prev = S.sheets.includes(p) ? p : S.sheets[S.sheets.length - 1] || ''; draw();
  }
  function draw() {
    const R = S.res;
    root.innerHTML = `<div class="row"><select id="mon">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 명단 이전 달 시트 <select id="prev"><option value="">없음</option>${opts(S.sheets, S.prev)}</select><button id="run" class="pri">${R ? '다시 만들기' : '명단 만들기'}</button></div>
    <div class="mute">작업치료현황 현황판에서 척수손상 색(주황)으로 칠해진 '일반' 환자, 또는 평가항목에 SCIM이 있는 비회복기 입원 환자입니다. 순서는 이전 달 명단을 따릅니다. '근거' 열이 한쪽뿐이면 확인해 보세요.</div>
    ${R ? `<h2>${R.rows.filter(r => !r.off).length}명</h2><table><tr><th>제외</th><th>번호</th><th>의사</th><th>병실</th><th>성명</th><th>근거</th><th>비고</th><th>확인</th></tr>
    ${R.rows.map((r, i) => `<tr class="${r.off ? 'mute' : r.warn || r.via !== '색상+SCIM' ? 'soft' : ''}"><td><input type="checkbox" data-off="${i}" ${r.off ? 'checked' : ''}></td><td>${i + 1}</td><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td>
      <td class="nw">${esc(r.name)} ${r.isNew ? '<span class="ok">신규</span>' : ''}</td><td class="mute">${esc(r.via)}</td><td><input data-memo="${i}" value="${esc(r.memo)}" size="22"></td><td class="warn">${esc(r.warn)}</td></tr>`).join('')}</table>
    <h2>이전 달에서 빠진 사람</h2><div>${R.left.map(x => `<span class="chip">${esc(x.name)} — ${esc(x.why)}</span>`).join(' ') || '<span class="mute">없음</span>'}</div>
    <h2>곧 비회복기로 넘어올 사람 (회복기 180일 도달)</h2><table><tr><th>성명</th><th>RM</th><th>병실</th><th>입원일</th><th>180일 도달</th></tr>${R.soon.map(x => `<tr><td>${esc(x.name)}</td><td>RM${esc(x.doctor)}</td><td>${esc(x.room)}</td><td>${esc(x.admitted)}</td><td>${esc(x.until)}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:14px"><button id="save" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  root.onchange = e => { const t = e.target; if (t.id === 'mon') { S.month = +t.value; load(); } if (t.id === 'prev') S.prev = t.value; if (t.dataset.off != null) { S.res.rows[+t.dataset.off].off = t.checked; draw(); } };
  root.oninput = e => e.target.dataset.memo != null && (S.res.rows[+e.target.dataset.memo].memo = e.target.value);
  root.onclick = async e => {
    if (e.target.id === 'run') { say('만드는 중…'); const r = await invoke('sci:run', { prevSheet: S.prev }); if (r.error) return say(r.error, true); S.res = r; say('명단을 만들었습니다'); draw(); }
    if (e.target.id === 'save') { const p = await invoke('sci:save', { month: S.month, rows: S.res.rows.filter(r => !r.off) }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
  };
  load();
} });
