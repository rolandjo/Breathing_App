/** Canvas orb geometry and frame drawing for the breathing guide. */
(function (global) {
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

    /**
     * Creates the canvas visualizer used by the session render loop.
     * Session and running state stay in the controller; this factory reads them
     * through getters so drawing can be extracted without splitting that state.
     *
     * @param {object} options - canvas, context, and session accessors
     * @returns {{resizeCanvas: Function, updateCachedColors: Function, drawFrame: Function}}
     */
    function createVisualizer(options = {}) {
        const canvas = options.canvas;
        const ctx = options.ctx;
        const getWrapper = options.getWrapper || (() => null);
        const getIsRunning = options.getIsRunning || (() => false);
        const getSession = options.getSession || (() => null);
        const visualPhaseList = options.visualPhaseList || (() => []);
        const currentStep = options.currentStep || (() => null);
        const readComputedStyle = options.getComputedStyle || global.getComputedStyle;
        const getDevicePixelRatio = options.getDevicePixelRatio
            || (() => global.devicePixelRatio || 1);
        const getColorRoot = options.getColorRoot || (() => global.document?.body);
        let cachedColors = {};

        function updateCachedColors() {
            const root = getColorRoot();
            if (!root || typeof readComputedStyle !== 'function') return;
            const styles = readComputedStyle(root);
            cachedColors = {
                inhale: styles.getPropertyValue('--orb-color-inhale').trim(),
                hold: styles.getPropertyValue('--orb-color-hold').trim(),
                exhale: styles.getPropertyValue('--orb-color-exhale').trim(),
                idle: styles.getPropertyValue('--orb-color-idle').trim(),
                glassBorder: styles.getPropertyValue('--md-sys-color-outline-variant').trim()
            };
        }

        function resizeCanvas() {
            const wrapper = getWrapper();
            if (!canvas || !ctx || !wrapper) return;
            const dpr = getDevicePixelRatio();
            canvas.width = wrapper.clientWidth * dpr;
            canvas.height = wrapper.clientHeight * dpr;
            ctx.scale(dpr, dpr);
            updateCachedColors();
        }

        function drawFrame(step, progress, idleTime = 0) {
            if (!canvas || !ctx) return;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            const cx = w / 2;
            const cy = h / 2;
            const r = Math.min(w, h) * 0.35;
            const isRunning = getIsRunning();
            const session = getSession();

            ctx.clearRect(0, 0, w, h);

            const activeSteps = visualPhaseList();
            if (activeSteps.length === 0 && isRunning) {
                const runningStep = currentStep();
                if (runningStep) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                    ctx.fillStyle = cachedColors[runningStep.colorKey] || cachedColors.idle;
                    ctx.shadowColor = ctx.fillStyle;
                    ctx.shadowBlur = 15;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
                return;
            }

            if (activeSteps.length === 0) return;

            const vertices = generateVertices(activeSteps.length, cx, cy, r);

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

            ctx.beginPath();
            ctx.arc(bx, by, 15, 0, Math.PI * 2);
            ctx.fillStyle = currentColor;
            ctx.shadowColor = currentColor;
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        return { resizeCanvas, updateCachedColors, drawFrame };
    }

    global.BreathingVisualizer = { generateVertices, easeInOutSine, createVisualizer };
})(typeof window !== 'undefined' ? window : globalThis);
