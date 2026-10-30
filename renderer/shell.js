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
  const invoke = (ch, ...a) => hub.invoke(ch, ...a);
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
  async function go(id) {
    state.cur = id; await reload();
    document.querySelectorAll('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    const m = mods.find(x => x.id === id); document.getElementById('vTitle').textContent = m.title; document.getElementById('vSub').textContent = m.desc || ''; status();
    const root = document.getElementById('view'); root.innerHTML = ''; root.onclick = root.onchange = root.oninput = null; m.render(root);
  }
  async function start() {
    state.roles = await invoke('app:roles'); await reload();
    const nav = document.getElementById('nav');
    nav.innerHTML = mods.map(m => (m.sep ? '<div class="nav-sep"></div>' : '') + `<div class="nav-item" data-id="${m.id}" title="${esc(m.title)}"><span class="ni">${m.icon || '•'}</span><span class="nl">${esc(m.title)}</span></div>`).join('');
    nav.onclick = e => { const it = e.target.closest('.nav-item'); it && go(it.dataset.id); };
    document.getElementById('sidebarToggle').onclick = () => { const sb = document.getElementById('sidebar'); sb.classList.toggle('collapsed'); document.getElementById('sidebarToggle').textContent = sb.classList.contains('collapsed') ? '»' : '«'; };
    const d = new Date(); document.getElementById('todayDate').textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${WD[d.getDay()]})`;
    go(mods[0].id);
  }
  return { register, start, go, reload, esc, wd, pad, opts, say, invoke, nextMonth, files, needFiles, missingBox, tabsHtml, state };
})();
