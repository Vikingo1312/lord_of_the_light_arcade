/**
 * Premium Mobile Virtual Controller (iOS Safari / Android / PWA Fullscreen Optimized)
 * - Multi-touch identifier tracking (left thumb stick never drops or interferes with right thumb buttons)
 * - Rotation-aware coordinate mapping (works in native landscape AND auto-rotated portrait-to-landscape)
 * - Ergonomic 8-way gate angles so horizontal walking never accidentally crouches or jumps
 * - 4 Arcade Buttons: P (Punch), K (Kick), S (Special), D (Dash) positioned clear of iOS Home Indicator
 * - Full Just-Pressed, Double-Tap Dash, and QCF motion history injection into InputManager
 */
export default class TouchPad {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.active = false;

        // D-Pad / Analog stick state
        this.dpad = { up: false, down: false, left: false, right: false };
        this.prevDpad = { up: false, down: false, left: false, right: false };
        this.stickAngle = 0;
        this.stickDist = 0;
        this.stickTouchId = null;

        // Attack + Dash buttons — current + previous frame for "just pressed"
        this.buttons = { l: false, h: false, s: false, dash: false };
        this.prevButtons = { l: false, h: false, s: false, dash: false };

        // Latch: once a button/dpad is pressed, hold it until injectInput consumes it.
        this.latchedButtons = { l: false, h: false, s: false, dash: false };
        this.latchedDpad = { up: false, down: false, left: false, right: false };
        this.anyTapLatched = false;

        // Double-tap dash timestamps on mobile stick
        this._lastLeftTap = 0;
        this._lastRightTap = 0;

        // Layout — raised well above iOS Safari toolbar / iPhone Home Bar
        this.stickCenter = { x: 250, y: 785 };
        this.stickRadius = 115;
        this.stickOuter = 165;
        this.stickPos = { x: 250, y: 785 };
        this.btnRadius = 74;
        this.btnPositions = [];

