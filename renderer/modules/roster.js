// 신환 평가명단 화면
Hub.register({ id: 'roster', icon: '🆕', desc: '신환 평가항목(EMR 액팅 기록)과 평가일 초안', title: '신환 평가명단', render(root) {
  const { esc, invoke, say, opts, wd, pad } = Hub, now = new Date(), nm = Hub.nextMonth();
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const S = { year: nm.year, month: nm.month, from: ymd(new Date(now.getFullYear(), now.getMonth(), 25)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)), res: null };
  const issues = r => {
    const out = [], d = r.date, last = `${S.year}-${pad(S.month)}-${pad(S.res.lastDay)}`; if (!d) return [{ msg: '날짜 없음' }];
    if (d.slice(0, 7) !== `${S.year}-${pad(S.month)}`) out.push({ msg: '다른 달' }); else if (d > last) out.push({ msg: `${S.res.lastDay}일 초과` });
    const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w === 0 || w === 6) out.push({ msg: '주말' });
    if ((S.res.off[d] || []).some(x => x.doctor === r.doctor)) out.push({ msg: `주치의 RM${r.doctor} off` });
    return out;
  };
  function draw() {
    if (Hub.needFiles(['status']).length) { root.innerHTML = Hub.missingBox(['status']); return; }
    const R = S.res, nErr = R ? R.rows.filter(r => issues(r).length).length : 0, emrN = Hub.state.settings.emr.length;
    root.innerHTML = `<div class="row">입원일 <input type="date" id="from" value="${S.from}"> ~ <input type="date" id="to" value="${S.to}">
      평가 달 <select id="yy">${opts([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], S.year)}</select>년 <select id="mm">${opts([1,2,3,4,5,6,7,8,9,10,11,12], S.month)}</select>월
      <button id="run" class="pri">${R ? '다시 만들기' : '명단 만들기'}</button></div>
    <div class="mute">입원일이 이 기간인 입원 환자를 대상으로, 평가항목은 EMR 평가 처방(파일 연결의 EMR 치료 내역 ${emrN}개)과 환자 구분별 기본 항목으로 채웁니다. 판단이 필요한 부분은 비고에 표시됩니다.</div>
    ${R ? `<div class="row"><b>${R.rows.length}명</b> · EMR 평가 확인 환자 ${R.emr.patients}명 (${esc(R.emr.from || '내역 없음')}${R.emr.to && R.emr.to !== R.emr.from ? ' ~ ' + esc(R.emr.to) : ''}) · <span class="${nErr ? 'err' : 'ok'}">규칙 위반 ${nErr}건</span></div>
    <table><tr><th>주치의</th><th>병실</th><th>환자</th><th>입원일</th><th>평가항목(PT)</th><th>평가항목(OT)</th><th>평가일</th><th>비고 / 점검</th></tr>
    ${R.rows.map((r, i) => { const is = issues(r); return `<tr class="${is.length ? 'bad' : r.notes.length ? 'soft' : ''}"><td>RM${esc(r.doctor)}</td><td>${esc(r.room)}</td><td class="nw">${esc(r.name)}</td><td class="nw mute">${esc(r.admitted)}</td>
      <td><input data-f="pt|${i}" value="${esc(r.pt)}" size="34"></td><td><input data-f="ot|${i}" value="${esc(r.ot)}" size="24"></td><td class="nw"><input type="date" data-d="${i}" value="${r.date || ''}"> ${r.date ? wd(r.date) : ''}</td>
      <td>${is.map(x => `<span class="err">${esc(x.msg)}</span>`).join(' · ')} ${r.notes.map(n => `<span class="mute">${esc(n)}</span>`).join(' · ')}</td></tr>`; }).join('')}</table>
    <div class="row" style="margin-top:14px"><button id="save" class="pri">새 엑셀로 저장</button></div>` : ''}`;
  }
  root.onchange = e => { const t = e.target;
    if (t.id === 'from') S.from = t.value; if (t.id === 'to') S.to = t.value; if (t.id === 'yy') S.year = +t.value; if (t.id === 'mm') S.month = +t.value;
    if (t.dataset.d != null) { S.res.rows[+t.dataset.d].date = t.value || null; const y = scrollY; draw(); scrollTo(0, y); } };
  root.oninput = e => { const f = e.target.dataset.f; if (f) { const [k, i] = f.split('|'); S.res.rows[+i][k] = e.target.value; } };
  root.onclick = async e => {
    if (e.target.id === 'run') { say('만드는 중…'); try { const r = await invoke('roster:run', { from: S.from, to: S.to, year: S.year, month: S.month }); if (r.error) return say(r.error, true); S.res = r; say(`${r.rows.length}명의 명단을 만들었습니다`); } catch (err) { say('실패: ' + err.message, true); } draw(); }
    if (e.target.id === 'save') { const p = await invoke('roster:save', { month: S.month, batch: `2차 명단(${+S.from.slice(8)}일~${+S.to.slice(8)}일 입원자)`, rows: S.res.rows }); say(p ? '저장했습니다: ' + p : '저장을 취소했습니다'); }
  };
  draw();
} });
