// 균등 배정: 사람×역할종류 과거 횟수가 적은 쪽 우선 + 직전 분기 같은 구역 회피.
// 무작위 시작 greedy를 여러 번 돌려 비용이 가장 낮은 것을 고른다. (ponytail: 최적해 보장 X, 인원 30명 규모면 충분)
const { categoryOf } = require('./history');

const zoneKey = z => /스테이션|복도/.test(z) ? '스테이션' : /인지|연하/.test(z) ? '인지연하'
  : /도구장/.test(z) ? '도구장' : /공용/.test(z) ? '공용공간' : /작업치료실/.test(z) ? '작업치료실'
  : /트롤리/.test(z) ? '트롤리' : z;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const expand = slots => slots.flatMap(s => Array.from({ length: s.n }, () => ({ zone: s.zone, role: s.role, category: s.category, zk: zoneKey(s.zone) })));

// history: parseSheet rows 중 이력으로 쓸 것. lastRows: 직전 분기 rows(구역 회피용).
function countsOf(history) {
  const c = {};
  for (const r of history) { c[r.name] ??= {}; c[r.name][r.category] = (c[r.name][r.category] || 0) + 1; }
  return c;
}

// zoneNovelty: 같은 구역을 많이 해 본 사람일수록 그 구역 비용을 키워 '해 보지 않은 곳'으로 가게 한다 (0이면 무시)
function assign({ slots, people, history, lastRows = [], tries = 3000, seed = 1, zoneWeight = 30, zoneNovelty = 3 }) {
  const cells = expand(slots);
  if (people.length < cells.length) throw new Error(`인원(${people.length}) < 칸(${cells.length})`);
  const cnt = countsOf(history);
  const zcnt = {};
  for (const r of history) { const z = (zcnt[r.name] ??= {}); const k = zoneKey(r.zone); z[k] = (z[k] || 0) + 1; }
  const lastZone = {};
  for (const r of lastRows) (lastZone[r.name] ??= new Set()).add(zoneKey(r.zone));
  const cost = (p, c) => ((cnt[p]?.[c.category] || 0) ** 2) + zoneNovelty * ((zcnt[p]?.[c.zk] || 0) ** 2) + (lastZone[p]?.has(c.zk) ? zoneWeight : 0);
  const rnd = mulberry32(seed);
  let best = null;
  for (let t = 0; t < tries; t++) {
    const order = cells.map((_, i) => i).sort(() => rnd() - 0.5);
    const pool = [...people].sort(() => rnd() - 0.5);
    const out = new Array(cells.length); let total = 0;
    for (const i of order) {
      let bi = 0, bc = Infinity;
      pool.forEach((p, k) => { const v = cost(p, cells[i]); if (v < bc) { bc = v; bi = k; } });
      out[i] = pool.splice(bi, 1)[0]; total += bc;
    }
    if (!best || total < best.total) best = { total, out, spare: pool };
  }
  return { cells: cells.map((c, i) => ({ ...c, name: best.out[i] })), spare: best.spare, total: best.total };
}

// 사람×구역 횟수 (화면의 '과거 횟수' 표용)
function zoneCounts(history) { const z = {}; for (const r of history) { (z[r.name] ??= {}); const k = zoneKey(r.zone); z[r.name][k] = (z[r.name][k] || 0) + 1; } return z; }

module.exports = { assign, expand, zoneKey, countsOf, zoneCounts, categoryOf };
