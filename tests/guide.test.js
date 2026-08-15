const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const script = fs.readFileSync(path.resolve(__dirname, '..', 'script.js'), 'utf8');
const index = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const guideKeys = [
    'guideTitle',
    'guideSafety',
    'boxTitle',
    'boxDescription',
    'relaxingTitle',
    'relaxingDescription',
    'equalTitle',
    'equalDescription',
    'powerRoundsTitle',
    'powerRoundsDescription'
];

test('every guide field is translated into all four supported languages', () => {
    guideKeys.forEach(key => {
        const definitions = script.match(new RegExp(`\\b${key}:`, 'g')) || [];
        assert.equal(definitions.length, 4, `${key} must have four translations`);
        assert.match(index, new RegExp(`data-lang-key=["']${key}["']`));
    });
});

test('guide includes practical safety guidance for intensive breathing', () => {
    assert.match(index, /class="guide-safety-note"/);
    assert.match(script, /never in water or while driving/);
    assert.match(script, /nunca en el agua ni mientras conduces/);
    assert.match(script, /jamais dans l’eau ni en conduisant/);
    assert.match(script, /niciodată în apă ori în timp ce conduci/);
});
