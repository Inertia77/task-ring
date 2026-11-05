'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('responsive execution rules load before final shared design rules', () => {
  const css = read('assets/css/main.css');
  const imports = [...css.matchAll(/@import\s+url\(["']([^"']+)["']\)/g)].map(match => match[1].split('?')[0]);
  assert.equal(new Set(imports).size, imports.length, 'CSS imports must not repeat');
  assert.ok(imports.includes('./mobile-execution.css'));
  assert.ok(imports.includes('./app-design.css'));
  assert.ok(imports.indexOf('./mobile-execution.css') < imports.indexOf('./app-design.css'));
  assert.ok(imports.includes('./operations-hud.css'), 'missing game-inspired mission HUD');
  assert.ok(imports.indexOf('./app-design.css') < imports.indexOf('./operations-hud.css'), 'the HUD must be the final visual layer');
  for (const name of imports) {
    assert.ok(fs.existsSync(path.join(root, 'assets/css', name)), 'missing stylesheet: ' + name);
  }
});

test('mobile navigation retains safe-area and keyboard-friendly controls', () => {
  const css = read('assets/css/mobile-execution.css');
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /#viewDock\s*\{/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /min-height:\s*44px/);
});

test('browser regression suite keeps Chromium and WebKit enabled', () => {
  const config = read('playwright.config.js');
  assert.match(config, /browserName:\s*'chromium'/);
  assert.match(config, /browserName:\s*'webkit'/);
  assert.match(config, /serviceWorkers:\s*'block'/);
});

test('game play tiers remain separate from blocked core task accounting', () => {
  const policy = read('assets/js/game-play-policy.js');
  assert.match(policy, /tier\s*>\s*2\)\s*return false/);
  assert.match(policy, /blockedOpsCount/);
});


test('game-inspired operations HUD is offline-ready without changing task semantics', () => {
  const sw = read('service-worker.js');
  const css = read('assets/css/operations-hud.css');
  assert.match(sw, /"\.\/assets\/css\/operations-hud\.css"/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.githubInlineState/);
  // The HUD should only be paint / layout; no Javascript data or persistence code.
  assert.doesNotMatch(css, /localStorage|sessionStorage|syncSetItem|\.disabled\s*=/);
});
