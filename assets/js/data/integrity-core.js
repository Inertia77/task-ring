// Pure data-integrity helpers shared by the browser sync layer and Node tests.
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TaskRingIntegrityCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const TIME_CATEGORY_ALIASES={
    create:"creator",
    creation:"creator",
    content:"creator",
    it:"it_ai",
    ai:"it_ai",
    tech:"it_ai",
    technology:"it_ai"
  };

  function canonicalTimeCategory(value,validValues,fallback="life"){
    const raw=String(value||"").trim().toLowerCase();
    const key=TIME_CATEGORY_ALIASES[raw]||raw;
    const valid=validValues instanceof Set?validValues:new Set(validValues||[]);
    return valid.has(key)?key:fallback;
  }

  function stableStringify(value){
    if(value===null||typeof value!=="object")return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(stableStringify).join(",")}]`;
    const keys=Object.keys(value).filter(key=>value[key]!==undefined&&key!=="updatedAt").sort();
    return `{${keys.map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function fnv1a(value){
    const raw=String(value||"");
    let hash=2166136261;
    for(let i=0;i<raw.length;i++){
      hash^=raw.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(36);
  }

  function configFingerprint(config){
    if(!config)return "";
    return fnv1a(stableStringify(config));
  }

  function isoMillis(value){
    const ms=Date.parse(String(value||""));
    return Number.isFinite(ms)?ms:0;
  }

  function decideConfig({local=null,remote=null,baseFingerprint=""}={}){
    if(!local&&!remote)return {source:"missing",reason:"no-config",localFingerprint:"",remoteFingerprint:""};
    const localFingerprint=configFingerprint(local);
    const remoteFingerprint=configFingerprint(remote);
    if(local&&remote&&localFingerprint===remoteFingerprint){
      return {source:"same",reason:"same-content",localFingerprint,remoteFingerprint};
    }
    if(!local)return {source:"remote",reason:"local-missing",localFingerprint,remoteFingerprint};
    if(!remote)return {source:"local",reason:"remote-missing",localFingerprint,remoteFingerprint};

    if(baseFingerprint){
      const localChanged=localFingerprint!==baseFingerprint;
      const remoteChanged=remoteFingerprint!==baseFingerprint;
      if(localChanged&&remoteChanged){
        return {source:"conflict",reason:"both-changed",localChanged,remoteChanged,localFingerprint,remoteFingerprint};
      }
      if(localChanged)return {source:"local",reason:"local-changed",localChanged,remoteChanged,localFingerprint,remoteFingerprint};
      if(remoteChanged)return {source:"remote",reason:"remote-changed",localChanged,remoteChanged,localFingerprint,remoteFingerprint};
      // A stale/corrupt baseline should never make us silently pick one side.
      return {source:"conflict",reason:"baseline-mismatch",localChanged,remoteChanged,localFingerprint,remoteFingerprint};
    }

    const localTime=isoMillis(local.updatedAt);
    const remoteTime=isoMillis(remote.updatedAt);
    if(localTime>remoteTime)return {source:"local",reason:"newer-local",localFingerprint,remoteFingerprint};
    if(remoteTime>localTime)return {source:"remote",reason:"newer-remote",localFingerprint,remoteFingerprint};
    return {source:"conflict",reason:"no-common-baseline",localFingerprint,remoteFingerprint};
  }

  function normalizeMetaEntry(entry){
    if(!entry||typeof entry!=="object")return null;
    const value=entry.value===true||entry.value===1||entry.value==="1"?"1":"0";
    return {
      value,
      updatedAt:String(entry.updatedAt||entry.updated_at||""),
      deviceId:String(entry.deviceId||entry.device_id||"")
    };
  }

  function sideRecord(key,states,meta){
    const explicit=normalizeMetaEntry(meta&&meta[key]);
    if(explicit)return {...explicit,versioned:true};
    if(states&&states[key]==="1")return {value:"1",updatedAt:"",deviceId:"",versioned:false};
    return null;
  }

  function pickStateRecord(local,remote){
    if(!local)return remote;
    if(!remote)return local;
    if(local.versioned&&remote.versioned){
      const lt=isoMillis(local.updatedAt),rt=isoMillis(remote.updatedAt);
      if(lt>rt)return local;
      if(rt>lt)return remote;
      if(local.value===remote.value)return local;
      // Equal/invalid timestamps are ambiguous: preserve the local user's state instead of deleting it silently.
      return local;
    }
    if(local.versioned&&!remote.versioned)return local;
    if(remote.versioned&&!local.versioned)return remote;
    // Legacy files encode only checked=true. Until both sides have metadata, absence must not erase a check.
    return local.value==="1"?local:remote;
  }

  function mergeStateRecords({localStates={},localMeta={},remoteStates={},remoteMeta={},migrationTime="",deviceId=""}={}){
    const keys=new Set([
      ...Object.keys(localStates||{}),...Object.keys(localMeta||{}),
      ...Object.keys(remoteStates||{}),...Object.keys(remoteMeta||{})
    ]);
    const states={};
    const stateMeta={};
    let migrated=0,localWins=0,remoteWins=0;
    keys.forEach(key=>{
      const local=sideRecord(key,localStates,localMeta);
      const remote=sideRecord(key,remoteStates,remoteMeta);
      const picked=pickStateRecord(local,remote);
      if(!picked)return;
      const wasLegacy=!picked.versioned;
      const finalRecord={
        value:picked.value,
        updatedAt:String(picked.updatedAt||migrationTime||""),
        deviceId:String(picked.deviceId||deviceId||"")
      };
      if(wasLegacy)migrated++;
      if(picked===local&&local!==remote)localWins++;
      if(picked===remote&&local!==remote)remoteWins++;
      stateMeta[key]=finalRecord;
      if(finalRecord.value==="1")states[key]="1";
    });
    return {states,stateMeta,stats:{migrated,localWins,remoteWins,total:keys.size}};
  }

  return {
    TIME_CATEGORY_ALIASES,
    canonicalTimeCategory,
    stableStringify,
    configFingerprint,
    decideConfig,
    mergeStateRecords,
    isoMillis
  };
});
