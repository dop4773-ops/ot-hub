// 모듈 등록부. 각 모듈 = { id, title, register({ ipc, settings, dialog }) } — register에서 'id:action' 채널을 등록한다.
module.exports = ['cleaning', 'roster', 'eval', 'sci', 'attendance', 'fall', 'inventory'].map(id => require(`./${id}/index.js`));
