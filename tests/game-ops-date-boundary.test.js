'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../assets/js/game-ops-core');

const clock=dayTime=>Date.parse(dayTime);
const base={task_key:'jst-day-regression',lifecycle_status:'UPCOMING',verification:'CONFIRMED',task_name:'date test'};

test('an event opens on its JST calendar date regardless of unverified exact start hour',()=>{
  const task={...base,open_at:'2026-11-05T23:00:00+09:00',deadline_date:'2026-11-16'};
  assert.equal(core.state(task,clock('2026-11-04T23:59:59+09:00')),'UPCOMING');
  assert.equal(core.state(task,clock('2026-11-05T00:00:00+09:00')),'ACTIVE');
  assert.equal(core.state(task,clock('2026-11-05T12:00:00+09:00')),'ACTIVE');
});
test('the full JST deadline date remains available even if timestamp was earlier',()=>{
  const task={...base,open_date:'2026-11-01',deadline_at:'2026-11-05T01:00:00+09:00'};
  assert.equal(core.state(task,clock('2026-11-05T23:59:59+09:00')),'ENDING_SOON');
  assert.equal(core.daysUntilEnd(task,clock('2026-11-05T18:00:00+09:00')),0);
  assert.equal(core.state(task,clock('2026-11-06T00:00:00+09:00')),'EXPIRED');
  assert.equal(task.deadline_at,'2026-11-05T01:00:00+09:00');
});
test('explicit calendar dates remain authoritative when provided',()=>{
  const task={...base,open_date:'2026-11-05',open_at:'2026-11-06T12:00:00+09:00',deadline_date:'2026-11-10',deadline_at:'2026-11-09T01:00:00+09:00'};
  assert.equal(core.taskStartDay(task),'2026-11-05');
  assert.equal(core.taskEndDay(task),'2026-11-10');
  assert.equal(core.state(task,clock('2026-11-05T12:00:00+09:00')),'ACTIVE');
  assert.equal(core.state(task,clock('2026-11-10T23:00:00+09:00')),'ENDING_SOON');
});
test('unknown dates keep conservative lifecycle status',()=>{
  const task={...base};
  assert.equal(core.state(task,clock('2026-11-05T12:00:00+09:00')),'UPCOMING');
  assert.equal(core.daysUntilEnd(task),null);
});
