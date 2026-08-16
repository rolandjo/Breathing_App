/** Central access to the application's explicit translation catalogs. */
(function (global) {
    const fallbackLanguage = 'en';
    const supportedLanguages = Object.freeze(['en', 'es', 'fr', 'ro']);
    const catalogs = global.BreathingTranslationCatalogs || {};

    function isSupportedLanguage(language) {
        return supportedLanguages.includes(language) && Boolean(catalogs[language]);
    }

    function getCatalog(language) {
        return catalogs[isSupportedLanguage(language) ? language : fallbackLanguage];
    }

    function getTranslations(language) {
        return getCatalog(language)?.translations || {};
    }

    function getPresetDescriptions(language) {
        return getCatalog(language)?.presetDescriptions || {};
    }

    function getVoiceCues(language) {
        return getCatalog(language)?.voiceCues || {};
    }

    function getSpeechLanguage(language) {
        return getCatalog(language)?.speechLanguage || 'en-US';
    }

    /**
     * Returns a localized string and substitutes named parameters.
     * Falling back to English keeps the interface usable when a newly added
     * language temporarily misses a key; returning the key last makes the
     * omission visible instead of silently rendering an empty control.
     *
     * @param {string} language - supported BCP 47 language code
     * @param {string} key - stable translation key
     * @param {Record<string, string | number>} [parameters]
     * @returns {string}
     */
    function getTranslation(language, key, parameters = {}) {
        const selected = getTranslations(language)[key];
        const fallback = getTranslations(fallbackLanguage)[key];
        const template = selected ?? fallback ?? key;
        return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
            Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : match
        ));
    }

    const translations = Object.freeze(Object.fromEntries(
        supportedLanguages.map(language => [language, getTranslations(language)])
    ));
    const presetDescriptions = Object.freeze(Object.fromEntries(
        supportedLanguages.map(language => [language, getPresetDescriptions(language)])
    ));
    const voiceCues = Object.freeze(Object.fromEntries(
        supportedLanguages.map(language => [language, getVoiceCues(language)])
    ));
    const speechLanguages = Object.freeze(Object.fromEntries(
        supportedLanguages.map(language => [language, getSpeechLanguage(language)])
    ));

    global.BreathingTranslationManager = Object.freeze({
        fallbackLanguage,
        supportedLanguages,
        translations,
        presetDescriptions,
        voiceCues,
        speechLanguages,
        isSupportedLanguage,
        getCatalog,
        getTranslations,
        getPresetDescriptions,
        getVoiceCues,
        getSpeechLanguage,
        getTranslation
    });
})(window);
