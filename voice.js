/** Prerecorded breathing cues with system speech as a genuine-error fallback. */
(function (global) {
    const LANGUAGE_TAGS = {
        en: 'en-US',
        es: 'es-ES',
        fr: 'fr-FR',
        ro: 'ro-RO'
    };

    const CUES = {
        en: { inhale: 'Inhale', exhale: 'Exhale', hold: 'Hold', rest: 'Hold' },
        es: { inhale: 'Inhala', exhale: 'Exhala', hold: 'Mantén', rest: 'Mantén' },
        fr: { inhale: 'Inspirez', exhale: 'Expirez', hold: 'Maintenez', rest: 'Maintenez' },
        ro: { inhale: 'Inspiră', exhale: 'Expiră', hold: 'Ține', rest: 'Ține' }
    };

    const AUDIO_FILES = {
        inhale: 'In.mp3',
        exhale: 'Out.mp3',
        hold: 'Hold.mp3',
        rest: 'Pause.mp3'
    };

    /**
     * Creates the phase-cue player used by the breathing session.
     *
     * Howler's HTML5 audio pool is deliberately used here. Android browsers
     * unlock media elements during a user gesture; reusing that unlocked pool
     * prevents later timer-driven phases from being mistaken for missing audio.
     * A play error waits for Howler's unlock event, while only a load error
     * switches to TTS because that indicates the recording is unavailable.
     *
     * @param {object} options - injectable browser dependencies and preferences
     * @returns {{speak: (phaseType: string) => boolean, cancel: () => void}}
     */
    function createVoiceGuide(options = {}) {
        const HowlPlayer = Object.prototype.hasOwnProperty.call(options, 'Howl') ? options.Howl : global.Howl;
        const howler = Object.prototype.hasOwnProperty.call(options, 'Howler') ? options.Howler : global.Howler;
        const synth = Object.prototype.hasOwnProperty.call(options, 'speechSynthesis')
            ? options.speechSynthesis
            : global.speechSynthesis;
        const Utterance = Object.prototype.hasOwnProperty.call(options, 'SpeechSynthesisUtterance')
            ? options.SpeechSynthesisUtterance
            : global.SpeechSynthesisUtterance;
        const getLanguage = options.getLanguage || (() => 'en');
        const getVolume = options.getVolume || (() => 0.5);
        const audioBasePath = options.audioBasePath || './audio/voice';
        const players = new Map();
        const unavailablePlayers = new Set();
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

        function cancel() {
            playbackId += 1;
            stopActiveCue();
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

        function isCurrentCue(player, soundId) {
            return activeCue
                && activeCue.player === player
                && (soundId == null || activeCue.soundId == null || activeCue.soundId === soundId);
        }

        function handleLoadError(player, soundId) {
            if (!isCurrentCue(player, soundId)) return;
            const cue = activeCue;
            unavailablePlayers.add(cue.key);
            activeCue = null;
            removeUnlockRetry(cue);
            speakWithSystemVoice(cue.phaseType, cue.language);
        }

        function playRecordedCue(cue) {
            try {
                cue.player.volume(selectedVolume());
                cue.soundId = cue.player.play();
                return true;
            } catch (_) {
                if (activeCue === cue) activeCue = null;
                return speakWithSystemVoice(cue.phaseType, cue.language);
            }
        }

        function handlePlayError(player, soundId) {
            if (!isCurrentCue(player, soundId) || activeCue.unlockHandler) return;
            const cue = activeCue;
            const requestId = cue.requestId;

            /** Retry only after the browser confirms that media playback is unlocked. */
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

        function getPlayer(language, phaseType) {
            if (!HowlPlayer || howler?.noAudio) return null;
            const file = AUDIO_FILES[phaseType] || AUDIO_FILES.hold;
            const key = `${language}/${file}`;
            if (unavailablePlayers.has(key)) return null;

            if (!players.has(key)) {
                try {
                    let player;
                    player = new HowlPlayer({
                        src: [`${audioBasePath}/${key}`],
                        format: ['mp3'],
                        html5: true,
                        preload: true,
                        pool: 2,
                        onloaderror: soundId => handleLoadError(player, soundId),
                        onplayerror: soundId => handlePlayError(player, soundId),
                        onend: soundId => handleEnd(player, soundId)
                    });
                    players.set(key, player);
                } catch (_) {
                    unavailablePlayers.add(key);
                    return null;
                }
            }
            return { key, player: players.get(key) };
        }

        function speak(phaseType) {
            cancel();
            const requestId = playbackId;
            const language = selectedLanguage();
            const entry = getPlayer(language, phaseType);

            if (!entry) return speakWithSystemVoice(phaseType, language);

            activeCue = {
                key: entry.key,
                player: entry.player,
                soundId: null,
                phaseType,
                language,
                requestId,
                unlockHandler: null
            };
            return playRecordedCue(activeCue);
        }

        return { speak, cancel };
    }

    global.BreathingVoice = { AUDIO_FILES, CUES, LANGUAGE_TAGS, createVoiceGuide };
})(window);
