const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);

for (const file of ['english.js', 'spanish.js', 'french.js', 'romanian.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'translations', file), 'utf8'), context);
}
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'translation-manager.js'), 'utf8'), context);

const manager = context.BreathingTranslationManager;

test('translation catalogs expose the four supported BCP 47 language codes', () => {
    assert.deepEqual(Array.from(manager.supportedLanguages), ['en', 'es', 'fr', 'ro']);
    assert.equal(manager.getSpeechLanguage('en'), 'en-US');
    assert.equal(manager.getSpeechLanguage('es'), 'es-ES');
    assert.equal(manager.getSpeechLanguage('fr'), 'fr-FR');
    assert.equal(manager.getSpeechLanguage('ro'), 'ro-RO');
});

test('every language catalog has the same translation keys as English', () => {
    const expectedKeys = Object.keys(manager.getTranslations('en')).sort();
    for (const language of manager.supportedLanguages) {
        assert.deepEqual(
            Object.keys(manager.getTranslations(language)).sort(),
            expectedKeys,
            `${language} translation keys must match English`
        );
    }
});

test('every translated HTML key exists in every language catalog', () => {
    const index = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const usedKeys = new Set(
        [...index.matchAll(/data-lang-(?:key|aria|title)="([^"]+)"/g)].map(match => match[1])
    );

    for (const language of manager.supportedLanguages) {
        const translations = manager.getTranslations(language);
        for (const key of usedKeys) {
            assert.equal(typeof translations[key], 'string', `${language} is missing ${key}`);
        }
    }
});

test('translation lookup falls back to English and substitutes named parameters', () => {
    manager.translations.en.parameterExample = 'Cycles: {count}';
    assert.equal(manager.getTranslation('unknown', 'parameterExample', { count: 3 }), 'Cycles: 3');
    assert.equal(manager.getTranslation('ro', 'missingKey'), 'missingKey');
});

test('preset descriptions and voice cues are present for every language', () => {
    for (const language of manager.supportedLanguages) {
        assert.deepEqual(
            Object.keys(manager.getPresetDescriptions(language)).sort(),
            ['box', 'custom', 'equal', 'power_rounds', 'relaxing']
        );
        assert.deepEqual(
            Object.keys(manager.getVoiceCues(language)).sort(),
            ['exhale', 'hold', 'inhale', 'rest']
        );
    }
});
