/** Prerecorded breathing cues with system speech as a playback fallback. */
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
        inhale: 'Inhale.mp3',
        exhale: 'Exhale.mp3',
        hold: 'Pause.mp3',
        rest: 'Pause.mp3'
    };

    function createVoiceGuide(options = {}) {
        const AudioPlayer = Object.prototype.hasOwnProperty.call(options, 'Audio') ? options.Audio : global.Audio;
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
        let activePlayer = null;
        let playbackId = 0;

        function selectedLanguage() {
            const language = getLanguage();
            return CUES[language] ? language : 'en';
        }

        function selectedVolume() {
            return Math.min(1, Math.max(0, Number(getVolume()) || 0));
        }

        function stopAudio() {
            if (!activePlayer) return;
            activePlayer.pause?.();
            try {
                activePlayer.currentTime = 0;
            } catch (_) {
                // Some browsers do not allow seeking until media metadata is ready.
            }
            activePlayer = null;
        }

        function cancel() {
            playbackId += 1;
            stopAudio();
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

        function getPlayer(language, phaseType) {
            if (!AudioPlayer) return null;
            const file = AUDIO_FILES[phaseType] || AUDIO_FILES.hold;
            const key = `${language}/${file}`;
            if (!players.has(key)) {
                const player = new AudioPlayer(`${audioBasePath}/${key}`);
                player.preload = 'auto';
                players.set(key, player);
            }
            return players.get(key);
        }

        function speak(phaseType) {
            cancel();
            const id = playbackId;
            const language = selectedLanguage();
            const player = getPlayer(language, phaseType);

            if (!player) return speakWithSystemVoice(phaseType, language);

            activePlayer = player;
            player.volume = selectedVolume();
            player.currentTime = 0;
            player.onended = () => {
                if (activePlayer === player) activePlayer = null;
            };

            try {
                const playResult = player.play();
                playResult?.catch?.(() => {
                    if (id !== playbackId || activePlayer !== player) return;
                    activePlayer = null;
                    speakWithSystemVoice(phaseType, language);
                });
                return true;
            } catch (_) {
                activePlayer = null;
                return speakWithSystemVoice(phaseType, language);
            }
        }

        return { speak, cancel };
    }

    global.BreathingVoice = { AUDIO_FILES, CUES, LANGUAGE_TAGS, createVoiceGuide };
})(window);
