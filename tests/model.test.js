const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createEnvironment(initial = new Map()) {
    const values = new Map(initial);
    const localStorage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const context = { console, localStorage, window: null };
    context.window = context;
    vm.createContext(context);
    for (const file of ['storage.js', 'model.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    }
    return { Model: context.BreathingModel, Storage: context.BreathingStorage, values };
}

function walkDuration(session) {
    let seconds = 0;
    let steps = 0;
    while (session.currentStep() && steps < 10000) {
        seconds += session.currentStep().duration();
        steps++;
        if (session.advance().done) break;
    }
    assert.ok(steps < 10000, 'session traversal should terminate');
    return seconds;
}

test('every built-in duration matches complete session traversal', () => {
    const { Model } = createEnvironment();
    for (const id of Model.PRESET_IDS) {
        const protocol = Model.getBuiltin(id);
        assert.equal(walkDuration(Model.createSession(protocol)), Model.protocolDuration(protocol), id);
    }
});

test('progressive retention increases once per root round', () => {
    const { Model } = createEnvironment();
    const protocol = Model.createProtocol({
        rounds: 3,
        blocks: [{ type: 'retention', duration: 10, increasePerRound: 5 }]
    });
    assert.equal(Model.protocolDuration(protocol), 45);
    assert.equal(walkDuration(Model.createSession(protocol)), 45);
});

test('nested references are traversed and counted', () => {
    const { Model } = createEnvironment();
    const protocol = Model.createProtocol({
        rounds: 2,
        blocks: [Model.createBlock({
            type: 'ref',
            protocolId: 'equal',
            snapshot: Model.getBuiltin('equal')
        })]
    });
    assert.equal(Model.protocolDuration(protocol), 48);
    assert.equal(walkDuration(Model.createSession(protocol)), 48);
});

test('reference snapshots survive deletion of their source exercise', () => {
    const { Model } = createEnvironment();
    const source = Model.saveUserProtocol(Model.createProtocol({
        name: 'Source',
        blocks: [{ type: 'pattern', cycles: 1, phases: [
            { type: 'inhale', duration: 2 },
            { type: 'exhale', duration: 3 }
        ] }]
    }));
    const parent = Model.createProtocol({ name: 'Parent' });
    Model.addRefBlock(parent, source.id);
    assert.equal(Model.deleteUserProtocol(source.id), true);
    assert.equal(Model.protocolDuration(parent), 53);
});

test('cyclic references are rejected', () => {
    const { Model } = createEnvironment();
    const parent = Model.saveUserProtocol(Model.createProtocol({ name: 'Parent' }));
    const child = Model.createProtocol({ name: 'Child' });
    Model.addRefBlock(child, parent.id);
    const savedChild = Model.saveUserProtocol(child);
    const loadedParent = Model.findProtocol(parent.id);
    assert.equal(Model.canAddRef(loadedParent, savedChild.id), false);
});

test('invalid library entries are skipped while valid entries survive', () => {
    const valid = {
        id: 'valid-one',
        name: 'Valid',
        rounds: 1,
        blocks: [{ type: 'pattern', cycles: 1, phases: [{ type: 'inhale', duration: 4 }] }]
    };
    const initial = new Map([['breathingTimerLibrary', JSON.stringify([null, { id: '', name: '' }, valid])]]);
    const { Model, values } = createEnvironment(initial);
    assert.deepEqual(Array.from(Model.loadUserLibrary(), item => item.id), ['valid-one']);
    assert.ok(values.has('breathingTimerLibrary'), 'reading invalid entries must not delete stored data');
});

test('storage write failures return false instead of throwing', () => {
    const quietConsole = { warn() {}, log() {}, error() {} };
    const context = {
        console: quietConsole,
        localStorage: {
            getItem() { return null; },
            setItem() { throw new Error('quota'); },
            removeItem() { throw new Error('blocked'); }
        },
        window: null
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'storage.js'), 'utf8'), context);
    assert.equal(context.BreathingStorage.writeJSON('key', { value: 1 }), false);
    assert.equal(context.BreathingStorage.remove('key'), false);
});
