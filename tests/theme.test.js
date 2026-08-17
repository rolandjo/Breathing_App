const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, '..', 'theme.js'), 'utf8'),
    context
);
const Theme = context.BreathingTheme;

test('normalizeHex accepts 3-digit and 6-digit values and rejects junk', () => {
    assert.equal(Theme.normalizeHex('#006A6A'), '#006a6a');
    assert.equal(Theme.normalizeHex('  #0a8  '), '#00aa88');
    assert.equal(Theme.normalizeHex('#gg0000'), '');
    assert.equal(Theme.normalizeHex('blue'), '');
    assert.equal(Theme.normalizeHex(null), '');
});

test('onColorFor picks dark text on light seeds and white on dark seeds', () => {
    assert.equal(Theme.onColorFor('#ffffff'), '#1a1a1a');
    assert.equal(Theme.onColorFor('#000000'), '#ffffff');
    assert.equal(Theme.onColorFor('#006a6a'), '#ffffff');
});

test('hexToHsl reads the app teal seed and hslToHex preserves hue', () => {
    const { h, s } = Theme.hexToHsl('#006a6a');
    assert.ok(Math.abs(h - 180) < 0.5);
    assert.ok(s > 99);
    const hex = Theme.hslToHex(200, 42, 32);
    assert.match(hex, /^#[0-9a-f]{6}$/);
    const again = Theme.hexToHsl(hex);
    assert.ok(Math.abs(again.h - 200) < 1);
});

test('createMaterialPalette exposes the roles the CSS theme consumes', () => {
    const light = Theme.createMaterialPalette('#006a6a', false);
    const dark = Theme.createMaterialPalette('#006a6a', true);
    const roles = [
        'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
        'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
        'tertiary', 'tertiaryContainer', 'onTertiaryContainer',
        'surface', 'surfaceLow', 'surfaceContainer', 'surfaceHigh', 'surfaceHighest',
        'onSurface', 'onSurfaceVariant', 'outline', 'outlineVariant', 'exhale'
    ];
    for (const role of roles) {
        assert.match(light[role], /^#[0-9a-f]{6}$/, `light ${role}`);
        assert.match(dark[role], /^#[0-9a-f]{6}$/, `dark ${role}`);
    }
    const lightSurface = parseInt(light.surface.slice(1), 16);
    const darkSurface = parseInt(dark.surface.slice(1), 16);
    assert.ok(lightSurface > darkSurface, 'light surface should be brighter than dark surface');
});

test('near-gray seeds stay desaturated instead of inventing a hue', () => {
    const palette = Theme.createMaterialPalette('#808080', false);
    const { s } = Theme.hexToHsl(palette.primary);
    assert.ok(s < 1, `expected near-zero saturation, got ${s}`);
});

test('applyPrimaryColor writes CSS variables and pins primary to the seed', () => {
    const properties = {};
    const result = Theme.applyPrimaryColor('#006a6a', {
        darkMode: false,
        styleTarget: {
            setProperty(name, value) {
                properties[name] = value;
            }
        }
    });
    assert.equal(result.color, '#006a6a');
    assert.equal(result.palette.primary, '#006a6a');
    assert.equal(properties['--md-sys-color-primary'], '#006a6a');
    assert.equal(properties['--orb-color-inhale'], '#006a6a');
    assert.ok(properties['--md-sys-color-surface']);
    assert.equal(Theme.applyPrimaryColor('nope'), null);
});
