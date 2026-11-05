'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function effectiveToken(css, name) {
  const hits = [...css.matchAll(new RegExp('--' + name + '\\s*:\\s*(#[0-9a-f]{6})\\s*;', 'gi'))];
  assert.ok(hits.length, 'Missing effective token: ' + name);
  return hits[hits.length-1][1];
}

function luminance(hex) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const linear = rgb.map(c => c <= .04045 ? c/12.92 : Math.pow((c+.055)/1.055,2.4));
  return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}

function contrast(a,b) {
  const hi = Math.max(luminance(a),luminance(b));
  const lo = Math.min(luminance(a),luminance(b));
  return (hi+.05)/(lo+.05);
}

test('effective semantic status token foregrounds meet WCAG AA on corresponding soft panels', () => {
  // This is a token-pair check, not a claim that all computed text colors pass WCAG.
  const css = fs.readFileSync(path.join(__dirname,'..','assets/css/app-design.css'),'utf8');
  for(const state of ['success','danger','warning','info']){
    const foreground = effectiveToken(css,'color-'+state);
    const background = effectiveToken(css,'color-'+state+'-soft');
    assert.ok(contrast(foreground,background) >= 4.5,
      state+' contrast '+contrast(foreground,background).toFixed(2)+':1 < 4.5:1');
  }
});
