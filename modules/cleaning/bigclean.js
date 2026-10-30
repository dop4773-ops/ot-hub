// 대청소 = 평일 배정 그대로 + 도구장 정리/소독 담당 추가 선정.
// 선정된 사람이 평일 칸(도구장 제외)을 맡고 있었다면 그 칸은 '지원배치 필요'로 비운다. (시트의 빈 칸 = 이 경우)
const { countsOf } = require('./assign');
const cfg = require('./slots.json').bigClean;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// weekdayCells: assign() 결과 cells. history: 이력 rows(도구장 횟수 집계용).
function bigClean({ weekdayCells, history, n = cfg.toolCabinetN, airFilters = cfg.airFilters, seed = 1 }) {
  const cnt = countsOf(history), rnd = mulberry32(seed);
  const people = weekdayCells.map(c => c.name);
  const tool = people.map(p => [p, cnt[p]?.['도구장'] || 0, rnd()])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, n).map(x => x[0]);
  const vacated = weekdayCells.filter(c => tool.includes(c.name) && c.category !== '도구장');
  return { tool, vacated, airFilters };
}

module.exports = { bigClean };
