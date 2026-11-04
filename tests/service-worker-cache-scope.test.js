const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('service worker activation only deletes obsolete TaskRing shell caches', async () => {
  const handlers = new Map();
  const deleted = [];
  const cacheNames = [
    'taskring-shell-20261001',
    'taskring-shell-20261104-design-2',
    'other-app-cache',
    'taskring-user-data',
  ];
  const context = {
    self: {
      addEventListener(name, handler) { handlers.set(name, handler); },
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => cacheNames,
      delete: async (name) => { deleted.push(name); return true; },
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'service-worker.js' });
  let pending;
  handlers.get('activate')({ waitUntil(promise) { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, ['taskring-shell-20261001']);
});
