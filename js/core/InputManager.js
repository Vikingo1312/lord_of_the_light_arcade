export default class InputManager {
    constructor() {
        this.keys = {};
        this.latchedKeys = {};
        this.pointerLatched = false;

        // P1 & P2 Buffer objects for input reading
        this.p1 = {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false, dash: false, menu: false,
            skipJust: false, dashLeftJust: false, dashRightJust: false, dashJust: false
        };
        this.p2 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        // Just-pressed detection
        this.p1Prev = { up: false, down: false, left: false, right: false, l: false, h: false, s: false, dash: false, menu: false };

        // Double-tap dash & simultaneous throw timestamps (ms)
        this._lastLeftTap = 0;
        this._lastRightTap = 0;
        this._lastLPress = 0;
        this._lastHPress = 0;

        // Motion input history (stores last 24 directional states with timestamps)
        this.inputHistory = [];
        this.maxHistory = 24;

        window.addEventListener('keydown', (e) => {
            if (!e.repeat) {
                this.keys[e.code] = true;
                this.latchedKeys[e.code] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousedown', () => {
            this.pointerLatched = true;
        });

        window.addEventListener('touchstart', () => {
            this.pointerLatched = true;
        }, { passive: true });

        window.addEventListener('blur', () => {
            this.keys = {};
            this.latchedKeys = {};
            this.pointerLatched = false;
        });
    }

    _isKeyActive(code) {
        return Boolean(this.keys[code] || this.latchedKeys[code]);
    }

    update() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp1 = gamepads[0];

        // Save previous states
        this.p1Prev.up = this.p1.up;
        this.p1Prev.down = this.p1.down;
        this.p1Prev.left = this.p1.left;
        this.p1Prev.right = this.p1.right;
        this.p1Prev.l = this.p1.l;
        this.p1Prev.h = this.p1.h;
        this.p1Prev.s = this.p1.s;
        this.p1Prev.dash = this.p1.dash;
        this.p1Prev.menu = this.p1.menu;

        this.p1.left = this._isKeyActive('KeyA') || this._isKeyActive('ArrowLeft') || (gp1 && (gp1.axes[0] < -0.5 || gp1.buttons[14]?.pressed));
        this.p1.right = this._isKeyActive('KeyD') || this._isKeyActive('ArrowRight') || (gp1 && (gp1.axes[0] > 0.5 || gp1.buttons[15]?.pressed));
        this.p1.up = this._isKeyActive('KeyW') || this._isKeyActive('ArrowUp') || (gp1 && (gp1.axes[1] < -0.5 || gp1.buttons[12]?.pressed));
        this.p1.down = this._isKeyActive('KeyS') || this._isKeyActive('ArrowDown') || (gp1 && (gp1.axes[1] > 0.5 || gp1.buttons[13]?.pressed));

        this.p1.l = this._isKeyActive('KeyJ') || this._isKeyActive('Enter') || this._isKeyActive('Space') || (gp1 && (gp1.buttons[0]?.pressed || gp1.buttons[2]?.pressed));
        this.p1.h = this._isKeyActive('KeyK') || (gp1 && (gp1.buttons[1]?.pressed || gp1.buttons[3]?.pressed));
        this.p1.s = this._isKeyActive('KeyL') || (gp1 && gp1.buttons[5]?.pressed);
        this.p1.dash = this._isKeyActive('ShiftLeft') || this._isKeyActive('ShiftRight') || this._isKeyActive('KeyI') || (gp1 && gp1.buttons[4]?.pressed);
        this.p1.menu = this._isKeyActive('Escape') || (gp1 && gp1.buttons[9]?.pressed);

        const pointerJust = this.pointerLatched;

        // Consume latched keys after reading them for this tick
        this.latchedKeys = {};
        this.pointerLatched = false;

        // Just-pressed flags
        this.p1.upJust = this.p1.up && !this.p1Prev.up;
        this.p1.downJust = this.p1.down && !this.p1Prev.down;
        this.p1.leftJust = this.p1.left && !this.p1Prev.left;
        this.p1.rightJust = this.p1.right && !this.p1Prev.right;
        this.p1.lJust = this.p1.l && !this.p1Prev.l;
        this.p1.hJust = this.p1.h && !this.p1Prev.h;
        this.p1.sJust = this.p1.s && !this.p1Prev.s;
        this.p1.dashJust = this.p1.dash && !this.p1Prev.dash;
        this.p1.menuJust = this.p1.menu && !this.p1Prev.menu;
        this.p1.skipJust = this.p1.lJust || this.p1.hJust || this.p1.sJust || this.p1.menuJust || pointerJust;

        // Double-tap Left / Right detection (within 260ms window) & Simultaneous L+H Throw (within 70ms)
        const now = performance.now();
        if (this.p1.lJust) this._lastLPress = now;
        if (this.p1.hJust) this._lastHPress = now;
        this.p1.throwJust = (this.p1.lJust || this.p1.hJust) && Math.abs(this._lastLPress - this._lastHPress) <= 70;

        this.p1.dashLeftJust = false;
        this.p1.dashRightJust = false;
        if (this.p1.leftJust) {
            if (now - this._lastLeftTap < 260) {
                this.p1.dashLeftJust = true;
                this._lastLeftTap = 0;
            } else {
                this._lastLeftTap = now;
            }
        }
        if (this.p1.rightJust) {
            if (now - this._lastRightTap < 260) {
                this.p1.dashRightJust = true;
                this._lastRightTap = 0;
            } else {
                this._lastRightTap = now;
            }
        }

        // Record directional state for motion input detection
        const dir = { up: this.p1.up, down: this.p1.down, right: this.p1.right, left: this.p1.left, t: now };
        this.inputHistory.push(dir);
        if (this.inputHistory.length > this.maxHistory) this.inputHistory.shift();
    }

    /**
     * Check for Quarter-Circle Forward input (↓↘→ or ↓→ on keyboard)
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasQCF(facing) {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 520);
        if (recent.length < 2) return false;

        const fwd = facing === 1 ? 'right' : 'left';
        let foundDown = false;

        for (const h of recent) {
            if (!foundDown && h.down && !h[fwd]) {
                foundDown = true;
            } else if (foundDown && !h.down && h[fwd]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check for Quarter-Circle Back / Hurricane Kick input (↓↙← or ↓←)
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasQCB(facing) {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 520);
        if (recent.length < 2) return false;

        const back = facing === 1 ? 'left' : 'right';
        let foundDown = false;

        for (const h of recent) {
            if (!foundDown && h.down && !h[back]) {
                foundDown = true;
            } else if (foundDown && !h.down && h[back]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check for Dragon Punch / Shoryuken input (→↓↘, →↓→, or ↓↑)
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasDP(facing) {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 540);
        if (recent.length < 2) return false;

        const fwd = facing === 1 ? 'right' : 'left';
        let foundFwd = false;
        let foundDownAfterFwd = false;
        let foundDown = false;

        for (const h of recent) {
            // Classic Shoryuken: Forward -> Down -> Forward/Down-Forward
            if (!foundFwd && h[fwd] && !h.down) {
                foundFwd = true;
            } else if (foundFwd && !foundDownAfterFwd && h.down) {
                foundDownAfterFwd = true;
            } else if (foundDownAfterFwd && h[fwd]) {
                return true;
            }
            // Fast Down -> Up + Punch shortcut
            if (!foundDown && h.down && !h.up) {
                foundDown = true;
            } else if (foundDown && h.up) {
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
