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
        // Attack buttons
        this.buttons = { l: false, h: false, s: false };

        // Layout positions (set in resize)
        this.dpadCenter = { x: 160, y: 0 };
        this.dpadRadius = 80;
        this.btnPositions = [];
        this.btnRadius = 45;

        // Detect touch device
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouchDevice) {
            this.active = true;
            this.setupTouchListeners();
        }

        this.resize();
    }

    resize() {
        const h = this.canvas.height;
        this.dpadCenter = { x: 160, y: h - 160 };

        // Three attack buttons on the right side
        const rightX = this.canvas.width - 100;
        const btnY = h - 160;
        this.btnPositions = [
            { id: 'l', x: rightX - 130, y: btnY + 30, label: 'LP', color: '#00ccff' },
            { id: 'h', x: rightX - 30, y: btnY - 20, label: 'HP', color: '#ff4400' },
            { id: 's', x: rightX - 30, y: btnY + 70, label: 'SK', color: '#fdbf00' },
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

            if (dist < this.dpadRadius * 2) {
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
                if (Math.sqrt(bdx * bdx + bdy * bdy) < this.btnRadius * 1.3) {
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
        p1.l = p1.l || this.buttons.l;
        p1.h = p1.h || this.buttons.h;
        p1.s = p1.s || this.buttons.s;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = 0.35;

        // D-Pad base circle
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(this.dpadCenter.x, this.dpadCenter.y, this.dpadRadius + 20, 0, Math.PI * 2);
        ctx.fill();

        // D-Pad arrows
        const dirs = [
            { dx: 0, dy: -1, active: this.dpad.up },
            { dx: 0, dy: 1, active: this.dpad.down },
            { dx: -1, dy: 0, active: this.dpad.left },
            { dx: 1, dy: 0, active: this.dpad.right },
        ];
        for (const d of dirs) {
            const ax = this.dpadCenter.x + d.dx * 50;
            const ay = this.dpadCenter.y + d.dy * 50;
            ctx.fillStyle = d.active ? '#00ffff' : '#666';
            ctx.beginPath();
            ctx.arc(ax, ay, 22, 0, Math.PI * 2);
            ctx.fill();
        }

        // Attack buttons
        for (const btn of this.btnPositions) {
            ctx.fillStyle = this.buttons[btn.id] ? btn.color : '#444';
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, this.btnRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(btn.label, btn.x, btn.y + 7);
        }

        ctx.restore();
    }
}
