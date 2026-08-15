const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, '..', 'ui-utils.js'), 'utf8'),
    context
);
const Ui = context.BreathingUiUtils;

test('chooser navigation wraps and supports Home/End', () => {
    assert.equal(Ui.chooserIndex(2, 3, 'ArrowDown'), 0);
    assert.equal(Ui.chooserIndex(0, 3, 'ArrowUp'), 2);
    assert.equal(Ui.chooserIndex(1, 3, 'Home'), 0);
    assert.equal(Ui.chooserIndex(1, 3, 'End'), 2);
});

test('duration formatting is localized without language-specific branches', () => {
    const labels = {
        timeLeft: 'Timp rămas',
        totalTimeLabel: 'Timp total',
        minuteShort: 'min',
        secondShort: 'sec'
    };
    assert.equal(Ui.formatDuration(61.2, labels, true), 'Timp rămas: 1 min 2 sec');
    assert.equal(Ui.formatDuration(60, labels, false), 'Timp total: 1 min 0 sec');
});
