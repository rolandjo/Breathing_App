const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'voice.js'), 'utf8'), context);

function createHarness(language = 'en', volume = 0.5, withAudio = true) {
    const calls = [];
    class AudioPlayer {
        constructor(src) {
            this.src = src;
            this.currentTime = 0;
            calls.push({ type: 'create-audio', player: this });
        }
        pause() { calls.push({ type: 'pause', player: this }); }
        play() {
            calls.push({ type: 'play', player: this });
            return Promise.resolve();
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
    const guide = context.BreathingVoice.createVoiceGuide({
        Audio: withAudio ? AudioPlayer : null,
        speechSynthesis,
        SpeechSynthesisUtterance: Utterance,
        getLanguage: () => language,
        getVolume: () => volume
    });
    return { calls, guide };
}

test('plays the prerecorded phase cue for the selected language', () => {
    const { calls, guide } = createHarness('ro', 0.7);
    assert.equal(guide.speak('inhale'), true);
    const player = calls.find(call => call.type === 'play').player;
    assert.equal(player.src, './audio/voice/ro/Inhale.mp3');
    assert.equal(player.volume, 0.7);
    assert.equal(calls.some(call => call.type === 'speak'), false);
});

test('hold and rest use their dedicated recordings', () => {
    const { calls, guide } = createHarness('fr');
    guide.speak('hold');
    guide.speak('rest');
    const createdSources = calls
        .filter(call => call.type === 'create-audio')
        .map(call => call.player.src);
    assert.deepEqual(createdSources, [
        './audio/voice/fr/Hold.mp3',
        './audio/voice/fr/Pause.mp3'
    ]);
    assert.equal(calls.filter(call => call.type === 'play').length, 2);
});

test('a new cue stops and rewinds the previous recording', () => {
    const { calls, guide } = createHarness('en');
    guide.speak('inhale');
    const firstPlayer = calls.find(call => call.type === 'play').player;
    firstPlayer.currentTime = 0.4;
    guide.speak('exhale');
    const played = calls.filter(call => call.type === 'play');
    assert.equal(calls.some(call => call.type === 'pause' && call.player === firstPlayer), true);
    assert.equal(firstPlayer.currentTime, 0);
    assert.equal(played[1].player.src, './audio/voice/en/Exhale.mp3');
});

test('uses localized system speech when audio playback is unavailable', () => {
    const { calls, guide } = createHarness('ro', 0.7, false);
    assert.equal(guide.speak('inhale'), true);
    const spoken = calls.find(call => call.type === 'speak').utterance;
    assert.equal(spoken.text, 'Inspiră');
    assert.equal(spoken.lang, 'ro-RO');
    assert.equal(spoken.volume, 0.7);
    assert.equal(spoken.voice.name, 'Romanian');
});

test('returns false when recorded and synthesized speech are unavailable', () => {
    const guide = context.BreathingVoice.createVoiceGuide({
        Audio: null,
        speechSynthesis: null,
        SpeechSynthesisUtterance: null
    });
    assert.equal(guide.speak('inhale'), false);
});
