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
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'voice.js'), 'utf8'), context);

function createHarness(language = 'en', volume = 0.5, withHowler = true, mode = 'recorded', withAudio = true) {
    const calls = [];
    const players = [];
    let nextSoundId = 1;

    class HowlPlayer {
        constructor(options) {
            this.options = options;
            this.listeners = new Map();
            players.push(this);
            calls.push({ type: 'create-howl', player: this });
        }

        play() {
            const soundId = nextSoundId++;
            calls.push({ type: 'play', player: this, soundId });
            return soundId;
        }

        stop(soundId) {
            calls.push({ type: 'stop', player: this, soundId });
        }

        volume(value) {
            calls.push({ type: 'volume', player: this, value });
        }

        unload() {
            calls.push({ type: 'unload', player: this });
        }

        once(event, handler) {
            this.listeners.set(event, handler);
            calls.push({ type: 'once', player: this, event });
        }

        off(event, handler) {
            if (this.listeners.get(event) === handler) this.listeners.delete(event);
            calls.push({ type: 'off', player: this, event });
        }

        emit(event, soundId, error) {
            this.options[`on${event}`]?.(soundId, error);
            const handler = this.listeners.get(event);
            if (handler) {
                this.listeners.delete(event);
                handler(soundId, error);
            }
        }
    }

    class Utterance {
        constructor(text) { this.text = text; }
    }

    class AudioPlayer {
        constructor(src) {
            this.src = src;
            this.currentTime = 0;
            calls.push({ type: 'create-audio', player: this, src });
        }

        play() {
            calls.push({ type: 'play-audio', player: this, muted: Boolean(this.muted) });
            return Promise.resolve();
        }

        pause() {
            calls.push({ type: 'pause-audio', player: this });
        }
    }

    const speechSynthesis = {
        cancel() { calls.push({ type: 'cancel-speech' }); },
        speak(utterance) { calls.push({ type: 'speak', utterance }); },
        getVoices() {
            return [
                { name: 'English', lang: 'en-US' },
                { name: 'Romanian', lang: 'ro-RO' }
            ];
        }
    };
    const howler = { html5PoolSize: 10, autoSuspend: true, noAudio: false };
    const guide = context.BreathingVoice.createVoiceGuide({
        Howl: withHowler ? HowlPlayer : null,
        Howler: withHowler ? howler : null,
        Audio: withAudio ? AudioPlayer : null,
        speechSynthesis,
        SpeechSynthesisUtterance: Utterance,
        getLanguage: () => language,
        getVolume: () => volume,
        getMode: () => mode,
        onError: detail => calls.push({ type: 'audio-error', detail })
    });
    return { calls, guide, howler, players };
}

test('plays the prerecorded phase cue through Howler for the selected language', () => {
    const { calls, guide, howler, players } = createHarness('ro', 0.7);
    assert.equal(guide.speak('inhale'), true);
    assert.equal(players[0].options.src[0], './audio/voice/ro/In.mp3');
    assert.equal(players[0].options.html5, false);
    assert.equal(players[0].options.preload, true);
    assert.equal(calls.some(call => call.type === 'volume' && call.value === 0.7), true);
    assert.equal(calls.some(call => call.type === 'speak'), false);
    assert.equal(howler.html5PoolSize, 8);
    assert.equal(howler.autoSuspend, false);
});

test('inhale, exhale, hold, and rest use their dedicated recordings', () => {
    const { guide, players } = createHarness('fr');
    guide.speak('inhale');
    guide.speak('exhale');
    guide.speak('hold');
    guide.speak('rest');
    assert.deepEqual(players.map(player => player.options.src[0]), [
        './audio/voice/fr/In.mp3',
        './audio/voice/fr/Out.mp3',
        './audio/voice/fr/Hold.mp3',
        './audio/voice/fr/Pause.mp3'
    ]);
});

test('a new cue stops the previous Howler sound ID', () => {
    const { calls, guide } = createHarness('en');
    guide.speak('inhale');
    const firstPlay = calls.find(call => call.type === 'play');
    guide.speak('exhale');
    assert.equal(calls.some(call => (
        call.type === 'stop'
        && call.player === firstPlay.player
        && call.soundId === firstPlay.soundId
    )), true);
});

