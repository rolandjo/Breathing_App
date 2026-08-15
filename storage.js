/**
 * Defensive JSON persistence shared by the model and UI controller.
 * Storage failures are reported to callers instead of interrupting a session.
 */
(function (global) {
    function storage() {
        try {
            return global.localStorage || null;
        } catch (error) {
            console.warn('Browser storage is unavailable.', error);
            return null;
        }
    }

    function readJSON(key, fallback = null) {
        try {
            const raw = storage()?.getItem(key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (error) {
            console.warn(`Ignoring invalid stored data for ${key}.`, error);
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            const target = storage();
            if (!target) return false;
            target.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Could not save ${key}.`, error);
            return false;
        }
    }

    function remove(key) {
        try {
            const target = storage();
            if (!target) return false;
            target.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Could not remove ${key}.`, error);
            return false;
        }
    }

    global.BreathingStorage = { readJSON, writeJSON, remove };
})(window);
