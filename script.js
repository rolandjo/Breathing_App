document.addEventListener('DOMContentLoaded', () => {
    // Element references
    const Model = window.BreathingModel;
    const Storage = window.BreathingStorage;
    const UiUtils = window.BreathingUiUtils;
    const Voice = window.BreathingVoice;
    const App = window.BreathingApp;
    if (!Model || !Storage || !UiUtils || !Voice || !App) {
        console.error('A required breathing app module failed to load.');
        return;
    }
    const elements = {
        protocolRoundsInput: document.getElementById('protocol-rounds'),
        blockList: document.getElementById('block-list'),
        addPatternBlockButton: document.getElementById('add-pattern-block'),
        addRetentionBlockButton: document.getElementById('add-retention-block'),
        addLibraryBlockSelect: document.getElementById('add-library-block'),
        exerciseNameInput: document.getElementById('exercise-name'),
        saveExerciseButton: document.getElementById('save-exercise'),
        deleteExerciseButton: document.getElementById('delete-exercise'),
        totalTimeDisplay: document.getElementById('total-time'),
        remainingCyclesDisplay: document.getElementById('remaining-cycles'),
        startButton: document.getElementById('start'),
        stopButton: document.getElementById('stop'),
        pauseButton: document.getElementById('pause'),
        toggleModeButton: document.getElementById('toggle-mode'),
        volumeControl: document.getElementById('volume-control'),
        presetSelect: document.getElementById('preset-select'),
        canvas: document.getElementById('breathing-canvas'),
        visualizerWrapper: document.querySelector('.visualizer-wrapper'),
        phaseTime: document.getElementById('phase-time'),
        languageToggle: document.getElementById('language-toggle'),
        guidedPrompt: document.getElementById('guided-prompt'),
        selectedPresetName: document.getElementById('selected-preset-name'),
        practiceSummary: document.getElementById('practice-summary'),
        exerciseChooserButton: document.getElementById('exercise-chooser-button'),
        exerciseChooserMenu: document.getElementById('exercise-chooser-menu'),
        primaryColorInput: document.getElementById('primary-color'),
        applyCustomColorButton: document.getElementById('apply-custom-color'),
        colorSwatches: document.querySelectorAll('.color-swatch'),
        appVersions: document.querySelectorAll('[data-app-version]'),
        appStatus: document.getElementById('app-status')
    };

    const ctx = elements.canvas.getContext('2d');

    // State variables
    let workingProtocol = Model.getBuiltin('custom');
    let selectedProtocolId = 'custom';
    let session = null;
    let isRunning = false;
    let isPaused = false;
    let currentLanguage = 'en';
    let sessionCompleted = false;
    let primaryColor = '#006a6a';
    let customAccentColor = '#006a6a';
    let promptTransitionId = 0;
    const PRESET_SWATCH_COLORS = new Set(['#006a6a', '#345ca8', '#6750a4', '#8c4a60', '#386a20']);

    // Animation Loop Variables
    let animationFrameId = null;
    let backgroundTimerId = null;
    let stepStartTime = 0;
    let lastTime = 0;
    let lastProgress = 0;
    let cachedColors = {};
    let suppressPhaseAudio = false;
    let visualizerResizeObserver = null;
    const collapsedBlockIds = new Set();

    // Translations
    const translations = {
        en: {
            title: 'Breathing Timer',
            darkMode: 'Dark Mode',
            choosePreset: 'Choose a preset:',
            custom: 'Custom',
            box: 'Box Breathing (4-4-4-4)',
            relaxing: 'Relaxing Breath (4-7-8)',
            equal: 'Equal Breathing (4-4)',
            power_rounds: 'Power rounds',
            inhale: 'Inhale (s)',
            pause1: 'Hold (s)',
            exhale: 'Exhale (s)',
            pause2: 'Hold (s)',
            cycles: 'Number of Cycles:',
            numberBreaths: 'Number of Breaths:',
            hold: 'Hold after exhale (s)',
            finalPause: 'Final Pause',
            finalInhale: 'Final Inhale & Hold',
            finalPause2: 'Last exhale',
            totalTime: 'Total Time: 0 min 0 sec',
            remainingCycles: 'Remaining Cycles: 0',
            start: 'Start',
            pause: 'Pause',
            resume: 'Resume',
            stop: 'Stop',
            presetInfo: 'Guide',
            guideTitle: 'Breathing pattern guide',
            guideSafety: 'Keep every breath comfortable. Stop and return to normal breathing if you feel dizzy or unwell; practice power rounds only seated or lying down, never in water or while driving.',
            boxTitle: 'Box Breathing (4-4-4-4)',
            boxDescription: 'Follow four equal 4-second phases: inhale, hold, exhale, hold. This steady, symmetrical rhythm offers a simple pace for settling your breathing and regaining focus.',
            relaxingTitle: 'Relaxing Breath (4-7-8)',
            relaxingDescription: 'Inhale for 4 seconds, hold for 7, then exhale slowly for 8. The extended exhale makes this a gentle wind-down pattern; shorten the timings if the rhythm feels strained.',
            equalTitle: 'Equal Breathing (4-4)',
            equalDescription: 'Match a 4-second inhale with a 4-second exhale, without holds. Its continuous rhythm is easy to follow for steady, relaxed breathing; adjust both phases together to keep them equal.',
            ready: 'Ready to breathe',
            selectedExercise: 'Selected exercise',
            darkModeHint: 'Use gentler colors in low light.',
            breatheIn: 'Breathe in...',
            holdBreath: 'Hold...',
            breatheOut: 'Breathe out...',
            complete: 'Session complete',
            appearance: 'Appearance',
            breathingSettings: 'Breathing',
            audio: 'Voice',
            colors: 'Colors',
            accentColor: 'Accent color',
            customColor: 'Custom',
            colorHint: 'Creates a coordinated Material color palette.',
            addPhase: 'Add phase',
            exerciseName: 'Save as',
            saveExercise: 'Save',
            myExercises: 'My exercises',
            builtinsGroup: 'Built-in',
            piecesGroup: 'Building blocks',
            rest: 'Rest',
            inhaleType: 'Inhale',
            holdType: 'Hold',
            exhaleType: 'Exhale',
            restType: 'Rest',
            saved: 'Saved',
            protocol: 'Protocol',
            protocolRounds: 'Repeat sequence',
            addPattern: 'Add pattern',
            addHold: 'Add hold',
            fromLibrary: 'Reuse an exercise…',
            patternBlock: 'Pattern',
            holdBlock: 'Hold',
            inherited: 'Linked',
            linked: 'Linked',
            detach: 'Make a local copy',
            makeLocalCopy: 'Make a local copy',
            usesExercise: 'Includes {name}',
            includesExercise: 'Includes {name}',
            linkedHint: '{name} is a separate exercise. This protocol includes it as this step. Copy it here if you want a version that only this protocol uses.',
            reuseExercise: 'Reuse an exercise',
            reuseExerciseHint: 'Adds a linked step. It stays in sync with the original.',
            stepLabel: 'Step {n}',
            then: 'Then',
            previewReadOnly: 'Preview',
            insideExercise: 'Inside {name}',
            buildingBlock: 'Building block',
            protocolOutline: 'This protocol runs, in order:',
            moveUp: 'Up',
            moveDown: 'Down',
            removeStep: 'Remove',
            collapseStep: 'Collapse step',
            expandStep: 'Expand step',
            cycles: 'Cycles',
            holdDuration: 'Hold (s)',
            holdIncrease: 'Increase each round (s)',
            power_breaths: 'Power breaths',
            whm_recovery: 'Recovery breath',
            recovery_breath: 'Recovery breath',
            holding: 'Holding...',
            powerRoundsTitle: 'Power rounds',
            powerRoundsDescription: 'Six rounds. Each round combines 35 brisk 2-second inhales and exhales, a hold that starts at 20 seconds and increases by 10 seconds each round, then a 3-second recovery inhale, 15-second hold, and 4-second exhale. This is the most demanding preset—stay relaxed and never force the hold.',
            rounds: 'rounds',
            volumeControl: 'Volume',
            close: 'Close',
            changeLanguage: 'Change language',
            openAppearance: 'Open appearance settings',
            openBreathing: 'Open breathing settings',
            chooseExercise: 'Choose exercise',
            exerciseList: 'Exercises',
            useDarkTheme: 'Use dark theme',
            accentPresets: 'Accent color presets',
            editCustomAccent: 'Edit custom accent color',
            deleteExercise: 'Delete saved exercise',
            phaseType: 'Phase type',
            movePhaseUp: 'Move phase up',
            movePhaseDown: 'Move phase down',
            removePhase: 'Remove phase',
            timeLeft: 'Time Left',
            totalTimeLabel: 'Total Time',
            minuteShort: 'min',
            secondShort: 'sec',
            remainingCyclesLabel: 'Remaining Cycles',
            roundsRemaining: 'Rounds Remaining',
            roundLabel: 'Round',
            breathsLabel: 'Breaths',
            storageError: 'Changes could not be saved in this browser.',
            teal: 'Teal', blue: 'Blue', violet: 'Violet', rose: 'Rose', green: 'Green'
        },
        es: {
            title: 'Temporizador de Respiración',
            darkMode: 'Modo Oscuro',
            choosePreset: 'Elegir preajuste:',
            custom: 'Personalizado',
            box: 'Respiración Cuadrada (4-4-4-4)',
            relaxing: 'Respiración Relajante (4-7-8)',
            equal: 'Respiración Igual (4-4)',
            power_rounds: 'Rondas de poder',
            inhale: 'Inhalar (s)',
            pause1: 'Mantener (s)',
            exhale: 'Exhalar (s)',
            pause2: 'Mantener (s)',
            cycles: 'Número de ciclos:',
            numberBreaths: 'Número de Respiraciones:',
            hold: 'Mantener después de exhalar (s)',
            finalPause: 'Pausa Final',
            finalInhale: 'Inhalación Final',
            finalPause2: 'Última exhalación',
            totalTime: 'Tiempo Total: 0 min 0 seg',
            remainingCycles: 'Ciclos Restantes: 0',
            start: 'Iniciar',
            pause: 'Pausar',
            resume: 'Reanudar',
            stop: 'Detener',
            presetInfo: 'Guía',
            guideTitle: 'Guía de patrones respiratorios',
            guideSafety: 'Mantén cada respiración cómoda. Detente y vuelve a respirar con normalidad si sientes mareo o malestar; practica las rondas de poder solo sentado o tumbado, nunca en el agua ni mientras conduces.',
            boxTitle: 'Respiración cuadrada (4-4-4-4)',
            boxDescription: 'Sigue cuatro fases iguales de 4 segundos: inhala, retén, exhala y retén. Este ritmo estable y simétrico ofrece una pauta sencilla para calmar la respiración y recuperar la concentración.',
            relaxingTitle: 'Respiración relajante (4-7-8)',
            relaxingDescription: 'Inhala durante 4 segundos, retén durante 7 y exhala lentamente durante 8. La exhalación prolongada favorece la relajación; acorta los tiempos si el ritmo resulta forzado.',
            equalTitle: 'Respiración equilibrada (4-4)',
            equalDescription: 'Combina una inhalación de 4 segundos con una exhalación de 4 segundos, sin retenciones. Su ritmo continuo facilita una respiración estable y relajada; ajusta ambas fases a la vez para mantenerlas iguales.',
            ready: 'Listo para respirar',
            selectedExercise: 'Ejercicio seleccionado',
            darkModeHint: 'Usa colores más suaves con poca luz.',
            breatheIn: 'Inhala...',
            holdBreath: 'Mantén...',
            breatheOut: 'Exhala...',
            complete: 'Sesión completada',
            appearance: 'Apariencia',
            breathingSettings: 'Respiración',
            audio: 'Voz',
            colors: 'Colores',
            accentColor: 'Color de acento',
            customColor: 'Personalizado',
            colorHint: 'Crea una paleta Material coordinada.',
            addPhase: 'Añadir fase',
            exerciseName: 'Guardar como',
            saveExercise: 'Guardar',
            myExercises: 'Mis ejercicios',
            builtinsGroup: 'Incluidos',
            piecesGroup: 'Bloques',
            rest: 'Descanso',
            inhaleType: 'Inhalar',
            holdType: 'Mantener',
            exhaleType: 'Exhalar',
            restType: 'Descanso',
            saved: 'Guardado',
            protocol: 'Protocolo',
            protocolRounds: 'Repetir secuencia',
            addPattern: 'Añadir patrón',
            addHold: 'Añadir retención',
            fromLibrary: 'Reutilizar un ejercicio…',
            patternBlock: 'Patrón',
            holdBlock: 'Retención',
            inherited: 'Vinculado',
            linked: 'Vinculado',
            detach: 'Hacer una copia local',
            makeLocalCopy: 'Hacer una copia local',
            usesExercise: 'Incluye {name}',
            includesExercise: 'Incluye {name}',
            linkedHint: '{name} es un ejercicio aparte. Este protocolo lo incluye como este paso. Cópialo aquí si quieres una versión solo para este protocolo.',
            reuseExercise: 'Reutilizar un ejercicio',
            reuseExerciseHint: 'Añade un paso vinculado. Se mantiene sincronizado con el original.',
            stepLabel: 'Paso {n}',
            then: 'Luego',
            previewReadOnly: 'Vista previa',
            insideExercise: 'Dentro de {name}',
            buildingBlock: 'Bloque reutilizado',
            protocolOutline: 'Este protocolo ejecuta, en orden:',
            moveUp: 'Subir',
            moveDown: 'Bajar',
            removeStep: 'Quitar',
            collapseStep: 'Contraer paso',
            expandStep: 'Expandir paso',
            cycles: 'Ciclos',
            holdDuration: 'Retención (s)',
            holdIncrease: 'Aumento por ronda (s)',
            power_breaths: 'Respiraciones de poder',
            whm_recovery: 'Respiración de recuperación',
            recovery_breath: 'Respiración de recuperación',
            holding: 'Reteniendo...',
            powerRoundsTitle: 'Rondas de poder',
            powerRoundsDescription: 'Seis rondas. Cada ronda combina 35 inhalaciones y exhalaciones dinámicas de 2 segundos, una retención que comienza en 20 segundos y aumenta 10 segundos por ronda, seguida de una inhalación de recuperación de 3 segundos, una retención de 15 y una exhalación de 4. Es el patrón más exigente: mantente relajado y no fuerces la retención.',
            rounds: 'rondas',
            volumeControl: 'Volumen',
            close: 'Cerrar',
            changeLanguage: 'Cambiar idioma',
            openAppearance: 'Abrir ajustes de apariencia',
            openBreathing: 'Abrir ajustes de respiración',
            chooseExercise: 'Elegir ejercicio',
            exerciseList: 'Ejercicios',
            useDarkTheme: 'Usar tema oscuro',
            accentPresets: 'Colores de acento predefinidos',
            editCustomAccent: 'Editar color de acento personalizado',
            deleteExercise: 'Eliminar ejercicio guardado',
            phaseType: 'Tipo de fase',
            movePhaseUp: 'Mover fase hacia arriba',
            movePhaseDown: 'Mover fase hacia abajo',
            removePhase: 'Eliminar fase',
            timeLeft: 'Tiempo restante',
            totalTimeLabel: 'Tiempo total',
            minuteShort: 'min',
            secondShort: 'seg',
            remainingCyclesLabel: 'Ciclos restantes',
            roundsRemaining: 'Rondas restantes',
            roundLabel: 'Ronda',
            breathsLabel: 'Resp.',
            storageError: 'No se pudieron guardar los cambios en este navegador.',
            teal: 'Verde azulado', blue: 'Azul', violet: 'Violeta', rose: 'Rosa', green: 'Verde'
        },
        fr: {
            title: 'Minuteur de Respiration',
            darkMode: 'Mode Sombre',
            choosePreset: 'Choisir un préréglage:',
            custom: 'Personnalisé',
            box: 'Respiration Carrée (4-4-4-4)',
            relaxing: 'Respiration Relaxante (4-7-8)',
            equal: 'Respiration Égale (4-4)',
            power_rounds: 'Cycles dynamiques',
            inhale: 'Inspirer (s)',
            pause1: 'Maintenir (s)',
            exhale: 'Expirer (s)',
            pause2: 'Maintenir (s)',
            cycles: 'Nombre de cycles:',
            numberBreaths: 'Nombre de Respirations:',
            hold: 'Maintenir après expiration (s)',
            finalPause: 'Pause Finale',
            finalInhale: 'Inspiration Finale',
            finalPause2: 'Dernière expiration',
            totalTime: 'Temps Total: 0 min 0 sec',
            remainingCycles: 'Cycles Restants: 0',
            start: 'Démarrer',
            pause: 'Pause',
            resume: 'Reprendre',
            stop: 'Arrêter',
            presetInfo: 'Guide',
            guideTitle: 'Guide des rythmes respiratoires',
            guideSafety: 'Gardez une respiration confortable. Arrêtez et reprenez une respiration normale en cas de vertige ou de malaise ; pratiquez les cycles dynamiques uniquement assis ou allongé, jamais dans l’eau ni en conduisant.',
            boxTitle: 'Respiration carrée (4-4-4-4)',
            boxDescription: 'Suivez quatre phases égales de 4 secondes : inspirez, retenez, expirez, retenez. Ce rythme stable et symétrique offre un repère simple pour calmer la respiration et retrouver sa concentration.',
            relaxingTitle: 'Respiration relaxante (4-7-8)',
            relaxingDescription: 'Inspirez pendant 4 secondes, retenez pendant 7, puis expirez lentement pendant 8. L’expiration prolongée favorise la détente ; raccourcissez les durées si le rythme devient inconfortable.',
            equalTitle: 'Respiration égale (4-4)',
            equalDescription: 'Associez une inspiration de 4 secondes à une expiration de 4 secondes, sans rétention. Ce rythme continu facilite une respiration stable et détendue ; ajustez les deux phases ensemble pour les garder égales.',
            ready: 'Prêt à respirer',
            selectedExercise: 'Exercice sélectionné',
            darkModeHint: 'Utilisez des couleurs plus douces le soir.',
            breatheIn: 'Inspirez...',
            holdBreath: 'Maintenez...',
            breatheOut: 'Expirez...',
            complete: 'Session terminée',
            appearance: 'Apparence',
            breathingSettings: 'Respiration',
            audio: 'Voix',
            colors: 'Couleurs',
            accentColor: 'Couleur d’accent',
            customColor: 'Personnalisée',
            colorHint: 'Crée une palette Material coordonnée.',
            addPhase: 'Ajouter une phase',
            exerciseName: 'Enregistrer sous',
            saveExercise: 'Enregistrer',
            myExercises: 'Mes exercices',
            builtinsGroup: 'Préréglages',
            piecesGroup: 'Blocs',
            rest: 'Pause',
            inhaleType: 'Inspirer',
            holdType: 'Maintenir',
            exhaleType: 'Expirer',
            restType: 'Pause',
            saved: 'Enregistré',
            protocol: 'Protocole',
            protocolRounds: 'Répéter la séquence',
            addPattern: 'Ajouter un motif',
            addHold: 'Ajouter une rétention',
            fromLibrary: 'Réutiliser un exercice…',
            patternBlock: 'Motif',
            holdBlock: 'Rétention',
            inherited: 'Lié',
            linked: 'Lié',
            detach: 'Faire une copie locale',
            makeLocalCopy: 'Faire une copie locale',
            usesExercise: 'Inclut {name}',
            includesExercise: 'Inclut {name}',
            linkedHint: '{name} est un exercice séparé. Ce protocole l’inclut comme cette étape. Copiez-le ici pour une version propre à ce protocole.',
            reuseExercise: 'Réutiliser un exercice',
            reuseExerciseHint: 'Ajoute une étape liée. Elle reste synchronisée avec l’original.',
            stepLabel: 'Étape {n}',
            then: 'Puis',
            previewReadOnly: 'Aperçu',
            insideExercise: 'Dans {name}',
            buildingBlock: 'Bloc réutilisé',
            protocolOutline: 'Ce protocole enchaîne, dans l’ordre :',
            moveUp: 'Haut',
            moveDown: 'Bas',
            removeStep: 'Retirer',
            collapseStep: 'Réduire l’étape',
            expandStep: 'Développer l’étape',
            cycles: 'Cycles',
            holdDuration: 'Rétention (s)',
            holdIncrease: 'Augmentation par cycle (s)',
            power_breaths: 'Respirations puissantes',
            whm_recovery: 'Respiration de récupération',
            recovery_breath: 'Respiration de récupération',
            holding: 'Rétention...',
            powerRoundsTitle: 'Cycles dynamiques',
            powerRoundsDescription: 'Six cycles. Chaque cycle combine 35 inspirations et expirations dynamiques de 2 secondes, une rétention qui commence à 20 secondes et augmente de 10 secondes par cycle, puis une inspiration de récupération de 3 secondes, une rétention de 15 secondes et une expiration de 4 secondes. C’est le rythme le plus exigeant : restez détendu et ne forcez jamais la rétention.',
            rounds: 'cycles',
            volumeControl: 'Volume',
            close: 'Fermer',
            changeLanguage: 'Changer de langue',
            openAppearance: 'Ouvrir les réglages d’apparence',
            openBreathing: 'Ouvrir les réglages de respiration',
            chooseExercise: 'Choisir un exercice',
            exerciseList: 'Exercices',
            useDarkTheme: 'Utiliser le thème sombre',
            accentPresets: 'Couleurs d’accent prédéfinies',
            editCustomAccent: 'Modifier la couleur d’accent personnalisée',
            deleteExercise: 'Supprimer l’exercice enregistré',
            phaseType: 'Type de phase',
            movePhaseUp: 'Monter la phase',
            movePhaseDown: 'Descendre la phase',
            removePhase: 'Supprimer la phase',
            timeLeft: 'Temps restant',
            totalTimeLabel: 'Temps total',
            minuteShort: 'min',
            secondShort: 's',
            remainingCyclesLabel: 'Cycles restants',
            roundsRemaining: 'Cycles restants',
            roundLabel: 'Cycle',
            breathsLabel: 'Resp.',
            storageError: 'Les modifications n’ont pas pu être enregistrées dans ce navigateur.',
            teal: 'Sarcelle', blue: 'Bleu', violet: 'Violet', rose: 'Rose', green: 'Vert'
        },
        ro: {
            title: 'Temporizator de respirație',
            darkMode: 'Mod întunecat',
            choosePreset: 'Alege un preset:',
            custom: 'Personalizat',
            box: 'Respirație pătrată (4-4-4-4)',
            relaxing: 'Respirație relaxantă (4-7-8)',
            equal: 'Respirație egală (4-4)',
            power_rounds: 'Runde de putere',
            inhale: 'Inspiră (s)',
            pause1: 'Ține (s)',
            exhale: 'Expiră (s)',
            pause2: 'Ține (s)',
            cycles: 'Cicluri',
            numberBreaths: 'Număr de respirații:',
            hold: 'Ține după expirare (s)',
            finalPause: 'Pauză finală',
            finalInhale: 'Inspirație finală',
            finalPause2: 'Ultima expirare',
            totalTime: 'Timp total: 0 min 0 sec',
            remainingCycles: 'Cicluri rămase: 0',
            start: 'Start',
            pause: 'Pauză',
            resume: 'Continuă',
            stop: 'Stop',
            presetInfo: 'Ghid',
            guideTitle: 'Ghidul tiparelor de respirație',
            guideSafety: 'Păstrează fiecare respirație confortabilă. Oprește-te și revino la respirația normală dacă amețești sau te simți rău; practică rundele de putere numai așezat sau culcat, niciodată în apă ori în timp ce conduci.',
            boxTitle: 'Respirație pătrată (4-4-4-4)',
            boxDescription: 'Urmează patru faze egale de câte 4 secunde: inspiră, ține, expiră și ține. Ritmul constant și simetric oferă un tempo simplu pentru liniștirea respirației și recăpătarea concentrării.',
            relaxingTitle: 'Respirație relaxantă (4-7-8)',
            relaxingDescription: 'Inspiră timp de 4 secunde, ține timp de 7, apoi expiră lent timp de 8. Expirația prelungită favorizează relaxarea; scurtează timpii dacă ritmul devine inconfortabil.',
            equalTitle: 'Respirație egală (4-4)',
            equalDescription: 'Combină o inspirație de 4 secunde cu o expirație de 4 secunde, fără rețineri. Ritmul continuu este ușor de urmărit pentru o respirație constantă și relaxată; ajustează ambele faze împreună pentru a le păstra egale.',
            ready: 'Gata de respirație',
            selectedExercise: 'Exercițiu selectat',
            darkModeHint: 'Folosește culori mai blânde pe întuneric.',
            breatheIn: 'Inspiră...',
            holdBreath: 'Ține...',
            breatheOut: 'Expiră...',
            complete: 'Sesiune încheiată',
            appearance: 'Aspect',
            breathingSettings: 'Respirație',
            audio: 'Voce',
            colors: 'Culori',
            accentColor: 'Culoare de accent',
            customColor: 'Personalizat',
            colorHint: 'Creează o paletă Material coordonată.',
            addPhase: 'Adaugă fază',
            exerciseName: 'Salvează ca',
            saveExercise: 'Salvează',
            myExercises: 'Exercițiile mele',
            builtinsGroup: 'Predefinite',
            piecesGroup: 'Blocuri',
            rest: 'Pauză',
            inhaleType: 'Inspiră',
            holdType: 'Ține',
            exhaleType: 'Expiră',
            restType: 'Pauză',
            saved: 'Salvat',
            protocol: 'Protocol',
            protocolRounds: 'Repetă secvența',
            addPattern: 'Adaugă pattern',
            addHold: 'Adaugă reținere',
            fromLibrary: 'Reutilizează un exercițiu…',
            patternBlock: 'Pattern',
            holdBlock: 'Reținere',
            inherited: 'Legat',
            linked: 'Legat',
            detach: 'Fă o copie locală',
            makeLocalCopy: 'Fă o copie locală',
            usesExercise: 'Include {name}',
            includesExercise: 'Include {name}',
            linkedHint: '{name} este un exercițiu separat. Acest protocol îl include ca pas. Copiază-l aici dacă vrei o versiune doar pentru acest protocol.',
            reuseExercise: 'Reutilizează un exercițiu',
            reuseExerciseHint: 'Adaugă un pas legat. Rămâne sincronizat cu originalul.',
            stepLabel: 'Pasul {n}',
            then: 'Apoi',
            previewReadOnly: 'Previzualizare',
            insideExercise: 'În {name}',
            buildingBlock: 'Bloc reutilizat',
            protocolOutline: 'Acest protocol rulează, în ordine:',
            moveUp: 'Sus',
            moveDown: 'Jos',
            removeStep: 'Elimină',
            collapseStep: 'Restrânge pasul',
            expandStep: 'Extinde pasul',
            holdDuration: 'Reținere (s)',
            holdIncrease: 'Creștere pe rundă (s)',
            power_breaths: 'Respirații de putere',
            whm_recovery: 'Respirație de recuperare',
            recovery_breath: 'Respirație de recuperare',
            holding: 'Reținere...',
            powerRoundsTitle: 'Runde de putere',
            powerRoundsDescription: 'Șase runde. Fiecare rundă combină 35 de inspirații și expirații dinamice de câte 2 secunde, o reținere care începe la 20 de secunde și crește cu 10 secunde la fiecare rundă, apoi o inspirație de recuperare de 3 secunde, o reținere de 15 secunde și o expirație de 4 secunde. Este cel mai solicitant tipar: rămâi relaxat și nu forța reținerea.',
            rounds: 'runde',
            volumeControl: 'Volum',
            close: 'Închide',
            changeLanguage: 'Schimbă limba',
            openAppearance: 'Deschide setările de aspect',
            openBreathing: 'Deschide setările de respirație',
            chooseExercise: 'Alege exercițiul',
            exerciseList: 'Exerciții',
            useDarkTheme: 'Folosește tema întunecată',
            accentPresets: 'Culori de accent predefinite',
            editCustomAccent: 'Editează culoarea de accent personalizată',
            deleteExercise: 'Șterge exercițiul salvat',
            phaseType: 'Tipul fazei',
            movePhaseUp: 'Mută faza în sus',
            movePhaseDown: 'Mută faza în jos',
            removePhase: 'Elimină faza',
            timeLeft: 'Timp rămas',
            totalTimeLabel: 'Timp total',
            minuteShort: 'min',
            secondShort: 'sec',
            remainingCyclesLabel: 'Cicluri rămase',
            roundsRemaining: 'Runde rămase',
            roundLabel: 'Runda',
            breathsLabel: 'Resp.',
            storageError: 'Modificările nu au putut fi salvate în acest browser.',
            teal: 'Turcoaz', blue: 'Albastru', violet: 'Violet', rose: 'Roz', green: 'Verde'
        }
    };

    const presetDescriptions = {
        en: {
            custom: 'Create your own breathing rhythm.',
            box: 'Balanced focus with four equal phases.',
            relaxing: 'A slower exhale designed for winding down.',
            equal: 'A simple, steady rhythm for everyday calm.',
            power_rounds: 'Guided breathing rounds followed by timed holds.'
        },
        es: {
            custom: 'Crea tu propio ritmo de respiración.',
            box: 'Enfoque equilibrado con cuatro fases iguales.',
            relaxing: 'Una exhalación lenta para relajarte.',
            equal: 'Un ritmo simple y constante para la calma diaria.',
            power_rounds: 'Rondas guiadas seguidas de retenciones cronometradas.'
        },
        fr: {
            custom: 'Créez votre propre rythme respiratoire.',
            box: 'Équilibre et concentration avec quatre phases égales.',
            relaxing: 'Une expiration lente pour favoriser la détente.',
            equal: 'Un rythme simple et stable pour le calme quotidien.',
            power_rounds: 'Cycles guidés suivis de rétentions chronométrées.'
        },
        ro: {
            custom: 'Creează-ți propriul ritm de respirație.',
            box: 'Focus echilibrat, cu patru faze egale.',
            relaxing: 'O expirare mai lentă, pentru relaxare.',
            equal: 'Un ritm simplu și constant pentru calmul de zi cu zi.',
            power_rounds: 'Runde ghidate, urmate de rețineri cronometrate.'
        }
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeHex(color) {
        if (typeof color !== 'string') return '';
        const value = color.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(value)) return value;
        if (/^#[0-9a-f]{3}$/.test(value)) {
            return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
        }
        return '';
    }

    function onColorFor(hex) {
        const value = hex.replace('#', '');
        const channel = offset => {
            const number = parseInt(value.slice(offset, offset + 2), 16) / 255;
            return number <= 0.03928 ? number / 12.92 : ((number + 0.055) / 1.055) ** 2.4;
        };
        const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
        return luminance > 0.45 ? '#1a1a1a' : '#ffffff';
    }

    function hexToHsl(hex) {
        const value = hex.replace('#', '');
        const red = parseInt(value.slice(0, 2), 16) / 255;
        const green = parseInt(value.slice(2, 4), 16) / 255;
        const blue = parseInt(value.slice(4, 6), 16) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;

        if (delta !== 0) {
            if (max === red) hue = 60 * (((green - blue) / delta) % 6);
            else if (max === green) hue = 60 * ((blue - red) / delta + 2);
            else hue = 60 * ((red - green) / delta + 4);
        }

        if (hue < 0) hue += 360;
        const lightness = (max + min) / 2;
        const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
        return { h: hue, s: saturation * 100 };
    }

    function hslToHex(hue, saturation, lightness) {
        const h = ((hue % 360) + 360) % 360;
        const s = clamp(saturation, 0, 100) / 100;
        const l = clamp(lightness, 0, 100) / 100;
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
        const offset = l - chroma / 2;
        let red = 0;
        let green = 0;
        let blue = 0;

        if (h < 60) [red, green] = [chroma, x];
        else if (h < 120) [red, green] = [x, chroma];
        else if (h < 180) [green, blue] = [chroma, x];
        else if (h < 240) [green, blue] = [x, chroma];
        else if (h < 300) [red, blue] = [x, chroma];
        else [red, blue] = [chroma, x];

        return `#${[red, green, blue].map(channel =>
            Math.round((channel + offset) * 255).toString(16).padStart(2, '0')
        ).join('')}`;
    }

    function createMaterialPalette(seedColor, darkMode) {
        const { h, s } = hexToHsl(seedColor);
        const isNeutral = s < 5;
        const primarySaturation = isNeutral ? 0 : clamp(s, 42, 78);
        const secondarySaturation = isNeutral ? 0 : clamp(s * 0.38, 18, 34);
        const tertiaryHue = (h + 62) % 360;
        const tertiarySaturation = isNeutral ? 0 : clamp(s * 0.62, 32, 58);
        const neutralSaturation = isNeutral ? 0 : clamp(s * 0.1, 3, 8);
        const variantSaturation = isNeutral ? 0 : clamp(s * 0.18, 6, 14);

        if (darkMode) {
            return {
                primary: hslToHex(h, primarySaturation, 80),
                onPrimary: hslToHex(h, primarySaturation, 20),
                primaryContainer: hslToHex(h, primarySaturation, 30),
                onPrimaryContainer: hslToHex(h, primarySaturation, 90),
                secondary: hslToHex(h, secondarySaturation, 80),
                onSecondary: hslToHex(h, secondarySaturation, 20),
                secondaryContainer: hslToHex(h, secondarySaturation, 30),
                onSecondaryContainer: hslToHex(h, secondarySaturation, 90),
                tertiary: hslToHex(tertiaryHue, tertiarySaturation, 80),
                tertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 30),
                onTertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 90),
                surface: hslToHex(h, neutralSaturation, 6),
                surfaceLow: hslToHex(h, neutralSaturation, 10),
                surfaceContainer: hslToHex(h, neutralSaturation, 12),
                surfaceHigh: hslToHex(h, neutralSaturation, 17),
                surfaceHighest: hslToHex(h, variantSaturation, 22),
                onSurface: hslToHex(h, neutralSaturation, 90),
                onSurfaceVariant: hslToHex(h, variantSaturation, 80),
                outline: hslToHex(h, variantSaturation, 60),
                outlineVariant: hslToHex(h, variantSaturation, 30),
                exhale: hslToHex(h - 58, isNeutral ? 0 : clamp(s, 38, 65), 80)
            };
        }

        return {
            primary: hslToHex(h, primarySaturation, 32),
            onPrimary: '#ffffff',
            primaryContainer: hslToHex(h, primarySaturation, 90),
            onPrimaryContainer: hslToHex(h, primarySaturation, 10),
            secondary: hslToHex(h, secondarySaturation, 38),
            onSecondary: '#ffffff',
            secondaryContainer: hslToHex(h, secondarySaturation, 90),
            onSecondaryContainer: hslToHex(h, secondarySaturation, 10),
            tertiary: hslToHex(tertiaryHue, tertiarySaturation, 38),
            tertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 90),
            onTertiaryContainer: hslToHex(tertiaryHue, tertiarySaturation, 10),
            surface: hslToHex(h, neutralSaturation, 98),
            surfaceLow: hslToHex(h, neutralSaturation, 96),
            surfaceContainer: hslToHex(h, neutralSaturation, 94),
            surfaceHigh: hslToHex(h, neutralSaturation, 92),
            surfaceHighest: hslToHex(h, variantSaturation, 90),
            onSurface: hslToHex(h, neutralSaturation, 10),
            onSurfaceVariant: hslToHex(h, variantSaturation, 30),
            outline: hslToHex(h, variantSaturation, 48),
            outlineVariant: hslToHex(h, variantSaturation, 80),
            exhale: hslToHex(h - 58, isNeutral ? 0 : clamp(s, 38, 65), 38)
        };
    }

    function applyPrimaryColor(color) {
        const nextColor = normalizeHex(color);
        if (!nextColor) return;
        primaryColor = nextColor;
        const palette = createMaterialPalette(primaryColor, document.body.classList.contains('dark-mode'));
        palette.primary = primaryColor;
        palette.onPrimary = onColorFor(primaryColor);
        const rootStyle = document.body.style;
        const roles = {
            '--md-sys-color-primary': palette.primary,
            '--md-sys-color-on-primary': palette.onPrimary,
            '--md-sys-color-primary-container': palette.primaryContainer,
            '--md-sys-color-on-primary-container': palette.onPrimaryContainer,
            '--md-sys-color-secondary': palette.secondary,
            '--md-sys-color-on-secondary': palette.onSecondary,
            '--md-sys-color-secondary-container': palette.secondaryContainer,
            '--md-sys-color-on-secondary-container': palette.onSecondaryContainer,
            '--md-sys-color-tertiary': palette.tertiary,
            '--md-sys-color-tertiary-container': palette.tertiaryContainer,
            '--md-sys-color-on-tertiary-container': palette.onTertiaryContainer,
            '--md-sys-color-surface': palette.surface,
            '--md-sys-color-surface-container-low': palette.surfaceLow,
            '--md-sys-color-surface-container': palette.surfaceContainer,
            '--md-sys-color-surface-container-high': palette.surfaceHigh,
            '--md-sys-color-surface-container-highest': palette.surfaceHighest,
            '--md-sys-color-on-surface': palette.onSurface,
            '--md-sys-color-on-surface-variant': palette.onSurfaceVariant,
            '--md-sys-color-outline': palette.outline,
            '--md-sys-color-outline-variant': palette.outlineVariant,
            '--orb-color-inhale': palette.primary,
            '--orb-color-hold': palette.tertiary,
            '--orb-color-exhale': palette.exhale,
            '--orb-color-idle': palette.secondary
        };

        Object.entries(roles).forEach(([role, value]) => rootStyle.setProperty(role, value));
        if (elements.primaryColorInput) {
            elements.primaryColorInput.value = customAccentColor;
        }
        const customButton = elements.primaryColorInput?.closest('.custom-color-button');
        let matchesSwatch = false;
        elements.colorSwatches.forEach(swatch => {
            const selected = swatch.dataset.color.toLowerCase() === primaryColor;
            swatch.setAttribute('aria-pressed', String(selected));
            matchesSwatch ||= selected;
        });
        if (customButton) {
            customButton.classList.toggle('is-selected', !matchesSwatch);
            customButton.setAttribute('aria-pressed', String(!matchesSwatch));
        }
        document.querySelector('meta[name="theme-color"]').content = palette.surface;
        updateCachedColors();
        if (!isRunning) drawFrame(null, 0, performance.now());
    }

    // Spoken phase cues
    const voiceGuide = Voice.createVoiceGuide({
        getLanguage: () => currentLanguage,
        getVolume: () => elements.volumeControl.value
    });

    function currentStep() {
        return session?.currentStep() || null;
    }

    function visualPhaseList() {
        if (isRunning && session) return session.visualPhases();
        const pattern = Model.firstPatternBlock(workingProtocol);
        return pattern ? Model.activePhases(pattern.phases) : [];
    }

    function speakPhase(phaseType = 'hold') {
        if (suppressPhaseAudio) return;
        voiceGuide.speak(phaseType);
    }

    function setGuidedPrompt(text, immediate = false) {
        if (!text || elements.guidedPrompt.textContent === text) return;
        const transitionId = ++promptTransitionId;
        elements.guidedPrompt.getAnimations().forEach(animation => animation.cancel());

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (immediate || reduceMotion || document.hidden || suppressPhaseAudio || typeof elements.guidedPrompt.animate !== 'function') {
            elements.guidedPrompt.textContent = text;
            return;
        }

        const fadeOut = elements.guidedPrompt.animate([
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
            { opacity: 0, transform: 'translateY(-6px)', filter: 'blur(2px)' }
        ], {
            duration: 110,
            easing: 'cubic-bezier(0.4, 0, 1, 1)',
            fill: 'forwards'
        });

        fadeOut.finished.then(() => {
            if (transitionId !== promptTransitionId) return;
            elements.guidedPrompt.textContent = text;
            elements.guidedPrompt.animate([
                { opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' },
                { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
            ], {
                duration: 240,
                easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
                fill: 'both'
            });
        }).catch(() => {});
    }

    // --- CANVAS VISUALIZER LOGIC ---

    function resizeCanvas() {
        const wrapper = elements.visualizerWrapper;
        const dpr = window.devicePixelRatio || 1;
        elements.canvas.width = wrapper.clientWidth * dpr;
        elements.canvas.height = wrapper.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        updateCachedColors();
    }

    function updateCachedColors() {
        const root = document.body;
        cachedColors = {
            inhale: getComputedStyle(root).getPropertyValue('--orb-color-inhale').trim(),
            hold: getComputedStyle(root).getPropertyValue('--orb-color-hold').trim(),
            exhale: getComputedStyle(root).getPropertyValue('--orb-color-exhale').trim(),
            idle: getComputedStyle(root).getPropertyValue('--orb-color-idle').trim(),
            glassBorder: getComputedStyle(root).getPropertyValue('--md-sys-color-outline-variant').trim(),
        };
    }

    function generateVertices(activeStepsCount, cx, cy, r) {
        if (activeStepsCount <= 1) return [{ x: cx, y: cy }];
        if (activeStepsCount === 2) {
            return [
                { x: cx, y: cy + r },
                { x: cx, y: cy - r }
            ];
        }
        if (activeStepsCount === 3) {
            return [
                { x: cx - r * 0.866, y: cy + r * 0.5 },
                { x: cx, y: cy - r },
                { x: cx + r * 0.866, y: cy + r * 0.5 }
            ];
        }
        if (activeStepsCount === 4) {
            return [
                { x: cx - r, y: cy + r },
                { x: cx - r, y: cy - r },
                { x: cx + r, y: cy - r },
                { x: cx + r, y: cy + r }
            ];
        }

        const vertices = [];
        for (let i = 0; i < activeStepsCount; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / activeStepsCount;
            vertices.push({
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle)
            });
        }
        return vertices;
    }

    function easeInOutSine(x) {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    }

    function drawFrame(step, progress, idleTime = 0) {
        const w = elements.canvas.clientWidth;
        const h = elements.canvas.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.35;

        ctx.clearRect(0, 0, w, h);

        const activeSteps = visualPhaseList();
        if (activeSteps.length === 0 && isRunning) {
            const step = currentStep();
            if (step) {
                ctx.beginPath();
                ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                ctx.fillStyle = cachedColors[step.colorKey] || cachedColors.idle;
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            return;
        }

        if (activeSteps.length === 0) return;

        const vertices = generateVertices(activeSteps.length, cx, cy, r);

        // Draw track
        if (vertices.length > 1) {
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            if (vertices.length > 2) ctx.closePath();
            
            ctx.strokeStyle = cachedColors.glassBorder || 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        let bx = cx;
        let by = cy;
        let currentColor = cachedColors.idle;

        if (!isRunning) {
            const accent = cachedColors.inhale || cachedColors.idle;
            const pulse = 1 + Math.sin(idleTime / 500) * 0.1;
            ctx.beginPath();
            ctx.arc(cx, cy, 20 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        const activeStep = step || currentStep();
        const activeIndex = (() => {
            if (!isRunning || !session || !activeStep) return -1;
            const block = session.currentBlock();
            if (!block || block.type !== 'pattern') return -1;
            const phase = block.phases[session.cursor.phaseIndex];
            return phase ? activeSteps.findIndex(item => item.id === phase.id) : -1;
        })();
        if (activeIndex !== -1 && vertices.length > 1) {
            const start = vertices[activeIndex];
            const end = vertices[(activeIndex + 1) % vertices.length];

            const easedProgress = easeInOutSine(progress);
            bx = start.x + (end.x - start.x) * easedProgress;
            by = start.y + (end.y - start.y) * easedProgress;
            currentColor = cachedColors[activeStep.colorKey];
        } else if (activeStep) {
             currentColor = cachedColors[activeStep.colorKey] || cachedColors.idle;
        }

        // Draw only the progress marker; the geometric track remains the focal point.
        ctx.beginPath();
        ctx.arc(bx, by, 15, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.shadowColor = currentColor;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0; 
    }

    function renderLoop(time) {
        if (!lastTime) lastTime = time;

        if (!isRunning) {
            drawFrame(null, 0, time);
            animationFrameId = requestAnimationFrame(renderLoop);
            lastTime = time;
            return;
        }

        if (isPaused) {
            stepStartTime += (time - lastTime); 
            lastTime = time;
            drawFrame(currentStep(), lastProgress); 
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        processTimerAt(time);

        if (isRunning) updateTotalTime(time);

        lastTime = time;
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function currentPhaseIsComplete(time) {
        const step = currentStep();
        if (!step) return false;
        const duration = step.duration();
        return duration === 0 || time - stepStartTime >= duration * 1000;
    }

    function processTimerAt(time, catchUp = false) {
        let caughtUp = false;
        let transitions = 0;

        do {
            suppressPhaseAudio = catchUp && currentPhaseIsComplete(time);
            caughtUp ||= suppressPhaseAudio;
            processPhase(time);
            transitions++;
        } while (
            catchUp && isRunning && !isPaused &&
            currentPhaseIsComplete(time) && transitions < 2000
        );

        suppressPhaseAudio = false;
        if (caughtUp && isRunning) {
            const step = currentStep();
            if (step) speakPhase(step.type);
        }
    }

    function processPhase(time) {
        const step = currentStep();
        if (!step) {
            finishSession();
            return;
        }

        const duration = step.duration();
        if (duration <= 0) {
            const result = session.advance();
            if (result.done) finishSession();
            return;
        }

        const elapsed = (time - stepStartTime) / 1000;
        let progress = elapsed / duration;
        let timeRemaining = Math.ceil(duration - elapsed);
        if (timeRemaining < 0) timeRemaining = 0;
        if (elements.phaseTime.textContent !== String(timeRemaining)) {
            elements.phaseTime.textContent = timeRemaining;
        }

        if (progress >= 1) {
            progress = 1;
            drawFrame(step, progress);
            const completedAt = stepStartTime + duration * 1000;
            const result = session.advance();
            if (result.done) {
                finishSession();
                return;
            }
            const nextStep = currentStep();
            if (nextStep && nextStep.duration() > 0) {
                setGuidedPrompt(translations[currentLanguage][nextStep.textKey]);
                speakPhase(nextStep.type);
            }
            stepStartTime = completedAt;
            lastProgress = 0;
            updateRemainingCycles();
            updateTotalTime();
        } else {
            drawFrame(step, progress);
            lastProgress = progress;
        }
    }


    // --- TIMER CONTROL ---

    function start() {
        if (isRunning) return;

        // Hide settings offcanvas if open
        ['appearanceOffcanvas', 'breathingOffcanvas'].forEach(id => {
            const offcanvasElement = document.getElementById(id);
            const bsOffcanvas = offcanvasElement && window.bootstrap?.Offcanvas.getInstance(offcanvasElement);
            if (bsOffcanvas) bsOffcanvas.hide();
        });

        session = Model.createSession(workingProtocol);
        sessionCompleted = false;
        isPaused = false;
        stepStartTime = performance.now();
        lastTime = stepStartTime;
        lastProgress = 0;
        isRunning = true;
        document.body.classList.add('session-active');
        resizeCanvas();
        updateCachedColors();
        elements.visualizerWrapper.classList.remove('session-complete', 'is-paused');

        elements.startButton.classList.add('d-none');
        elements.stopButton.classList.remove('d-none');
        elements.pauseButton.classList.remove('d-none');

        updateRemainingCycles();
        updateTotalTime();

        const firstStep = currentStep();
        if (firstStep) {
             setGuidedPrompt(translations[currentLanguage][firstStep.textKey]);
             speakPhase(firstStep.type);
        } else {
             speakPhase();
        }

        stepStartTime = performance.now();
        lastTime = stepStartTime;
        updateTimerExecutionMode();
    }

    function restoreIdleControls() {
        document.body.classList.remove('session-active');
        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');
        setPauseControl(false);
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
    }

    function stop() {
        if (!isRunning) return;

        isRunning = false;
        isPaused = false;
        voiceGuide.cancel();
        sessionCompleted = false;
        session = null;
        elements.visualizerWrapper.classList.remove('session-complete', 'is-paused');
        stopBackgroundTimer();
        restoreIdleControls();

        updateRemainingCycles();
        updateTotalTime();
        resetDisplay();
    }

    function finishSession() {
        isRunning = false;
        isPaused = false;
        voiceGuide.cancel();
        session = null;
        sessionCompleted = true;
        elements.visualizerWrapper.classList.remove('is-paused');
        elements.visualizerWrapper.classList.add('session-complete');
        stopBackgroundTimer();
        restoreIdleControls();
        setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete');
        elements.phaseTime.textContent = '';
        updateRemainingCycles();
        updateTimeDisplay(0, true);
        drawFrame(null, 0, performance.now());
    }

    function pause() {
        if (!isRunning || isPaused) return;
        isPaused = true;
        voiceGuide.cancel();
        elements.visualizerWrapper.classList.add('is-paused');
        stopBackgroundTimer();
        setPauseControl(true);
        elements.pauseButton.classList.remove('btn-warning');
        elements.pauseButton.classList.add('btn-primary');
    }

    function resume() {
        if (!isPaused) return;
        isPaused = false;
        elements.visualizerWrapper.classList.remove('is-paused');
        setPauseControl(false);
        elements.pauseButton.classList.remove('btn-primary');
        elements.pauseButton.classList.add('btn-warning');
        const step = currentStep();
        if (step) speakPhase(step.type);
        updateTimerExecutionMode();
    }

    function toggleSessionPause() {
        if (!isRunning) return;
        if (isPaused) resume();
        else pause();
    }

    function runBackgroundTick() {
        if (!isRunning || isPaused) return;

        const time = performance.now();
        processTimerAt(time, true);

        if (isRunning) updateTotalTime(time);
        lastTime = time;
    }

    function startBackgroundTimer() {
        if (backgroundTimerId !== null || !isRunning || isPaused) return;
        backgroundTimerId = window.setInterval(runBackgroundTick, 250);
    }

    function stopBackgroundTimer() {
        if (backgroundTimerId === null) return;
        window.clearInterval(backgroundTimerId);
        backgroundTimerId = null;
    }

    function updateTimerExecutionMode() {
        if (document.hidden) {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            startBackgroundTimer();
            return;
        }

        stopBackgroundTimer();
        if (animationFrameId === null) {
            const time = performance.now();
            if (isRunning && !isPaused) processTimerAt(time, true);
            lastTime = time;
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    }

    function resetDisplay() {
        setGuidedPrompt(translations[currentLanguage]?.ready || 'Ready to breathe');
        elements.phaseTime.textContent = '';
        drawFrame(null, 0, performance.now());
    }

    function updateTimeDisplay(totalSeconds, forceRemaining = false) {
        const nextText = UiUtils.formatDuration(
            totalSeconds,
            translations[currentLanguage],
            isRunning || forceRemaining
        );
        if (elements.totalTimeDisplay.textContent !== nextText) {
            elements.totalTimeDisplay.textContent = nextText;
        }
    }

    function updateTotalTime(time = performance.now()) {
        if (sessionCompleted) {
            updateTimeDisplay(0, true);
            return;
        }

        if (isRunning && session) {
            updateTimeDisplay(session.remainingSeconds(time, stepStartTime));
            return;
        }

        updateTimeDisplay(Model.protocolDuration(workingProtocol));
    }

    function updateRemainingCycles() {
        const t = translations[currentLanguage] || {};
        const holdingText = t.holding || 'Holding...';
        if (sessionCompleted) {
            const label = Model.protocolHasMultipleStages(workingProtocol)
                ? (t.roundsRemaining || 'Rounds Remaining')
                : (t.remainingCyclesLabel || 'Remaining Cycles');
            elements.remainingCyclesDisplay.textContent = `${label}: 0`;
            return;
        }

        const info = isRunning && session
            ? session.progressInfo()
            : {
                round: 1,
                totalRounds: workingProtocol.rounds,
                remainingCycles: Model.firstPatternBlock(workingProtocol)?.cycles || 0,
                inRetention: false,
                inPattern: true,
                multiRound: Model.protocolHasMultipleStages(workingProtocol)
            };

        if (info.multiRound) {
            const roundText = t.roundLabel || 'Round';
            if (!info.inPattern) {
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${info.round}/${info.totalRounds} | ${holdingText}`;
            } else {
                const breathText = t.breathsLabel || 'Breaths';
                elements.remainingCyclesDisplay.textContent = `${roundText}: ${info.round}/${info.totalRounds} | ${breathText}: ${info.remainingCycles}`;
            }
            return;
        }

        const remainingText = t.remainingCyclesLabel || 'Remaining Cycles';
        elements.remainingCyclesDisplay.textContent = `${remainingText}: ${info.remainingCycles}`;
    }

    function setPauseControl(paused) {
        const icon = elements.pauseButton.querySelector('i');
        const label = elements.pauseButton.querySelector('.control-label');
        if (icon) icon.className = paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        if (label) {
            label.textContent = paused
                ? (translations[currentLanguage]?.resume || 'Resume')
                : (translations[currentLanguage]?.pause || 'Pause');
            label.setAttribute('data-lang-key', paused ? 'resume' : 'pause');
        }
        elements.pauseButton.setAttribute('aria-label', label?.textContent || (paused ? 'Resume' : 'Pause'));
    }

    function protocolDisplayName(protocol) {
        if (protocol.nameKey && translations[currentLanguage]?.[protocol.nameKey]) {
            return translations[currentLanguage][protocol.nameKey];
        }
        return protocol.name || translations[currentLanguage]?.custom || 'Custom';
    }

    function homeExerciseName(protocol) {
        return protocolDisplayName(protocol).replace(/\s*\(\d+(?:\s*[-–·]\s*\d+)+\)\s*$/, '');
    }

    function formatBlockSummary(blockSummary) {
        const t = translations[currentLanguage] || {};
        if (blockSummary.kind === 'retention') {
            const hold = t.holdBlock || 'Hold';
            return blockSummary.increasePerRound
                ? `${hold} ${blockSummary.duration}+${blockSummary.increasePerRound}`
                : `${hold} ${blockSummary.duration}`;
        }
        if (blockSummary.kind === 'ref') {
            const name = (blockSummary.nameKey && t[blockSummary.nameKey]) || blockSummary.name;
            return (t.usesExercise || 'Uses {name}').replace('{name}', name);
        }
        if (blockSummary.phases?.length) {
            return `${blockSummary.phases.join(' · ')} × ${blockSummary.cycles}`;
        }
        return `${blockSummary.cycles} ${t.cycles || 'cycles'}`;
    }

    function syncPracticeSummary() {
        const t = translations[currentLanguage] || {};
        elements.selectedPresetName.textContent = homeExerciseName(workingProtocol);
        const summary = Model.summaryParts(workingProtocol);
        if (summary.kind === 'protocol') {
            const parts = summary.blocks.map(formatBlockSummary);
            if (summary.rounds > 1) parts.push(`${summary.rounds} ${t.rounds || 'rounds'}`);
            elements.practiceSummary.textContent = parts.join(' · ');
            return;
        }
        elements.practiceSummary.textContent = `${summary.phases.join(' · ')} · ${summary.cycles} ${t.cycles || 'cycles'}`;
    }

    function refreshPresetSelect() {
        const t = translations[currentLanguage] || {};
        const library = Model.loadUserLibrary();
        const currentValue = selectedProtocolId;
        elements.presetSelect.innerHTML = '';

        const builtinGroup = document.createElement('optgroup');
        builtinGroup.label = t.builtinsGroup || 'Built-in';
        Model.PRESET_IDS.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = t[id] || Model.builtins[id].name;
            builtinGroup.appendChild(option);
        });
        elements.presetSelect.appendChild(builtinGroup);

        if (library.length) {
            const userGroup = document.createElement('optgroup');
            userGroup.label = t.myExercises || 'My exercises';
            library.forEach(protocol => {
                const option = document.createElement('option');
                option.value = protocol.id;
                option.textContent = protocol.name;
                userGroup.appendChild(option);
            });
            elements.presetSelect.appendChild(userGroup);
        }

        if ([...elements.presetSelect.options].some(option => option.value === currentValue)) {
            elements.presetSelect.value = currentValue;
        } else {
            elements.presetSelect.value = 'custom';
            selectedProtocolId = 'custom';
        }
        refreshExerciseChooser();
    }

    function exerciseChooserItems() {
        const items = Model.PRESET_IDS.map(id => ({
            id,
            group: 'builtin',
            name: homeExerciseName(Model.getBuiltin(id))
        }));
        Model.loadUserLibrary().forEach(protocol => {
            items.push({
                id: protocol.id,
                group: 'user',
                name: protocol.name
            });
        });
        return items;
    }

    function setExerciseChooserOpen(open) {
        if (!elements.exerciseChooserButton || !elements.exerciseChooserMenu) return;
        const chooser = elements.exerciseChooserButton.closest('.practice-chooser');
        elements.exerciseChooserButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        chooser?.classList.toggle('is-open', open);
    }

    function exerciseChooserOptions() {
        return [...elements.exerciseChooserMenu.querySelectorAll('.exercise-menu-item')];
    }

    function focusExerciseOption(index) {
        const options = exerciseChooserOptions();
        if (!options.length) return;
        const target = options[Math.max(0, Math.min(index, options.length - 1))];
        options.forEach(option => { option.tabIndex = option === target ? 0 : -1; });
        target.focus();
    }

    function closeExerciseChooser(restoreFocus = false) {
        setExerciseChooserOpen(false);
        if (restoreFocus) elements.exerciseChooserButton.focus();
    }

    function moveExerciseChooserFocus(event) {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
        event.preventDefault();
        const options = exerciseChooserOptions();
        const currentIndex = options.indexOf(document.activeElement);
        focusExerciseOption(UiUtils.chooserIndex(currentIndex, options.length, event.key));
        return true;
    }

    function refreshExerciseChooser() {
        const t = translations[currentLanguage] || {};
        const menu = elements.exerciseChooserMenu;
        if (!menu) return;
        const items = exerciseChooserItems();
        menu.innerHTML = '';
        const groups = [
            { id: 'builtin', label: t.builtinsGroup || 'Built-in' },
            { id: 'user', label: t.myExercises || 'My exercises' }
        ];
        groups.forEach(group => {
            const matches = items.filter(item => item.group === group.id);
            if (!matches.length) return;
            const heading = document.createElement('li');
            heading.className = 'exercise-menu-group';
            heading.setAttribute('role', 'presentation');
            heading.textContent = group.label;
            menu.appendChild(heading);
            matches.forEach(item => {
                const row = document.createElement('li');
                row.setAttribute('role', 'presentation');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'exercise-menu-item';
                button.setAttribute('role', 'option');
                button.dataset.protocolId = item.id;
                button.textContent = item.name;
                const selected = item.id === selectedProtocolId;
                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-selected', selected ? 'true' : 'false');
                button.tabIndex = selected ? 0 : -1;
                button.addEventListener('click', () => {
                    closeExerciseChooser(true);
                    if (item.id !== selectedProtocolId) loadProtocol(item.id);
                });
                button.addEventListener('keydown', event => {
                    if (moveExerciseChooserFocus(event)) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        button.click();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        closeExerciseChooser(true);
                    } else if (event.key === 'Tab') {
                        setExerciseChooserOpen(false);
                    }
                });
                row.appendChild(button);
                menu.appendChild(row);
            });
        });
    }

    function phaseTypeLabel(type) {
        const t = translations[currentLanguage] || {};
        return t[`${type}Type`] || type;
    }

    function iconButton(icon, label, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-icon';
        button.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
        button.setAttribute('aria-label', label);
        button.disabled = disabled;
        return button;
    }

    function labeledActionButton(icon, text, aria, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn block-action-btn';
        button.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${text}</span>`;
        button.setAttribute('aria-label', aria || text);
        button.title = aria || text;
        button.disabled = disabled;
        return button;
    }

    function stepTitle(index, label, t) {
        const title = document.createElement('div');
        title.className = 'block-card-title';
        const step = document.createElement('button');
        step.type = 'button';
        step.className = 'block-step-index';
        step.textContent = (t.stepLabel || 'Step {n}').replace('{n}', String(index + 1));
        const name = document.createElement('span');
        name.className = 'block-step-name';
        name.textContent = label;
        title.append(step, name);
        return title;
    }

    function collapsedSummaryFor(block, t) {
        if (block.type === 'retention') {
            return formatBlockSummary({
                kind: 'retention',
                duration: block.duration,
                increasePerRound: block.increasePerRound
            });
        }
        if (block.type === 'ref') {
            const nested = Model.resolveRef(block);
            const name = nested ? protocolDisplayName(nested) : block.protocolId;
            const nestedSummary = nested ? Model.summaryParts(nested) : null;
            const include = (t.includesExercise || 'Includes {name}').replace('{name}', name);
            if (nestedSummary?.kind === 'pattern') {
                return `${include} · ${nestedSummary.phases.join(' · ')} × ${nestedSummary.cycles}`;
            }
            return include;
        }
        const phases = Model.activePhases(block.phases).map(phase => phase.duration);
        return `${phases.join(' · ')} × ${block.cycles}`;
    }

    function applyCollapsedState(card, block, t) {
        const collapsed = collapsedBlockIds.has(block.id);
        card.classList.toggle('is-collapsed', collapsed);
        const toggle = card.querySelector('.block-step-index');
        if (toggle) {
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.setAttribute('aria-label', collapsed
                ? (t.expandStep || 'Expand step')
                : (t.collapseStep || 'Collapse step'));
        }
    }

    function wireCardCollapse(card, block, t, body) {
        body.classList.add('block-card-body');
        const summary = document.createElement('p');
        summary.className = 'block-collapsed-summary';
        summary.textContent = collapsedSummaryFor(block, t);
        const toggle = card.querySelector('.block-step-index');
        if (toggle) {
            const onToggle = (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (collapsedBlockIds.has(block.id)) collapsedBlockIds.delete(block.id);
                else collapsedBlockIds.add(block.id);
                applyCollapsedState(card, block, t);
            };
            toggle.addEventListener('click', onToggle);
        }
        card.append(summary, body);
        applyCollapsedState(card, block, t);
    }

    function renderLinkedPreview(nested, t) {
        const preview = document.createElement('div');
        preview.className = 'linked-preview';
        const caption = document.createElement('div');
        caption.className = 'linked-preview-label';
        caption.textContent = nested
            ? (t.insideExercise || 'Inside {name}').replace('{name}', protocolDisplayName(nested))
            : (t.previewReadOnly || 'Preview');
        preview.appendChild(caption);

        if (!nested) return preview;

        const summary = Model.summaryParts(nested);
        if (summary.kind === 'pattern') {
            const chips = document.createElement('div');
            chips.className = 'linked-preview-chips';
            const pattern = nested.blocks.find(item => item.type === 'pattern');
            (pattern?.phases || []).forEach(phase => {
                const chip = document.createElement('span');
                chip.className = `linked-chip phase-${phase.type}`;
                chip.textContent = `${phaseTypeLabel(phase.type)} ${phase.duration}s`;
                chips.appendChild(chip);
            });
            const cycles = document.createElement('span');
            cycles.className = 'linked-chip is-cycles';
            cycles.textContent = `× ${summary.cycles}`;
            chips.appendChild(cycles);
            preview.appendChild(chips);
            return preview;
        }

        const list = document.createElement('ul');
        list.className = 'linked-preview-list';
        (summary.blocks || []).forEach(item => {
            const row = document.createElement('li');
            row.textContent = formatBlockSummary(item);
            list.appendChild(row);
        });
        preview.appendChild(list);
        return preview;
    }

    function renderPhaseRows(block, list) {
        const t = translations[currentLanguage] || {};
        block.phases.forEach((phase, index) => {
            const row = document.createElement('div');
            row.className = `phase-row phase-${phase.type}`;

            const typeSelect = document.createElement('select');
            typeSelect.className = 'form-select shadow-sm custom-select';
            typeSelect.setAttribute('aria-label', t.phaseType || 'Phase type');
            Model.PHASE_TYPES.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = phaseTypeLabel(type);
                if (type === phase.type) option.selected = true;
                typeSelect.appendChild(option);
            });
            typeSelect.addEventListener('change', () => {
                markAsCustomIfBuiltin();
                Model.updatePhase(workingProtocol, block.id, phase.id, { type: typeSelect.value });
                afterProtocolEdit();
            });

            const durationInput = document.createElement('input');
            durationInput.type = 'number';
            durationInput.className = 'form-control shadow-sm custom-input';
            durationInput.min = '1';
            durationInput.max = '180';
            durationInput.value = phase.duration;
            durationInput.setAttribute('aria-label', `${phaseTypeLabel(phase.type)} (s)`);
            durationInput.addEventListener('input', () => {
                markAsCustomIfBuiltin();
                Model.updatePhase(workingProtocol, block.id, phase.id, { duration: durationInput.value });
                afterProtocolEdit(false);
            });
            durationInput.addEventListener('change', () => {
                const value = Number(durationInput.value);
                durationInput.value = Number.isFinite(value) ? Math.min(180, Math.max(1, value)) : 4;
                markAsCustomIfBuiltin();
                Model.updatePhase(workingProtocol, block.id, phase.id, { duration: durationInput.value });
                afterProtocolEdit();
            });

            const actions = document.createElement('div');
            actions.className = 'phase-row-actions';
            const upButton = iconButton('fa-solid fa-arrow-up', t.movePhaseUp || 'Move phase up', index === 0);
            upButton.addEventListener('click', () => {
                markAsCustomIfBuiltin();
                Model.movePhase(workingProtocol, block.id, phase.id, -1);
                afterProtocolEdit();
            });
            const downButton = iconButton('fa-solid fa-arrow-down', t.movePhaseDown || 'Move phase down', index === block.phases.length - 1);
            downButton.addEventListener('click', () => {
                markAsCustomIfBuiltin();
                Model.movePhase(workingProtocol, block.id, phase.id, 1);
                afterProtocolEdit();
            });
            const removeButton = iconButton('fa-solid fa-minus', t.removePhase || 'Remove phase', block.phases.length <= 1);
            removeButton.addEventListener('click', () => {
                markAsCustomIfBuiltin();
                Model.removePhase(workingProtocol, block.id, phase.id);
                afterProtocolEdit();
            });
            actions.append(upButton, downButton, removeButton);
            row.append(typeSelect, durationInput, actions);
            list.appendChild(row);
        });
    }

    function renderBlockActions(block, index, t) {
        const actions = document.createElement('div');
        actions.className = 'block-card-actions';
        const upButton = labeledActionButton(
            'fa-solid fa-arrow-up',
            t.moveUp || 'Up',
            t.moveUp || 'Move step up',
            index === 0
        );
        upButton.addEventListener('click', () => {
            markAsCustomIfBuiltin();
            Model.moveBlock(workingProtocol, block.id, -1);
            afterProtocolEdit();
        });
        const downButton = labeledActionButton(
            'fa-solid fa-arrow-down',
            t.moveDown || 'Down',
            t.moveDown || 'Move step down',
            index === workingProtocol.blocks.length - 1
        );
        downButton.addEventListener('click', () => {
            markAsCustomIfBuiltin();
            Model.moveBlock(workingProtocol, block.id, 1);
            afterProtocolEdit();
        });
        const removeButton = labeledActionButton(
            'fa-solid fa-trash',
            t.removeStep || 'Remove',
            t.removeStep || 'Remove step',
            workingProtocol.blocks.length <= 1
        );
        removeButton.addEventListener('click', () => {
            markAsCustomIfBuiltin();
            Model.removeBlock(workingProtocol, block.id);
            afterProtocolEdit();
        });
        actions.append(upButton, downButton, removeButton);
        return actions;
    }

    function renderPatternCard(block, index, t) {
        const card = document.createElement('div');
        card.className = 'block-card is-pattern';
        const header = document.createElement('div');
        header.className = 'block-card-header';
        const title = stepTitle(index, t.patternBlock || 'Pattern', t);
        header.append(title, renderBlockActions(block, index, t));
        card.appendChild(header);

        const body = document.createElement('div');
        const cyclesGroup = document.createElement('div');
        cyclesGroup.className = 'form-group mb-3';
        const cyclesLabel = document.createElement('label');
        cyclesLabel.className = 'form-label small';
        cyclesLabel.textContent = t.cycles || 'Cycles';
        const cyclesInput = document.createElement('input');
        cyclesInput.type = 'number';
        cyclesInput.className = 'form-control shadow-sm custom-input';
        cyclesInput.min = '1';
        cyclesInput.max = '100';
        cyclesInput.value = block.cycles;
        cyclesInput.setAttribute('aria-label', t.cycles || 'Cycles');
        cyclesInput.addEventListener('input', () => {
            markAsCustomIfBuiltin();
            Model.setPatternCycles(workingProtocol, block.id, cyclesInput.value);
            afterProtocolEdit(false);
        });
        cyclesInput.addEventListener('change', () => {
            const value = Number(cyclesInput.value);
            cyclesInput.value = Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : 1;
            markAsCustomIfBuiltin();
            Model.setPatternCycles(workingProtocol, block.id, cyclesInput.value);
            afterProtocolEdit();
        });
        cyclesGroup.append(cyclesLabel, cyclesInput);
        body.appendChild(cyclesGroup);

        const list = document.createElement('div');
        list.className = 'phase-list';
        renderPhaseRows(block, list);
        body.appendChild(list);

        const addPhase = document.createElement('button');
        addPhase.type = 'button';
        addPhase.className = 'btn guide-button w-100';
        addPhase.innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i> <span>${t.addPhase || 'Add phase'}</span>`;
        addPhase.disabled = block.phases.length >= Model.MAX_PHASES;
        addPhase.addEventListener('click', () => {
            markAsCustomIfBuiltin();
            Model.addPhase(workingProtocol, block.id);
            afterProtocolEdit();
        });
        body.appendChild(addPhase);
        wireCardCollapse(card, block, t, body);
        return card;
    }

    function renderRetentionCard(block, index, t) {
        const card = document.createElement('div');
        card.className = 'block-card is-retention';
        const header = document.createElement('div');
        header.className = 'block-card-header';
        const title = stepTitle(index, t.holdBlock || 'Hold', t);
        header.append(title, renderBlockActions(block, index, t));
        card.appendChild(header);

        const body = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'row g-3';
        row.innerHTML = `
            <div class="col-6">
                <label class="form-label small">${t.holdDuration || 'Hold (s)'}</label>
            </div>
            <div class="col-6">
                <label class="form-label small">${t.holdIncrease || 'Increase each round (s)'}</label>
            </div>
        `;
        const durationInput = document.createElement('input');
        durationInput.type = 'number';
        durationInput.className = 'form-control shadow-sm custom-input';
        durationInput.min = '0';
        durationInput.max = '180';
        durationInput.value = block.duration;
        durationInput.setAttribute('aria-label', t.holdDuration || 'Hold (s)');
        const increaseInput = document.createElement('input');
        increaseInput.type = 'number';
        increaseInput.className = 'form-control shadow-sm custom-input';
        increaseInput.min = '0';
        increaseInput.max = '60';
        increaseInput.value = block.increasePerRound;
        increaseInput.setAttribute('aria-label', t.holdIncrease || 'Increase each round (s)');

        const apply = (rerender) => {
            markAsCustomIfBuiltin();
            Model.setRetention(workingProtocol, block.id, {
                duration: durationInput.value,
                increasePerRound: increaseInput.value
            });
            afterProtocolEdit(rerender);
        };
        durationInput.addEventListener('input', () => apply(false));
        increaseInput.addEventListener('input', () => apply(false));
        durationInput.addEventListener('change', () => {
            durationInput.value = Math.min(180, Math.max(0, Number(durationInput.value) || 0));
            apply(true);
        });
        increaseInput.addEventListener('change', () => {
            increaseInput.value = Math.min(60, Math.max(0, Number(increaseInput.value) || 0));
            apply(true);
        });

        row.children[0].appendChild(durationInput);
        row.children[1].appendChild(increaseInput);
        body.appendChild(row);
        wireCardCollapse(card, block, t, body);
        return card;
    }

    function renderRefCard(block, index, t) {
        const nested = Model.resolveRef(block);
        const card = document.createElement('div');
        card.className = 'block-card is-ref';
        const header = document.createElement('div');
        header.className = 'block-card-header';
        const sourceName = nested
            ? ((nested.nameKey && t[nested.nameKey]) || nested.name)
            : block.protocolId;
        const title = stepTitle(index, (t.includesExercise || t.usesExercise || 'Includes {name}').replace('{name}', sourceName), t);
        const badge = document.createElement('span');
        badge.className = 'inherited-badge';
        badge.textContent = t.buildingBlock || t.linked || 'Building block';
        title.appendChild(badge);
        header.append(title, renderBlockActions(block, index, t));
        card.appendChild(header);

        const body = document.createElement('div');
        const hint = document.createElement('p');
        hint.className = 'linked-hint';
        hint.textContent = (t.linkedHint || '{name} is a separate exercise. This protocol includes it as this step.')
            .replace('{name}', sourceName);
        body.appendChild(hint);
        body.appendChild(renderLinkedPreview(nested, t));

        const detach = document.createElement('button');
        detach.type = 'button';
        detach.className = 'btn guide-button w-100';
        detach.textContent = t.makeLocalCopy || t.detach || 'Make a local copy';
        detach.addEventListener('click', () => {
            markAsCustomIfBuiltin();
            Model.detachRef(workingProtocol, block.id);
            afterProtocolEdit();
        });
        body.appendChild(detach);
        wireCardCollapse(card, block, t, body);
        return card;
    }

    function refreshLibrarySelect() {
        const t = translations[currentLanguage] || {};
        const select = elements.addLibraryBlockSelect;
        const items = Model.listInsertableProtocols(workingProtocol);
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t.fromLibrary || 'From library…';
        select.appendChild(placeholder);

        const groups = {
            piece: t.piecesGroup || 'Building blocks',
            builtin: t.builtinsGroup || 'Built-in',
            user: t.myExercises || 'My exercises'
        };
        Object.entries(groups).forEach(([group, label]) => {
            const matches = items.filter(item => item.group === group);
            if (!matches.length) return;
            const optgroup = document.createElement('optgroup');
            optgroup.label = label;
            matches.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = (item.nameKey && t[item.nameKey]) || item.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
        select.disabled = items.length === 0 || workingProtocol.blocks.length >= Model.MAX_BLOCKS;
    }

    function outlineLabelFor(block, t) {
        if (block.type === 'retention') return t.holdBlock || 'Hold';
        if (block.type === 'ref') {
            const nested = Model.resolveRef(block);
            return nested ? protocolDisplayName(nested) : block.protocolId;
        }
        return t.patternBlock || 'Pattern';
    }

    function renderProtocolOutline(t) {
        if (workingProtocol.blocks.length < 2 && !workingProtocol.blocks.some(block => block.type === 'ref')) {
            return null;
        }
        const wrap = document.createElement('div');
        wrap.className = 'protocol-outline';
        const label = document.createElement('div');
        label.className = 'protocol-outline-label';
        label.textContent = t.protocolOutline || 'This protocol runs, in order:';
        const list = document.createElement('ol');
        list.className = 'protocol-outline-list';
        workingProtocol.blocks.forEach(block => {
            const item = document.createElement('li');
            item.textContent = outlineLabelFor(block, t);
            if (block.type === 'ref') {
                const mark = document.createElement('span');
                mark.className = 'outline-linked';
                mark.textContent = t.buildingBlock || 'Building block';
                item.appendChild(mark);
            }
            list.appendChild(item);
        });
        wrap.append(label, list);
        return wrap;
    }

    function renderProtocolEditor() {
        const t = translations[currentLanguage] || {};
        elements.blockList.innerHTML = '';
        elements.protocolRoundsInput.value = workingProtocol.rounds;
        const outline = renderProtocolOutline(t);
        if (outline) elements.blockList.appendChild(outline);
        workingProtocol.blocks.forEach((block, index) => {
            if (index > 0) {
                const then = document.createElement('div');
                then.className = 'block-then';
                then.textContent = t.then || 'Then';
                elements.blockList.appendChild(then);
            }
            if (block.type === 'retention') {
                elements.blockList.appendChild(renderRetentionCard(block, index, t));
            } else if (block.type === 'ref') {
                elements.blockList.appendChild(renderRefCard(block, index, t));
            } else {
                elements.blockList.appendChild(renderPatternCard(block, index, t));
            }
        });

        const atLimit = workingProtocol.blocks.length >= Model.MAX_BLOCKS;
        elements.addPatternBlockButton.disabled = atLimit;
        elements.addRetentionBlockButton.disabled = atLimit;
        refreshLibrarySelect();

        const isUserExercise = !workingProtocol.builtin && !Model.PRESET_IDS.includes(selectedProtocolId);
        elements.deleteExerciseButton.classList.toggle('d-none', !isUserExercise);
        if (!isUserExercise && Model.PRESET_IDS.includes(selectedProtocolId)) {
            elements.exerciseNameInput.value = '';
        } else if (isUserExercise) {
            elements.exerciseNameInput.value = workingProtocol.name;
        }
    }

    function markAsCustomIfBuiltin() {
        if (selectedProtocolId !== 'custom' && Model.PRESET_IDS.includes(selectedProtocolId)) {
            selectedProtocolId = 'custom';
            workingProtocol.id = 'custom';
            workingProtocol.nameKey = 'custom';
            workingProtocol.name = translations[currentLanguage]?.custom || 'Custom';
            workingProtocol.builtin = true;
            workingProtocol.piece = false;
            elements.presetSelect.value = 'custom';
        }
    }

    function afterProtocolEdit(rerender = true) {
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete');
        if (rerender) renderProtocolEditor();
        syncPracticeSummary();
        updateTotalTime();
        updateRemainingCycles();
        savePreferences();
        if (!isRunning) drawFrame(null, 0, performance.now());
    }

    function translatePage() {
        document.documentElement.lang = currentLanguage;
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            const translation = translations[currentLanguage]?.[key];
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else if (key !== 'totalTime' && key !== 'remainingCycles') {
                    element.textContent = translation;
                }
            }
        });
        document.querySelectorAll('[data-lang-aria]').forEach(element => {
            const translation = translations[currentLanguage]?.[element.dataset.langAria];
            if (translation) element.setAttribute('aria-label', translation);
        });
        document.querySelectorAll('[data-lang-title]').forEach(element => {
            const translation = translations[currentLanguage]?.[element.dataset.langTitle];
            if (translation) element.title = translation;
        });

        refreshPresetSelect();
        const description = presetDescriptions[currentLanguage]?.[selectedProtocolId]
            || (workingProtocol.builtin ? '' : workingProtocol.name);
        document.getElementById('preset-description').textContent = description;
        renderProtocolEditor();
        syncPracticeSummary();
        updateTotalTime();
        updateRemainingCycles();
        if (sessionCompleted) {
            setGuidedPrompt(translations[currentLanguage]?.complete || 'Session complete', true);
        } else if (!isRunning) {
            resetDisplay();
        }
    }

    function announceStatus(message) {
        if (!elements.appStatus || !message) return;
        elements.appStatus.textContent = '';
        window.requestAnimationFrame(() => { elements.appStatus.textContent = message; });
    }

    function savePreferences() {
        const preferences = {
            protocolId: selectedProtocolId,
            protocol: workingProtocol,
            volume: elements.volumeControl.value,
            darkMode: document.body.classList.contains('dark-mode'),
            language: currentLanguage,
            primaryColor,
            customAccentColor
        };
        const saved = Storage.writeJSON('breathingTimerPreferences', preferences);
        if (!saved) announceStatus(translations[currentLanguage]?.storageError);
        return saved;
    }

    function setStoredNumber(input, value) {
        if (value === undefined || value === null || value === '') return;
        const parsed = Number(value);
        const min = Number(input.min);
        const max = Number(input.max);
        if (!Number.isFinite(parsed)) return;
        input.value = Math.min(max, Math.max(min, parsed));
    }

    function syncPresetUi() {
        renderProtocolEditor();
        syncPracticeSummary();
    }

    function loadProtocol(id) {
        selectedProtocolId = id;
        workingProtocol = Model.findProtocol(id);
        elements.presetSelect.value = id;
        sessionCompleted = false;
        elements.visualizerWrapper.classList.remove('session-complete');
        syncPresetUi();
        translatePage();
        savePreferences();
        if (!isRunning) drawFrame(null, 0, performance.now());
    }

    function loadPreferences() {
        const preferences = Storage.readJSON('breathingTimerPreferences', null);

        if (preferences) {
            setStoredNumber(elements.volumeControl, preferences.volume);
            if (typeof preferences.darkMode === 'boolean') {
                if (preferences.darkMode) {
                    document.body.classList.add('dark-mode');
                    elements.toggleModeButton.checked = true;
                } else {
                    document.body.classList.remove('dark-mode');
                    elements.toggleModeButton.checked = false;
                }
            }
            if (translations[preferences.language]) {
                currentLanguage = preferences.language;
                elements.languageToggle.textContent = currentLanguage.toUpperCase();
            }
            if (/^#[0-9a-f]{6}$/i.test(preferences.primaryColor || '')) {
                primaryColor = preferences.primaryColor;
            }
            if (/^#[0-9a-f]{6}$/i.test(preferences.customAccentColor || '')) {
                customAccentColor = preferences.customAccentColor;
            } else if (!PRESET_SWATCH_COLORS.has(primaryColor.toLowerCase())) {
                customAccentColor = primaryColor;
            }

            workingProtocol = Model.migrateLegacyPreferences(preferences);
            selectedProtocolId = Model.canonicalId(
                preferences.protocolId
                || preferences.preset
                || workingProtocol.id
                || 'custom'
            );
            if (!Model.PRESET_IDS.includes(selectedProtocolId)
                && !Model.loadUserLibrary().some(item => item.id === selectedProtocolId)) {
                selectedProtocolId = workingProtocol.builtin ? workingProtocol.id : selectedProtocolId;
            }
        }

        applyPrimaryColor(primaryColor);
        if (elements.primaryColorInput) {
            elements.primaryColorInput.value = customAccentColor;
        }
        refreshPresetSelect();
        elements.presetSelect.value = [...elements.presetSelect.options].some(option => option.value === selectedProtocolId)
            ? selectedProtocolId
            : 'custom';
        syncPresetUi();
        translatePage();
    }

    // Event Listeners
    elements.startButton.addEventListener('click', start);
    elements.stopButton.addEventListener('click', stop);
    elements.pauseButton.addEventListener('click', () => {
        toggleSessionPause();
    });

    document.addEventListener('click', (event) => {
        if (!isRunning) return;
        const target = event.target;
        if (target instanceof Element && target.closest('button, a, input, select, textarea, label, .offcanvas, .modal, .practice-chooser')) {
            return;
        }
        toggleSessionPause();
    });

    elements.volumeControl.addEventListener('input', (event) => {
        event.target.style.setProperty('--range-progress', `${event.target.value * 100}%`);
        savePreferences();
    });

    elements.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            applyPrimaryColor(swatch.dataset.color);
            savePreferences();
        });
    });

    const applyPickedColor = (event) => {
        const nextColor = normalizeHex(event.target.value);
        if (!nextColor) return;
        customAccentColor = nextColor;
        applyPrimaryColor(customAccentColor);
        savePreferences();
    };
    elements.primaryColorInput.addEventListener('input', applyPickedColor);
    elements.primaryColorInput.addEventListener('change', applyPickedColor);
    elements.applyCustomColorButton?.addEventListener('click', () => {
        applyPrimaryColor(customAccentColor);
        savePreferences();
    });

    elements.presetSelect.addEventListener('change', (event) => {
        loadProtocol(event.target.value);
    });

    elements.addPatternBlockButton.addEventListener('click', () => {
        markAsCustomIfBuiltin();
        Model.addBlock(workingProtocol, {
            type: 'pattern',
            cycles: 4,
            phases: [
                { type: 'inhale', duration: 4 },
                { type: 'exhale', duration: 4 }
            ]
        });
        afterProtocolEdit();
    });

    elements.addRetentionBlockButton.addEventListener('click', () => {
        markAsCustomIfBuiltin();
        Model.addBlock(workingProtocol, { type: 'retention', duration: 20, increasePerRound: 0 });
        afterProtocolEdit();
    });

    elements.addLibraryBlockSelect.addEventListener('change', (event) => {
        const id = event.target.value;
        if (!id) return;
        markAsCustomIfBuiltin();
        Model.addRefBlock(workingProtocol, id);
        event.target.value = '';
        afterProtocolEdit();
    });

    elements.saveExerciseButton.addEventListener('click', () => {
        const name = elements.exerciseNameInput.value.trim()
            || protocolDisplayName(workingProtocol);
        workingProtocol.name = name;
        workingProtocol.builtin = false;
        workingProtocol.nameKey = '';
        const saved = Model.saveUserProtocol(workingProtocol);
        if (!saved) {
            announceStatus(translations[currentLanguage]?.storageError);
            return;
        }
        workingProtocol = Model.cloneProtocol(saved);
        selectedProtocolId = saved.id;
        refreshPresetSelect();
        elements.presetSelect.value = saved.id;
        syncPresetUi();
        document.getElementById('preset-description').textContent = saved.name;
        savePreferences();
        const saveLabel = elements.saveExerciseButton.querySelector('[data-lang-key="saveExercise"]') || elements.saveExerciseButton;
        saveLabel.textContent = translations[currentLanguage]?.saved || 'Saved';
        window.setTimeout(() => {
            saveLabel.textContent = translations[currentLanguage]?.saveExercise || 'Save';
        }, 1200);
    });

    elements.deleteExerciseButton.addEventListener('click', () => {
        if (Model.PRESET_IDS.includes(selectedProtocolId)) return;
        if (!Model.deleteUserProtocol(selectedProtocolId)) {
            announceStatus(translations[currentLanguage]?.storageError);
            return;
        }
        loadProtocol('custom');
    });

    elements.toggleModeButton.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        applyPrimaryColor(primaryColor);
        savePreferences();
    });

    elements.languageToggle.addEventListener('click', () => {
        const languages = Object.keys(translations);
        const currentIndex = languages.indexOf(currentLanguage);
        currentLanguage = languages[(currentIndex + 1) % languages.length];
        elements.languageToggle.textContent = currentLanguage.toUpperCase();
        document.documentElement.lang = currentLanguage;
        translatePage();
        savePreferences();
    });

    elements.protocolRoundsInput.addEventListener('input', () => {
        Model.setProtocolRounds(workingProtocol, elements.protocolRoundsInput.value);
        afterProtocolEdit(false);
    });
    elements.protocolRoundsInput.addEventListener('change', () => {
        const value = parseInt(elements.protocolRoundsInput.value, 10);
        const min = parseInt(elements.protocolRoundsInput.min, 10);
        const max = parseInt(elements.protocolRoundsInput.max, 10);
        if (isNaN(value) || value < min) elements.protocolRoundsInput.value = min;
        else if (value > max) elements.protocolRoundsInput.value = max;
        Model.setProtocolRounds(workingProtocol, elements.protocolRoundsInput.value);
        afterProtocolEdit();
    });

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && (
            target.isContentEditable ||
            ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)
        )) return;

        if (event.code === 'Space') {
            event.preventDefault();
            if (isRunning) stop(); else start();
        } else if (event.code === 'KeyP') {
            event.preventDefault();
            if (isRunning) isPaused ? resume() : pause();
        }
    });

    document.addEventListener('visibilitychange', () => {
        updateTimerExecutionMode();
    });

    window.addEventListener('resize', () => {
        resizeCanvas();
        if(!isRunning) drawFrame(null, 0, performance.now());
    });

    function initialize() {
        elements.appVersions.forEach(element => {
            element.textContent = `v${App.version}`;
            element.setAttribute('aria-label', `App version ${App.version}`);
        });
        loadPreferences();
        syncPresetUi();
        translatePage();

        elements.startButton.classList.remove('d-none');
        elements.stopButton.classList.add('d-none');
        elements.pauseButton.classList.add('d-none');

        elements.volumeControl.style.setProperty('--range-progress', `${elements.volumeControl.value * 100}%`);
        
        resizeCanvas();
        if ('ResizeObserver' in window) {
            visualizerResizeObserver = new ResizeObserver(() => {
                resizeCanvas();
                if (!isRunning) drawFrame(null, 0, performance.now());
            });
            visualizerResizeObserver.observe(elements.visualizerWrapper);
        }
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    if (elements.exerciseChooserButton) {
        elements.exerciseChooserButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = elements.exerciseChooserButton.getAttribute('aria-expanded') === 'true';
            setExerciseChooserOpen(!open);
            if (!open) {
                const options = exerciseChooserOptions();
                const selectedIndex = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
                focusExerciseOption(selectedIndex >= 0 ? selectedIndex : 0);
            }
        });
        elements.exerciseChooserButton.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            setExerciseChooserOpen(true);
            const options = exerciseChooserOptions();
            const selectedIndex = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
            const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
            focusExerciseOption(UiUtils.chooserIndex(baseIndex, options.length, event.key));
        });
        document.addEventListener('click', (event) => {
            const chooser = elements.exerciseChooserButton.closest('.practice-chooser');
            if (chooser && event.target instanceof Element && chooser.contains(event.target)) return;
            setExerciseChooserOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && elements.exerciseChooserButton.getAttribute('aria-expanded') === 'true') {
                closeExerciseChooser(true);
            }
        });
    }

    ['appearanceOffcanvas', 'breathingOffcanvas'].forEach(id => {
        const panel = document.getElementById(id);
        if (!panel) return;
        panel.addEventListener('show.bs.offcanvas', () => {
            panel.classList.add('is-sliding-in');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    panel.classList.remove('is-sliding-in');
                });
            });
        });
    });

    initialize();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
