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

    global.BreathingUiUtils = { chooserIndex, formatDuration };
})(window);
