/** Protocol block-card rendering for the Protocols sheet. */
(function (global) {
    /**
     * Creates the protocol editor renderer.
     * Mutation of the working protocol stays in the model; this factory only
     * builds DOM and calls back into the controller after each edit so timer
     * cache invalidation and persistence remain centralized.
     *
     * @param {object} options - model, elements, protocol getters, and edit callbacks
     * @returns {{render: Function, refreshLibrarySelect: Function}}
     */
    function createProtocolEditor(options = {}) {
        const Model = options.Model || global.BreathingModel;
        const elements = options.elements || {};
        const getWorkingProtocol = options.getWorkingProtocol || (() => null);
        const getSelectedProtocolId = options.getSelectedProtocolId || (() => 'custom');
        const getTranslations = options.getTranslations || (() => ({}));
        const protocolDisplayName = options.protocolDisplayName || (protocol => protocol?.name || '');
        const formatBlockSummary = options.formatBlockSummary || (() => '');
        const markAsCustomIfBuiltin = options.markAsCustomIfBuiltin || (() => {});
        const afterProtocolEdit = options.afterProtocolEdit || (() => {});
        const collapsedBlockIds = new Set();

        function phaseTypeLabel(type) {
            const t = getTranslations();
            return t[`${type}Type`] || type;
        }

        function iconButton(icon, label, disabled = false) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-icon';
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            iconEl.setAttribute('aria-hidden', 'true');
            button.appendChild(iconEl);
            button.setAttribute('aria-label', label);
            button.title = label;
            button.disabled = disabled;
            return button;
        }

        function labeledActionButton(icon, text, aria, disabled = false) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn block-action-btn';
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            iconEl.setAttribute('aria-hidden', 'true');
            const textEl = document.createElement('span');
            textEl.textContent = text;
            button.append(iconEl, textEl);
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
            const t = getTranslations();
            const workingProtocol = getWorkingProtocol();
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
            const workingProtocol = getWorkingProtocol();
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
            const workingProtocol = getWorkingProtocol();
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
            const iconEl = document.createElement('i');
            iconEl.className = 'fa-solid fa-plus';
            iconEl.setAttribute('aria-hidden', 'true');
            const textEl = document.createElement('span');
            textEl.textContent = t.addPhase || 'Add phase';
            addPhase.append(iconEl, new Text(' '), textEl);
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
            const workingProtocol = getWorkingProtocol();
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

            const col1 = document.createElement('div');
            col1.className = 'col-6';
            const label1 = document.createElement('label');
            label1.className = 'form-label small';
            label1.textContent = t.holdDuration || 'Hold (s)';
            col1.appendChild(label1);

            const col2 = document.createElement('div');
            col2.className = 'col-6';
            const label2 = document.createElement('label');
            label2.className = 'form-label small';
            label2.textContent = t.holdIncrease || 'Increase each round (s)';
            col2.appendChild(label2);

            row.append(col1, col2);

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
                Model.detachRef(getWorkingProtocol(), block.id);
                afterProtocolEdit();
            });
            body.appendChild(detach);
            wireCardCollapse(card, block, t, body);
            return card;
        }

        function refreshLibrarySelect() {
            const t = getTranslations();
            const workingProtocol = getWorkingProtocol();
            const select = elements.addLibraryBlockSelect;
            if (!select) return;
            const items = Model.listInsertableProtocols(workingProtocol);
            select.replaceChildren();
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
            const workingProtocol = getWorkingProtocol();
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

        function render() {
            const t = getTranslations();
            const workingProtocol = getWorkingProtocol();
            const selectedProtocolId = getSelectedProtocolId();
            if (!elements.blockList) return;
            elements.blockList.replaceChildren();
            if (elements.protocolRoundsInput) {
                elements.protocolRoundsInput.value = workingProtocol.rounds;
            }
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
            if (elements.addPatternBlockButton) elements.addPatternBlockButton.disabled = atLimit;
            if (elements.addRetentionBlockButton) elements.addRetentionBlockButton.disabled = atLimit;
            refreshLibrarySelect();

            const isUserExercise = !workingProtocol.builtin && !Model.PRESET_IDS.includes(selectedProtocolId);
            elements.deleteExerciseButton?.classList.toggle('d-none', !isUserExercise);
            if (!isUserExercise && Model.PRESET_IDS.includes(selectedProtocolId)) {
                if (elements.exerciseNameInput) elements.exerciseNameInput.value = '';
            } else if (isUserExercise && elements.exerciseNameInput) {
                elements.exerciseNameInput.value = workingProtocol.name;
            }
        }

        return { render, refreshLibrarySelect };
    }

    global.BreathingProtocolEditor = { createProtocolEditor };
})(typeof window !== 'undefined' ? window : globalThis);
