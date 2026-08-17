const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = {};
vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, '..', 'visualizer.js'), 'utf8'),
    context
);
const Visualizer = context.BreathingVisualizer;

function vertices(count, cx, cy, r) {
    return JSON.parse(JSON.stringify(Visualizer.generateVertices(count, cx, cy, r)));
}

test('generateVertices places one-phase and two-phase tracks on a vertical axis', () => {
    assert.deepEqual(vertices(1, 10, 20, 5), [{ x: 10, y: 20 }]);
    assert.deepEqual(vertices(2, 0, 0, 10), [
        { x: 0, y: 10 },
        { x: 0, y: -10 }
    ]);
});

test('generateVertices uses dedicated 3- and 4-phase layouts', () => {
    const triangle = vertices(3, 0, 0, 10);
    assert.equal(triangle.length, 3);
    assert.ok(Math.abs(triangle[1].x) < 1e-10);
    assert.equal(triangle[1].y, -10);

    assert.deepEqual(vertices(4, 0, 0, 8), [
        { x: -8, y: 8 },
        { x: -8, y: -8 },
        { x: 8, y: -8 },
        { x: 8, y: 8 }
    ]);
});

test('generateVertices starts n-gons at the top of the circle', () => {
    const pentagon = vertices(5, 0, 0, 10);
    assert.equal(pentagon.length, 5);
    assert.ok(Math.abs(pentagon[0].x) < 1e-10);
    assert.ok(Math.abs(pentagon[0].y + 10) < 1e-10);
});

test('easeInOutSine is symmetric around the midpoint', () => {
    assert.equal(Visualizer.easeInOutSine(0) + 0, 0);
    assert.equal(Visualizer.easeInOutSine(1), 1);
    assert.ok(Math.abs(Visualizer.easeInOutSine(0.5) - 0.5) < 1e-10);
    assert.ok(Visualizer.easeInOutSine(0.25) < 0.25);
    assert.ok(Visualizer.easeInOutSine(0.75) > 0.75);
});
