const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createServiceWorkerHarness(cachedResponse) {
    const listeners = {};
    let networkCalls = 0;
    const context = {
        Headers,
        Request,
        Response,
        URL,
        caches: {
            match: async () => cachedResponse,
            open: async () => ({ addAll: async () => {}, put: async () => {} }),
            keys: async () => [],
            delete: async () => true
        },
        fetch: async () => {
            networkCalls += 1;
            throw new Error('Unexpected network request');
        },
        importScripts: () => {},
        self: {
            BreathingApp: { cacheName: 'breathing-timer-test' },
            location: { origin: 'https://example.test' },
            clients: { claim: async () => {} },
            skipWaiting: async () => {},
            addEventListener: (type, listener) => { listeners[type] = listener; }
        }
    };

    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8'),
        context
    );

    return { context, listeners, getNetworkCalls: () => networkCalls };
}

test('creates a partial response for an explicit cached byte range', async () => {
    const fullResponse = new Response(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), {
        headers: { 'Content-Type': 'audio/mpeg' }
    });
    const { context } = createServiceWorkerHarness(fullResponse);
    context.fullResponse = fullResponse;

    const response = await vm.runInContext(
        'createPartialResponse(fullResponse, "bytes=2-5")',
        context
    );

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/8');
    assert.equal(response.headers.get('Content-Length'), '4');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2, 3, 4, 5]);
});

test('supports open-ended and suffix byte ranges', () => {
    const { context } = createServiceWorkerHarness(null);
    const openEnded = vm.runInContext('parseByteRange("bytes=6-", 10)', context);
    const suffix = vm.runInContext('parseByteRange("bytes=-3", 10)', context);

    assert.equal(openEnded.start, 6);
    assert.equal(openEnded.end, 9);
    assert.equal(suffix.start, 7);
    assert.equal(suffix.end, 9);
});

test('returns 416 for an unsatisfiable byte range', async () => {
    const fullResponse = new Response(Uint8Array.from([0, 1, 2, 3]));
    const { context } = createServiceWorkerHarness(fullResponse);
    context.fullResponse = fullResponse;

    const response = await vm.runInContext(
        'createPartialResponse(fullResponse, "bytes=10-20")',
        context
    );

    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */4');
    assert.equal(response.headers.get('Content-Length'), '0');
});

test('fetch handler serves cached media ranges without a network request', async () => {
    const cachedResponse = new Response(Uint8Array.from([10, 11, 12, 13, 14]), {
        headers: { 'Content-Type': 'audio/mpeg' }
    });
    const { listeners, getNetworkCalls } = createServiceWorkerHarness(cachedResponse);
    let responsePromise;
    const request = new Request('https://example.test/audio/bowl.mp3', {
        headers: { Range: 'bytes=1-3' }
    });

    listeners.fetch({
        request,
        respondWith: promise => { responsePromise = promise; },
        waitUntil: () => {}
    });
    const response = await responsePromise;

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 1-3/5');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [11, 12, 13]);
    assert.equal(getNetworkCalls(), 0);
});
