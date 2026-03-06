/**
 * Mobile Virtual Touchpad
 * Renders a D-pad and attack buttons on touch screens.
 * Injects touch input into InputManager.
 */
export default class TouchPad {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.active = false;
        this.touches = {};

        // D-Pad state
        this.dpad = { up: false, down: false, left: false, right: false };
        // Attack buttons — current + previous frame for "just pressed" detection
        this.buttons = { l: false, h: false, s: false };
        this.prevButtons = { l: false, h: false, s: false };

        // Layout positions (set in resize)
        this.dpadCenter = { x: 160, y: 0 };
        this.dpadRadius = 90;
        this.btnPositions = [];
        this.btnRadius = 55;

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
        this.dpadCenter = { x: 140, y: h - 180 };

        // Three attack buttons on the right side — bigger and more spaced
        const rightX = w - 110;
        const btnY = h - 180;
        this.btnPositions = [
            { id: 'l', x: rightX - 150, y: btnY + 30, label: '👊', color: '#00ccff' },
            { id: 'h', x: rightX - 40, y: btnY - 30, label: '🦶', color: '#ff4400' },
            { id: 's', x: rightX - 40, y: btnY + 80, label: '⚡', color: '#fdbf00' },
        ];
    }

    setupTouchListeners() {
        const handle = (e) => {
            e.preventDefault();
            this.processTouches(e.touches);
        };

        this.canvas.addEventListener('touchstart', handle, { passive: false });
        this.canvas.addEventListener('touchmove', handle, { passive: false });
        this.canvas.addEventListener('touchend', handle, { passive: false });
        this.canvas.addEventListener('touchcancel', handle, { passive: false });
    }

    processTouches(touchList) {
        // Save previous state for "just pressed" detection
        this.prevButtons.l = this.buttons.l;
        this.prevButtons.h = this.buttons.h;
        this.prevButtons.s = this.buttons.s;

        // Reset all
        this.dpad = { up: false, down: false, left: false, right: false };
        this.buttons = { l: false, h: false, s: false };

        const scaleX = this.canvas.width / this.canvas.clientWidth;
        const scaleY = this.canvas.height / this.canvas.clientHeight;

        for (let i = 0; i < touchList.length; i++) {
            const t = touchList[i];
            const rect = this.canvas.getBoundingClientRect();
            const tx = (t.clientX - rect.left) * scaleX;
            const ty = (t.clientY - rect.top) * scaleY;

            // Check D-Pad
            const dx = tx - this.dpadCenter.x;
            const dy = ty - this.dpadCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.dpadRadius * 2.5) {
                const angle = Math.atan2(dy, dx);
                const deg = angle * (180 / Math.PI);

                if (deg > -60 && deg < 60) this.dpad.right = true;
                if (deg > 120 || deg < -120) this.dpad.left = true;
                if (deg > -150 && deg < -30) this.dpad.up = true;
                if (deg > 30 && deg < 150) this.dpad.down = true;
            }

            // Check buttons
            for (const btn of this.btnPositions) {
                const bdx = tx - btn.x;
                const bdy = ty - btn.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) < this.btnRadius * 1.5) {
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

        // "Just pressed" — true on the frame the button goes from false to true
        if (this.buttons.l && !this.prevButtons.l) p1.lJust = true;
        if (this.buttons.h && !this.prevButtons.h) p1.hJust = true;
        if (this.buttons.s && !this.prevButtons.s) p1.sJust = true;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = 0.7;

        // D-Pad base circle with border
        ctx.fillStyle = 'rgba(20, 20, 30, 0.8)';
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.dpadCenter.x, this.dpadCenter.y, this.dpadRadius + 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // D-Pad directional arrows
        const dirs = [
            { dx: 0, dy: -1, active: this.dpad.up, label: '▲' },
            { dx: 0, dy: 1, active: this.dpad.down, label: '▼' },
            { dx: -1, dy: 0, active: this.dpad.left, label: '◀' },
            { dx: 1, dy: 0, active: this.dpad.right, label: '▶' },
        ];
        for (const d of dirs) {
            const ax = this.dpadCenter.x + d.dx * 55;
            const ay = this.dpadCenter.y + d.dy * 55;
            ctx.fillStyle = d.active ? '#00ffff' : 'rgba(100, 100, 120, 0.8)';
            ctx.beginPath();
            ctx.arc(ax, ay, 28, 0, Math.PI * 2);
            ctx.fill();

            // Arrow label
            ctx.fillStyle = d.active ? '#000' : '#ccc';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.label, ax, ay + 7);
        }

        // Attack buttons — large, visible, with glow when pressed
        for (const btn of this.btnPositions) {
            const isPressed = this.buttons[btn.id];

            // Glow ring when pressed
            if (isPressed) {
                ctx.shadowColor = btn.color;
                ctx.shadowBlur = 20;
            }

            // Button background
            ctx.fillStyle = isPressed ? btn.color : 'rgba(40, 40, 50, 0.85)';
            ctx.strokeStyle = btn.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, this.btnRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Button emoji label
            ctx.fillStyle = isPressed ? '#000' : '#fff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(btn.label, btn.x, btn.y + 10);
        }

        ctx.restore();
    }
}
