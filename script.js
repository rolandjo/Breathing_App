document.addEventListener('DOMContentLoaded', () => {
    // Element references
    const elements = {
        inhaleInput: document.getElementById('inhale'),
        pause1Input: document.getElementById('pause1'),
        exhaleInput: document.getElementById('exhale'),
        pause2Input: document.getElementById('pause2'),
        cyclesInput: document.getElementById('cycles'),
        cyclesLabel: document.getElementById('cyclesLabel'),
        holdInput: document.getElementById('hold'),
        finalPauseInput: document.getElementById('finalPause'),
        finalInhaleInput: document.getElementById('finalInhale'),
        finalPause2Input: document.getElementById('finalPause2'),
        whmRoundsInput: document.getElementById('whmRounds'),
        whmIncreaseInput: document.getElementById('whmIncrease'),
        totalTimeDisplay: document.getElementById('total-time'),
        remainingCyclesDisplay: document.getElementById('remaining-cycles'),
        startButton: document.getElementById('start'),
        stopButton: document.getElementById('stop'),
        pauseButton: document.getElementById('pause'),
        toggleModeButton: document.getElementById('toggle-mode'),
        volumeControl: document.getElementById('volume-control'),
        presetSelect: document.getElementById('preset-select'),
        canvas: document.getElementById('breathing-canvas'),
        visualizerWrapper: document.querySelector('.visualizer-wrapper'),
        phaseTime: document.getElementById('phase-time'),
        wimHofExtraFields: document.getElementById('wim-hof-extra-fields'),
        languageToggle: document.getElementById('language-toggle'),
        guidedPrompt: document.getElementById('guided-prompt'),
        primaryColorInput: document.getElementById('primary-color'),
        colorSwatches: document.querySelectorAll('.color-swatch')
    };

    const ctx = elements.canvas.getContext('2d');

    // State variables
    let currentStep = 0;
    let currentCycle = 0;
    let totalCycles = 0;
    let isRunning = false;
    let isPaused = false;
    let currentLanguage = 'en';
    let sessionCompleted = false;
    let primaryColor = '#006a6a';
    let promptTransitionId = 0;

    // Animation Loop Variables
    let animationFrameId = null;
    let backgroundTimerId = null;
    let stepStartTime = 0;
    let lastTime = 0;
    let lastProgress = 0;
    let cachedColors = {};
    let suppressPhaseAudio = false;
    
    // WHM Specific State
    let whmSteps = [];
    let isWimHof = false;
    let wimHofStepIndex = 0;
    let currentWhmRound = 0;
    let totalWhmRounds = 1;
    let originalWhmHold = 0;

    // Translations
    const translations = {
        en: {
            title: 'Breathing Timer',
            darkMode: 'Dark Mode',
            choosePreset: 'Choose a preset:',
            custom: 'Custom',
            box: 'Box Breathing (4-4-4-4)',
            relaxing: 'Relaxing Breath (4-7-8)',
            equal: 'Equal Breathing (4-4)',
            wim_hof: 'WHM Breathing',
            inhale: 'Inhale (s)',
            pause1: 'Hold (s)',
            exhale: 'Exhale (s)',
            pause2: 'Hold (s)',
            cycles: 'Number of Cycles:',
            numberBreaths: 'Number of Breaths:',
            whmRounds: 'Total WHM Rounds',
            whmIncrease: 'Hold Increase Time (s)',
            hold: 'Hold after exhale (s)',
            finalPause: 'Final Pause',
            finalInhale: 'Final Inhale & Hold',
            finalPause2: 'Last exhale',
            totalTime: 'Total Time: 0 min 0 sec',
            remainingCycles: 'Remaining Cycles: 0',
            start: 'Start',
            pause: 'Pause',
            resume: 'Resume',
            stop: 'Stop',
            presetInfo: 'Guide',
            ready: 'Ready to breathe',
            breatheIn: 'Breathe in...',
            holdBreath: 'Hold...',
            breatheOut: 'Breathe out...',
            complete: 'Session complete',
            colors: 'Colors',
            accentColor: 'Accent color',
            customColor: 'Custom',
            colorHint: 'Creates a coordinated Material color palette.'
        },
        es: {
            title: 'Temporizador de Respiración',
            darkMode: 'Modo Oscuro',
            choosePreset: 'Elegir preajuste:',
            custom: 'Personalizado',
            box: 'Respiración Cuadrada (4-4-4-4)',
            relaxing: 'Respiración Relajante (4-7-8)',
            equal: 'Respiración Igual (4-4)',
            wim_hof: 'Respiración WHM',
            inhale: 'Inhalar (s)',
            pause1: 'Mantener (s)',
            exhale: 'Exhalar (s)',
            pause2: 'Mantener (s)',
            cycles: 'Número de ciclos:',
            numberBreaths: 'Número de Respiraciones:',
            whmRounds: 'Rondas Totales WHM',
            whmIncrease: 'Aumento de Retención (s)',
            hold: 'Mantener después de exhalar (s)',
            finalPause: 'Pausa Final',
            finalInhale: 'Inhalación Final',
            finalPause2: 'Última exhalación',
            totalTime: 'Tiempo Total: 0 min 0 seg',
            remainingCycles: 'Ciclos Restantes: 0',
            start: 'Iniciar',
            pause: 'Pausar',
            resume: 'Reanudar',
            stop: 'Detener',
            presetInfo: 'Guía',
            ready: 'Listo para respirar',
            breatheIn: 'Inhala...',
            holdBreath: 'Mantén...',
            breatheOut: 'Exhala...',
            complete: 'Sesión completada',
            colors: 'Colores',
            accentColor: 'Color de acento',
            customColor: 'Personalizado',
            colorHint: 'Crea una paleta Material coordinada.'
        },
        fr: {
            title: 'Minuteur de Respiration',
            darkMode: 'Mode Sombre',
            choosePreset: 'Choisir un préréglage:',
            custom: 'Personnalisé',
            box: 'Respiration Carrée (4-4-4-4)',
            relaxing: 'Respiration Relaxante (4-7-8)',
            equal: 'Respiration Égale (4-4)',
            wim_hof: 'Respiration WHM',
            inhale: 'Inspirer (s)',
            pause1: 'Maintenir (s)',
            exhale: 'Expirer (s)',
            pause2: 'Maintenir (s)',
            cycles: 'Nombre de cycles:',
            numberBreaths: 'Nombre de Respirations:',
            whmRounds: 'Total de Cycles WHM',
            whmIncrease: 'Augmentation de la Rétention (s)',
            hold: 'Maintenir après expiration (s)',
            finalPause: 'Pause Finale',
            finalInhale: 'Inspiration Finale',
            finalPause2: 'Dernière expiration',
            totalTime: 'Temps Total: 0 min 0 sec',
            remainingCycles: 'Cycles Restants: 0',
            start: 'Démarrer',
            pause: 'Pause',
            resume: 'Reprendre',
            stop: 'Arrêter',
            presetInfo: 'Guide',
            ready: 'Prêt à respirer',
            breatheIn: 'Inspirez...',
            holdBreath: 'Maintenez...',
            breatheOut: 'Expirez...',
            complete: 'Session terminée',
            colors: 'Couleurs',
            accentColor: 'Couleur d’accent',
            customColor: 'Personnalisée',
            colorHint: 'Crée une palette Material coordonnée.'
        }
    };

    // Breathing pattern presets
    const presets = {
        custom: { inhale: 4, pause1: 4, exhale: 4, pause2: 4 },
        box: { inhale: 4, pause1: 4, exhale: 4, pause2: 4 },
        relaxing: { inhale: 4, pause1: 7, exhale: 8, pause2: 0 },
        equal: { inhale: 4, pause1: 0, exhale: 4, pause2: 0 },
        wim_hof: {
            inhale: 2,
            pause1: 0,
            exhale: 2,
            pause2: 0,
            cycles: 35,
            hold: 20,
            whmRounds: 6,
            whmIncrease: 10,
            finalPause: 1,
            finalInhale: 15,
            finalPause2: 5
        }
    };

    const presetDescriptions = {
        en: {
            custom: 'Create your own breathing rhythm.',
            box: 'Balanced focus with four equal phases.',
            relaxing: 'A slower exhale designed for winding down.',
            equal: 'A simple, steady rhythm for everyday calm.',
            wim_hof: 'Guided breathing rounds followed by timed holds.'
        },
        es: {
            custom: 'Crea tu propio ritmo de respiración.',
            box: 'Enfoque equilibrado con cuatro fases iguales.',
            relaxing: 'Una exhalación lenta para relajarte.',
            equal: 'Un ritmo simple y constante para la calma diaria.',
            wim_hof: 'Rondas guiadas seguidas de retenciones cronometradas.'
        },
        fr: {
            custom: 'Créez votre propre rythme respiratoire.',
            box: 'Équilibre et concentration avec quatre phases égales.',
            relaxing: 'Une expiration lente pour favoriser la détente.',
            equal: 'Un rythme simple et stable pour le calme quotidien.',
            wim_hof: 'Cycles guidés suivis de rétentions chronométrées.'
        }
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
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

    function applyPrimaryColor(color) {
        if (!/^#[0-9a-f]{6}$/i.test(color)) return;
        primaryColor = color.toLowerCase();
        const palette = createMaterialPalette(primaryColor, document.body.classList.contains('dark-mode'));
        const rootStyle = document.body.style;
        const roles = {
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

        Object.entries(roles).forEach(([role, value]) => rootStyle.setProperty(role, value));
        elements.primaryColorInput.value = primaryColor;
        elements.colorSwatches.forEach(swatch => {
            swatch.setAttribute('aria-pressed', String(swatch.dataset.color.toLowerCase() === primaryColor));
        });
        document.querySelector('meta[name="theme-color"]').content = palette.surface;
        updateCachedColors();
        if (!isRunning) drawFrame(null, 0, performance.now());
    }

    // Breathing steps configuration
    const steps = [
        { action: 'Inhale', textKey: 'breatheIn', colorKey: 'inhale', duration: () => parseInt(elements.inhaleInput.value) },
        { action: 'Hold', textKey: 'holdBreath', colorKey: 'hold', duration: () => parseInt(elements.pause1Input.value) },
        { action: 'Exhale', textKey: 'breatheOut', colorKey: 'exhale', duration: () => parseInt(elements.exhaleInput.value) },
        { action: 'Hold', textKey: 'holdBreath', colorKey: 'hold', duration: () => parseInt(elements.pause2Input.value) }
    ];

    // Audio setup
    const beep = new Audio('./tibetan-singing-bowl-54400.mp3');
    beep.preload = 'auto';

    function playBeep(phaseType = 'default') {
        if (suppressPhaseAudio) return;
        beep.currentTime = 0;
        
        // Force the browser to NOT preserve pitch so the tone actually changes
        beep.preservesPitch = false;
        if (beep.mozPreservesPitch !== undefined) beep.mozPreservesPitch = false;
        if (beep.webkitPreservesPitch !== undefined) beep.webkitPreservesPitch = false;
        
        // Adjust pitch/speed to create distinct sounds for different phases
        if (phaseType === 'inhale') {
            beep.playbackRate = 1.4; // Noticeably higher pitch
        } else if (phaseType === 'exhale') {
            beep.playbackRate = 0.6; // Noticeably lower, deeper pitch
        } else {
            beep.playbackRate = 1.0; // Standard pitch for holds
        }

        beep.play().catch(error => console.log('Audio play prevented:', error));
    }

    function setGuidedPrompt(text, immediate = false) {
        if (!text || elements.guidedPrompt.textContent === text) return;
        const transitionId = ++promptTransitionId;
        elements.guidedPrompt.getAnimations().forEach(animation => animation.cancel());

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (immediate || reduceMotion || document.hidden || suppressPhaseAudio || typeof elements.guidedPrompt.animate !== 'function') {
            elements.guidedPrompt.textContent = text;
            return;
        }

        const fadeOut = elements.guidedPrompt.animate([
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
            { opacity: 0, transform: 'translateY(-6px)', filter: 'blur(2px)' }
        ], {
            duration: 110,
            easing: 'cubic-bezier(0.4, 0, 1, 1)',
            fill: 'forwards'
        });

        fadeOut.finished.then(() => {
            if (transitionId !== promptTransitionId) return;
            elements.guidedPrompt.textContent = text;
            elements.guidedPrompt.animate([
                { opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' },
                { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
            ], {
                duration: 240,
                easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
                fill: 'both'
            });
        }).catch(() => {});
    }

    // --- CANVAS VISUALIZER LOGIC ---

    function resizeCanvas() {
        const wrapper = elements.visualizerWrapper;
        const dpr = window.devicePixelRatio || 1;
        elements.canvas.width = wrapper.clientWidth * dpr;
        elements.canvas.height = wrapper.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        updateCachedColors();
    }

    function updateCachedColors() {
        const root = document.body;
        cachedColors = {
            inhale: getComputedStyle(root).getPropertyValue('--orb-color-inhale').trim(),
            hold: getComputedStyle(root).getPropertyValue('--orb-color-hold').trim(),
            exhale: getComputedStyle(root).getPropertyValue('--orb-color-exhale').trim(),
            idle: getComputedStyle(root).getPropertyValue('--orb-color-idle').trim(),
            glassBorder: getComputedStyle(root).getPropertyValue('--md-sys-color-outline-variant').trim(),
        };
    }

    function generateVertices(activeStepsCount, cx, cy, r) {
        const vertices = [];
        if (activeStepsCount === 2) {
            vertices.push({ x: cx, y: cy + r });
            vertices.push({ x: cx, y: cy - r });
        } else if (activeStepsCount === 3) {
            vertices.push({ x: cx - r * 0.866, y: cy + r * 0.5 });
            vertices.push({ x: cx, y: cy - r });
            vertices.push({ x: cx + r * 0.866, y: cy + r * 0.5 });
        } else if (activeStepsCount === 4) {
            vertices.push({ x: cx - r, y: cy + r });
            vertices.push({ x: cx - r, y: cy - r });
            vertices.push({ x: cx + r, y: cy - r });
            vertices.push({ x: cx + r, y: cy + r });
        } else {
            vertices.push({ x: cx, y: cy });
        }
        return vertices;
    }

    function easeInOutSine(x) {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    }

    function drawFrame(step, progress, idleTime = 0) {
        const w = elements.canvas.clientWidth;
        const h = elements.canvas.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.35;

        ctx.clearRect(0, 0, w, h);

        let activeSteps;
        if (isWimHof) {
             activeSteps = whmSteps;
        } else {
             activeSteps = steps.filter(s => s.duration() > 0);
        }

        if (activeSteps.length === 0) return;

        const vertices = generateVertices(activeSteps.length, cx, cy, r);

        // Draw track
        if (vertices.length > 1) {
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            if (vertices.length > 2) ctx.closePath();
            
            ctx.strokeStyle = cachedColors.glassBorder || 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        let bx = cx;
        let by = cy;
        let currentColor = cachedColors.idle;

        if (!isRunning) {
            // Idle animation
            const pulse = 1 + Math.sin(idleTime / 500) * 0.1;
            const idleRadius = r * 0.48 * pulse;
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.beginPath();
            ctx.arc(cx, cy, idleRadius, 0, Math.PI * 2);
            ctx.fillStyle = cachedColors.idle;
            ctx.shadowColor = cachedColors.idle;
            ctx.shadowBlur = 36;
            ctx.fill();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(cx, cy, 20 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = cachedColors.idle;
            ctx.shadowColor = cachedColors.idle;
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        const activeIndex = activeSteps.indexOf(step);
        if (activeIndex !== -1 && vertices.length > 1) {
            const start = vertices[activeIndex];
            const end = vertices[(activeIndex + 1) % vertices.length];

            const easedProgress = easeInOutSine(progress);
            bx = start.x + (end.x - start.x) * easedProgress;
            by = start.y + (end.y - start.y) * easedProgress;
            currentColor = cachedColors[step.colorKey];
        } else if (vertices.length === 1) {
             currentColor = cachedColors[step.colorKey];
        }

        // Material expressive breathing surface, synchronized with phase progress
        const easedPhase = easeInOutSine(clamp(progress, 0, 1));
        let breathScale = 0.62;
        if (step.colorKey === 'inhale') {
            breathScale = 0.42 + easedPhase * 0.5;
        } else if (step.colorKey === 'exhale') {
            breathScale = 0.92 - easedPhase * 0.5;
        } else if (step.colorKey === 'hold') {
            const holdBase = !isWimHof && currentStep === 3 ? 0.44 : 0.88;
            breathScale = holdBase + Math.sin(progress * Math.PI * 2) * 0.018;
        }

        const breathRadius = r * breathScale;
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(cx, cy, breathRadius, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.shadowColor = currentColor;
        ctx.shadowBlur = 42;
        ctx.fill();
        ctx.restore();

        // Draw glowing ball
        ctx.beginPath();
        ctx.arc(bx, by, 15, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.shadowColor = currentColor;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0; 
    }

    function renderLoop(time) {
        if (!lastTime) lastTime = time;

        if (!isRunning) {
            drawFrame(null, 0, time);
            animationFrameId = requestAnimationFrame(renderLoop);
            lastTime = time;
            return;
        }

        if (isPaused) {
            stepStartTime += (time - lastTime); 
            lastTime = time;
            drawFrame(isWimHof ? whmSteps[wimHofStepIndex] : steps[currentStep], lastProgress); 
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        processTimerAt(time);

        if (isRunning) updateTotalTime(time);

        lastTime = time;
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function currentPhaseIsComplete(time) {
        const step = isWimHof ? whmSteps[wimHofStepIndex] : steps[currentStep];
        if (!step) return false;
        const duration = step.duration();
        return duration === 0 || time - stepStartTime >= duration * 1000;
    }

    function processTimerAt(time, catchUp = false) {
        let caughtUp = false;
        let transitions = 0;

        do {
            suppressPhaseAudio = catchUp && currentPhaseIsComplete(time);
            caughtUp ||= suppressPhaseAudio;

            if (isWimHof) {
                processWimHofPhase(time);
            } else {
                processStandardPhase(time);
            }

            transitions++;
        } while (
            catchUp && isRunning && !isPaused &&
            currentPhaseIsComplete(time) && transitions < 2000
        );

        suppressPhaseAudio = false;
        if (caughtUp && isRunning) {
            const currentStepConfig = isWimHof ? whmSteps[wimHofStepIndex] : steps[currentStep];
            if (currentStepConfig) playBeep(currentStepConfig.colorKey);
        }
    }

    function processStandardPhase(time) {
        let step = steps[currentStep];
        
        // Skip 0 duration steps
        while (step && step.duration() === 0) {
            advanceStandardStep(stepStartTime);
            step = steps[currentStep];
            if (!isRunning || isWimHof) return;
        }

        if (!step) return;

        let elapsed = (time - stepStartTime) / 1000;
        let progress = elapsed / step.duration();

        let timeRemaining = Math.ceil(step.duration() - elapsed);
        if (timeRemaining < 0) timeRemaining = 0;
        if (elements.phaseTime.textContent !== String(timeRemaining)) {
            elements.phaseTime.textContent = timeRemaining;
        }

        if (progress >= 1) {
            progress = 1;
            drawFrame(step, progress);
            const completedAt = stepStartTime + step.duration() * 1000;
            advanceStandardStep(completedAt);
        } else {
            drawFrame(step, progress);
            lastProgress = progress;
        }
    }

    function advanceStandardStep(time) {
        currentStep++;
        
        if (currentStep >= steps.length) {
            currentStep = 0;
            currentCycle++;
            updateRemainingCycles();
            updateTotalTime();
            
            if (currentCycle >= totalCycles) {
                if (elements.presetSelect.value === 'wim_hof') {
                    isWimHof = true;
                    wimHofStepIndex = 0;
                    setupWimHofSteps();
                    stepStartTime = time; 
                    playBeep(whmSteps[0].colorKey);
                    setGuidedPrompt(translations[currentLanguage][whmSteps[0].textKey]);
                    return;
                } else {
                    finishSession();
                    return;
                }
            }
        }
        
        const newStep = steps[currentStep];
        if (newStep && newStep.duration() > 0) {
            setGuidedPrompt(translations[currentLanguage][newStep.textKey]);
            playBeep(newStep.colorKey);
        }
        
        stepStartTime = time;
        lastProgress = 0;
    }

    // --- WIM HOF SPECIFIC PHASE LOGIC ---

    function setupWimHofSteps() {
        whmSteps = [
            { textKey: 'holdBreath', text: 'Hold', colorKey: 'hold', duration: () => originalWhmHold + currentWhmRound * parseInt(elements.whmIncreaseInput.value) },
            { textKey: 'holdBreath', text: 'Final Pause', colorKey: 'idle', duration: () => parseInt(elements.finalPauseInput.value) },
            { textKey: 'breatheIn', text: 'Inhale and Hold', colorKey: 'inhale', duration: () => parseInt(elements.finalInhaleInput.value) },
            { textKey: 'holdBreath', text: 'Final Pause 2', colorKey: 'idle', duration: () => parseInt(elements.finalPause2Input.value) }
        ];
    }

    function processWimHofPhase(time) {
        const step = whmSteps[wimHofStepIndex];
        if (!step) {
             finishSession();
             return;
        }

        let elapsed = (time - stepStartTime) / 1000;
        let progress = elapsed / step.duration();

        let timeRemaining = Math.ceil(step.duration() - elapsed);
        if (timeRemaining < 0) timeRemaining = 0;
        if (elements.phaseTime.textContent !== String(timeRemaining)) {
            elements.phaseTime.textContent = timeRemaining;
        }

        if (progress >= 1) {
            progress = 1;
            drawFrame(step, progress);
            const completedAt = stepStartTime + step.duration() * 1000;
            
            wimHofStepIndex++;
            if (wimHofStepIndex >= whmSteps.length) {
                currentWhmRound++;
                if (currentWhmRound >= totalWhmRounds) {
                    finishSession();
                } else {
                    // Reset to standard breathing loop
                    isWimHof = false;
                    currentCycle = 0;
                    currentStep = 0;
                    
                    // Skip any 0 duration steps at the start
                    while(steps[currentStep] && steps[currentStep].duration() <= 0) {
                        currentStep++;
                    }
                    
                    setGuidedPrompt(translations[currentLanguage][steps[currentStep].textKey]);
                    playBeep(steps[currentStep].colorKey);
                    stepStartTime = completedAt;
                    lastProgress = 0;
                    updateTotalTime();
                    updateRemainingCycles();
                }
                return;
            }
            
            setGuidedPrompt(translations[currentLanguage][whmSteps[wimHofStepIndex].textKey]);
            playBeep(whmSteps[wimHofStepIndex].colorKey);
            stepStartTime = completedAt;
            lastProgress = 0;
        } else {
            drawFrame(step, progress);
            lastProgress = progress;
        }
    }


    // --- TIMER CONTROL ---

    function start() {
        if (isRunning) return;

        // Hide settings offcanvas if open
        const offcanvasElement = document.getElementById('settingsOffcanvas');
        if (offcanvasElement) {
            const bsOffcanvas = window.bootstrap?.Offcanvas.getInstance(offcanvasElement);
            if (bsOffcanvas) {
                bsOffcanvas.hide();
            }
        }

        resizeCanvas();
        updateCachedColors();

        isRunning = true;
        isPaused = false;
        isWimHof = false;
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete', 'is-paused');
        currentStep = 0;
        currentCycle = 0;
        totalCycles = parseInt(elements.cyclesInput.value);
        
        currentWhmRound = 0;
        if (elements.presetSelect.value === 'wim_hof') {
            totalWhmRounds = parseInt(elements.whmRoundsInput.value);
            originalWhmHold = parseInt(elements.holdInput.value); // Store base hold
        } else {
            totalWhmRounds = 1;
        }

        elements.startButton.classList.add('d-none');
        elements.stopButton.classList.remove('d-none');
        elements.pauseButton.classList.remove('d-none');

        updateRemainingCycles();
        updateTotalTime();
        
        while(steps[currentStep] && steps[currentStep].duration() <= 0) {
             currentStep++;
        }
        
        if (steps[currentStep]) {
             setGuidedPrompt(translations[currentLanguage][steps[currentStep].textKey]);
             playBeep(steps[currentStep].colorKey);
        } else {
             playBeep();
        }

        stepStartTime = performance.now();
        lastTime = stepStartTime;
        updateTimerExecutionMode();
    }

    function restoreIdleControls() {
        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');
        elements.pauseButton.textContent = translations[currentLanguage]?.pause || 'Pause';
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
    }

    function stop() {
        if (!isRunning) return;

        isRunning = false;
        isPaused = false;
        isWimHof = false;
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete', 'is-paused');
        stopBackgroundTimer();
        restoreIdleControls();

        updateRemainingCycles();
        updateTotalTime();
        resetDisplay();
    }

    function finishSession() {
        isRunning = false;
        isPaused = false;
        isWimHof = false;
        sessionCompleted = true;
        elements.visualizerWrapper.classList.remove('is-paused');
        elements.visualizerWrapper.classList.add('session-complete');
        stopBackgroundTimer();
        restoreIdleControls();
        setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete');
        elements.phaseTime.textContent = '';
        updateRemainingCycles();
        updateTimeDisplay(0, true);
        drawFrame(null, 0, performance.now());
    }

    function pause() {
        if (!isRunning || isPaused) return;
        isPaused = true;
        elements.visualizerWrapper.classList.add('is-paused');
        stopBackgroundTimer();
        elements.pauseButton.textContent = translations[currentLanguage]?.resume || 'Resume';
        elements.pauseButton.classList.remove('btn-warning');
        elements.pauseButton.classList.add('btn-primary');
    }

    function resume() {
        if (!isPaused) return;
        isPaused = false;
        elements.visualizerWrapper.classList.remove('is-paused');
        elements.pauseButton.textContent = translations[currentLanguage]?.pause || 'Pause';
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
        updateTimerExecutionMode();
    }

    function runBackgroundTick() {
        if (!isRunning || isPaused) return;

        const time = performance.now();
        processTimerAt(time, true);

        if (isRunning) updateTotalTime(time);
        lastTime = time;
    }

    function startBackgroundTimer() {
        if (backgroundTimerId !== null || !isRunning || isPaused) return;
        backgroundTimerId = window.setInterval(runBackgroundTick, 250);
    }

    function stopBackgroundTimer() {
        if (backgroundTimerId === null) return;
        window.clearInterval(backgroundTimerId);
        backgroundTimerId = null;
    }

    function updateTimerExecutionMode() {
        if (document.hidden) {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            startBackgroundTimer();
            return;
        }

        stopBackgroundTimer();
        if (animationFrameId === null) {
            const time = performance.now();
            if (isRunning && !isPaused) processTimerAt(time, true);
            lastTime = time;
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    }

    function resetDisplay() {
        setGuidedPrompt(translations[currentLanguage]?.ready || 'Ready to breathe');
        elements.phaseTime.textContent = '';
        drawFrame(null, 0, performance.now());
    }

    function updateTimeDisplay(totalSeconds, forceRemaining = false) {
        const roundedSeconds = Math.max(0, Math.ceil(totalSeconds));
        const minutes = Math.floor(roundedSeconds / 60);
        const seconds = roundedSeconds % 60;
        const prefix = (isRunning || forceRemaining)
            ? (currentLanguage === 'en' ? 'Time Left' : (currentLanguage === 'es' ? 'Tiempo Restante' : 'Temps Restant'))
            : (translations[currentLanguage]?.totalTime?.split(':')[0] || 'Total Time');
        const nextText = `${prefix}: ${minutes} min ${seconds} sec`;
        if (elements.totalTimeDisplay.textContent !== nextText) {
            elements.totalTimeDisplay.textContent = nextText;
        }
    }

    function durationOf(stepList, startIndex = 0) {
        return stepList.slice(startIndex).reduce((sum, step) => sum + step.duration(), 0);
    }

    function remainingInCurrentStep(time, step) {
        if (!isRunning || !step) return step?.duration() || 0;
        const elapsed = Math.max(0, (time - stepStartTime) / 1000);
        return Math.max(0, step.duration() - elapsed);
    }

    function remainingBreathingTime(time) {
        const cycleDuration = durationOf(steps);
        if (!isRunning) return cycleDuration * parseInt(elements.cyclesInput.value);

        const currentStepRemaining = remainingInCurrentStep(time, steps[currentStep]);
        const laterSteps = durationOf(steps, currentStep + 1);
        const laterCycles = Math.max(0, totalCycles - currentCycle - 1) * cycleDuration;
        return currentStepRemaining + laterSteps + laterCycles;
    }

    function updateTotalTime(time = performance.now()) {
        if (sessionCompleted) {
            updateTimeDisplay(0, true);
            return;
        }

        if (elements.presetSelect.value !== 'wim_hof') {
            updateTimeDisplay(remainingBreathingTime(time));
            return;
        }

        let totalSeconds = 0;
        const totalRounds = parseInt(elements.whmRoundsInput.value);
        const roundIndex = isRunning ? currentWhmRound : 0;
        const baseHold = isRunning && originalWhmHold > 0
            ? originalWhmHold
            : parseInt(elements.holdInput.value);
        const increase = parseInt(elements.whmIncreaseInput.value);
        const staticTime = parseInt(elements.finalPauseInput.value)
            + parseInt(elements.finalInhaleInput.value)
            + parseInt(elements.finalPause2Input.value);
        const breathsPerRound = durationOf(steps) * parseInt(elements.cyclesInput.value);

        if (!isRunning) {
            for (let round = 0; round < totalRounds; round++) {
                totalSeconds += breathsPerRound + baseHold + round * increase + staticTime;
            }
        } else if (!isWimHof) {
            totalSeconds += remainingBreathingTime(time) + baseHold + roundIndex * increase + staticTime;
        } else {
            totalSeconds += remainingInCurrentStep(time, whmSteps[wimHofStepIndex]);
            totalSeconds += durationOf(whmSteps, wimHofStepIndex + 1);
        }

        if (isRunning) {
            for (let round = roundIndex + 1; round < totalRounds; round++) {
                totalSeconds += breathsPerRound + baseHold + round * increase + staticTime;
            }
        }

        updateTimeDisplay(totalSeconds);
    }

    function updateRemainingCycles() {
        if (sessionCompleted) {
            const label = elements.presetSelect.value === 'wim_hof'
                ? (currentLanguage === 'en' ? 'Rounds Remaining' : (currentLanguage === 'es' ? 'Rondas Restantes' : 'Cycles Restants'))
                : (translations[currentLanguage]?.remainingCycles?.split(':')[0] || 'Remaining Cycles');
            elements.remainingCyclesDisplay.textContent = `${label}: 0`;
            return;
        }
        if (elements.presetSelect.value === 'wim_hof') {
            const roundText = currentLanguage === 'en' ? 'Round' : (currentLanguage === 'es' ? 'Ronda' : 'Cycle');
            const currentR = isRunning ? currentWhmRound + 1 : 1;
            const totRounds = elements.whmRoundsInput.value;
            
            if (isWimHof) {
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${currentR}/${totRounds} | Holding...`;
            } else {
                const remainingBreaths = Math.max(0, parseInt(elements.cyclesInput.value) - currentCycle);
                const breathText = currentLanguage === 'en' ? 'Breaths' : (currentLanguage === 'es' ? 'Resp.' : 'Resp.');
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${currentR}/${totRounds} | ${breathText}: ${remainingBreaths}`;
            }
        } else {
            const remainingText = translations[currentLanguage]?.remainingCycles?.split(':')[0] || 'Remaining Cycles';
            elements.remainingCyclesDisplay.textContent = `${remainingText}: ${Math.max(0, parseInt(elements.cyclesInput.value) - currentCycle)}`;
        }
    }

    function translatePage() {
        // Toggle Cycles label based on preset
        if (elements.presetSelect.value === 'wim_hof') {
            elements.cyclesLabel.setAttribute('data-lang-key', 'numberBreaths');
        } else {
            elements.cyclesLabel.setAttribute('data-lang-key', 'cycles');
        }

        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            const translation = translations[currentLanguage]?.[key];
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else {
                    if (key !== 'totalTime' && key !== 'remainingCycles') {
                        element.textContent = translation;
                    }
                }
            }
        });
        document.getElementById('preset-description').textContent =
            presetDescriptions[currentLanguage][elements.presetSelect.value];
        updateTotalTime();
        updateRemainingCycles();
        if (sessionCompleted) {
            setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete', true);
        } else if (!isRunning) {
            resetDisplay();
        }
    }

    // Local storage functions
    function savePreferences() {
        const preferences = {
            preset: elements.presetSelect.value,
            inhale: elements.inhaleInput.value,
            pause1: elements.pause1Input.value,
            exhale: elements.exhaleInput.value,
            pause2: elements.pause2Input.value,
            cycles: elements.cyclesInput.value,
            volume: elements.volumeControl.value,
            darkMode: document.body.classList.contains('dark-mode'),
            language: currentLanguage,
            primaryColor,
            hold: elements.holdInput.value,
            finalPause: elements.finalPauseInput.value,
            finalInhale: elements.finalInhaleInput.value,
            finalPause2: elements.finalPause2Input.value,
            whmRounds: elements.whmRoundsInput.value,
            whmIncrease: elements.whmIncreaseInput.value,
        };
        localStorage.setItem('breathingTimerPreferences', JSON.stringify(preferences));
    }

    function setStoredNumber(input, value) {
        if (value === undefined || value === null || value === '') return;
        const parsed = Number(value);
        const min = Number(input.min);
        const max = Number(input.max);
        if (!Number.isFinite(parsed)) return;
        input.value = Math.min(max, Math.max(min, parsed));
    }

    function syncPresetUi() {
        const isWhmPreset = elements.presetSelect.value === 'wim_hof';
        elements.wimHofExtraFields.classList.toggle('is-visible', isWhmPreset);
        elements.wimHofExtraFields.setAttribute('aria-hidden', String(!isWhmPreset));
        elements.cyclesLabel.setAttribute('data-lang-key', isWhmPreset ? 'numberBreaths' : 'cycles');
    }

    function loadPreferences() {
        let preferences = null;
        try {
            preferences = JSON.parse(localStorage.getItem('breathingTimerPreferences'));
        } catch (error) {
            console.warn('Ignoring invalid saved preferences.', error);
            localStorage.removeItem('breathingTimerPreferences');
        }

        if (preferences) {
            if (presets[preferences.preset]) elements.presetSelect.value = preferences.preset;
            setStoredNumber(elements.inhaleInput, preferences.inhale);
            setStoredNumber(elements.pause1Input, preferences.pause1);
            setStoredNumber(elements.exhaleInput, preferences.exhale);
            setStoredNumber(elements.pause2Input, preferences.pause2);
            setStoredNumber(elements.cyclesInput, preferences.cycles);
            setStoredNumber(elements.volumeControl, preferences.volume);
            setStoredNumber(elements.holdInput, preferences.hold);
            setStoredNumber(elements.finalPauseInput, preferences.finalPause);
            setStoredNumber(elements.finalInhaleInput, preferences.finalInhale);
            setStoredNumber(elements.finalPause2Input, preferences.finalPause2);
            setStoredNumber(elements.whmRoundsInput, preferences.whmRounds);
            setStoredNumber(elements.whmIncreaseInput, preferences.whmIncrease);

            if (typeof preferences.darkMode === 'boolean') {
                if(preferences.darkMode) {
                    document.body.classList.add('dark-mode');
                    elements.toggleModeButton.checked = true;
                } else {
                    document.body.classList.remove('dark-mode');
                    elements.toggleModeButton.checked = false;
                }
            }
            if (translations[preferences.language]) {
                currentLanguage = preferences.language;
                elements.languageToggle.textContent = currentLanguage.toUpperCase();
            }
            if (/^#[0-9a-f]{6}$/i.test(preferences.primaryColor || '')) {
                primaryColor = preferences.primaryColor;
            }
        }
        applyPrimaryColor(primaryColor);
        syncPresetUi();
        translatePage();
    }

    // Event Listeners
    elements.startButton.addEventListener('click', start);
    elements.stopButton.addEventListener('click', stop);
    elements.pauseButton.addEventListener('click', () => {
        if (isPaused) resume(); else pause();
    });

    elements.volumeControl.addEventListener('input', (event) => {
        beep.volume = event.target.value;
        event.target.style.setProperty('--range-progress', `${event.target.value * 100}%`);
        savePreferences();
    });

    elements.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            applyPrimaryColor(swatch.dataset.color);
            savePreferences();
        });
    });

    elements.primaryColorInput.addEventListener('input', (event) => {
        applyPrimaryColor(event.target.value);
        savePreferences();
    });

    elements.presetSelect.addEventListener('change', (event) => {
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete');
        const preset = presets[event.target.value];
        elements.inhaleInput.value = preset.inhale;
        elements.pause1Input.value = preset.pause1;
        elements.exhaleInput.value = preset.exhale;
        elements.pause2Input.value = preset.pause2;

        if (preset.cycles) elements.cyclesInput.value = preset.cycles;
        if (preset.whmRounds) elements.whmRoundsInput.value = preset.whmRounds;
        if (preset.whmIncrease) elements.whmIncreaseInput.value = preset.whmIncrease;
        if (preset.hold) elements.holdInput.value = preset.hold;
        if (preset.finalPause) elements.finalPauseInput.value = preset.finalPause;
        if (preset.finalInhale) elements.finalInhaleInput.value = preset.finalInhale;
        if (preset.finalPause2) elements.finalPause2Input.value = preset.finalPause2;

        syncPresetUi();
        translatePage();
        savePreferences();
    });

    elements.toggleModeButton.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        applyPrimaryColor(primaryColor);
        savePreferences();
    });

    elements.languageToggle.addEventListener('click', () => {
        const languages = Object.keys(translations);
        const currentIndex = languages.indexOf(currentLanguage);
        currentLanguage = languages[(currentIndex + 1) % languages.length];
        elements.languageToggle.textContent = currentLanguage.toUpperCase();
        translatePage();
        savePreferences();
    });

    [
        elements.inhaleInput, elements.pause1Input, elements.exhaleInput,
        elements.pause2Input, elements.cyclesInput, elements.holdInput,
        elements.finalPauseInput, elements.finalInhaleInput, elements.finalPause2Input,
        elements.whmRoundsInput, elements.whmIncreaseInput
    ].forEach(input => {
        input.addEventListener('input', () => {
            sessionCompleted = false;
            elements.visualizerWrapper.classList.remove('session-complete');
            updateTotalTime();
            savePreferences();
        });

        input.addEventListener('change', () => {
            const value = parseInt(input.value);
            const min = parseInt(input.min);
            const max = parseInt(input.max);

            if (isNaN(value) || value < min) input.value = min;
            else if (value > max) input.value = max;

            updateTotalTime();
            savePreferences();
            
            // Set preset to Custom if a core timing value manually changed (ignore WHM specific ones)
            if (['inhale', 'pause1', 'exhale', 'pause2'].includes(input.id)) {
                elements.presetSelect.value = 'custom';
                syncPresetUi();
                translatePage();
                savePreferences();
            }
        });
    });

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && (
            target.isContentEditable ||
            ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)
        )) return;

        if (event.code === 'Space') {
            event.preventDefault();
            if (isRunning) stop(); else start();
        } else if (event.code === 'KeyP') {
            event.preventDefault();
            if (isRunning) isPaused ? resume() : pause();
        }
    });

    document.addEventListener('visibilitychange', () => {
        updateTimerExecutionMode();
    });

    window.addEventListener('resize', () => {
        resizeCanvas();
        if(!isRunning) drawFrame(null, 0, performance.now());
    });

    function initialize() {
        loadPreferences();
        syncPresetUi();
        translatePage();

        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');

        beep.volume = elements.volumeControl.value;
        elements.volumeControl.style.setProperty('--range-progress', `${elements.volumeControl.value * 100}%`);
        
        resizeCanvas();
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    initialize();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
