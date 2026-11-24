const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../assets/js/game-play-policy.js');
const uid='owner-test';
test('separates play tier, story focus, and individual tasks',()=>{
  P.setOwner(uid);
  P.setRows([{game_key:'zzz',game_name:'游戏 A',play_tier:1,story_focus:true,sort_order:2},{game_key:'endfield',game_name:'游戏 B',play_tier:3,story_focus:true,sort_order:6}],uid);
  assert.equal(P.get({id:'zzz'}).tier,1);
  assert.equal(P.get({id:'endfield'}).storyFocus,true);
  assert.equal(P.tierForCode('ENF'),3);
  assert.equal(P.get({id:'hsr',playTier:2,storyFocus:true}).tier,2);
  assert.deepEqual(P.untrackedGames([{id:'zzz'}]).map(g=>g.id),['endfield']);
});
test('only current verified pending priority events count toward S',()=>{
  const now=Date.parse('2026-11-03T06:00:00Z');
  const row=(key,extra={})=>({game:'ZZZ',task_key:key,user_action:'NONE',verification:'CONFIRMED',lifecycle_status:'ACTIVE',deadline_at:'2026-11-04T06:00:00Z',...extra});
  P.setOpsTasks([row('a'),row('future',{open_at:'2026-11-04T09:00:00Z'}),row('unverified',{verification:'TO_VERIFY'}),row('past',{deadline_at:'2026-11-02T06:00:00Z'}),row('done',{user_action:'DONE'}),row('t3',{game:'ENF'})],uid);
  assert.equal(P.blockedOpsCount(now),1);
});
test('policy rows are isolated by authenticated owner',()=>{
  P.setOwner('another-owner');
  assert.equal(P.get({id:'zzz'}).tier,null);
  assert.equal(P.blockedOpsCount(Date.parse('2026-11-03T06:00:00Z')),0);
  assert.equal(P.setRows([{game_key:'zzz',play_tier:1}],'owner-test'),false);
  assert.equal(P.get({id:'zzz'}).tier,null);
});

test('A/B events never count toward S and new game codes are discoverable',()=>{P.setOwner(uid);P.setRows([{game_key:'zzz',game_name:'S',play_tier:1,sort_order:1},{game_key:'endfield',game_name:'A',play_tier:2,sort_order:2},{game_key:'azur_promilia',game_name:'B',play_tier:3,sort_order:3}],uid);assert.equal(P.tierForCode('AZUR_PROMILIA'),3);assert.equal(P.allGames().find(g=>g.key==='azur_promilia').code,'AZUR_PROMILIA');P.setOpsTasks(['ZZZ','ENF','AZUR_PROMILIA'].map(game=>({game,user_action:'NONE',verification:'CONFIRMED',lifecycle_status:'ACTIVE',deadline_at:'2026-12-01T00:00:00Z'})),uid);assert.equal(P.blockedOpsCount(Date.parse('2026-11-24T00:00:00Z')),1);});
