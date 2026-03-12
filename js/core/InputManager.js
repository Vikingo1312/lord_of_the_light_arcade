export default class InputManager {
    constructor() {
        this.keys = {};

        // P1 & P2 Buffer objects for input reading
        this.p1 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };
        this.p2 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        // Just-pressed detection
        this.p1Prev = { l: false, h: false, s: false, menu: false };

        // Motion input history (stores last 10 directional states with timestamps)
        this.inputHistory = [];
        this.maxHistory = 15;

        window.addEventListener('keydown', (e) => {
            if (!e.repeat) this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp1 = gamepads[0];

        // Save previous attack states
        this.p1Prev.l = this.p1.l;
        this.p1Prev.h = this.p1.h;
        this.p1Prev.s = this.p1.s;

        this.p1.left = this.keys['KeyA'] || (gp1 && (gp1.axes[0] < -0.5 || gp1.buttons[14]?.pressed));
        this.p1.right = this.keys['KeyD'] || (gp1 && (gp1.axes[0] > 0.5 || gp1.buttons[15]?.pressed));
        this.p1.up = this.keys['KeyW'] || (gp1 && (gp1.axes[1] < -0.5 || gp1.buttons[12]?.pressed));
        this.p1.down = this.keys['KeyS'] || (gp1 && (gp1.axes[1] > 0.5 || gp1.buttons[13]?.pressed));

        this.p1.l = this.keys['KeyJ'] || (gp1 && gp1.buttons[2]?.pressed);
        this.p1.h = this.keys['KeyK'] || (gp1 && gp1.buttons[3]?.pressed);
        this.p1.s = this.keys['KeyL'] || (gp1 && gp1.buttons[5]?.pressed);
        this.p1.menu = this.keys['Escape'] || (gp1 && gp1.buttons[9]?.pressed);

        // Just-pressed flags
        this.p1.lJust = this.p1.l && !this.p1Prev.l;
        this.p1.hJust = this.p1.h && !this.p1Prev.h;
        this.p1.sJust = this.p1.s && !this.p1Prev.s;
        this.p1.menuJust = this.p1.menu && !this.p1Prev.menu;

        this.p1Prev.menu = this.p1.menu;

        // Record directional state for motion input detection
        const dir = { down: this.p1.down, right: this.p1.right, left: this.p1.left, t: performance.now() };
        this.inputHistory.push(dir);
        if (this.inputHistory.length > this.maxHistory) this.inputHistory.shift();
    }

    /**
     * Check for Quarter-Circle Forward input (↓↘→)
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasQCF(facing) {
        const now = performance.now();
        const window = 500; // ms (increased from 400ms for slightly more forgiving inputs)
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
