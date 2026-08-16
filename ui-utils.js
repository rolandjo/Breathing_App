/** Pure UI helpers kept outside the main controller for reuse and testing. */
(function (global) {
    function chooserIndex(currentIndex, itemCount, key) {
        if (itemCount <= 0) return -1;
        if (key === 'Home') return 0;
        if (key === 'End') return itemCount - 1;
        const start = currentIndex < 0 ? 0 : currentIndex;
        if (key === 'ArrowDown') return (start + 1) % itemCount;
        if (key === 'ArrowUp') return (start - 1 + itemCount) % itemCount;
        return start;
    }

    function formatDuration(totalSeconds, labels = {}, remaining = false) {
        const roundedSeconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
        const minutes = Math.floor(roundedSeconds / 60);
        const seconds = roundedSeconds % 60;
        const prefix = remaining
            ? (labels.timeLeft || 'Time Left')
            : (labels.totalTimeLabel || 'Total Time');
        return `${prefix}: ${minutes} ${labels.minuteShort || 'min'} ${seconds} ${labels.secondShort || 'sec'}`;
    }

    /**
     * Returns the whole number displayed by a pre-session countdown.
     * Using absolute timestamps instead of decrementing an interval prevents
     * timer throttling in backgrounded mobile tabs from stretching the delay.
     *
     * @param {number} startTime - countdown start from performance.now()
     * @param {number} currentTime - current performance timestamp
     * @param {number} durationSeconds - configured countdown duration
     * @returns {number} remaining whole seconds, clamped to zero
     */
    function countdownSecondsRemaining(startTime, currentTime, durationSeconds) {
        const duration = Math.max(0, Number(durationSeconds) || 0);
        const elapsedMilliseconds = Math.max(0, (Number(currentTime) || 0) - (Number(startTime) || 0));
        return Math.max(0, Math.ceil(duration - elapsedMilliseconds / 1000));
    }

    global.BreathingUiUtils = { chooserIndex, countdownSecondsRemaining, formatDuration };
})(window);
