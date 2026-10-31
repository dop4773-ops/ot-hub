// 앱 셸: 사이드바 + 모듈 등록. 모듈 화면은 renderer/modules/<id>.js 에서 Hub.register({id,title,render})로 등록한다.
// rehab-hub로 합칠 때: render(root) 한 함수가 도구 페이지 한 장에 해당하고, Hub.invoke는 window.rehab.* 호출로 바꾼다.
const Hub = (() => {
  const mods = [], state = { cur: null, settings: null, roles: null };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const wd = d => WD[new Date(d + 'T00:00:00Z').getUTCDay()];
  const pad = n => String(n).padStart(2, '0');
  const opts = (list, cur) => list.map(x => `<option ${String(x) === String(cur) ? 'selected' : ''}>${esc(x)}</option>`).join('');
  let msgTimer; const say = (t, bad) => { const m = document.getElementById('msg'); m.textContent = t; m.className = 'show' + (bad ? ' warn' : ''); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.className = '', bad ? 9000 : 5000); };
  // 오류가 나면 무엇이 실패했는지 위쪽 알림으로 보여 준다(호출한 쪽은 그대로 예외를 받는다)
  const cleanMsg = m => String(m || '알 수 없는 오류').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  const invoke = async (ch, ...a) => { try { return await hub.invoke(ch, ...a); } catch (e) { say(cleanMsg(e && e.message), true); if (e && typeof e === 'object') e.shown = true; throw e; } };
  window.addEventListener('unhandledrejection', ev => { const e = ev.reason; if (e && e.shown) return; say('문제가 생겼습니다: ' + cleanMsg(e && e.message || e), true); });
  // 마지막에 고른 값(층·내보내기 선택 등) 기억 — 저장소를 못 쓰는 환경에서는 조용히 기본값
  const pref = { get: (k, d) => { try { const v = localStorage.getItem('othub.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('othub.' + k, JSON.stringify(v)); } catch { /* 무시 */ } } };
  // 저장 끝 안내: 파일 이름 + 폴더 열기
  const saved = p => { if (!p) return say('저장을 취소했습니다'); const m = document.getElementById('msg'); m.innerHTML = `✅ 저장했습니다 <code>${esc(String(p).split(/[\\/]/).pop())}</code> <button id="msgOpen" class="btn">폴더 열기</button>`; m.className = 'show'; m.querySelector('#msgOpen').onclick = () => invoke('app:reveal', p); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.className = '', 12000); };
  // 공통 공휴일: { 'YYYY-MM-DD': '이름' } 한 벌을 모든 화면이 같이 쓴다. prefix('2026-11' 또는 '2026-')에 해당하는 항목만 text(한 줄에 '날짜 이름')로 바꿔 저장.
  const holidayLines = (prefix) => Object.entries((state.settings && state.settings.holidays) || {}).filter(([d]) => d.startsWith(prefix)).sort().map(([d, n]) => `${d} ${n || ''}`.trim());
  const setHolidays = async (prefix, text) => {
    const old = (state.settings && state.settings.holidays) || {}, cur = { ...old }; for (const d of Object.keys(cur)) if (d.startsWith(prefix)) delete cur[d];
    for (const l of String(text).split('\n')) { const m = l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/); if (m && m[1].startsWith(prefix)) cur[m[1]] = m[2] || old[m[1]] || '공휴일'; }
    const st = await invoke('app:setHolidays', cur); state.settings = st; invalidate(); return st;
  };
  const nextMonth = () => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + 1, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 }; };
  const files = () => state.settings.files;
  const needFiles = (roles) => roles.filter(r => !state.settings.files[r]).map(r => state.roles[r].label);
  const missingBox = roles => { const m = needFiles(roles); return m.length ? `<div class="warn">먼저 「파일 연결」에서 ${m.map(esc).join(', ')} 을(를) 연결하세요.</div>` : ''; };
  // 모듈 화면 안의 탭: tabs(root, [['id','이름'], …], 현재, 바뀔 때 호출)
  const tabsHtml = (list, cur) => `<div class="tabs">${list.map(([id, n]) => `<button data-tab="${id}" class="${id === cur ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
  const register = m => mods.push(m);
  // 사이드바·상단 알림: 연결된 파일 수 (필수 = 작업치료현황·재활평가관리·청소분담표·SCI 명단·도구 목록)
  function status() {
    const must = ['status', 'eval', 'cleaning', 'sci', 'tools'], ok = must.filter(r => state.settings.files[r]).length, pill = document.getElementById('filePill');
    pill.textContent = `파일 연결 ${ok}/${must.length}`; pill.className = 'pill ' + (ok === must.length ? 'ok' : 'stale');
    document.getElementById('dot').className = 'dot' + (ok === must.length ? '' : ' warn'); document.getElementById('stText').textContent = ok === must.length ? '필수 파일 모두 연결' : '연결 안 된 파일 있음';
    document.getElementById('stSub').textContent = ok === must.length ? '' : must.filter(r => !state.settings.files[r]).map(r => state.roles[r].label).join(', ');
  }
  async function reload() { state.settings = await invoke('app:settings'); }
  // 상단 버전 알약: 업데이트 상태를 보여 주고, 준비되면 눌러서 재시작·설치
  const upd = { state: 'idle' };
  function showUpdate(u) {
    Object.assign(upd, u); const p = document.getElementById('verPill'); if (!p) return;
    const m = { dev: [`v${u.version} · 개발 실행`, ''], idle: [`v${u.version}`, ''], checking: [`v${u.version} · 업데이트 확인 중…`, ''], none: [`v${u.version} · 최신`, 'ok'],
      downloading: [`새 버전 ${u.latest || ''} 받는 중 ${u.percent || 0}%`, 'stale'], ready: [`↻ 새 버전 ${u.latest} 설치 — 클릭해 재시작`, 'stale'], error: [`v${u.version} · 업데이트 확인 실패`, 'stale'] }[u.state] || [`v${u.version}`, ''];
    p.textContent = m[0]; p.className = 'pill ' + m[1]; p.style.cursor = u.state === 'ready' ? 'pointer' : 'default'; p.title = u.message || '';
  }
  // 다른 모듈 화면을 이 안의 한 칸(el)에 끼워 넣는다(평가일 관리 안의 CCRT 탭 등). 안쪽 이벤트가 바깥 화면 핸들러로 번지지 않게 막는다.
  function mount(id, el) {
    const m = mods.find(x => x.id === id); el.innerHTML = '';
    const box = document.createElement('div'); el.appendChild(box); m.render(box);
    for (const t of ['click', 'change', 'input']) box.addEventListener(t, e => e.stopPropagation());
  }
  // 화면은 한 번만 만들어 두고 보였다 숨겼다 한다(고치던 칸·고른 값이 메뉴를 옮겨도 남는다). 파일 연결이 바뀌면 다른 화면은 지우고 다음에 새로 읽는다. Ctrl+R = 이 화면 새로 읽기.
  const roots = {};
  const invalidate = () => { for (const [id, r] of Object.entries(roots)) if (id !== state.cur) { r.remove(); delete roots[id]; } };
  async function go(id, fresh) {
    state.cur = id; await reload();
    document.querySelectorAll('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    const m = mods.find(x => x.id === id); document.getElementById('vTitle').textContent = m.title; document.getElementById('vSub').textContent = m.desc || ''; status();
    const view = document.getElementById('view');
    if (fresh && roots[id]) { roots[id].remove(); delete roots[id]; }
    if (!roots[id]) { roots[id] = document.createElement('div'); view.appendChild(roots[id]); m.render(roots[id]); }
    for (const [k, r] of Object.entries(roots)) r.hidden = k !== id;
  }
  const navIds = () => mods.filter(m => !m.hidden).map(m => m.id);
  const curRoot = () => roots[state.cur];
  // ── 단축키 (재활프로그램과 같은 규칙: Ctrl+1~ 화면 이동 · Ctrl+\ 사이드바 · Ctrl+Enter 실행 · Ctrl+E 저장 · Ctrl+R 새로 읽기 · Alt 길게 = 안내)
  const isMac = /Mac/i.test(navigator.platform), kl = k => isMac ? k.replace('Ctrl', '⌘') : k;
  const clickIn = sels => { const r = curRoot(); const el = r && sels.map(q => r.querySelector(q)).find(x => x && !x.disabled && !x.hidden); if (!el) return false; el.click(); return true; };
  const toggleSidebar = () => document.getElementById('sidebarToggle').click();
  const KEYS = () => [
    ...navIds().map((id, i) => ({ code: `Digit${(i + 1) % 10}`, keys: `Ctrl+${(i + 1) % 10}`, label: `${mods.find(x => x.id === id).title} 화면으로 이동`, nav: true, run: () => (go(id), true) })),
    { code: 'Backslash', keys: 'Ctrl+\\', label: '사이드바 접기/펼치기', run: () => (toggleSidebar(), true) },
    { code: 'Enter', keys: 'Ctrl+Enter', label: '지금 화면 실행 (다시 배정·다시 만들기)', view: true, run: () => clickIn(['[data-key="run"]', '#run']) },
    { code: 'KeyE', keys: 'Ctrl+E', label: '엑셀로 저장', view: true, run: () => clickIn(['[data-key="save"]', '#save2', '#save']) },
    { code: 'KeyR', keys: 'Ctrl+R', label: '이 화면 새로 읽기(파일을 다시 읽음)', view: true, run: () => (go(state.cur, true), true) },
  ];
  let altTimer = null, altCard = null, altCombo = false;
  const hideAlt = () => { clearTimeout(altTimer); altCard && altCard.remove(); altCard = null; };
  const showAlt = () => {
    if (altCard) return; const ks = KEYS(), m = mods.find(x => x.id === state.cur), row = x => `<div class="alt-row"><span>${esc(x.label)}</span><kbd>${esc(kl(x.keys))}</kbd></div>`;
    altCard = document.createElement('div'); altCard.className = 'alt-overlay';
    altCard.innerHTML = `<div class="alt-card"><h3>단축키</h3><div class="alt-cols"><div><div class="alt-sub first">지금 화면 · ${esc(m ? m.title : '')}</div>${ks.filter(x => x.view).map(row).join('')}<div class="alt-sub">공통</div>${ks.filter(x => !x.nav && !x.view).map(row).join('')}<div class="alt-row"><span>이름 검색 창·알림 닫기</span><kbd>Esc</kbd></div></div><div><div class="alt-sub first">화면 이동</div>${ks.filter(x => x.nav).map(row).join('')}</div></div><p class="alt-hint">Alt를 떼거나 Esc를 누르면 닫힙니다</p></div>`;
    document.body.appendChild(altCard);
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Alt') { if (!e.repeat) { altCombo = false; clearTimeout(altTimer); altTimer = setTimeout(showAlt, 500); } return; }
    if (e.altKey) altCombo = true;
    if (e.key === 'Escape') { if (altCard) hideAlt(); const m = document.getElementById('msg'); if (m.classList.contains('show')) m.className = ''; return; }
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
    const hit = KEYS().find(k => k.code === e.code);                       // e.code = 눌린 글쇠 자리 — 한글 입력 상태에서도 같다
    if (hit && hit.run() !== false) e.preventDefault();
  }, true);
  document.addEventListener('keyup', e => { if (e.key === 'Alt') { clearTimeout(altTimer); hideAlt(); } });
  window.addEventListener('blur', hideAlt);
  async function start() {
    state.roles = await invoke('app:roles'); await reload();
    const nav = document.getElementById('nav');
    nav.innerHTML = mods.filter(m => !m.hidden).map(m => (m.sep ? '<div class="nav-sep"></div>' : '') + `<div class="nav-item" data-id="${m.id}" title="${esc(m.title)}"><span class="ni">${m.icon || '•'}</span><span class="nl">${esc(m.title)}</span></div>`).join('');
    nav.onclick = e => { const it = e.target.closest('.nav-item'); it && go(it.dataset.id); };
    hub.on('app:update', showUpdate); invoke('app:updateState').then(showUpdate);
    document.getElementById('verPill').onclick = () => { if (upd.state === 'ready') invoke('app:updateInstall'); };
    document.getElementById('sidebarToggle').onclick = () => { const sb = document.getElementById('sidebar'); sb.classList.toggle('collapsed'); document.getElementById('sidebarToggle').textContent = sb.classList.contains('collapsed') ? '»' : '«'; };
    const d = new Date(); document.getElementById('todayDate').textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${WD[d.getDay()]})`;
    go(mods[0].id);
  }
  return { register, mount, start, refreshStatus: () => status(), pref, saved, holidayLines, setHolidays, invalidate, navIds, upd, showUpdate, go, reload, esc, wd, pad, opts, say, invoke, nextMonth, files, needFiles, missingBox, tabsHtml, state };
})();
