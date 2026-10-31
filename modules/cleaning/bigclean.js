// 대청소 = 원본 '대청소' 시트의 칸 구성(bigSlots)에 맞춘 배정.
//  · 평일 배정에서 같은 구역·역할 칸의 담당자를 그대로 이어받는다(없는 칸=신규, 평일에만 있던 칸의 담당자=여유 인원)
//  · 도구장 정리/소독 담당 n명을 뽑는다. 그 사람이 이어받은 칸을 맡고 있었다면 그 칸은 비게 된다(= 지원배치가 필요한 칸)
//  · 비는 칸 + 신규 칸은 여유 인원(어느 칸도 안 맡은 사람)에게서 과거 횟수가 적은 순으로 자동 추천한다(화면에서 바꿀 수 있음)
const { countsOf, expand } = require('./assign');
const cfg = require('./slots.json').bigClean;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const norm = r => (r || '').replace(/\(.*?\)|\s/g, '');
const sameRole = (a, b) => { a = norm(a); b = norm(b); return a === b || (a && b && (a.startsWith(b) || b.startsWith(a))); };

// weekdayCells: assign() 결과. bigSlots: 원본 대청소 칸 구성. people: 이번에 근무하는 전원.
function bigClean({ weekdayCells, bigSlots, people, history, n = cfg.toolCabinetN, airFilters = cfg.airFilters, seed = 1 }) {
  const cnt = countsOf(history), rnd = mulberry32(seed);
  const cells = expand(bigSlots || weekdayCells.filter(c => c.category !== '도구장'));
  const free = weekdayCells.map(c => ({ ...c, used: false }));
  cells.forEach(c => {                                                       // 평일 담당자 이어받기
    const w = free.find(x => !x.used && x.zk === c.zk && sameRole(x.role, c.role));
    if (w) { w.used = true; c.name = w.name; c.from = '평일'; } else { c.name = ''; c.from = '신규'; }
  });
  const holders = new Set(cells.map(c => c.name).filter(Boolean));
  const tool = [...holders, ...free.filter(x => !x.used).map(x => x.name)]                  // 도구장 담당 후보 = 평일에 일하던 사람들
    .filter((v, i, a) => a.indexOf(v) === i).map(p => [p, cnt[p]?.['도구장'] || 0, rnd()])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, n).map(x => x[0]);
  cells.forEach(c => { if (tool.includes(c.name)) { c.vacated = c.name; c.name = ''; c.from = '비움'; } });
  const taken = new Set(cells.map(c => c.name).filter(Boolean));
  const spare = people.filter(p => !taken.has(p) && !tool.includes(p));
  const open = cells.map((c, i) => i).filter(i => !cells[i].name);
  for (const i of open) {                                                    // 여유 인원 자동 추천(과거 횟수 적은 순)
    if (!spare.length) break;
    let bk = 0, bv = Infinity; spare.forEach((p, k) => { const v = (cnt[p]?.[cells[i].category] || 0) + rnd() * .5; if (v < bv) { bv = v; bk = k; } });
    cells[i].name = spare.splice(bk, 1)[0]; cells[i].from = '지원';
  }
  return { tool, cells, openIdx: open, spare, airFilters };
}

module.exports = { bigClean };
