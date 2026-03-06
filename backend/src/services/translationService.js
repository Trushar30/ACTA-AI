const translate = require('google-translate-api-x');

/**
 * Translation Service
 * Uses google-translate-api-x for free, high-quality translation.
 */

const translateText = async (text, targetLanguage) => {
    try {
        if (!text) return '';

        // Mapping simple language codes
        const languageMap = {
            'English': 'en',
            'Hindi': 'hi',
            'Gujarati': 'gu'
        };

        const targetLangCode = languageMap[targetLanguage] || 'en';

        // google-translate-api-x usage
        // It returns a promise that resolves to an object with { text: '...', ... }
        const res = await translate(text, { to: targetLangCode });

        return res.text;

    } catch (error) {
        console.error('Translation Error:', error.message);
        // Fallback: return original text with error indicator if needed, 
        // or just original text to avoid breaking UI.
        return text;
    }
};

module.exports = {
    translateText
};
