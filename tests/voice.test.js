const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'voice.js'), 'utf8'), context);

function createHarness(language = 'en', volume = 0.5, withHowler = true) {
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
        speechSynthesis,
        SpeechSynthesisUtterance: Utterance,
        getLanguage: () => language,
        getVolume: () => volume
    });
    return { calls, guide, howler, players };
}

test('plays the prerecorded phase cue through Howler for the selected language', () => {
    const { calls, guide, howler, players } = createHarness('ro', 0.7);
    assert.equal(guide.speak('inhale'), true);
    assert.equal(players[0].options.src[0], './audio/voice/ro/In.mp3');
    assert.equal(players[0].options.html5, true);
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

test('a genuine load error uses localized system speech', () => {
    const { calls, guide, players } = createHarness('ro', 0.7);
    guide.speak('inhale');
    const play = calls.find(call => call.type === 'play');
    players[0].emit('loaderror', play.soundId, 'MEDIA_ERR_SRC_NOT_SUPPORTED');

    const spoken = calls.find(call => call.type === 'speak').utterance;
    assert.equal(spoken.text, 'Inspiră');
    assert.equal(spoken.lang, 'ro-RO');
    assert.equal(spoken.volume, 0.7);
    assert.equal(spoken.voice.name, 'Romanian');
});

test('uses localized system speech when Howler is unavailable', () => {
    const { calls, guide } = createHarness('ro', 0.7, false);
    assert.equal(guide.speak('inhale'), true);
    const spoken = calls.find(call => call.type === 'speak').utterance;
    assert.equal(spoken.text, 'Inspiră');
    assert.equal(spoken.lang, 'ro-RO');
});

test('returns false when recorded and synthesized speech are unavailable', () => {
    const guide = context.BreathingVoice.createVoiceGuide({
        Howl: null,
        Howler: null,
        speechSynthesis: null,
        SpeechSynthesisUtterance: null
    });
    assert.equal(guide.speak('inhale'), false);
});
