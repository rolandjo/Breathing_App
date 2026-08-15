/**
 * Session model for the breathing app.
 *
 * Protocol → rounds of blocks
 * Block    → pattern | retention | ref (inherited protocol)
 * Phase    → inhale | hold | exhale | rest
 */
(function (global) {
    const Storage = global.BreathingStorage;
    const PHASE_TYPES = ['inhale', 'hold', 'exhale', 'rest'];
    const PHASE_META = {
        inhale: { textKey: 'breatheIn', colorKey: 'inhale' },
        hold: { textKey: 'holdBreath', colorKey: 'hold' },
        exhale: { textKey: 'breatheOut', colorKey: 'exhale' },
        rest: { textKey: 'holdBreath', colorKey: 'idle' }
    };
    const MAX_PHASES = 8;
    const MAX_BLOCKS = 8;
    const MAX_NESTING = 3;
    const LIBRARY_KEY = 'breathingTimerLibrary';
    const PRESET_IDS = ['custom', 'box', 'relaxing', 'equal', 'power_rounds'];
    const PIECE_IDS = ['power_breaths', 'recovery_breath'];
    const ID_ALIASES = {
        wim_hof: 'power_rounds',
        whm_recovery: 'recovery_breath'
    };
    const BUILTIN_IDS = PRESET_IDS.concat(PIECE_IDS);

    function uid(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function clamp(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, number));
    }

    function createPhase(input = {}) {
        const type = PHASE_TYPES.includes(input.type) ? input.type : 'inhale';
        const meta = PHASE_META[type];
        return {
            id: input.id || uid('phase'),
            type,
            duration: clamp(input.duration ?? 4, 0, 180),
            label: typeof input.label === 'string' ? input.label : '',
            textKey: input.textKey || meta.textKey,
            colorKey: input.colorKey || meta.colorKey
        };
    }

    function snapshotProtocol(protocol) {
        if (!protocol) return null;
        const clone = JSON.parse(JSON.stringify(protocol));
        clone.builtin = false;
        return clone;
    }

    function createBlock(input = {}) {
        if (input.type === 'retention') {
            return {
                id: input.id || uid('block'),
                type: 'retention',
                duration: clamp(input.duration ?? 20, 0, 180),
                increasePerRound: clamp(input.increasePerRound ?? 0, 0, 60)
            };
        }

        if (input.type === 'ref') {
            return {
                id: input.id || uid('block'),
                type: 'ref',
                protocolId: canonicalId(input.protocolId || ''),
                snapshot: input.snapshot ? snapshotProtocol(input.snapshot) : null
            };
        }

        const phases = Array.isArray(input.phases) && input.phases.length
            ? input.phases.map(createPhase)
            : [
                createPhase({ type: 'inhale', duration: 4 }),
                createPhase({ type: 'hold', duration: 4 }),
                createPhase({ type: 'exhale', duration: 4 }),
                createPhase({ type: 'hold', duration: 4 })
            ];

        return {
            id: input.id || uid('block'),
            type: 'pattern',
            cycles: clamp(input.cycles ?? 3, 1, 100),
            phases
        };
    }

    function createProtocol(input = {}) {
        const blocks = Array.isArray(input.blocks) && input.blocks.length
            ? input.blocks.map(createBlock)
            : [createBlock()];

        return {
            id: canonicalId(input.id || uid('protocol')),
            name: input.name || 'Custom',
            nameKey: input.nameKey ? canonicalId(input.nameKey) : '',
            builtin: Boolean(input.builtin),
            piece: Boolean(input.piece),
            rounds: clamp(input.rounds ?? 1, 1, 20),
            blocks: blocks.slice(0, MAX_BLOCKS)
        };
    }

    function cloneProtocol(protocol) {
        return createProtocol(JSON.parse(JSON.stringify(protocol)));
    }

    function findBlock(protocol, blockId) {
        return protocol.blocks.find(block => block.id === blockId) || null;
    }

    function firstPatternBlock(protocol) {
        for (const block of protocol.blocks) {
            if (block.type === 'pattern') return block;
            if (block.type === 'ref') {
                const nested = resolveRef(block);
                const inner = nested ? firstPatternBlock(nested) : null;
                if (inner) return inner;
            }
        }
        return null;
    }

    function firstRetentionBlock(protocol) {
        return protocol.blocks.find(block => block.type === 'retention') || null;
    }

    function hasRetention(protocol, depth = 0) {
        if (!protocol || depth > MAX_NESTING) return false;
        return protocol.blocks.some(block => {
            if (block.type === 'retention') return true;
            if (block.type === 'ref') {
                const nested = resolveRef(block);
                return nested ? hasRetention(nested, depth + 1) : false;
            }
            return false;
        });
    }

    function activePhases(phases = []) {
        return phases.filter(phase => Number(phase.duration) > 0);
    }

    function durationOf(phases = [], startIndex = 0) {
        return phases.slice(startIndex).reduce((sum, phase) => sum + (Number(phase.duration) || 0), 0);
    }

    function canonicalId(id) {
        return ID_ALIASES[id] || id;
    }

    function lookupProtocol(id) {
        const resolved = canonicalId(id);
        if (builtins[resolved]) return cloneProtocol(builtins[resolved]);
        const match = loadUserLibrary().find(item => item.id === resolved || item.id === id);
        return match ? cloneProtocol(match) : null;
    }

    function resolveRef(block) {
        if (!block || block.type !== 'ref') return null;
        const live = lookupProtocol(block.protocolId);
        if (live) return live;
        if (block.snapshot) return cloneProtocol(block.snapshot);
        return null;
    }

    function collectRefIds(protocol, acc = new Set(), depth = 0, visiting = new Set()) {
        if (!protocol || depth > MAX_NESTING) return acc;
        if (visiting.has(protocol.id)) return acc;
        visiting.add(protocol.id);
        for (const block of protocol.blocks) {
            if (block.type !== 'ref' || !block.protocolId) continue;
            acc.add(block.protocolId);
            const nested = resolveRef(block);
            if (nested) collectRefIds(nested, acc, depth + 1, visiting);
        }
        visiting.delete(protocol.id);
        return acc;
    }

    function canAddRef(parent, sourceId) {
        if (!parent || !sourceId) return false;
        if (parent.blocks.length >= MAX_BLOCKS) return false;
        if (sourceId === parent.id) return false;
        const source = lookupProtocol(sourceId);
        if (!source) return false;
        if (collectRefIds(source).has(parent.id)) return false;
        return true;
    }

    function blockDuration(block, roundIndex = 0, depth = 0, visiting = new Set()) {
        if (!block || depth > MAX_NESTING) return 0;
        if (block.type === 'retention') {
            return (Number(block.duration) || 0) + roundIndex * (Number(block.increasePerRound) || 0);
        }
        if (block.type === 'pattern') {
            return durationOf(block.phases) * (Number(block.cycles) || 0);
        }
        if (block.type === 'ref') {
            const nested = resolveRef(block);
            return nested ? protocolDuration(nested, depth + 1, visiting) : 0;
        }
        return 0;
    }

    function protocolDuration(protocol, depth = 0, visiting = new Set()) {
        if (!protocol || depth > MAX_NESTING) return 0;
        if (visiting.has(protocol.id)) return 0;
        const nextVisiting = new Set(visiting);
        nextVisiting.add(protocol.id);
        let total = 0;
        for (let round = 0; round < protocol.rounds; round++) {
            for (const block of protocol.blocks) {
                total += blockDuration(block, round, depth, nextVisiting);
            }
        }
        return total;
    }

    function createRefBlock(protocolId) {
        const source = lookupProtocol(protocolId);
        return createBlock({
            type: 'ref',
            protocolId,
            snapshot: source ? snapshotProtocol(source) : null
        });
    }

    const builtins = {
        custom: createProtocol({
            id: 'custom',
            name: 'Custom',
            nameKey: 'custom',
            builtin: true,
            blocks: [createBlock({
                cycles: 3,
                phases: [
                    { type: 'inhale', duration: 4 },
                    { type: 'hold', duration: 4 },
                    { type: 'exhale', duration: 4 },
                    { type: 'hold', duration: 4 }
                ]
            })]
        }),
        box: createProtocol({
            id: 'box',
            name: 'Box Breathing (4-4-4-4)',
            nameKey: 'box',
            builtin: true,
            blocks: [createBlock({
                cycles: 3,
                phases: [
                    { type: 'inhale', duration: 4 },
                    { type: 'hold', duration: 4 },
                    { type: 'exhale', duration: 4 },
                    { type: 'hold', duration: 4 }
                ]
            })]
        }),
        relaxing: createProtocol({
            id: 'relaxing',
            name: 'Relaxing Breath (4-7-8)',
            nameKey: 'relaxing',
            builtin: true,
            blocks: [createBlock({
                cycles: 3,
                phases: [
                    { type: 'inhale', duration: 4 },
                    { type: 'hold', duration: 7 },
                    { type: 'exhale', duration: 8 }
                ]
            })]
        }),
        equal: createProtocol({
            id: 'equal',
            name: 'Equal Breathing (4-4)',
            nameKey: 'equal',
            builtin: true,
            blocks: [createBlock({
                cycles: 3,
                phases: [
                    { type: 'inhale', duration: 4 },
                    { type: 'exhale', duration: 4 }
                ]
            })]
        }),
        power_breaths: createProtocol({
            id: 'power_breaths',
            name: 'Power breaths',
            nameKey: 'power_breaths',
            builtin: true,
            piece: true,
            blocks: [createBlock({
                cycles: 35,
                phases: [
                    { type: 'inhale', duration: 2 },
                    { type: 'exhale', duration: 2 }
                ]
            })]
        }),
        recovery_breath: createProtocol({
            id: 'recovery_breath',
            name: 'Recovery breath',
            nameKey: 'recovery_breath',
            builtin: true,
            piece: true,
            blocks: [createBlock({
                cycles: 1,
                phases: [
                    { type: 'inhale', duration: 3 },
                    { type: 'hold', duration: 15 },
                    { type: 'exhale', duration: 4 }
                ]
            })]
        }),
        power_rounds: null
    };

    builtins.power_rounds = createProtocol({
        id: 'power_rounds',
        name: 'Power rounds',
        nameKey: 'power_rounds',
        builtin: true,
        rounds: 6,
        blocks: [
            createRefBlock('power_breaths'),
            createBlock({
                type: 'retention',
                duration: 20,
                increasePerRound: 10
            }),
            createRefBlock('recovery_breath')
        ]
    });

    function getBuiltin(id) {
        return builtins[id] ? cloneProtocol(builtins[id]) : cloneProtocol(builtins.custom);
    }

    function isValidStoredProtocol(item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        if (typeof item.id !== 'string' || !item.id.trim()) return false;
        if (typeof item.name !== 'string' || !item.name.trim()) return false;
        if (!Array.isArray(item.blocks) || !item.blocks.length) return false;
        return item.blocks.every(block => {
            if (!block || typeof block !== 'object') return false;
            if (block.type === 'retention') return true;
            if (block.type === 'ref') return typeof block.protocolId === 'string' && Boolean(block.protocolId);
            return (block.type === 'pattern' || block.type === undefined)
                && Array.isArray(block.phases)
                && block.phases.length > 0;
        });
    }

    function loadUserLibrary() {
        const stored = Storage?.readJSON(LIBRARY_KEY, []);
        if (!Array.isArray(stored)) return [];
        return stored
            .filter(isValidStoredProtocol)
            .map(item => createProtocol({ ...item, builtin: false, piece: false }));
    }

    function saveUserLibrary(library) {
        return Boolean(Storage?.writeJSON(LIBRARY_KEY, library));
    }

    function saveUserProtocol(protocol) {
        const library = loadUserLibrary().filter(item => item.id !== protocol.id);
        const saved = createProtocol({
            ...protocol,
            id: protocol.builtin || BUILTIN_IDS.includes(protocol.id) ? uid('protocol') : protocol.id,
            builtin: false,
            piece: false,
            nameKey: ''
        });
        library.push(saved);
        return saveUserLibrary(library) ? saved : null;
    }

    function deleteUserProtocol(id) {
        return saveUserLibrary(loadUserLibrary().filter(item => item.id !== id));
    }

    function findProtocol(id) {
        return lookupProtocol(id) || getBuiltin('custom');
    }

    function listInsertableProtocols(parent) {
        const items = [];
        PIECE_IDS.forEach(id => {
            if (canAddRef(parent, id)) items.push({ id, group: 'piece', nameKey: id, name: builtins[id].name });
        });
        PRESET_IDS.forEach(id => {
            if (id === 'custom') return;
            if (canAddRef(parent, id)) items.push({ id, group: 'builtin', nameKey: id, name: builtins[id].name });
        });
        loadUserLibrary().forEach(protocol => {
            if (canAddRef(parent, protocol.id)) {
                items.push({ id: protocol.id, group: 'user', nameKey: '', name: protocol.name });
            }
        });
        return items;
    }

    function migrateLegacyPreferences(preferences = {}) {
        if (preferences.protocol) {
            return createProtocol(preferences.protocol);
        }

        const presetId = builtins[canonicalId(preferences.preset)]
            ? canonicalId(preferences.preset)
            : 'custom';
        const protocol = getBuiltin(presetId);
        const pattern = protocol.blocks.find(block => block.type === 'pattern');
        if (pattern) {
            if (preferences.cycles !== undefined) pattern.cycles = clamp(preferences.cycles, 1, 100);
            if (presetId === 'custom' || preferences.preset === 'custom') {
                pattern.phases = [
                    createPhase({ type: 'inhale', duration: preferences.inhale ?? 4 }),
                    createPhase({ type: 'hold', duration: preferences.pause1 ?? 4 }),
                    createPhase({ type: 'exhale', duration: preferences.exhale ?? 4 }),
                    createPhase({ type: 'hold', duration: preferences.pause2 ?? 4 })
                ].filter(phase => phase.duration > 0 || phase.type === 'inhale' || phase.type === 'exhale');
                if (!pattern.phases.length) {
                    pattern.phases = [createPhase({ type: 'inhale', duration: 4 }), createPhase({ type: 'exhale', duration: 4 })];
                }
            }
        }

        if (presetId === 'power_rounds') {
            protocol.rounds = clamp(preferences.whmRounds ?? protocol.rounds, 1, 20);
            const retention = firstRetentionBlock(protocol);
            if (retention) {
                retention.duration = clamp(preferences.hold ?? retention.duration, 0, 180);
                retention.increasePerRound = clamp(preferences.whmIncrease ?? retention.increasePerRound, 0, 60);
            }
        }

        return protocol;
    }

    function addBlock(protocol, input = {}) {
        if (protocol.blocks.length >= MAX_BLOCKS) return protocol;
        protocol.blocks.push(createBlock(input));
        return protocol;
    }

    function addRefBlock(protocol, protocolId) {
        if (!canAddRef(protocol, protocolId)) return protocol;
        protocol.blocks.push(createRefBlock(protocolId));
        return protocol;
    }

    function removeBlock(protocol, blockId) {
        if (protocol.blocks.length <= 1) return protocol;
        protocol.blocks = protocol.blocks.filter(block => block.id !== blockId);
        return protocol;
    }

    function moveBlock(protocol, blockId, offset) {
        const index = protocol.blocks.findIndex(block => block.id === blockId);
        const nextIndex = index + offset;
        if (index < 0 || nextIndex < 0 || nextIndex >= protocol.blocks.length) return protocol;
        const [block] = protocol.blocks.splice(index, 1);
        protocol.blocks.splice(nextIndex, 0, block);
        return protocol;
    }

    function detachRef(protocol, blockId) {
        const index = protocol.blocks.findIndex(block => block.id === blockId);
        const block = protocol.blocks[index];
        if (!block || block.type !== 'ref') return protocol;
        const nested = resolveRef(block);
        if (!nested || !nested.blocks.length) {
            protocol.blocks.splice(index, 1);
            if (!protocol.blocks.length) protocol.blocks.push(createBlock());
            return protocol;
        }
        const inlined = nested.blocks.map(item => createBlock(item));
        const room = MAX_BLOCKS - (protocol.blocks.length - 1);
        protocol.blocks.splice(index, 1, ...inlined.slice(0, Math.max(1, room)));
        return protocol;
    }

    function addPhase(protocol, blockId, phaseInput) {
        const block = findBlock(protocol, blockId);
        if (!block || block.type !== 'pattern' || block.phases.length >= MAX_PHASES) return protocol;
        block.phases.push(createPhase(phaseInput || { type: 'hold', duration: 4 }));
        return protocol;
    }

    function removePhase(protocol, blockId, phaseId) {
        const block = findBlock(protocol, blockId);
        if (!block || block.type !== 'pattern' || block.phases.length <= 1) return protocol;
        block.phases = block.phases.filter(phase => phase.id !== phaseId);
        return protocol;
    }

    function movePhase(protocol, blockId, phaseId, offset) {
        const block = findBlock(protocol, blockId);
        if (!block || block.type !== 'pattern') return protocol;
        const index = block.phases.findIndex(phase => phase.id === phaseId);
        const nextIndex = index + offset;
        if (index < 0 || nextIndex < 0 || nextIndex >= block.phases.length) return protocol;
        const [phase] = block.phases.splice(index, 1);
        block.phases.splice(nextIndex, 0, phase);
        return protocol;
    }

    function updatePhase(protocol, blockId, phaseId, changes) {
        const block = findBlock(protocol, blockId);
        if (!block || block.type !== 'pattern') return protocol;
        const index = block.phases.findIndex(phase => phase.id === phaseId);
        if (index === -1) return protocol;
        const previous = block.phases[index];
        const next = { ...previous, ...changes, id: phaseId };
        if (changes.type && changes.type !== previous.type) {
            const meta = PHASE_META[next.type] || PHASE_META.inhale;
            next.textKey = meta.textKey;
            next.colorKey = meta.colorKey;
        }
        block.phases[index] = createPhase(next);
        return protocol;
    }

    function setPatternCycles(protocol, blockId, cycles) {
        const block = typeof blockId === 'string' ? findBlock(protocol, blockId) : firstPatternBlock(protocol);
        if (block && block.type === 'pattern') block.cycles = clamp(cycles, 1, 100);
        return protocol;
    }

    function setRetention(protocol, blockId, settings = {}) {
        const block = findBlock(protocol, blockId);
        if (!block || block.type !== 'retention') return protocol;
        if (settings.duration !== undefined) block.duration = clamp(settings.duration, 0, 180);
        if (settings.increasePerRound !== undefined) {
            block.increasePerRound = clamp(settings.increasePerRound, 0, 60);
        }
        return protocol;
    }

    function setProtocolRounds(protocol, rounds) {
        protocol.rounds = clamp(rounds, 1, 20);
        return protocol;
    }

    function stepFromBlock(block, cursor) {
        if (!block) return null;
        if (block.type === 'retention') {
            return {
                type: 'hold',
                textKey: 'holdBreath',
                colorKey: 'hold',
                duration: () => blockDuration(block, cursor.roundIndex)
            };
        }
        if (block.type !== 'pattern') return null;
        const phase = block.phases[cursor.phaseIndex];
        if (!phase) return null;
        return {
            type: phase.type,
            textKey: phase.textKey,
            colorKey: phase.colorKey,
            duration: () => Number(phase.duration) || 0
        };
    }

    function protocolHasMultipleStages(protocol, depth = 0) {
        if (!protocol || depth > MAX_NESTING) return false;
        if (protocol.rounds > 1 || protocol.blocks.length > 1) return true;
        const block = protocol.blocks[0];
        if (block?.type === 'retention') return true;
        if (block?.type === 'ref') {
            const nested = resolveRef(block);
            return nested ? protocolHasMultipleStages(nested, depth + 1) : false;
        }
        return false;
    }

    function createSession(protocol) {
        const root = cloneProtocol(protocol);
        const frames = [];

        function pushFrame(nextProtocol) {
            frames.push({
                protocol: cloneProtocol(nextProtocol),
                roundIndex: 0,
                blockIndex: 0,
                cycleIndex: 0,
                phaseIndex: 0
            });
        }

        function currentFrame() {
            return frames[frames.length - 1] || null;
        }

        function rawBlock(frame) {
            return frame?.protocol.blocks[frame.blockIndex] || null;
        }

        function enterRefs() {
            for (let guard = 0; guard < 40; guard++) {
                const frame = currentFrame();
                if (!frame) return false;
                const block = rawBlock(frame);
                if (!block) {
                    if (!advanceFrame(frame)) return false;
                    continue;
                }
                if (block.type !== 'ref') return true;
                if (frames.length > MAX_NESTING) {
                    if (!advanceFrame(frame)) return false;
                    continue;
                }
                const nested = resolveRef(block);
                if (!nested || !nested.blocks.length) {
                    if (!advanceFrame(frame)) return false;
                    continue;
                }
                if (frames.some(item => item.protocol.id === nested.id)) {
                    if (!advanceFrame(frame)) return false;
                    continue;
                }
                pushFrame(nested);
            }
            return Boolean(currentFrame() && rawBlock(currentFrame())?.type !== 'ref');
        }

        function advanceFrame(frame) {
            frame.blockIndex++;
            frame.cycleIndex = 0;
            frame.phaseIndex = 0;
            if (frame.blockIndex >= frame.protocol.blocks.length) {
                frame.blockIndex = 0;
                frame.roundIndex++;
                if (frame.roundIndex >= frame.protocol.rounds) {
                    frames.pop();
                    if (!frames.length) return false;
                    return advanceFrame(currentFrame());
                }
            }
            return true;
        }

        function skipEmpty() {
            for (let guard = 0; guard < 200; guard++) {
                if (!enterRefs()) return false;
                const frame = currentFrame();
                const block = rawBlock(frame);
                if (!block) return false;
                if (block.type === 'retention') {
                    if (blockDuration(block, frame.roundIndex) > 0) return true;
                } else if (block.type === 'pattern') {
                    while (block.phases[frame.phaseIndex] && Number(block.phases[frame.phaseIndex].duration) <= 0) {
                        frame.phaseIndex++;
                    }
                    if (block.phases[frame.phaseIndex] && Number(block.phases[frame.phaseIndex].duration) > 0) {
                        return true;
                    }
                }
                if (!advanceFrame(frame)) return false;
            }
            return false;
        }

        function currentBlock() {
            const frame = currentFrame();
            return rawBlock(frame);
        }

        function currentStep() {
            const frame = currentFrame();
            return stepFromBlock(currentBlock(), frame || { roundIndex: 0, phaseIndex: 0 });
        }

        function visualPhases() {
            const block = currentBlock();
            if (!block || block.type !== 'pattern') return [];
            return activePhases(block.phases);
        }

        function advance() {
            const frame = currentFrame();
            const block = rawBlock(frame);
            if (!frame || !block) return { done: true };

            if (block.type === 'retention' || block.type === 'ref') {
                if (!advanceFrame(frame) || !skipEmpty()) return { done: true };
                return { done: false };
            }

            frame.phaseIndex++;
            while (block.phases[frame.phaseIndex] && Number(block.phases[frame.phaseIndex].duration) <= 0) {
                frame.phaseIndex++;
            }

            if (frame.phaseIndex >= block.phases.length) {
                frame.phaseIndex = 0;
                frame.cycleIndex++;
                if (frame.cycleIndex >= block.cycles) {
                    if (!advanceFrame(frame) || !skipEmpty()) return { done: true };
                    return { done: false };
                }
                if (!skipEmpty()) return { done: true };
            }

            return { done: false };
        }

        function remainingSeconds(now, stepStartTime) {
            const step = currentStep();
            if (!step) return 0;
            const elapsed = Math.max(0, (now - stepStartTime) / 1000);
            let total = Math.max(0, step.duration() - elapsed);

            for (let index = frames.length - 1; index >= 0; index--) {
                const frame = frames[index];
                const block = rawBlock(frame);
                if (index === frames.length - 1 && block?.type === 'pattern') {
                    total += durationOf(block.phases, frame.phaseIndex + 1);
                    total += durationOf(block.phases) * Math.max(0, block.cycles - frame.cycleIndex - 1);
                }
                for (let blockIndex = frame.blockIndex + 1; blockIndex < frame.protocol.blocks.length; blockIndex++) {
                    total += blockDuration(frame.protocol.blocks[blockIndex], frame.roundIndex);
                }
                for (let round = frame.roundIndex + 1; round < frame.protocol.rounds; round++) {
                    for (const laterBlock of frame.protocol.blocks) {
                        total += blockDuration(laterBlock, round);
                    }
                }
            }

            return total;
        }

        function progressInfo() {
            const rootFrame = frames[0];
            const leafFrame = currentFrame();
            const block = currentBlock();
            const remainingCycles = block?.type === 'pattern'
                ? Math.max(0, block.cycles - (leafFrame?.cycleIndex || 0))
                : 0;
            return {
                round: (rootFrame?.roundIndex || 0) + 1,
                totalRounds: root.rounds,
                cycle: (leafFrame?.cycleIndex || 0) + 1,
                totalCycles: block?.type === 'pattern' ? block.cycles : 0,
                remainingCycles,
                inRetention: block?.type === 'retention',
                inPattern: block?.type === 'pattern',
                blockType: block?.type || '',
                multiRound: protocolHasMultipleStages(root)
            };
        }

        pushFrame(root);
        skipEmpty();

        return {
            protocol: root,
            get cursor() {
                const frame = currentFrame();
                return frame || { roundIndex: 0, blockIndex: 0, cycleIndex: 0, phaseIndex: 0 };
            },
            currentBlock,
            currentStep,
            visualPhases,
            advance,
            remainingSeconds,
            progressInfo
        };
    }

    function blockSummary(block) {
        if (block.type === 'retention') {
            return {
                kind: 'retention',
                duration: block.duration,
                increasePerRound: block.increasePerRound
            };
        }
        if (block.type === 'ref') {
            const nested = resolveRef(block);
            return {
                kind: 'ref',
                protocolId: block.protocolId,
                name: nested?.name || block.protocolId,
                nameKey: nested?.nameKey || '',
                nested: nested ? summaryParts(nested) : null
            };
        }
        return {
            kind: 'pattern',
            cycles: block.cycles,
            phases: activePhases(block.phases).map(phase => phase.duration)
        };
    }

    function summaryParts(protocol) {
        const stages = protocolHasMultipleStages(protocol);
        if (!stages && protocol.blocks[0]?.type === 'pattern') {
            const pattern = protocol.blocks[0];
            return {
                kind: 'pattern',
                phases: activePhases(pattern.phases).map(phase => phase.duration),
                cycles: pattern.cycles
            };
        }
        return {
            kind: 'protocol',
            rounds: protocol.rounds,
            blocks: protocol.blocks.map(blockSummary)
        };
    }

    global.BreathingModel = {
        PHASE_TYPES,
        PHASE_META,
        MAX_PHASES,
        MAX_BLOCKS,
        MAX_NESTING,
        PRESET_IDS,
        PIECE_IDS,
        BUILTIN_IDS,
        ID_ALIASES,
        builtins,
        canonicalId,
        createPhase,
        createBlock,
        createProtocol,
        cloneProtocol,
        getBuiltin,
        findProtocol,
        lookupProtocol,
        resolveRef,
        firstPatternBlock,
        firstRetentionBlock,
        hasRetention,
        activePhases,
        protocolDuration,
        protocolHasMultipleStages,
        canAddRef,
        listInsertableProtocols,
        addBlock,
        addRefBlock,
        removeBlock,
        moveBlock,
        detachRef,
        addPhase,
        removePhase,
        movePhase,
        updatePhase,
        setPatternCycles,
        setRetention,
        setProtocolRounds,
        createSession,
        summaryParts,
        loadUserLibrary,
        saveUserProtocol,
        deleteUserProtocol,
        migrateLegacyPreferences
    };
})(window);
