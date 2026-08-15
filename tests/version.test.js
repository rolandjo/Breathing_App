const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function readProjectFile(file) {
    return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
}

test('runtime and package versions stay synchronized', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(readProjectFile('version.js'), context);
    const packageJson = JSON.parse(readProjectFile('package.json'));

    assert.equal(context.BreathingApp.version, packageJson.version);
    assert.equal(context.BreathingApp.cacheName, `breathing-timer-v${packageJson.version}`);
});

test('service worker derives its cache release from version metadata', () => {
    const serviceWorker = readProjectFile('sw.js');

    assert.match(serviceWorker, /importScripts\('\.\/version\.js'\)/);
    assert.match(serviceWorker, /self\.BreathingApp\.cacheName/);
    assert.doesNotMatch(serviceWorker, /const CACHE_NAME = ['"]breathing-timer-v/);
    assert.match(serviceWorker, /event\.request\.destination === 'script'/);
    assert.match(serviceWorker, /event\.request\.destination === 'style'/);
});

test('version is shown at the bottom of both settings drawers', () => {
    const index = readProjectFile('index.html');
    const versionTargets = index.match(/data-app-version/g) || [];
    const navbar = index.match(/<nav[^]*?<\/nav>/)?.[0] || '';

    assert.equal(versionTargets.length, 2);
    assert.equal((index.match(/settings-version-footer/g) || []).length, 2);
    assert.doesNotMatch(navbar, /data-app-version/);
});
