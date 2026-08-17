/** Material 3 palette math and CSS custom-property application. */
(function (global) {
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeHex(color) {
        if (typeof color !== 'string') return '';
        const value = color.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(value)) return value;
        if (/^#[0-9a-f]{3}$/.test(value)) {
            return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
        }
        return '';
    }

    function onColorFor(hex) {
        const value = hex.replace('#', '');
        const channel = offset => {
            const number = parseInt(value.slice(offset, offset + 2), 16) / 255;
            return number <= 0.03928 ? number / 12.92 : ((number + 0.055) / 1.055) ** 2.4;
        };
        const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
        return luminance > 0.45 ? '#1a1a1a' : '#ffffff';
    }

    function hexToHsl(hex) {
        const value = hex.replace('#', '');
        const red = parseInt(value.slice(0, 2), 16) / 255;
        const green = parseInt(value.slice(2, 4), 16) / 255;
        const blue = parseInt(value.slice(4, 6), 16) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;

        if (delta !== 0) {
            if (max === red) hue = 60 * (((green - blue) / delta) % 6);
            else if (max === green) hue = 60 * ((blue - red) / delta + 2);
            else hue = 60 * ((red - green) / delta + 4);
        }

        if (hue < 0) hue += 360;
        const lightness = (max + min) / 2;
        const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
        return { h: hue, s: saturation * 100 };
    }

    function hslToHex(hue, saturation, lightness) {
        const h = ((hue % 360) + 360) % 360;
        const s = clamp(saturation, 0, 100) / 100;
        const l = clamp(lightness, 0, 100) / 100;
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
        const offset = l - chroma / 2;
        let red = 0;
        let green = 0;
        let blue = 0;

        if (h < 60) [red, green] = [chroma, x];
        else if (h < 120) [red, green] = [x, chroma];
        else if (h < 180) [green, blue] = [chroma, x];
        else if (h < 240) [green, blue] = [x, chroma];
        else if (h < 300) [red, blue] = [x, chroma];
        else [red, blue] = [chroma, x];

        return `#${[red, green, blue].map(channel =>
            Math.round((channel + offset) * 255).toString(16).padStart(2, '0')
        ).join('')}`;
    }

    function createMaterialPalette(seedColor, darkMode) {
        const { h, s } = hexToHsl(seedColor);
        const isNeutral = s < 5;
        const primarySaturation = isNeutral ? 0 : clamp(s, 42, 78);
        const secondarySaturation = isNeutral ? 0 : clamp(s * 0.38, 18, 34);
        const tertiaryHue = (h + 62) % 360;
        const tertiarySaturation = isNeutral ? 0 : clamp(s * 0.62, 32, 58);
        const neutralSaturation = isNeutral ? 0 : clamp(s * 0.1, 3, 8);
        const variantSaturation = isNeutral ? 0 : clamp(s * 0.18, 6, 14);

        if (darkMode) {
            return {
                primary: hslToHex(h, primarySaturation, 80),
                onPrimary: hslToHex(h, primarySaturation, 20),
                primaryContainer: hslToHex(h, primarySaturation, 30),
                onPrimaryContainer: hslToHex(h, primarySaturation, 90),
                secondary: hslToHex(h, secondarySaturation, 80),
                onSecondary: hslToHex(h, secondarySaturation, 20),
                secondaryContainer: hslToHex(h, secondarySaturation, 30),
                onSecondaryContainer: hslToHex(h, secondarySaturation, 90),
                tertiary: hslToHex(tertiaryHue, tertiarySaturation, 80),
                tertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 30),
                onTertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 90),
                surface: hslToHex(h, neutralSaturation, 6),
                surfaceLow: hslToHex(h, neutralSaturation, 10),
                surfaceContainer: hslToHex(h, neutralSaturation, 12),
                surfaceHigh: hslToHex(h, neutralSaturation, 17),
                surfaceHighest: hslToHex(h, variantSaturation, 22),
                onSurface: hslToHex(h, neutralSaturation, 90),
                onSurfaceVariant: hslToHex(h, variantSaturation, 80),
                outline: hslToHex(h, variantSaturation, 60),
                outlineVariant: hslToHex(h, variantSaturation, 30),
                exhale: hslToHex(h - 58, isNeutral ? 0 : clamp(s, 38, 65), 80)
            };
        }

        return {
            primary: hslToHex(h, primarySaturation, 32),
            onPrimary: '#ffffff',
            primaryContainer: hslToHex(h, primarySaturation, 90),
            onPrimaryContainer: hslToHex(h, primarySaturation, 10),
            secondary: hslToHex(h, secondarySaturation, 38),
            onSecondary: '#ffffff',
            secondaryContainer: hslToHex(h, secondarySaturation, 90),
            onSecondaryContainer: hslToHex(h, secondarySaturation, 10),
            tertiary: hslToHex(tertiaryHue, tertiarySaturation, 38),
            tertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 90),
            onTertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 10),
            surface: hslToHex(h, neutralSaturation, 98),
            surfaceLow: hslToHex(h, neutralSaturation, 96),
            surfaceContainer: hslToHex(h, neutralSaturation, 94),
            surfaceHigh: hslToHex(h, neutralSaturation, 92),
            surfaceHighest: hslToHex(h, variantSaturation, 90),
            onSurface: hslToHex(h, neutralSaturation, 10),
            onSurfaceVariant: hslToHex(h, variantSaturation, 30),
            outline: hslToHex(h, variantSaturation, 48),
            outlineVariant: hslToHex(h, variantSaturation, 80),
            exhale: hslToHex(h - 58, isNeutral ? 0 : clamp(s, 38, 65), 38)
        };
    }

    function paletteCssRoles(palette) {
        return {
            '--md-sys-color-primary': palette.primary,
            '--md-sys-color-on-primary': palette.onPrimary,
            '--md-sys-color-primary-container': palette.primaryContainer,
            '--md-sys-color-on-primary-container': palette.onPrimaryContainer,
            '--md-sys-color-secondary': palette.secondary,
            '--md-sys-color-on-secondary': palette.onSecondary,
            '--md-sys-color-secondary-container': palette.secondaryContainer,
            '--md-sys-color-on-secondary-container': palette.onSecondaryContainer,
            '--md-sys-color-tertiary': palette.tertiary,
            '--md-sys-color-tertiary-container': palette.tertiaryContainer,
            '--md-sys-color-on-tertiary-container': palette.onTertiaryContainer,
            '--md-sys-color-surface': palette.surface,
            '--md-sys-color-surface-container-low': palette.surfaceLow,
            '--md-sys-color-surface-container': palette.surfaceContainer,
            '--md-sys-color-surface-container-high': palette.surfaceHigh,
            '--md-sys-color-surface-container-highest': palette.surfaceHighest,
            '--md-sys-color-on-surface': palette.onSurface,
            '--md-sys-color-on-surface-variant': palette.onSurfaceVariant,
            '--md-sys-color-outline': palette.outline,
            '--md-sys-color-outline-variant': palette.outlineVariant,
            '--orb-color-inhale': palette.primary,
            '--orb-color-hold': palette.tertiary,
            '--orb-color-exhale': palette.exhale,
            '--orb-color-idle': palette.secondary
        };
    }

    /**
     * Writes Material 3 CSS custom properties for a seed accent color.
     * Swatch selection, theme-color, and canvas redraw stay in the controller
     * so this function can be tested with a style-map stand-in.
     *
     * @param {string} color - 3- or 6-digit hex seed
     * @param {{darkMode?: boolean, styleTarget?: {setProperty: Function}}} [options]
     * @returns {{color: string, palette: object}|null} applied color, or null if invalid
     */
    function applyPrimaryColor(color, options = {}) {
        const nextColor = normalizeHex(color);
        if (!nextColor) return null;
        const darkMode = typeof options.darkMode === 'boolean'
            ? options.darkMode
            : Boolean(global.document?.body?.classList?.contains('dark-mode'));
        const palette = createMaterialPalette(nextColor, darkMode);
        palette.primary = nextColor;
        palette.onPrimary = onColorFor(nextColor);
        const styleTarget = options.styleTarget || global.document?.body?.style;
        if (styleTarget?.setProperty) {
            Object.entries(paletteCssRoles(palette)).forEach(([role, value]) => {
                styleTarget.setProperty(role, value);
            });
        }
        return { color: nextColor, palette };
    }

    global.BreathingTheme = {
        normalizeHex,
        onColorFor,
        hexToHsl,
        hslToHex,
        createMaterialPalette,
        applyPrimaryColor
    };
})(typeof window !== 'undefined' ? window : globalThis);