test('a mobile play error waits for unlock and retries without switching to TTS', () => {
    const { calls, guide, players } = createHarness('en');
    guide.speak('inhale');
    const firstPlay = calls.find(call => call.type === 'play');

    players[0].emit('playerror', firstPlay.soundId, 'NotAllowedError');
    assert.equal(calls.some(call => call.type === 'speak'), false);
    assert.equal(calls.some(call => call.type === 'once' && call.event === 'unlock'), true);

    players[0].emit('unlock', firstPlay.soundId);
    assert.equal(calls.filter(call => call.type === 'play').length, 2);
    assert.equal(calls.some(call => call.type === 'speak'), false);
});

test('cancel removes a pending unlock retry so an obsolete cue cannot play', () => {
    const { calls, guide, players } = createHarness('en');
    guide.speak('inhale');
    const firstPlay = calls.find(call => call.type === 'play');
    players[0].emit('playerror', firstPlay.soundId, 'NotAllowedError');

    guide.cancel();
    players[0].emit('unlock', firstPlay.soundId);

    assert.equal(calls.filter(call => call.type === 'play').length, 1);
    assert.equal(calls.some(call => call.type === 'off' && call.event === 'unlock'), true);
});

test('a load error retries with HTML5 Audio without switching to TTS', () => {
    const { calls, guide, players } = createHarness('ro', 0.7);
    guide.speak('inhale');
    const play = calls.find(call => call.type === 'play');
    players[0].emit('loaderror', play.soundId, 'MEDIA_ERR_SRC_NOT_SUPPORTED');

    assert.equal(players.length, 2);
    assert.equal(players[1].options.html5, true);
    assert.equal(calls.filter(call => call.type === 'play').length, 2);
    assert.equal(calls.some(call => call.type === 'speak'), false);
});

test('a second load error falls back to the bowl and never starts TTS', () => {
    const { calls, guide, players } = createHarness('ro', 0.7);
    guide.speak('inhale');
    const firstPlay = calls.find(call => call.type === 'play');
    players[0].emit('loaderror', firstPlay.soundId, 'MEDIA_ERR_SRC_NOT_SUPPORTED');
    const retryPlay = calls.filter(call => call.type === 'play')[1];
    players[1].emit('loaderror', retryPlay.soundId, 'MEDIA_ERR_SRC_NOT_SUPPORTED');

    assert.equal(calls.some(call => call.type === 'play-audio' && !call.muted), true);
    assert.equal(calls.some(call => call.type === 'speak'), false);

    guide.speak('inhale');
    assert.equal(players.length, 3);
    assert.equal(players[2].options.html5, false);
});

test('uses the native bowl when Howler is unavailable', () => {
    const { calls, guide } = createHarness('ro', 0.7, false);
    assert.equal(guide.speak('inhale'), true);
    assert.equal(calls.some(call => call.type === 'play-audio' && !call.muted), true);
    assert.equal(calls.some(call => call.type === 'speak'), false);
});

test('uses localized system speech only when TTS is explicitly selected', () => {
    const { calls, guide } = createHarness('ro', 0.7, true, 'tts');
    assert.equal(guide.speak('inhale'), true);
    const spoken = calls.find(call => call.type === 'speak').utterance;
    assert.equal(spoken.text, 'Inspiră');
    assert.equal(spoken.lang, 'ro-RO');
    assert.equal(spoken.volume, 0.7);
    assert.equal(spoken.voice.name, 'Romanian');
    assert.equal(calls.some(call => call.type === 'play'), false);
    assert.equal(calls.some(call => call.type === 'play-audio'), false);
});

test('bowl mode uses distinct pitches for inhale and exhale', () => {
    const { calls, guide } = createHarness('en', 0.6, true, 'bowl');
    guide.speak('inhale');
    const bowl = calls.find(call => call.type === 'create-audio').player;
    assert.equal(bowl.src, './audio/tibetan-singing-bowl-54400.mp3');
    assert.equal(bowl.playbackRate, 1.4);
    assert.equal(bowl.volume, 0.6);

    guide.speak('exhale');
    assert.equal(bowl.playbackRate, 0.6);
    assert.equal(calls.some(call => call.type === 'speak'), false);
});

test('returns false when recorded audio and the bowl are unavailable', () => {
    const guide = context.BreathingVoice.createVoiceGuide({
        Howl: null,
        Howler: null,
        Audio: null,
        speechSynthesis: null,
        SpeechSynthesisUtterance: null
    });
    assert.equal(guide.speak('inhale'), false);
});
