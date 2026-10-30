// 사용: node scripts/test-staff.js "<작업치료현황.xlsx>"
const assert = require('assert'); const { sortSeniority } = require('../shared/staff');
const S = (name, rank, years, team) => ({ name, rank, years, team });
const o = sortSeniority([S('c', '사원', 3, 1), S('b', '부팀장', null, 2), S('a', '팀장', null, 2), S('d', '사원', 13, 3), S('a1', '팀장', null, 1), S('b1', '부팀장', null, 1), S('x', '실장', null, null), S('e', '사원', 3, 2)]).map(s => s.name).join(' ');
assert.strictEqual(o, 'x a1 a b1 b d c e');                       // 실장 → 1팀장 2팀장 → 1부팀장 2부팀장 → 사원(연차↓, 같으면 팀 번호순)
console.log('직급·경력 정렬 시험 OK');
