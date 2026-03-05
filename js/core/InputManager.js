export default class InputManager {
    constructor() {
        this.keys = {};
        this.touch = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        // P1 & P2 Buffer objects for input reading
        this.p1 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };
        this.p2 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        // Just-pressed detection
        this.p1Prev = { l: false, h: false, s: false };

        // Motion input history (stores last 10 directional states with timestamps)
        this.inputHistory = [];
        this.maxHistory = 15;

        // --- Keyboard Setup ---
        window.addEventListener('keydown', (e) => {
            if (!e.repeat) this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // --- Mobile Touch Auto-Detect ---
        const mobileUI = document.getElementById('mobile-ui');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            if (mobileUI) mobileUI.classList.remove('hidden');
        }

        // Bind touch buttons to this.touch state
        const bindTouch = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch[key] = true; }, { passive: false });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.touch[key] = false; }, { passive: false });
            el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touch[key] = false; }, { passive: false });
        };

        bindTouch('btn-up', 'up');
        bindTouch('btn-down', 'down');
        bindTouch('btn-left', 'left');
        bindTouch('btn-right', 'right');
        bindTouch('btn-l', 'l');
        bindTouch('btn-h', 'h');
        bindTouch('btn-s', 's');
    }

    update() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp1 = gamepads[0];

        // Save previous attack states
        this.p1Prev.l = this.p1.l;
        this.p1Prev.h = this.p1.h;
        this.p1Prev.s = this.p1.s;

        // Dual Keyboard Support: WASD or Arrows
        // Gamepad Support: Analog Stick (Axes 0/1) or D-PAD (Buttons 12-15)
        // Mobile Support: this.touch
        this.p1.left = this.keys['KeyA'] || this.keys['ArrowLeft'] || this.touch.left || (gp1 && (gp1.axes[0] < -0.4 || gp1.buttons[14]?.pressed));
        this.p1.right = this.keys['KeyD'] || this.keys['ArrowRight'] || this.touch.right || (gp1 && (gp1.axes[0] > 0.4 || gp1.buttons[15]?.pressed));
        this.p1.up = this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['Space'] || this.touch.up || (gp1 && (gp1.axes[1] < -0.4 || gp1.buttons[12]?.pressed));
        this.p1.down = this.keys['KeyS'] || this.keys['ArrowDown'] || this.touch.down || (gp1 && (gp1.axes[1] > 0.4 || gp1.buttons[13]?.pressed));

        // Attack Buttons:
        // KeyScheme A: J, K, L
        // KeyScheme B: Z, X, C
        // Gamepad PlayStation Layout: 
        // Square (Button 2) -> Light Punch (l)
        // Triangle (Button 3) -> Heavy Punch (h)
        // Cross (Button 0) or Circle (Button 1) -> Special/Kick (s)
        this.p1.l = this.keys['KeyJ'] || this.keys['KeyZ'] || this.touch.l || (gp1 && gp1.buttons[2]?.pressed); // Square
        this.p1.h = this.keys['KeyK'] || this.keys['KeyX'] || this.touch.h || (gp1 && gp1.buttons[3]?.pressed); // Triangle
        this.p1.s = this.keys['KeyL'] || this.keys['KeyC'] || this.touch.s || (gp1 && (gp1.buttons[0]?.pressed || gp1.buttons[1]?.pressed)); // Cross or Circle

        // Just-pressed flags
        this.p1.lJust = this.p1.l && !this.p1Prev.l;
        this.p1.hJust = this.p1.h && !this.p1Prev.h;
        this.p1.sJust = this.p1.s && !this.p1Prev.s;

        // Record directional state for motion input detection
        const dir = { down: this.p1.down, right: this.p1.right, left: this.p1.left, t: performance.now() };
        this.inputHistory.push(dir);
        if (this.inputHistory.length > this.maxHistory) this.inputHistory.shift();
    }

    /**
     * Check for Quarter-Circle Forward input (↓↘→) within last 400ms
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasQCF(facing) {
        const now = performance.now();
        const window = 400; // ms
        const recent = this.inputHistory.filter(h => (now - h.t) < window);
        if (recent.length < 3) return false;

        // Looking for: DOWN only → DOWN+FORWARD → FORWARD only
        const fwd = facing === 1 ? 'right' : 'left';
        let foundDown = false;
        let foundDiag = false;

        for (const h of recent) {
            if (!foundDown && h.down && !h[fwd]) {
                foundDown = true;
            } else if (foundDown && !foundDiag && h.down && h[fwd]) {
                foundDiag = true;
            } else if (foundDiag && !h.down && h[fwd]) {
                return true;
            }
        }
        return false;
    }

    /** Clear the motion input history after a special move is executed */
    clearMotionHistory() {
        this.inputHistory = [];
    }
}
