const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const index = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const translationCatalogs = [
    'english.js',
    'spanish.js',
    'french.js',
    'romanian.js'
].map(file => fs.readFileSync(path.resolve(__dirname, '..', 'translations', file), 'utf8'));

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
        const definitions = translationCatalogs.filter(catalog => catalog.includes(`"${key}"`));
        assert.equal(definitions.length, 4, `${key} must have four translations`);
        assert.match(index, new RegExp(`data-lang-key=["']${key}["']`));
    });
});

test('guide includes practical safety guidance for intensive breathing', () => {
    assert.match(index, /class="guide-safety-note"/);
    assert.match(translationCatalogs[0], /never in water or while driving/);
    assert.match(translationCatalogs[1], /nunca en el agua ni mientras conduces/);
    assert.match(translationCatalogs[2], /jamais dans l’eau ni en conduisant/);
    assert.match(translationCatalogs[3], /niciodată în apă ori în timp ce conduci/);
});
