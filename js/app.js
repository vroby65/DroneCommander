// Application bootstrap. Load localization before defining Blockly blocks because
// block labels and toolbox category names capture the active translation.

window.addEventListener('load', () => {
    const savedLang = localStorage.getItem('selectedLanguage') || 'en';
    document.getElementById('languageSelect').value = savedLang;
    loadLanguageFile(savedLang, () => {
        localStorage.setItem('selectedLanguage', savedLang);
        applyLocalizedStrings();
        defineCustomBlocks();
        initBlockly();
        restoreProgramFromLocalStorage();
        initThree();
        document.getElementById('graphicsSelect').value = graphicsProfileName;
        applyGraphicsProfile(graphicsProfileName);
        updateWebGLCanvas();
        animate();
        loadScenarioList();
    });
});