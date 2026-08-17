document.addEventListener('DOMContentLoaded', () => {
    // Element references
    const Model = window.BreathingModel;
    const Storage = window.BreathingStorage;
    const UiUtils = window.BreathingUiUtils;
    const TranslationManager = window.BreathingTranslationManager;
    const Voice = window.BreathingVoice;
    const Theme = window.BreathingTheme;
    const Visualizer = window.BreathingVisualizer;
    const ProtocolEditor = window.BreathingProtocolEditor;
    const ExerciseChooser = window.BreathingExerciseChooser;
    const App = window.BreathingApp;
    if (!Model || !Storage || !UiUtils || !TranslationManager || !Voice || !Theme || !Visualizer || !ProtocolEditor || !ExerciseChooser || !App) {
        console.error('A required breathing app module failed to load.');
        return;
    }
    const elements = {
        protocolRoundsInput: document.getElementById('protocol-rounds'),
        blockList: document.getElementById('block-list'),
        addPatternBlockButton: document.getElementById('add-pattern-block'),
        addRetentionBlockButton: document.getElementById('add-retention-block'),
        addLibraryBlockSelect: document.getElementById('add-library-block'),
        exerciseNameInput: document.getElementById('exercise-name'),
        saveExerciseButton: document.getElementById('save-exercise'),
        deleteExerciseButton: document.getElementById('delete-exercise'),
        totalTimeDisplay: document.getElementById('total-time'),
        remainingCyclesDisplay: document.getElementById('remaining-cycles'),
        startButton: document.getElementById('start'),
        stopButton: document.getElementById('stop'),
        pauseButton: document.getElementById('pause'),
        toggleModeButton: document.getElementById('toggle-mode'),
        audioModeControl: document.getElementById('audio-mode'),
        volumeControl: document.getElementById('volume-control'),
        presetSelect: document.getElementById('preset-select'),
        selectedPresetInfo: document.getElementById('selected-preset-info'),
        canvas: document.getElementById('breathing-canvas'),
        visualizerWrapper: document.querySelector('.visualizer-wrapper'),
        phaseTime: document.getElementById('phase-time'),
        languageToggle: document.getElementById('language-toggle'),
        guidedPrompt: document.getElementById('guided-prompt'),
        selectedPresetName: document.getElementById('selected-preset-name'),
        practiceSummary: document.getElementById('practice-summary'),
        exerciseChooserButton: document.getElementById('exercise-chooser-button'),
        exerciseChooserMenu: document.getElementById('exercise-chooser-menu'),
        primaryColorInput: document.getElementById('primary-color'),
        applyCustomColorButton: document.getElementById('apply-custom-color'),
        colorSwatches: document.querySelectorAll('.color-swatch'),
        appVersions: document.querySelectorAll('[data-app-version]'),
        appStatus: document.getElementById('app-status')
    };

    const ctx = elements.canvas.getContext('2d');

    // State variables
    let workingProtocol = Model.getBuiltin('custom');
    let selectedProtocolId = 'custom';
    let session = null;
    let isRunning = false;
    let isPaused = false;
    let currentLanguage = 'en';
    let sessionCompleted = false;
    let primaryColor = '#006a6a';
    let customAccentColor = '#006a6a';
    let promptTransitionId = 0;
    const SESSION_COUNTDOWN_SECONDS = 3;
    const PRESET_SWATCH_COLORS = new Set(['#006a6a', '#345ca8', '#6750a4', '#8c4a60', '#386a20']);

    // Animation Loop Variables
    let animationFrameId = null;
    let backgroundTimerId = null;
    let isCountingDown = false;
    let countdownStartTime = 0;
    let stepStartTime = 0;
    let lastTime = 0;
    let lastProgress = 0;
    let suppressPhaseAudio = false;
    let visualizerResizeObserver = null;

    let cachedVisualPhases = null;
    let cachedVisualPhasesBlock = null;
    let cachedVisualPhasesProtocol = null;

    const translations = TranslationManager.translations;
    const presetDescriptions = TranslationManager.presetDescriptions;

    const visualizer = Visualizer.createVisualizer({
        canvas: elements.canvas,
        ctx,
        getWrapper: () => elements.visualizerWrapper,
        getIsRunning: () => isRunning,
        getSession: () => session,
        visualPhaseList,
        currentStep
    });

    const protocolEditor = ProtocolEditor.createProtocolEditor({
        Model,
        elements,
        getWorkingProtocol: () => workingProtocol,
        getSelectedProtocolId: () => selectedProtocolId,
        getTranslations: () => translations[currentLanguage] || {},
        protocolDisplayName,
        formatBlockSummary,
        markAsCustomIfBuiltin,
        afterProtocolEdit
    });

    const exerciseChooser = ExerciseChooser.createExerciseChooser({
        Model,
        UiUtils,
        elements,
        getSelectedProtocolId: () => selectedProtocolId,
        setSelectedProtocolId: (id) => { selectedProtocolId = id; },
        getTranslations: () => translations[currentLanguage] || {},
        homeExerciseName,
        loadProtocol
    });

    /**
     * Applies the accent seed through BreathingTheme, then updates swatches,
     * theme-color, and the idle orb. Palette math stays in theme.js so it can
     * be unit-tested without this DOM glue.
     *
     * @param {string} color - 3- or 6-digit hex seed
     */
    function applyPrimaryColor(color) {
        const result = Theme.applyPrimaryColor(color, {
            darkMode: document.body.classList.contains('dark-mode'),
            styleTarget: document.body.style
        });
        if (!result) return;
        primaryColor = result.color;
        if (elements.primaryColorInput) {
            elements.primaryColorInput.value = customAccentColor;
        }
        const customButton = elements.primaryColorInput?.closest('.custom-color-button');
        let matchesSwatch = false;
        elements.colorSwatches.forEach(swatch => {
            const selected = swatch.dataset.color.toLowerCase() === primaryColor;
            swatch.setAttribute('aria-pressed', String(selected));
            matchesSwatch ||= selected;
        });
        if (customButton) {
            customButton.classList.toggle('is-selected', !matchesSwatch);
            customButton.setAttribute('aria-pressed', String(!matchesSwatch));
        }
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.content = result.palette.surface;
        visualizer.updateCachedColors();
        if (!isRunning) visualizer.drawFrame(null, 0, performance.now());
    }

    // Spoken phase cues
    const voiceGuide = Voice.createVoiceGuide({
        getLanguage: () => currentLanguage,
        getVolume: () => elements.volumeControl.value,
        getMode: () => elements.audioModeControl.value,
        onError: detail => console.warn('Audio cue changed playback path.', detail)
    });

    function currentStep() {
        return session?.currentStep() || null;
    }

    function visualPhaseList() {
        if (isRunning && session) {
            const block = session.currentBlock();
            if (cachedVisualPhasesBlock === block) return cachedVisualPhases;
            cachedVisualPhasesBlock = block;
            cachedVisualPhasesProtocol = null;
            cachedVisualPhases = session.visualPhases();
            return cachedVisualPhases;
        } else {
            if (cachedVisualPhasesProtocol === workingProtocol) return cachedVisualPhases;
            cachedVisualPhasesProtocol = workingProtocol;
            cachedVisualPhasesBlock = null;
            const pattern = Model.firstPatternBlock(workingProtocol);
            cachedVisualPhases = pattern ? Model.activePhases(pattern.phases) : [];
            return cachedVisualPhases;
        }
    }

    function speakPhase(phaseType = 'hold') {
        if (suppressPhaseAudio) return;
        voiceGuide.speak(phaseType);
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

    function renderLoop(time) {
        if (!lastTime) lastTime = time;

        if (!isRunning) {
            visualizer.drawFrame(null, 0, time);
            animationFrameId = requestAnimationFrame(renderLoop);
            lastTime = time;
            return;
        }

        if (isPaused) {
            stepStartTime += (time - lastTime); 
            lastTime = time;
            visualizer.drawFrame(currentStep(), lastProgress); 
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        processActiveTimerAt(time);

        if (isRunning) updateTotalTime(time);

        lastTime = time;
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function currentPhaseIsComplete(time) {
        const step = currentStep();
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
            processPhase(time);
            transitions++;
        } while (
            catchUp && isRunning && !isPaused &&
            currentPhaseIsComplete(time) && transitions < 2000
        );

        suppressPhaseAudio = false;
        if (caughtUp && isRunning) {
            const step = currentStep();
            if (step) speakPhase(step.type);
        }
    }

    /**
     * Holds the session on its first step until the three-second preparation
     * period completes. Absolute timestamps keep the countdown accurate when
     * Android throttles animation frames or switches to the background timer.
     */
    function processSessionCountdown(time) {
        const remaining = UiUtils.countdownSecondsRemaining(
            countdownStartTime,
            time,
            SESSION_COUNTDOWN_SECONDS
        );
        if (remaining > 0) {
            if (elements.phaseTime.textContent !== String(remaining)) {
                elements.phaseTime.textContent = remaining;
            }
            visualizer.drawFrame(currentStep(), 0, time);
            return;
        }

        isCountingDown = false;
        countdownStartTime = 0;
        stepStartTime = time;
        lastTime = time;
        lastProgress = 0;
        elements.pauseButton.classList.remove('d-none');

        const firstStep = currentStep();
        if (firstStep) {
            setGuidedPrompt(translations[currentLanguage][firstStep.textKey]);
            speakPhase(firstStep.type);
        } else {
            speakPhase();
        }
    }

    function processActiveTimerAt(time, catchUp = false) {
        if (isCountingDown) {
            processSessionCountdown(time);
            return;
        }
        processTimerAt(time, catchUp);
    }

    function processPhase(time) {
        const step = currentStep();
        if (!step) {
            finishSession();
            return;
        }

        const duration = step.duration();
        if (duration <= 0) {
            const result = session.advance();
            if (result.done) finishSession();
            return;
        }

        const elapsed = (time - stepStartTime) / 1000;
        let progress = elapsed / duration;
        let timeRemaining = Math.ceil(duration - elapsed);
        if (timeRemaining < 0) timeRemaining = 0;
        if (elements.phaseTime.textContent !== String(timeRemaining)) {
            elements.phaseTime.textContent = timeRemaining;
        }

        if (progress >= 1) {
            progress = 1;
            visualizer.drawFrame(step, progress);
            const completedAt = stepStartTime + duration * 1000;
            const result = session.advance();
            if (result.done) {
                finishSession();
                return;
            }
            const nextStep = currentStep();
            if (nextStep && nextStep.duration() > 0) {
                setGuidedPrompt(translations[currentLanguage][nextStep.textKey]);
                speakPhase(nextStep.type);
            }
            stepStartTime = completedAt;
            lastProgress = 0;
            updateRemainingCycles();
            updateTotalTime();
        } else {
            visualizer.drawFrame(step, progress);
            lastProgress = progress;
        }
    }


    // --- TIMER CONTROL ---

    function hideSettingsSheets() {
        ['appearanceOffcanvas', 'breathingOffcanvas', 'profileOffcanvas'].forEach((id) => {
            const offcanvasElement = document.getElementById(id);
            const bsOffcanvas = offcanvasElement && window.bootstrap?.Offcanvas.getInstance(offcanvasElement);
            if (bsOffcanvas) bsOffcanvas.hide();
        });
    }

    function start() {
        if (isRunning) return;

        // Keep mobile media permission attached to the Start gesture even
        // though the first audible cue is delayed by the countdown.
        voiceGuide.prepare();

        hideSettingsSheets();
        setNavDestinationActive('home');

        session = Model.createSession(workingProtocol);
        sessionCompleted = false;
        isPaused = false;
        isCountingDown = true;
        countdownStartTime = performance.now();
        stepStartTime = countdownStartTime;
        lastTime = countdownStartTime;
        lastProgress = 0;
        isRunning = true;
        document.body.classList.add('session-active');
        visualizer.resizeCanvas();
        visualizer.updateCachedColors();
        elements.visualizerWrapper.classList.remove('session-complete', 'is-paused');

        elements.startButton.classList.add('d-none');
        elements.stopButton.classList.remove('d-none');
        elements.pauseButton.classList.add('d-none');

        updateRemainingCycles();
        updateTotalTime();

        setGuidedPrompt(translations[currentLanguage]?.ready || 'Ready to breathe', true);
        elements.phaseTime.textContent = String(SESSION_COUNTDOWN_SECONDS);
        updateTimerExecutionMode();
    }

    function restoreIdleControls() {
        document.body.classList.remove('session-active');
        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');
        setPauseControl(false);
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
    }

    function stop() {
        if (!isRunning) return;

        isRunning = false;
        isPaused = false;
        isCountingDown = false;
        countdownStartTime = 0;
        voiceGuide.cancel();
        sessionCompleted = false;
        session = null;
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
        isCountingDown = false;
        countdownStartTime = 0;
        voiceGuide.cancel();
        session = null;
        sessionCompleted = true;
        elements.visualizerWrapper.classList.remove('is-paused');
        elements.visualizerWrapper.classList.add('session-complete');
        stopBackgroundTimer();
        restoreIdleControls();
        setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete');
        elements.phaseTime.textContent = '';
        updateRemainingCycles();
        updateTimeDisplay(0, true);
        visualizer.drawFrame(null, 0, performance.now());
    }

    function pause() {
        if (!isRunning || isPaused || isCountingDown) return;
        isPaused = true;
        voiceGuide.cancel();
        elements.visualizerWrapper.classList.add('is-paused');
        stopBackgroundTimer();
        setPauseControl(true);
        elements.pauseButton.classList.remove('btn-warning');
        elements.pauseButton.classList.add('btn-primary');
    }

    function resume() {
        if (!isPaused) return;
        isPaused = false;
        elements.visualizerWrapper.classList.remove('is-paused');
        setPauseControl(false);
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
        const step = currentStep();
        if (step) speakPhase(step.type);
        updateTimerExecutionMode();
    }

    function toggleSessionPause() {
        if (!isRunning) return;
        if (isPaused) resume();
        else pause();
    }

    function runBackgroundTick() {
        if (!isRunning || isPaused) return;

        const time = performance.now();
        processActiveTimerAt(time, true);

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
            if (isRunning && !isPaused) processActiveTimerAt(time, true);
            lastTime = time;
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    }

    function resetDisplay() {
        setGuidedPrompt(translations[currentLanguage]?.ready || 'Ready to breathe');
        elements.phaseTime.textContent = '';
        visualizer.drawFrame(null, 0, performance.now());
    }

    function updateTimeDisplay(totalSeconds, forceRemaining = false) {
        const nextText = UiUtils.formatDuration(
            totalSeconds,
            translations[currentLanguage],
            isRunning || forceRemaining
        );
        if (elements.totalTimeDisplay.textContent !== nextText) {
            elements.totalTimeDisplay.textContent = nextText;
        }
    }

    function updateTotalTime(time = performance.now()) {
        if (sessionCompleted) {
            updateTimeDisplay(0, true);
            return;
        }

        if (isRunning && session) {
            if (isCountingDown) {
                updateTimeDisplay(Model.protocolDuration(workingProtocol));
                return;
            }
            updateTimeDisplay(session.remainingSeconds(time, stepStartTime));
            return;
        }

        updateTimeDisplay(Model.protocolDuration(workingProtocol));
    }

    function updateRemainingCycles() {
        const t = translations[currentLanguage] || {};
        const holdingText = t.holding || 'Holding...';
        if (sessionCompleted) {
            const label = Model.protocolHasMultipleStages(workingProtocol)
                ? (t.roundsRemaining || 'Rounds Remaining')
                : (t.remainingCyclesLabel || 'Remaining Cycles');
            elements.remainingCyclesDisplay.textContent = `${label}: 0`;
            return;
        }

        const info = isRunning && session
            ? session.progressInfo()
            : {
                round: 1,
                totalRounds: workingProtocol.rounds,
                remainingCycles: Model.firstPatternBlock(workingProtocol)?.cycles || 0,
                inRetention: false,
                inPattern: true,
                multiRound: Model.protocolHasMultipleStages(workingProtocol)
            };

        if (info.multiRound) {
            const roundText = t.roundLabel || 'Round';
            if (!info.inPattern) {
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${info.round}/${info.totalRounds} | ${holdingText}`;
            } else {
                const breathText = t.breathsLabel || 'Breaths';
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${info.round}/${info.totalRounds} | ${breathText}: ${info.remainingCycles}`;
            }
            return;
        }

        const remainingText = t.remainingCyclesLabel || 'Remaining Cycles';
        elements.remainingCyclesDisplay.textContent = `${remainingText}: ${info.remainingCycles}`;
    }

    function setPauseControl(paused) {
        const icon = elements.pauseButton.querySelector('i');
        const label = elements.pauseButton.querySelector('.control-label');
        if (icon) icon.className = paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        if (label) {
            label.textContent = paused
                ? (translations[currentLanguage]?.resume || 'Resume')
                : (translations[currentLanguage]?.pause || 'Pause');
            label.setAttribute('data-lang-key', paused ? 'resume' : 'pause');
        }
        elements.pauseButton.setAttribute('aria-label', label?.textContent || (paused ? 'Resume' : 'Pause'));
    }

    function syncLanguageToggleLabel() {
        const code = elements.languageToggle?.querySelector('.toolbar-lang-code') || elements.languageToggle;
        if (code) code.textContent = currentLanguage.toUpperCase();
    }

    function protocolDisplayName(protocol) {
        if (protocol.nameKey && translations[currentLanguage]?.[protocol.nameKey]) {
            return translations[currentLanguage][protocol.nameKey];
        }
        return protocol.name || translations[currentLanguage]?.custom || 'Custom';
    }

    function homeExerciseName(protocol) {
        return protocolDisplayName(protocol).replace(/\s*\(\d+(?:\s*[-–·]\s*\d+)+\)\s*$/, '');
    }

    function formatBlockSummary(blockSummary) {
        const t = translations[currentLanguage] || {};
        if (blockSummary.kind === 'retention') {
            const hold = t.holdBlock || 'Hold';
            return blockSummary.increasePerRound
                ? `${hold} ${blockSummary.duration}+${blockSummary.increasePerRound}`
                : `${hold} ${blockSummary.duration}`;
        }
        if (blockSummary.kind === 'ref') {
            const name = (blockSummary.nameKey && t[blockSummary.nameKey]) || blockSummary.name;
            return (t.usesExercise || 'Uses {name}').replace('{name}', name);
        }
        if (blockSummary.phases?.length) {
            return `${blockSummary.phases.join(' · ')} × ${blockSummary.cycles}`;
        }
        return `${blockSummary.cycles} ${t.cycles || 'cycles'}`;
    }

    function syncPracticeSummary() {
        const t = translations[currentLanguage] || {};
        elements.selectedPresetName.textContent = homeExerciseName(workingProtocol);
        const summary = Model.summaryParts(workingProtocol);
        if (summary.kind === 'protocol') {
            const parts = summary.blocks.map(formatBlockSummary);
            if (summary.rounds > 1) parts.push(`${summary.rounds} ${t.rounds || 'rounds'}`);
            elements.practiceSummary.textContent = parts.join(' · ');
        } else {
            elements.practiceSummary.textContent = `${summary.phases.join(' · ')} · ${summary.cycles} ${t.cycles || 'cycles'}`;
        }
        syncSelectedPresetInfo();
    }


    function markAsCustomIfBuiltin() {
        if (selectedProtocolId !== 'custom' && Model.PRESET_IDS.includes(selectedProtocolId)) {
            selectedProtocolId = 'custom';
            workingProtocol.id = 'custom';
            workingProtocol.nameKey = 'custom';
            workingProtocol.name = translations[currentLanguage]?.custom || 'Custom';
            workingProtocol.builtin = true;
            workingProtocol.piece = false;
            elements.presetSelect.value = 'custom';
        }
    }

    function afterProtocolEdit(rerender = true) {
        cachedVisualPhasesProtocol = null; // Invalidate cache
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete');
        if (rerender) protocolEditor.render();
        syncPracticeSummary();
        updateTotalTime();
        updateRemainingCycles();
        savePreferences();
        if (!isRunning) visualizer.drawFrame(null, 0, performance.now());
    }

    function translatePage() {
        document.documentElement.lang = currentLanguage;
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            const translation = translations[currentLanguage]?.[key];
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else if (key !== 'totalTime' && key !== 'remainingCycles') {
                    element.textContent = translation;
                }
            }
        });
        document.querySelectorAll('[data-lang-aria]').forEach(element => {
            const translation = translations[currentLanguage]?.[element.dataset.langAria];
            if (translation) element.setAttribute('aria-label', translation);
        });
        document.querySelectorAll('[data-lang-title]').forEach(element => {
            const translation = translations[currentLanguage]?.[element.dataset.langTitle];
            if (translation) element.title = translation;
        });

        exerciseChooser.refreshPresetSelect();
        const description = presetDescriptions[currentLanguage]?.[selectedProtocolId]
            || (workingProtocol.builtin ? '' : workingProtocol.name);
        document.getElementById('preset-description').textContent = description;
        protocolEditor.render();
        syncPracticeSummary();
        updateTotalTime();
        updateRemainingCycles();
        if (sessionCompleted) {
            setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete', true);
        } else if (!isRunning) {
            resetDisplay();
        }
    }

    function announceStatus(message) {
        if (!elements.appStatus || !message) return;
        elements.appStatus.textContent = '';
        window.requestAnimationFrame(() => { elements.appStatus.textContent = message; });
    }

    function savePreferences() {
        const preferences = {
            protocolId: selectedProtocolId,
            protocol: workingProtocol,
            audioMode: elements.audioModeControl.value,
            volume: elements.volumeControl.value,
            darkMode: document.body.classList.contains('dark-mode'),
            language: currentLanguage,
            primaryColor,
            customAccentColor
        };
        const saved = Storage.writeJSON('breathingTimerPreferences', preferences);
        if (!saved) announceStatus(translations[currentLanguage]?.storageError);
        return saved;
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
        protocolEditor.render();
        syncPracticeSummary();
    }

    function loadProtocol(id) {
        selectedProtocolId = id;
        workingProtocol = Model.findProtocol(id);
        elements.presetSelect.value = id;
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete');
        syncPresetUi();
        translatePage();
        savePreferences();
        if (!isRunning) visualizer.drawFrame(null, 0, performance.now());
    }

    function loadPreferences() {
        const preferences = Storage.readJSON('breathingTimerPreferences', null);

        if (preferences) {
            if (Object.values(Voice.AUDIO_MODES).includes(preferences.audioMode)) {
                elements.audioModeControl.value = preferences.audioMode;
            }
            setStoredNumber(elements.volumeControl, preferences.volume);
            if (typeof preferences.darkMode === 'boolean') {
                if (preferences.darkMode) {
                    document.body.classList.add('dark-mode');
                    elements.toggleModeButton.checked = true;
                } else {
                    document.body.classList.remove('dark-mode');
                    elements.toggleModeButton.checked = false;
                }
            }
            if (translations[preferences.language]) {
                currentLanguage = preferences.language;
                syncLanguageToggleLabel();
            }
            if (/^#[0-9a-f]{6}$/i.test(preferences.primaryColor || '')) {
                primaryColor = preferences.primaryColor;
            }
            if (/^#[0-9a-f]{6}$/i.test(preferences.customAccentColor || '')) {
                customAccentColor = preferences.customAccentColor;
            } else if (!PRESET_SWATCH_COLORS.has(primaryColor.toLowerCase())) {
                customAccentColor = primaryColor;
            }

            workingProtocol = Model.migrateLegacyPreferences(preferences);
            selectedProtocolId = Model.canonicalId(
                preferences.protocolId
                || preferences.preset
                || workingProtocol.id
                || 'custom'
            );
            if (!Model.PRESET_IDS.includes(selectedProtocolId)
                && !Model.loadUserLibrary().some(item => item.id === selectedProtocolId)) {
                selectedProtocolId = workingProtocol.builtin ? workingProtocol.id : selectedProtocolId;
            }
        }

        applyPrimaryColor(primaryColor);
        if (elements.primaryColorInput) {
            elements.primaryColorInput.value = customAccentColor;
        }
        exerciseChooser.refreshPresetSelect();
        elements.presetSelect.value = [...elements.presetSelect.options].some(option => option.value === selectedProtocolId)
            ? selectedProtocolId
            : 'custom';
        syncPresetUi();
        translatePage();
    }

    // Event Listeners
    elements.startButton.addEventListener('click', start);
    elements.stopButton.addEventListener('click', stop);
    elements.pauseButton.addEventListener('click', () => {
        toggleSessionPause();
    });

    document.addEventListener('click', (event) => {
        if (!isRunning) return;
        const target = event.target;
        if (target instanceof Element && target.closest('button, a, input, select, textarea, label, .offcanvas, .modal, .practice-chooser, .app-nav')) {
            return;
        }
        toggleSessionPause();
    });

    elements.volumeControl.addEventListener('input', (event) => {
        event.target.style.setProperty('--range-progress', `${event.target.value * 100}%`);
        savePreferences();
    });

    elements.audioModeControl.addEventListener('change', () => {
        voiceGuide.cancel();
        savePreferences();
    });

    elements.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            applyPrimaryColor(swatch.dataset.color);
            savePreferences();
        });
    });

    const applyPickedColor = (event) => {
        const nextColor = Theme.normalizeHex(event.target.value);
        if (!nextColor) return;
        customAccentColor = nextColor;
        applyPrimaryColor(customAccentColor);
        savePreferences();
    };
    elements.primaryColorInput.addEventListener('input', applyPickedColor);
    elements.primaryColorInput.addEventListener('change', applyPickedColor);
    elements.applyCustomColorButton?.addEventListener('click', () => {
        applyPrimaryColor(customAccentColor);
        savePreferences();
    });

    elements.presetSelect.addEventListener('change', (event) => {
        loadProtocol(event.target.value);
    });

    elements.addPatternBlockButton.addEventListener('click', () => {
        markAsCustomIfBuiltin();
        Model.addBlock(workingProtocol, {
            type: 'pattern',
            cycles: 4,
            phases: [
                { type: 'inhale', duration: 4 },
                { type: 'exhale', duration: 4 }
            ]
        });
        afterProtocolEdit();
    });

    elements.addRetentionBlockButton.addEventListener('click', () => {
        markAsCustomIfBuiltin();
        Model.addBlock(workingProtocol, { type: 'retention', duration: 20, increasePerRound: 0 });
        afterProtocolEdit();
    });

    elements.addLibraryBlockSelect.addEventListener('change', (event) => {
        const id = event.target.value;
        if (!id) return;
        markAsCustomIfBuiltin();
        Model.addRefBlock(workingProtocol, id);
        event.target.value = '';
        afterProtocolEdit();
    });

    elements.saveExerciseButton.addEventListener('click', () => {
        const name = elements.exerciseNameInput.value.trim()
            || protocolDisplayName(workingProtocol);
        workingProtocol.name = name;
        workingProtocol.builtin = false;
        workingProtocol.nameKey = '';
        const saved = Model.saveUserProtocol(workingProtocol);
        if (!saved) {
            announceStatus(translations[currentLanguage]?.storageError);
            return;
        }
        workingProtocol = Model.cloneProtocol(saved);
        selectedProtocolId = saved.id;
        exerciseChooser.refreshPresetSelect();
        elements.presetSelect.value = saved.id;
        syncPresetUi();
        document.getElementById('preset-description').textContent = saved.name;
        savePreferences();
        const saveLabel = elements.saveExerciseButton.querySelector('[data-lang-key="saveExercise"]') || elements.saveExerciseButton;
        saveLabel.textContent = translations[currentLanguage]?.saved || 'Saved';
        window.setTimeout(() => {
            saveLabel.textContent = translations[currentLanguage]?.saveExercise || 'Save';
        }, 1200);
    });

    elements.deleteExerciseButton.addEventListener('click', () => {
        if (Model.PRESET_IDS.includes(selectedProtocolId)) return;
        if (!Model.deleteUserProtocol(selectedProtocolId)) {
            announceStatus(translations[currentLanguage]?.storageError);
            return;
        }
        loadProtocol('custom');
    });

    elements.toggleModeButton.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        applyPrimaryColor(primaryColor);
        savePreferences();
    });

    elements.languageToggle.addEventListener('click', () => {
        const languages = TranslationManager.supportedLanguages;
        const currentIndex = languages.indexOf(currentLanguage);
        currentLanguage = languages[(currentIndex + 1) % languages.length];
        syncLanguageToggleLabel();
        document.documentElement.lang = currentLanguage;
        translatePage();
        savePreferences();
    });

    elements.protocolRoundsInput.addEventListener('input', () => {
        Model.setProtocolRounds(workingProtocol, elements.protocolRoundsInput.value);
        afterProtocolEdit(false);
    });
    elements.protocolRoundsInput.addEventListener('change', () => {
        const value = parseInt(elements.protocolRoundsInput.value, 10);
        const min = parseInt(elements.protocolRoundsInput.min, 10);
        const max = parseInt(elements.protocolRoundsInput.max, 10);
        if (isNaN(value) || value < min) elements.protocolRoundsInput.value = min;
        else if (value > max) elements.protocolRoundsInput.value = max;
        Model.setProtocolRounds(workingProtocol, elements.protocolRoundsInput.value);
        afterProtocolEdit();
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
        visualizer.resizeCanvas();
        if(!isRunning) visualizer.drawFrame(null, 0, performance.now());
    });

    function initialize() {
        elements.appVersions.forEach(element => {
            element.textContent = `v${App.version}`;
            element.setAttribute('aria-label', `App version ${App.version}`);
        });
        loadPreferences();
        syncPresetUi();
        translatePage();

        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');

        elements.volumeControl.style.setProperty('--range-progress', `${elements.volumeControl.value * 100}%`);
        
        visualizer.resizeCanvas();
        if ('ResizeObserver' in window) {
            visualizerResizeObserver = new ResizeObserver(() => {
                visualizer.resizeCanvas();
                if (!isRunning) visualizer.drawFrame(null, 0, performance.now());
            });
            visualizerResizeObserver.observe(elements.visualizerWrapper);
        }
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    exerciseChooser.bind();

    elements.selectedPresetInfo?.addEventListener('click', (event) => {
        event.stopPropagation();
        exerciseChooser.closeExerciseChooser(false);
        openPresetGuide(selectedProtocolId);
    });

    document.getElementById('info-button')?.addEventListener('click', () => {
        const modalEl = document.getElementById('infoModal');
        if (!modalEl) return;
        modalEl.dataset.guidePresetId = '';
        modalEl.classList.remove('is-single-guide');
        applyGuideView(modalEl);
    });

    document.getElementById('infoModal')?.addEventListener('show.bs.modal', (event) => {
        applyGuideView(event.currentTarget);
    });

    function setNavDestinationActive(name) {
        document.querySelectorAll('.nav-destination[data-nav]').forEach((button) => {
            const isActive = button.dataset.nav === name;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    const sheetNavNames = {
        appearanceOffcanvas: 'settings',
        breathingOffcanvas: 'protocols',
        profileOffcanvas: 'profile'
    };

    function isSheetShowing(id) {
        return document.getElementById(id)?.classList.contains('show');
    }

    document.getElementById('nav-home')?.addEventListener('click', () => {
        hideSettingsSheets();
        setNavDestinationActive('home');
    });

    Object.keys(sheetNavNames).forEach((id) => {
        const panel = document.getElementById(id);
        if (!panel) return;
        panel.addEventListener('show.bs.offcanvas', () => {
            Object.keys(sheetNavNames).forEach((otherId) => {
                if (otherId === id) return;
                const other = document.getElementById(otherId);
                const otherInstance = other && window.bootstrap?.Offcanvas.getInstance(other);
                if (otherInstance) otherInstance.hide();
            });
            setNavDestinationActive(sheetNavNames[id]);
            panel.classList.add('is-sliding-in');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    panel.classList.remove('is-sliding-in');
                });
            });
        });
        panel.addEventListener('hidden.bs.offcanvas', () => {
            const anotherOpen = Object.keys(sheetNavNames).some((otherId) => otherId !== id && isSheetShowing(otherId));
            if (!anotherOpen) {
                setNavDestinationActive('home');
            }
        });
    });

    initialize();
});

(function enablePwaOnHttp() {
    const servedOverHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (!servedOverHttp) return;

    if (!document.querySelector('link[rel="manifest"]')) {
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = 'manifest.json';
        document.head.appendChild(manifestLink);
    }

    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
})();
