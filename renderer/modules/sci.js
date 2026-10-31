// SCI 비회복기 명단 화면 — 그 달(보통 이번 달 말) 명단을 만든다. 순서는 앞선 달 시트를 자동으로 따른다.
Hub.register({ id: 'sci', icon: '🩺', desc: '현황판 색상·전체시간표 카드로 비회복기 척수손상 환자 명단', title: 'SCI 비회복기 명단', render(root) {
  const { esc, invoke, say, opts } = Hub, now = new Date(), S = { month: now.getMonth() + 1, prev: '', res: null };
  async function load() {
    if (Hub.needFiles(['status', 'eval']).length) { root.innerHTML = Hub.missingBox(['status', 'eval']); return; }
    S.prev = (await invoke('sci:sheets', S.month)).prev; draw(); run(true);
  }
  async function run(quiet) { const r = await invoke('sci:run', { month: S.month }); if (r.error) return say(r.error, true); S.res = r; S.prev = r.prevSheet; if (!quiet) say('명단을 다시 만들었습니다'); draw(); }
  function draw() {
    const R = S.res;
    root.innerHTML = `<div class="row actionbar"><select id="mon">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월 명단 <button id="run" class="btn primary">${R ? '다시 만들기' : '명단 만들기'}</button>${R ? '<button id="save" class="btn" style="margin-left:auto">원본 서식으로 저장</button>' : ''}</div>
    <div class="mute">그 달 말에 그 달 명단을 만드는 용도입니다 (지금 재원 중인 비회복기 척수손상 환자). 번호 순서는 ${S.prev ? `<b>${esc(S.prev)}</b> 명단의 순서를 따르고 새로 들어온 사람은 뒤에 붙입니다` : '시트가 없어 입원일 순서로 만듭니다'}.<br>
    비회복기 판단 = ① 현황판에서 척수손상 색(주황)으로 칠해진 '일반' 환자, 또는 ② 평가항목에 SCIM이 있고 환자 전체시간표 카드가 "회복기 재활치료 스케줄"이 아닌 "재활치료 스케줄"인 환자.</div>
    ${R && !R.timetable ? '<div class="box warnbox">환자 전체시간표(10F/3F)가 연결되지 않아 ② 시간표 확인은 건너뛰고 SCIM만으로 판단했습니다. 「파일 연결」에서 연결하세요.</div>' : ''}
    ${R ? `<div class="strip"><b>${R.rows.filter(r => !r.off).length}명</b><span class="mute">'근거'가 한쪽뿐인 줄은 한 번 확인해 보세요</span></div>
    <div class="scroll"><table class="data"><tr><th>제외</th><th>번호</th><th>의사</th><th>병실</th><th>성명</th><th>근거</th><th>비고</th><th>확인</th></tr>
    ${R.rows.map((r, i) => `<tr class="${r.off ? 'mute' : r.warn || (r.via !== '색상+SCIM+시간표' && r.via !== '색상+SCIM') ? 'soft' : ''}"><td><input type="checkbox" data-off="${i}" ${r.off ? 'checked' : ''}></td><td>${i + 1}</td><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td>
      <td class="nw"><b>${esc(r.name)}</b> ${r.isNew ? '<span class="badge orange">신규</span>' : ''}</td><td class="mute">${esc(r.via)}</td><td><input data-memo="${i}" value="${esc(r.memo)}" size="22"></td><td class="warn">${esc(r.warn)}</td></tr>`).join('')}</table></div>
    <h2>${esc(R.prevSheet || '앞선 달')} 명단에서 빠진 사람</h2><div>${R.left.map(x => `<span class="chip">${esc(x.name)} — ${esc(x.why)}</span>`).join(' ') || '<span class="mute">없음</span>'}</div>
    <h2>곧 비회복기로 넘어올 사람 (회복기 180일 도달)</h2><table class="data"><tr><th>성명</th><th>RM</th><th>병실</th><th>입원일</th><th>180일 도달</th></tr>${R.soon.map(x => `<tr><td>${esc(x.name)}</td><td>RM${esc(x.doctor)}</td><td>${esc(x.room)}</td><td>${esc(x.admitted)}</td><td>${esc(x.until)}</td></tr>`).join('')}</table>` : ''}`;
  }
  root.onchange = async e => { const t = e.target; if (t.id === 'mon') { S.month = +t.value; S.res = null; S.prev = (await invoke('sci:sheets', S.month)).prev; draw(); run(true); } if (t.dataset.off != null) { S.res.rows[+t.dataset.off].off = t.checked; draw(); } };
  root.oninput = e => e.target.dataset.memo != null && (S.res.rows[+e.target.dataset.memo].memo = e.target.value);
  root.onclick = async e => {
    if (e.target.id === 'run') { say('만드는 중…'); run(false); }
    if (e.target.id === 'save') { const p = await invoke('sci:save', { month: S.month, rows: S.res.rows.filter(r => !r.off) }); Hub.saved(p); }
  };
  load();
} });
