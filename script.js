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
        phaseTime: document.getElementById('phase-time'),
        wimHofExtraFields: document.getElementById('wim-hof-extra-fields'),
        languageToggle: document.getElementById('language-toggle'),
        guidedPrompt: document.getElementById('guided-prompt')
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

    // Animation Loop Variables
    let animationFrameId = null;
    let stepStartTime = 0;
    let lastTime = 0;
    let lastProgress = 0;
    let cachedColors = {};
    
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
            complete: 'Session complete'
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
            complete: 'Sesión completada'
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
            complete: 'Session terminée'
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

    // --- CANVAS VISUALIZER LOGIC ---

    function resizeCanvas() {
        const wrapper = document.querySelector('.visualizer-wrapper');
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
            glassBorder: getComputedStyle(root).getPropertyValue('--glass-border').trim(),
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

        if (isWimHof) {
             processWimHofPhase(time);
        } else {
             processStandardPhase(time);
        }

        if (isRunning) updateTotalTime(time);

        lastTime = time;
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function processStandardPhase(time) {
        let step = steps[currentStep];
        
        // Skip 0 duration steps
        while (step && step.duration() === 0) {
            advanceStandardStep(time);
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
            advanceStandardStep(time);
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
                    elements.guidedPrompt.textContent = translations[currentLanguage][whmSteps[0].textKey];
                    return;
                } else {
                    finishSession();
                    return;
                }
            }
        }
        
        const newStep = steps[currentStep];
        if (newStep && newStep.duration() > 0) {
            elements.guidedPrompt.textContent = translations[currentLanguage][newStep.textKey];
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
                    
                    elements.guidedPrompt.textContent = translations[currentLanguage][steps[currentStep].textKey];
                    playBeep(steps[currentStep].colorKey);
                    stepStartTime = time;
                    lastProgress = 0;
                    updateTotalTime();
                    updateRemainingCycles();
                }
                return;
            }
            
            elements.guidedPrompt.textContent = translations[currentLanguage][whmSteps[wimHofStepIndex].textKey];
            playBeep(whmSteps[wimHofStepIndex].colorKey);
            stepStartTime = time;
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
             elements.guidedPrompt.textContent = translations[currentLanguage][steps[currentStep].textKey];
             playBeep(steps[currentStep].colorKey);
        } else {
             playBeep();
        }

        stepStartTime = performance.now();
        lastTime = stepStartTime;
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
        restoreIdleControls();
        elements.guidedPrompt.textContent = translations[currentLanguage]?.complete || 'Session complete';
        elements.phaseTime.textContent = '';
        updateRemainingCycles();
        updateTimeDisplay(0, true);
        drawFrame(null, 0, performance.now());
    }

    function pause() {
        if (!isRunning || isPaused) return;
        isPaused = true;
        elements.pauseButton.textContent = translations[currentLanguage]?.resume || 'Resume';
        elements.pauseButton.classList.remove('btn-warning');
        elements.pauseButton.classList.add('btn-primary');
    }

    function resume() {
        if (!isPaused) return;
        isPaused = false;
        elements.pauseButton.textContent = translations[currentLanguage]?.pause || 'Pause';
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
    }

    function resetDisplay() {
        elements.guidedPrompt.textContent = translations[currentLanguage]?.ready || 'Ready to breathe';
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
        updateTotalTime();
        updateRemainingCycles();
        if (sessionCompleted) {
            elements.guidedPrompt.textContent = translations[currentLanguage]?.complete || 'Session complete';
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
        elements.wimHofExtraFields.classList.toggle('d-none', !isWhmPreset);
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
        }
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
        savePreferences();
    });

    elements.presetSelect.addEventListener('change', (event) => {
        sessionCompleted = false;
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
        updateCachedColors();
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
        if (document.hidden && isRunning && !isPaused) pause();
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