        // Detect touch device (or mobile viewport)
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouchDevice) {
            this.active = true;
            this.setupTouchListeners();
        }

        this.resize();
    }

    resize() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Analog stick — bottom-left, raised away from iOS bottom bar (y = h - 295)
        this.stickCenter = { x: 255, y: h - 295 };
        this.stickPos = { ...this.stickCenter };

        // 4 Arcade Action buttons — bottom-right ergonomic diamond/arc layout
        const rx = w - 255;
        const ry = h - 295;
        const spacing = 118;
        this.btnPositions = [
            { id: 'l', x: rx - spacing, y: ry + 10, label: 'P', sub: 'PUNCH', color: '#00ccff' },
            { id: 'h', x: rx, y: ry - spacing + 10, label: 'K', sub: 'KICK', color: '#ff4444' },
            { id: 's', x: rx + spacing, y: ry + 10, label: 'S', sub: 'SPEC', color: '#ffcc00' },
            { id: 'dash', x: rx, y: ry + spacing - 5, label: 'D', sub: 'DASH', color: '#bb66ff' },
        ];
    }

    _mapPoint(clientX, clientY) {
        if (window.mapTouchToCanvas) {
            return window.mapTouchToCanvas(clientX, clientY, this.canvas);
        }
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)),
            y: (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)),
        };
    }

    setupTouchListeners() {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.anyTapLatched = true;
            if (this.game && this.game.audioManager && this.game.audioManager.unlockAudio) {
                this.game.audioManager.unlockAudio();
            }
            this._handleSpecialCombatTaps(e.changedTouches);
            this.handleTouches(e.touches);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouches(e.touches);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouches(e.touches);
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.handleTouches(e.touches);
        }, { passive: false });
    }

    /**
     * Handle direct touch on Combat top-right MENU button, top-center PAUSE button, or Pause overlay
     */
    _handleSpecialCombatTaps(changedTouches) {
        if (!changedTouches || !changedTouches.length || !this.game || !this.game.stateManager) return;
        const st = this.game.stateManager.currentState;
        const combatSt = this.game.stateManager.states['Combat'];
        if (!st || st !== combatSt) return;

        const pt = this._mapPoint(changedTouches[0].clientX, changedTouches[0].clientY);
        if (typeof st._handleCanvasTap === 'function') {
            st._handleCanvasTap(pt.x, pt.y);
        }
    }

    handleTouches(touchList) {
        // Reset live state (represents what fingers are CURRENTLY touching)
        this.dpad = { up: false, down: false, left: false, right: false };
        this.buttons = { l: false, h: false, s: false, dash: false };

        let foundStickTouch = false;

        for (let i = 0; i < touchList.length; i++) {
            const t = touchList[i];
            const pt = this._mapPoint(t.clientX, t.clientY);
            const tx = pt.x;
            const ty = pt.y;

            const dx = tx - this.stickCenter.x;
            const dy = ty - this.stickCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if this touch is the tracked left-thumb stick touch OR a new touch in the left-side stick zone
            const isStickZone = (this.stickTouchId === t.identifier) ||
                (this.stickTouchId === null && tx < this.canvas.width * 0.45 && ty > 160 && dist < this.stickOuter * 2.4);

            if (isStickZone && !foundStickTouch) {
                foundStickTouch = true;
                this.stickTouchId = t.identifier;

                const clampedDist = Math.min(dist, this.stickOuter);
                const angle = Math.atan2(dy, dx);
                this.stickPos = {
                    x: this.stickCenter.x + Math.cos(angle) * clampedDist,
                    y: this.stickCenter.y + Math.sin(angle) * clampedDist,
                };
                this.stickAngle = angle;
                this.stickDist = clampedDist / this.stickOuter;

                // Ergonomic 8-way arcade gate:
                // Wide horizontal zones (-65°..65°) so walking forward/back never accidentally crouches or jumps!
                if (this.stickDist > 0.24) {
                    const deg = angle * (180 / Math.PI);
                    if (deg > -68 && deg < 68) this.dpad.right = true;
                    if (deg > 112 || deg < -112) this.dpad.left = true;
                    // Up (Jump / Salto) and Down (Crouch) require deliberate vertical push
                    if (deg > -135 && deg < -45 && (dy / this.stickOuter) < -0.38) this.dpad.up = true;
                    if (deg > 45 && deg < 135 && (dy / this.stickOuter) > 0.38) this.dpad.down = true;
                }
                continue;
            }

            // Check right-side action buttons (generous hit radius so thumbs never miss)
            for (const btn of this.btnPositions) {
                const bdx = tx - btn.x;
                const bdy = ty - btn.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) < this.btnRadius * 1.45) {
                    this.buttons[btn.id] = true;
                }
            }
        }

        if (!foundStickTouch) {
            this.stickTouchId = null;
            this.stickDist = 0;
            this.stickPos = { ...this.stickCenter };
        }

        // LATCH: Ensure fast taps between 60fps ticks are never dropped
        for (const k of ['l', 'h', 's', 'dash']) {
            if (this.buttons[k]) this.latchedButtons[k] = true;
        }
        for (const k of ['up', 'down', 'left', 'right']) {
            if (this.dpad[k]) this.latchedDpad[k] = true;
        }
    }

    /** Inject touch state into InputManager (including Just-Pressed, Double-Tap Dash, and QCF History!) */
    injectInput(inputManager) {
        if (!this.active) return;

        const p1 = inputManager.p1;
        const now = performance.now();

        const curLeft = this.dpad.left || this.latchedDpad.left;
        const curRight = this.dpad.right || this.latchedDpad.right;
        const curUp = this.dpad.up || this.latchedDpad.up;
        const curDown = this.dpad.down || this.latchedDpad.down;

        const leftJust = curLeft && !this.prevDpad.left;
        const rightJust = curRight && !this.prevDpad.right;
        const upJust = curUp && !this.prevDpad.up;
        const downJust = curDown && !this.prevDpad.down;

        p1.left = p1.left || curLeft;
        p1.right = p1.right || curRight;
        p1.up = p1.up || curUp;
        p1.down = p1.down || curDown;

        p1.leftJust = p1.leftJust || leftJust;
        p1.rightJust = p1.rightJust || rightJust;
        p1.upJust = p1.upJust || upJust;
        p1.downJust = p1.downJust || downJust;

        // Double-tap left/right on virtual stick triggers Dash
        if (leftJust) {
            if (now - this._lastLeftTap < 280) {
                p1.dashLeftJust = true;
                this._lastLeftTap = 0;
            } else {
                this._lastLeftTap = now;
            }
        }
        if (rightJust) {
            if (now - this._lastRightTap < 280) {
                p1.dashRightJust = true;
                this._lastRightTap = 0;
            } else {
                this._lastRightTap = now;
            }
        }

        // Held & Just-Pressed buttons
        const latchL = this.buttons.l || this.latchedButtons.l;
        const latchH = this.buttons.h || this.latchedButtons.h;
        const latchS = this.buttons.s || this.latchedButtons.s;
        const latchDash = this.buttons.dash || this.latchedButtons.dash;

        p1.l = p1.l || latchL;
        p1.h = p1.h || latchH;
        p1.s = p1.s || latchS;
        p1.dash = p1.dash || latchDash;

        if (latchL && !this.prevButtons.l) p1.lJust = true;
        if (latchH && !this.prevButtons.h) p1.hJust = true;
        if (latchS && !this.prevButtons.s) p1.sJust = true;
        if (latchDash && !this.prevButtons.dash) p1.dashJust = true;
        if ((p1.lJust && p1.h) || (p1.hJust && p1.l)) p1.throwJust = true;

        if (this.anyTapLatched || p1.lJust || p1.hJust || p1.sJust || p1.dashJust) {
            p1.skipJust = true;
        }

        // Feed TouchPad directional state into InputManager's motion history so QCF/QCB/DP work on mobile!
        if ((curUp || curDown || curRight || curLeft) && inputManager.inputHistory) {
            inputManager.inputHistory.push({ up: p1.up, down: p1.down, right: p1.right, left: p1.left, t: now });
            if (inputManager.inputHistory.length > inputManager.maxHistory) {
                inputManager.inputHistory.shift();
            }
        }

        // Save previous states & clear latches
        this.prevDpad = { left: curLeft, right: curRight, up: curUp, down: curDown };
        this.prevButtons = { l: latchL, h: latchH, s: latchS, dash: latchDash };
        this.latchedButtons = { l: false, h: false, s: false, dash: false };
        this.latchedDpad = { up: false, down: false, left: false, right: false };
        this.anyTapLatched = false;
    }

    draw(ctx) {
        if (!this.active) return;

        // Only draw the virtual arcade controller during Combat (or Menu Options),
        // keeping Menu, CharacterSelect, Story, and VersusIntro 100% clean for direct touch!
        const sm = this.game && this.game.stateManager;
        if (sm && sm.currentState && sm.states) {
            const isCombat = sm.currentState === sm.states['Combat'];
            const isMenuOptions = sm.currentState === sm.states['Menu'] && sm.currentState.inOptions;
            if (!isCombat && !isMenuOptions) return;
        }

        ctx.save();

        // ─── ANALOG STICK ───
        ctx.globalAlpha = 0.58;
        const grad = ctx.createRadialGradient(
            this.stickCenter.x, this.stickCenter.y, 20,
            this.stickCenter.x, this.stickCenter.y, this.stickOuter + 15
        );
        grad.addColorStop(0, 'rgba(30, 35, 50, 0.9)');
        grad.addColorStop(1, 'rgba(10, 12, 20, 0.65)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.stickCenter.x, this.stickCenter.y, this.stickOuter + 15, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring border
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 8-way Direction indicators
        const tickDirs = [
            { dx: 0, dy: -1, act: this.dpad.up },
            { dx: 0, dy: 1, act: this.dpad.down },
            { dx: -1, dy: 0, act: this.dpad.left },
            { dx: 1, dy: 0, act: this.dpad.right },
        ];
        for (const d of tickDirs) {
            ctx.globalAlpha = d.act ? 0.9 : 0.3;
            ctx.fillStyle = d.act ? '#00e5ff' : '#667';
            const tickX = this.stickCenter.x + d.dx * (this.stickOuter - 4);
            const tickY = this.stickCenter.y + d.dy * (this.stickOuter - 4);
            ctx.beginPath();
            ctx.arc(tickX, tickY, d.act ? 9 : 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Thumb stick (inner circle that moves)
        ctx.globalAlpha = 0.85;
        const thumbGrad = ctx.createRadialGradient(
            this.stickPos.x - 5, this.stickPos.y - 5, 5,
            this.stickPos.x, this.stickPos.y, this.stickRadius
        );
        thumbGrad.addColorStop(0, 'rgba(70, 82, 108, 0.95)');
        thumbGrad.addColorStop(0.7, 'rgba(35, 42, 60, 0.9)');
        thumbGrad.addColorStop(1, 'rgba(18, 22, 34, 0.85)');
        ctx.fillStyle = thumbGrad;
        ctx.beginPath();
        ctx.arc(this.stickPos.x, this.stickPos.y, this.stickRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.stickDist > 0.24 ? 'rgba(0, 229, 255, 0.8)' : 'rgba(120, 135, 160, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = this.stickDist > 0.24 ? '#00e5ff' : '#778';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.stickPos.x, this.stickPos.y, 9, 0, Math.PI * 2);
        ctx.fill();

        // ─── 4 ACTION BUTTONS (P, K, S, DASH) ───
        for (const btn of this.btnPositions) {
            const isPressed = this.buttons[btn.id];

            if (isPressed) {
                ctx.shadowColor = btn.color;
                ctx.shadowBlur = 26;
            }

            ctx.globalAlpha = isPressed ? 0.92 : 0.68;
            const btnGrad = ctx.createRadialGradient(
                btn.x - 5, btn.y - 5, 5,
                btn.x, btn.y, this.btnRadius
            );
            if (isPressed) {
                btnGrad.addColorStop(0, btn.color);
                btnGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
            } else {
                btnGrad.addColorStop(0, 'rgba(48, 54, 72, 0.92)');
                btnGrad.addColorStop(1, 'rgba(18, 22, 34, 0.88)');
            }
            ctx.fillStyle = btnGrad;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, this.btnRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isPressed ? '#ffffff' : btn.color;
            ctx.lineWidth = isPressed ? 3.5 : 2.5;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.globalAlpha = isPressed ? 1 : 0.9;
            ctx.fillStyle = isPressed ? '#000' : '#fff';
            ctx.font = 'bold 26px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(btn.label, btn.x, btn.y + 6);

            ctx.font = 'bold 10px "Press Start 2P"';
            ctx.fillStyle = isPressed ? '#111' : btn.color;
            ctx.fillText(btn.sub, btn.x, btn.y + 28);
        }

        ctx.restore();
    }
}
