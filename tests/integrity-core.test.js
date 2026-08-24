const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../assets/js/data/integrity-core.js");

const valid=new Set(["game","language","it_ai","science","creator","body","economy","life"]);

test("legacy time_category aliases migrate to canonical categories",()=>{
  assert.equal(Core.canonicalTimeCategory("create",valid,"life"),"creator");
  assert.equal(Core.canonicalTimeCategory("it",valid,"life"),"it_ai");
  assert.equal(Core.canonicalTimeCategory("creator",valid,"life"),"creator");
  assert.equal(Core.canonicalTimeCategory("unknown",valid,"life"),"life");
});

test("config fingerprints ignore updatedAt but detect content changes",()=>{
  const a={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"A"}],refs:[]};
  const b={updatedAt:"2026-08-24T00:00:00Z",tasks:[{id:"a",title:"A"}],refs:[]};
  const c={updatedAt:"2026-08-24T00:00:00Z",tasks:[{id:"a",title:"B"}],refs:[]};
  assert.equal(Core.configFingerprint(a),Core.configFingerprint(b));
  assert.notEqual(Core.configFingerprint(a),Core.configFingerprint(c));
});

test("three-way config merge keeps a newer local-only change",()=>{
  const base={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"base"}]};
  const local={updatedAt:"2026-08-24T01:00:00Z",tasks:[{id:"a",title:"local"}]};
  const remote={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"base"}]};
  const decision=Core.decideConfig({local,remote,baseFingerprint:Core.configFingerprint(base)});
  assert.equal(decision.source,"local");
});

test("three-way config merge accepts a remote-only change",()=>{
  const base={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"base"}]};
  const local={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"base"}]};
  const remote={updatedAt:"2026-08-24T01:00:00Z",tasks:[{id:"a",title:"remote"}]};
  const decision=Core.decideConfig({local,remote,baseFingerprint:Core.configFingerprint(base)});
  assert.equal(decision.source,"remote");
});

test("three-way config merge reports conflict when both sides changed",()=>{
  const base={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"base"}]};
  const local={updatedAt:"2026-08-24T01:00:00Z",tasks:[{id:"a",title:"local"}]};
  const remote={updatedAt:"2026-08-24T02:00:00Z",tasks:[{id:"a",title:"remote"}]};
  const decision=Core.decideConfig({local,remote,baseFingerprint:Core.configFingerprint(base)});
  assert.equal(decision.source,"conflict");
  assert.equal(decision.reason,"both-changed");
});

test("first sync uses timestamps only when no common baseline exists",()=>{
  const older={updatedAt:"2026-08-20T00:00:00Z",tasks:[{id:"a",title:"old"}]};
  const newer={updatedAt:"2026-08-24T00:00:00Z",tasks:[{id:"a",title:"new"}]};
  assert.equal(Core.decideConfig({local:newer,remote:older}).source,"local");
  assert.equal(Core.decideConfig({local:older,remote:newer}).source,"remote");
  assert.equal(Core.decideConfig({local:{...older,tasks:[{id:"a",title:"left"}]},remote:{...older,tasks:[{id:"a",title:"right"}]}}).source,"conflict");
});

test("legacy true-only states are unioned during migration",()=>{
  const result=Core.mergeStateRecords({
    localStates:{a:"1"},remoteStates:{b:"1"},migrationTime:"2026-08-24T00:00:00Z",deviceId:"dev-a"
  });
  assert.deepEqual(result.states,{a:"1",b:"1"});
  assert.equal(result.stateMeta.a.value,"1");
  assert.equal(result.stateMeta.b.value,"1");
});

test("versioned remote tombstone beats a legacy local check",()=>{
  const result=Core.mergeStateRecords({
    localStates:{a:"1"},
    remoteMeta:{a:{value:"0",updatedAt:"2026-08-24T02:00:00Z",deviceId:"remote"}},
    migrationTime:"2026-08-24T03:00:00Z",deviceId:"local"
  });
  assert.equal(result.states.a,undefined);
  assert.equal(result.stateMeta.a.value,"0");
});

test("newer local state wins over older remote tombstone",()=>{
  const result=Core.mergeStateRecords({
    localStates:{a:"1"},
    localMeta:{a:{value:"1",updatedAt:"2026-08-24T03:00:00Z",deviceId:"local"}},
    remoteMeta:{a:{value:"0",updatedAt:"2026-08-24T02:00:00Z",deviceId:"remote"}}
  });
  assert.equal(result.states.a,"1");
  assert.equal(result.stateMeta.a.deviceId,"local");
});

test("newer remote tombstone removes an older local check",()=>{
  const result=Core.mergeStateRecords({
    localStates:{a:"1"},
    localMeta:{a:{value:"1",updatedAt:"2026-08-24T02:00:00Z",deviceId:"local"}},
    remoteMeta:{a:{value:"0",updatedAt:"2026-08-24T03:00:00Z",deviceId:"remote"}}
  });
  assert.equal(result.states.a,undefined);
  assert.equal(result.stateMeta.a.value,"0");
});

test("equal-time ambiguous state conflict preserves the current local value",()=>{
  const result=Core.mergeStateRecords({
    localStates:{a:"1"},
    localMeta:{a:{value:"1",updatedAt:"2026-08-24T03:00:00Z",deviceId:"local"}},
    remoteMeta:{a:{value:"0",updatedAt:"2026-08-24T03:00:00Z",deviceId:"remote"}}
  });
  assert.equal(result.states.a,"1");
  assert.equal(result.stateMeta.a.deviceId,"local");
});
