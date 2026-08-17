/** Preset select and home exercise listbox. */
(function (global) {
    /**
     * Creates the exercise chooser used on Home and in the Protocols sheet.
     * Selection still flows through the controller's loadProtocol callback so
     * session state and persistence stay in one place.
     *
     * @param {object} options - model, elements, selection accessors, and load callback
     * @returns {{refreshPresetSelect: Function, refreshExerciseChooser: Function, setExerciseChooserOpen: Function, closeExerciseChooser: Function, bind: Function}}
     */
    function createExerciseChooser(options = {}) {
        const Model = options.Model || global.BreathingModel;
        const UiUtils = options.UiUtils || global.BreathingUiUtils;
        const elements = options.elements || {};
        const getSelectedProtocolId = options.getSelectedProtocolId || (() => 'custom');
        const setSelectedProtocolId = options.setSelectedProtocolId || (() => {});
        const getTranslations = options.getTranslations || (() => ({}));
        const homeExerciseName = options.homeExerciseName || (protocol => protocol?.name || '');
        const loadProtocol = options.loadProtocol || (() => {});

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
            if (!elements.exerciseChooserMenu) return [];
            return [...elements.exerciseChooserMenu.querySelectorAll('.exercise-menu-item')];
        }

        function focusExerciseOption(index) {
            const optionsList = exerciseChooserOptions();
            if (!optionsList.length) return;
            const target = optionsList[Math.max(0, Math.min(index, optionsList.length - 1))];
            optionsList.forEach(option => { option.tabIndex = option === target ? 0 : -1; });
            target.focus();
        }

        function closeExerciseChooser(restoreFocus = false) {
            setExerciseChooserOpen(false);
            if (restoreFocus) elements.exerciseChooserButton?.focus();
        }

        function moveExerciseChooserFocus(event) {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
            event.preventDefault();
            const optionsList = exerciseChooserOptions();
            const currentIndex = optionsList.indexOf(document.activeElement);
            focusExerciseOption(UiUtils.chooserIndex(currentIndex, optionsList.length, event.key));
            return true;
        }

        function refreshExerciseChooser() {
            const t = getTranslations();
            const menu = elements.exerciseChooserMenu;
            if (!menu) return;
            const items = exerciseChooserItems();
            const selectedProtocolId = getSelectedProtocolId();
            menu.replaceChildren();
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
                        if (item.id !== getSelectedProtocolId()) loadProtocol(item.id);
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

        function refreshPresetSelect() {
            const t = getTranslations();
            const library = Model.loadUserLibrary();
            const currentValue = getSelectedProtocolId();
            if (!elements.presetSelect) return;
            elements.presetSelect.replaceChildren();

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
                setSelectedProtocolId('custom');
            }
            refreshExerciseChooser();
        }

        function bind() {
            if (!elements.exerciseChooserButton) return;
            elements.exerciseChooserButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const open = elements.exerciseChooserButton.getAttribute('aria-expanded') === 'true';
                setExerciseChooserOpen(!open);
                if (!open) {
                    const optionsList = exerciseChooserOptions();
                    const selectedIndex = optionsList.findIndex(option => option.getAttribute('aria-selected') === 'true');
                    focusExerciseOption(selectedIndex >= 0 ? selectedIndex : 0);
                }
            });
            elements.exerciseChooserButton.addEventListener('keydown', event => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                setExerciseChooserOpen(true);
                const optionsList = exerciseChooserOptions();
                const selectedIndex = optionsList.findIndex(option => option.getAttribute('aria-selected') === 'true');
                const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
                focusExerciseOption(UiUtils.chooserIndex(baseIndex, optionsList.length, event.key));
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

        return {
            refreshPresetSelect,
            refreshExerciseChooser,
            setExerciseChooserOpen,
            closeExerciseChooser,
            bind
        };
    }

    global.BreathingExerciseChooser = { createExerciseChooser };
})(typeof window !== 'undefined' ? window : globalThis);
