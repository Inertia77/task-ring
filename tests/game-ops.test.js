const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../assets/js/game-ops-core');
const now=Date.parse('2026-10-07T07:00:00Z');
const row=(key,extra={})=>({task_key:key,task_name:key,lifecycle_status:'ACTIVE',...extra});
test('opening and urgency use actual instants rather than stale lifecycle',()=>{
  assert.equal(C.state(row('future',{open_at:'2026-10-08T07:00:00Z'}),now),'UPCOMING');
  assert.equal(C.state(row('opened',{lifecycle_status:'UPCOMING',open_at:'2026-10-06T07:00:00Z'}),now),'ACTIVE');
  assert.equal(C.state(row('near',{deadline_at:'2026-10-07T12:00:00Z'}),now),'ENDING_SOON');
  assert.equal(C.state(row('claim',{claim_end_at:'2026-10-09T06:00:00Z'}),now),'ENDING_SOON');
  assert.equal(C.state(row('expired',{deadline_at:'2026-10-07T06:00:00Z'}),now),'EXPIRED');
  assert.equal(C.state(row('archived',{archived_at:'2026-10-07T06:00:00Z'}),now),'ARCHIVED');
});
test('group deadline ordering includes date-only deadlines',()=>{
  const g=C.groups([row('later',{deadline_at:'2026-10-12T00:00:00Z'}),row('unknown'),row('date-only',{deadline_date:'2026-10-09'}),row('soon',{deadline_at:'2026-10-10T00:00:00Z'}),row('archived',{archived_at:'2026-10-01T00:00:00Z'})],now);
  assert.deepEqual(g.ACTIVE.map(t=>t.task_key),['date-only','soon','later','unknown']);
});
test('urgency is red within 3 days, yellow within 7 days and ignores stale unverified expiry',()=>{
  assert.equal(C.urgency(row('red',{deadline_at:'2026-10-10T00:00:00Z',verification:'CONFIRMED'}),now),'red');
  assert.equal(C.urgency(row('yellow',{deadline_at:'2026-10-13T00:00:00Z',verification:'CONFIRMED'}),now),'yellow');
  assert.equal(C.urgency(row('date-red',{deadline_date:'2026-10-10',verification:'TO_VERIFY'}),now),'red');
  assert.equal(C.urgency(row('stale',{deadline_at:'2026-10-06T00:00:00Z',verification:'TO_VERIFY'}),now),'none');
});
test('manual task converts JST once, assigns region and disallows inverted windows',()=>{
  const v={game:'NTE',task_name:'试验',task_type:'LIMITED_TIME',open_at:'2026-10-08T05:00',deadline_at:'2026-10-09T05:00'};
  const t=C.manual(v,'owner','uuid');assert.equal(t.open_at,'2026-10-07T20:00:00.000Z');assert.equal(t.server,'CN');assert.equal(t.task_key,'MANUAL|NTE|uuid');
  assert.throws(()=>C.manual({...v,deadline_at:'2026-10-07T05:00'},'owner','uuid'));
});
