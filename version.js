/** Canonical application release metadata shared by the page and service worker. */
(function (global) {
    const version = '1.3.2';

    global.BreathingApp = Object.freeze({
        version,
        cacheName: `breathing-timer-v${version}`
    });
})(globalThis);
