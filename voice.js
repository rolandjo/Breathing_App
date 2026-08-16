/** Recorded breathing cues, a bowl fallback, and explicitly selected system speech. */
(function (global) {
    const TranslationManager = global.BreathingTranslationManager;
    const LANGUAGE_TAGS = TranslationManager?.speechLanguages || {};
    const CUES = TranslationManager?.voiceCues || {};

    const AUDIO_FILES = {
        inhale: 'In.mp3',
        exhale: 'Out.mp3',
        hold: 'Hold.mp3',
        rest: 'Pause.mp3'
    };
    const AUDIO_MODES = Object.freeze({
        recorded: 'recorded',
        bowl: 'bowl',
        tts: 'tts'
    });

    /**
     * Creates the phase-cue player used by the breathing session.
     *
     * Recorded cues try Web Audio first and HTML5 Audio once if decoding or
     * loading fails. Android may report a transient load error while changing
     * media backends, so one error must not blacklist the file for the rest of
     * the session. The bowl uses the browser's native Audio element as an
     * independent final path. System speech is never an automatic fallback;
     * it runs only when the user explicitly selects TTS.
     *
     * @param {object} options - injectable browser dependencies and preferences
     * @returns {{speak: (phaseType: string) => boolean, cancel: () => void}}
     */
    function createVoiceGuide(options = {}) {
        const HowlPlayer = Object.prototype.hasOwnProperty.call(options, 'Howl') ? options.Howl : global.Howl;
        const howler = Object.prototype.hasOwnProperty.call(options, 'Howler') ? options.Howler : global.Howler;
        const AudioPlayer = Object.prototype.hasOwnProperty.call(options, 'Audio') ? options.Audio : global.Audio;
        const synth = Object.prototype.hasOwnProperty.call(options, 'speechSynthesis')
            ? options.speechSynthesis
            : global.speechSynthesis;
        const Utterance = Object.prototype.hasOwnProperty.call(options, 'SpeechSynthesisUtterance')
            ? options.SpeechSynthesisUtterance
            : global.SpeechSynthesisUtterance;
        const getLanguage = options.getLanguage || (() => 'en');
        const getVolume = options.getVolume || (() => 0.5);
        const getMode = options.getMode || (() => AUDIO_MODES.recorded);
        const reportError = options.onError || (() => {});
        const audioBasePath = options.audioBasePath || './audio/voice';
        const bowlPath = options.bowlPath || './tibetan-singing-bowl-54400.mp3';
        const players = new Map();
        let bowlPlayer = null;
        let bowlActionId = 0;
        let bowlPriming = false;
        let bowlUnlocked = false;
        let activeCue = null;
        let playbackId = 0;

        if (howler) {
            howler.html5PoolSize = 8;
            howler.autoSuspend = false;
        }

        function selectedLanguage() {
            const language = getLanguage();
            return CUES[language] ? language : 'en';
        }

        function selectedVolume() {
            return Math.min(1, Math.max(0, Number(getVolume()) || 0));
        }

        function selectedMode() {
            const mode = getMode();
            return Object.values(AUDIO_MODES).includes(mode) ? mode : AUDIO_MODES.recorded;
        }

        function removeUnlockRetry(cue) {
            if (!cue?.unlockHandler) return;
            cue.player.off?.('unlock', cue.unlockHandler);
            cue.unlockHandler = null;
        }

        function stopActiveCue() {
            if (!activeCue) return;
            const cue = activeCue;
            activeCue = null;
            removeUnlockRetry(cue);
            try {
                cue.player.stop(cue.soundId);
            } catch (_) {
                // A failed or not-yet-loaded media node may already be detached.
            }
        }

        function stopBowl() {
            if (!bowlPlayer) return;
            bowlActionId += 1;
            try {
                bowlPlayer.pause();
                bowlPlayer.currentTime = 0;
                bowlPlayer.muted = false;
            } catch (_) {
                // Some browsers reject seeking before media metadata is available.
            }
        }

        function cancel() {
            playbackId += 1;
            stopActiveCue();
            stopBowl();
            synth?.cancel?.();
        }

        function speakWithSystemVoice(phaseType, language) {
            if (!synth || !Utterance) return false;
            const phrase = CUES[language][phaseType] || CUES[language].hold;
            const utterance = new Utterance(phrase);
            const languageTag = LANGUAGE_TAGS[language];
            utterance.lang = languageTag;
            utterance.volume = selectedVolume();
            utterance.rate = 0.88;
            utterance.pitch = 1;

            const voices = synth.getVoices?.() || [];
            const exactVoice = voices.find(voice => voice.lang?.toLowerCase() === languageTag.toLowerCase());
            const regionalVoice = voices.find(voice => voice.lang?.toLowerCase().startsWith(language));
            utterance.voice = exactVoice || regionalVoice || null;

            synth.cancel();
            synth.speak(utterance);
            return true;
        }

        function getBowlPlayer() {
            if (bowlPlayer || !AudioPlayer) return bowlPlayer;
            try {
                bowlPlayer = new AudioPlayer(bowlPath);
                bowlPlayer.preload = 'auto';
            } catch (error) {
                reportError({ kind: 'bowl-create', error });
            }
            return bowlPlayer;
        }

        /**
         * Silently primes the actual fallback element during the Start click.
         * Android can enforce media permission per element, so creating a fresh
         * bowl only after an asynchronous recording error may be too late.
         */
        function primeBowl() {
            if (bowlUnlocked || bowlPriming) return;
            const player = getBowlPlayer();
            if (!player) return;
            const actionId = ++bowlActionId;
            bowlPriming = true;
            player.muted = true;
            try {
                const playback = player.play();
                Promise.resolve(playback).then(() => {
                    bowlPriming = false;
                    bowlUnlocked = true;
                    if (actionId !== bowlActionId) return;
                    player.pause();
                    player.currentTime = 0;
                    player.muted = false;
                }).catch(error => {
                    bowlPriming = false;
                    if (actionId === bowlActionId) player.muted = false;
                    reportError({ kind: 'bowl-unlock', error });
                });
            } catch (error) {
                bowlPriming = false;
                player.muted = false;
                reportError({ kind: 'bowl-unlock', error });
            }
        }

        function playBowl(phaseType) {
            const player = getBowlPlayer();
            if (!player) return false;
            stopBowl();
            player.muted = false;
            player.volume = selectedVolume();
            player.preservesPitch = false;
            if ('mozPreservesPitch' in player) player.mozPreservesPitch = false;
            if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = false;
            player.playbackRate = phaseType === 'inhale' ? 1.4 : (phaseType === 'exhale' ? 0.6 : 1);
            try {
                const playback = player.play();
                playback?.catch?.(error => reportError({ kind: 'bowl-play', phaseType, error }));
                return true;
            } catch (error) {
                reportError({ kind: 'bowl-play', phaseType, error });
                return false;
            }
        }

        function isCurrentCue(player, soundId) {
            return activeCue
                && activeCue.player === player
                && (soundId == null || activeCue.soundId == null || activeCue.soundId === soundId);
        }

        function finishWithBowl(cue, kind, error) {
            if (activeCue === cue) activeCue = null;
            removeUnlockRetry(cue);
            reportError({ kind, phaseType: cue.phaseType, language: cue.language, error });
            return playBowl(cue.phaseType);
        }

        function playRecordedCue(cue) {
            try {
                cue.player.volume(selectedVolume());
                cue.soundId = cue.player.play();
                return true;
            } catch (error) {
                return finishWithBowl(cue, 'recorded-play', error);
            }
        }

        function handleLoadError(player, soundId, error) {
            if (!isCurrentCue(player, soundId)) return;
            const cue = activeCue;
            removeUnlockRetry(cue);
            players.delete(cue.cacheKey);
            try {
                cue.player.unload?.();
            } catch (_) {
                // A failed backend can already have released its media resource.
            }

            if (!cue.html5) {
                const retry = getRecordedPlayer(cue.language, cue.phaseType, true);
                if (retry) {
                    cue.player = retry.player;
                    cue.cacheKey = retry.cacheKey;
                    cue.html5 = true;
                    cue.soundId = null;
                    cue.playRetries = 0;
                    reportError({ kind: 'recorded-load-retry', phaseType: cue.phaseType, language: cue.language, error });
                    playRecordedCue(cue);
                    return;
                }
            }

            finishWithBowl(cue, 'recorded-load', error);
        }

        function handlePlayError(player, soundId, error) {
            if (!isCurrentCue(player, soundId) || activeCue.unlockHandler) return;
            const cue = activeCue;
            if (cue.playRetries >= 1) {
                finishWithBowl(cue, 'recorded-play', error);
                return;
            }
            cue.playRetries += 1;
            const requestId = cue.requestId;

            /** Retry once only after Howler confirms that mobile playback is unlocked. */
            cue.unlockHandler = () => {
                cue.unlockHandler = null;
                if (requestId !== playbackId || activeCue !== cue) return;
                try {
                    cue.player.stop(cue.soundId);
                } catch (_) {
                    // The rejected sound ID may not have entered Howler's pool.
                }
                cue.soundId = null;
                playRecordedCue(cue);
            };
            player.once?.('unlock', cue.unlockHandler);
        }

        function handleEnd(player, soundId) {
            if (isCurrentCue(player, soundId)) activeCue = null;
        }

        function getRecordedPlayer(language, phaseType, html5 = false) {
            if (!HowlPlayer || howler?.noAudio) return null;
            const file = AUDIO_FILES[phaseType] || AUDIO_FILES.hold;
            const sourceKey = `${language}/${file}`;
            const cacheKey = `${sourceKey}:${html5 ? 'html5' : 'webaudio'}`;

            if (!players.has(cacheKey)) {
                try {
                    let player;
                    player = new HowlPlayer({
                        src: [`${audioBasePath}/${sourceKey}`],
                        format: ['mp3'],
                        html5,
                        preload: true,
                        pool: 2,
                        onloaderror: (soundId, error) => handleLoadError(player, soundId, error),
                        onplayerror: (soundId, error) => handlePlayError(player, soundId, error),
                        onend: soundId => handleEnd(player, soundId)
                    });
                    players.set(cacheKey, player);
                } catch (error) {
                    reportError({ kind: 'recorded-create', phaseType, language, html5, error });
                    return null;
                }
            }
            return { cacheKey, html5, player: players.get(cacheKey) };
        }

        function speakRecordedCue(phaseType, language, requestId) {
            const entry = getRecordedPlayer(language, phaseType, false)
                || getRecordedPlayer(language, phaseType, true);
            if (!entry) return playBowl(phaseType);

            activeCue = {
                cacheKey: entry.cacheKey,
                player: entry.player,
                soundId: null,
                phaseType,
                language,
                requestId,
                html5: entry.html5,
                playRetries: 0,
                unlockHandler: null
            };
            return playRecordedCue(activeCue);
        }

        function speak(phaseType = 'hold') {
            cancel();
            const requestId = playbackId;
            const language = selectedLanguage();
            const mode = selectedMode();

            if (mode === AUDIO_MODES.tts) return speakWithSystemVoice(phaseType, language);
            if (mode === AUDIO_MODES.bowl) return playBowl(phaseType);
            primeBowl();
            return speakRecordedCue(phaseType, language, requestId);
        }

        return { speak, cancel };
    }

    global.BreathingVoice = { AUDIO_FILES, AUDIO_MODES, CUES, LANGUAGE_TAGS, createVoiceGuide };
})(window);
