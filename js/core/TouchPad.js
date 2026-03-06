/**
 * Premium Mobile Virtual Controller
 * Modern analog stick + action buttons with dark glass aesthetic.
 * Renders on touch screens only. Injects input into InputManager.
 */
export default class TouchPad {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.active = false;

        // D-Pad / Analog stick state
        this.dpad = { up: false, down: false, left: false, right: false };
        this.stickAngle = 0;
        this.stickDist = 0;
        this.stickTouchId = null;

        // Attack buttons — current + previous frame for "just pressed"
        this.buttons = { l: false, h: false, s: false };
        this.prevButtons = { l: false, h: false, s: false };

        // Layout
        this.stickCenter = { x: 0, y: 0 };
        this.stickRadius = 90;
        this.stickOuter = 130;
        this.stickPos = { x: 0, y: 0 }; // Current thumb position
        this.btnRadius = 55;
        this.btnPositions = [];

        // Detect touch device
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

        // Analog stick — bottom-left, big
        this.stickCenter = { x: 180, y: h - 200 };
        this.stickPos = { ...this.stickCenter };

        // Action buttons — bottom-right, diamond layout
        const rx = w - 160;
        const ry = h - 200;
        const spacing = 80;
        this.btnPositions = [
            { id: 'l', x: rx - spacing, y: ry, label: 'P', sub: 'PUNCH', color: '#00ccff' },
            { id: 'h', x: rx, y: ry - spacing, label: 'K', sub: 'KICK', color: '#ff4444' },
            { id: 's', x: rx + spacing, y: ry, label: 'S', sub: 'SPEC', color: '#ffcc00' },
        ];
    }

    setupTouchListeners() {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
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

    handleTouches(touchList) {
        // Save previous button state
        this.prevButtons = { ...this.buttons };

        // Reset
        this.dpad = { up: false, down: false, left: false, right: false };
        this.buttons = { l: false, h: false, s: false };
        this.stickDist = 0;
        this.stickPos = { ...this.stickCenter };

        const scaleX = this.canvas.width / this.canvas.clientWidth;
        const scaleY = this.canvas.height / this.canvas.clientHeight;

        for (let i = 0; i < touchList.length; i++) {
            const t = touchList[i];
            const rect = this.canvas.getBoundingClientRect();
            const tx = (t.clientX - rect.left) * scaleX;
            const ty = (t.clientY - rect.top) * scaleY;

            // Check analog stick zone (generous area)
            const dx = tx - this.stickCenter.x;
            const dy = ty - this.stickCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.stickOuter * 2.5) {
                // Clamp stick position to outer ring
                const clampedDist = Math.min(dist, this.stickOuter);
                const angle = Math.atan2(dy, dx);
                this.stickPos = {
                    x: this.stickCenter.x + Math.cos(angle) * clampedDist,
                    y: this.stickCenter.y + Math.sin(angle) * clampedDist,
                };
                this.stickAngle = angle;
                this.stickDist = clampedDist / this.stickOuter;

                // Convert to D-pad with deadzone
                if (this.stickDist > 0.3) {
                    const deg = angle * (180 / Math.PI);
                    if (deg > -60 && deg < 60) this.dpad.right = true;
                    if (deg > 120 || deg < -120) this.dpad.left = true;
                    if (deg > -150 && deg < -30) this.dpad.up = true;
                    if (deg > 30 && deg < 150) this.dpad.down = true;
                }
            }

            // Check buttons
            for (const btn of this.btnPositions) {
                const bdx = tx - btn.x;
                const bdy = ty - btn.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) < this.btnRadius * 1.8) {
                    this.buttons[btn.id] = true;
                }
            }
        }
    }

    /** Inject touch state into InputManager */
    injectInput(inputManager) {
        if (!this.active) return;

        const p1 = inputManager.p1;
        p1.left = p1.left || this.dpad.left;
        p1.right = p1.right || this.dpad.right;
        p1.up = p1.up || this.dpad.up;
        p1.down = p1.down || this.dpad.down;

        // Held buttons
        p1.l = p1.l || this.buttons.l;
        p1.h = p1.h || this.buttons.h;
        p1.s = p1.s || this.buttons.s;

        // "Just pressed" — true only on the frame it goes from false to true
        if (this.buttons.l && !this.prevButtons.l) p1.lJust = true;
        if (this.buttons.h && !this.prevButtons.h) p1.hJust = true;
        if (this.buttons.s && !this.prevButtons.s) p1.sJust = true;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();

        // ─── ANALOG STICK ───
        // Outer ring (dark glass)
        ctx.globalAlpha = 0.6;
        const grad = ctx.createRadialGradient(
            this.stickCenter.x, this.stickCenter.y, 20,
            this.stickCenter.x, this.stickCenter.y, this.stickOuter + 15
        );
        grad.addColorStop(0, 'rgba(30, 35, 50, 0.9)');
        grad.addColorStop(1, 'rgba(10, 12, 20, 0.7)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.stickCenter.x, this.stickCenter.y, this.stickOuter + 15, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring border
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Direction indicators (subtle ticks)
        ctx.globalAlpha = 0.3;
        const tickDirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        ];
        for (const d of tickDirs) {
            const isActive = (d.dx === 1 && this.dpad.right) || (d.dx === -1 && this.dpad.left) ||
                (d.dy === -1 && this.dpad.up) || (d.dy === 1 && this.dpad.down);
            ctx.globalAlpha = isActive ? 0.8 : 0.25;
            ctx.fillStyle = isActive ? '#00d4ff' : '#445';
            const tickX = this.stickCenter.x + d.dx * (this.stickOuter + 5);
            const tickY = this.stickCenter.y + d.dy * (this.stickOuter + 5);
            ctx.beginPath();
            ctx.arc(tickX, tickY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Thumb stick (inner circle that moves)
        ctx.globalAlpha = 0.85;
        const thumbGrad = ctx.createRadialGradient(
            this.stickPos.x - 5, this.stickPos.y - 5, 5,
            this.stickPos.x, this.stickPos.y, this.stickRadius
        );
        thumbGrad.addColorStop(0, 'rgba(60, 70, 90, 0.95)');
        thumbGrad.addColorStop(0.7, 'rgba(35, 40, 55, 0.9)');
        thumbGrad.addColorStop(1, 'rgba(20, 25, 35, 0.85)');
        ctx.fillStyle = thumbGrad;
        ctx.beginPath();
        ctx.arc(this.stickPos.x, this.stickPos.y, this.stickRadius, 0, Math.PI * 2);
        ctx.fill();

        // Thumb stick edge highlight
        ctx.strokeStyle = this.stickDist > 0.3 ? 'rgba(0, 212, 255, 0.6)' : 'rgba(100, 110, 130, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Center dot
        ctx.fillStyle = this.stickDist > 0.3 ? '#00d4ff' : '#556';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(this.stickPos.x, this.stickPos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // ─── ACTION BUTTONS ───
        for (const btn of this.btnPositions) {
            const isPressed = this.buttons[btn.id];

            // Button shadow/glow
            if (isPressed) {
                ctx.shadowColor = btn.color;
                ctx.shadowBlur = 25;
            }

            // Button background (dark glass)
            ctx.globalAlpha = isPressed ? 0.9 : 0.65;
            const btnGrad = ctx.createRadialGradient(
                btn.x - 5, btn.y - 5, 5,
                btn.x, btn.y, this.btnRadius
            );
            if (isPressed) {
                btnGrad.addColorStop(0, btn.color);
                btnGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
            } else {
                btnGrad.addColorStop(0, 'rgba(45, 50, 65, 0.9)');
                btnGrad.addColorStop(1, 'rgba(20, 25, 35, 0.85)');
            }
            ctx.fillStyle = btnGrad;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, this.btnRadius, 0, Math.PI * 2);
            ctx.fill();

            // Button border
            ctx.strokeStyle = isPressed ? btn.color : 'rgba(100, 110, 130, 0.4)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Button label
            ctx.globalAlpha = isPressed ? 1 : 0.8;
            ctx.fillStyle = isPressed ? '#000' : '#ddd';
            ctx.font = 'bold 28px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(btn.label, btn.x, btn.y + 10);
        }

        ctx.restore();
    }
}
