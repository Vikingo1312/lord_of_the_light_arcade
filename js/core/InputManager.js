export default class InputManager {
    constructor() {
        this.keys = {};
        this.latchedKeys = {};
        this.pointerLatched = false;

        // P1 & P2 Buffer objects for input reading
        this.p1 = {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false, dash: false, guard: false, menu: false,
            skipJust: false, dashLeftJust: false, dashRightJust: false, dashJust: false
        };
        this.p2 = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        // Just-pressed detection
        this.p1Prev = { up: false, down: false, left: false, right: false, l: false, h: false, s: false, dash: false, guard: false, menu: false };

        // Double-tap dash & simultaneous throw/rush timestamps (ms)
        this._lastLeftTap = 0;
        this._lastRightTap = 0;
        this._lastLPress = 0;
        this._lastHPress = 0;
        this._lastSPress = 0;

        // Motion input history (stores last 32 directional states with timestamps)
        this.inputHistory = [];
        this.maxHistory = 32;

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
        const gp1 = gamepads[0] || gamepads[1] || null;

        // Save previous states
        this.p1Prev.up = this.p1.up;
        this.p1Prev.down = this.p1.down;
        this.p1Prev.left = this.p1.left;
        this.p1Prev.right = this.p1.right;
        this.p1Prev.l = this.p1.l;
        this.p1Prev.h = this.p1.h;
        this.p1Prev.s = this.p1.s;
        this.p1Prev.dash = this.p1.dash;
        this.p1Prev.guard = this.p1.guard;
        this.p1Prev.menu = this.p1.menu;

        this.p1.left = this._isKeyActive('KeyA') || this._isKeyActive('ArrowLeft') || Boolean(gp1 && (gp1.axes[0] < -0.38 || gp1.buttons[14]?.pressed));
        this.p1.right = this._isKeyActive('KeyD') || this._isKeyActive('ArrowRight') || Boolean(gp1 && (gp1.axes[0] > 0.38 || gp1.buttons[15]?.pressed));
        this.p1.up = this._isKeyActive('KeyW') || this._isKeyActive('ArrowUp') || Boolean(gp1 && (gp1.axes[1] < -0.38 || gp1.buttons[12]?.pressed));
        this.p1.down = this._isKeyActive('KeyS') || this._isKeyActive('ArrowDown') || Boolean(gp1 && (gp1.axes[1] > 0.38 || gp1.buttons[13]?.pressed));

        this.p1.l = this._isKeyActive('KeyJ') || this._isKeyActive('Enter') || this._isKeyActive('Space') || Boolean(gp1 && (gp1.buttons[0]?.pressed || gp1.buttons[2]?.pressed));
        this.p1.h = this._isKeyActive('KeyK') || Boolean(gp1 && (gp1.buttons[1]?.pressed || gp1.buttons[3]?.pressed));
        this.p1.s = this._isKeyActive('KeyL') || this._isKeyActive('KeyU') || Boolean(gp1 && (gp1.buttons[5]?.pressed || gp1.buttons[7]?.pressed));
        this.p1.dash = this._isKeyActive('ShiftLeft') || this._isKeyActive('ShiftRight') || this._isKeyActive('KeyI') || Boolean(gp1 && gp1.buttons[4]?.pressed);
        this.p1.guard = this._isKeyActive('KeyB') || this._isKeyActive('ShiftLeft') || this._isKeyActive('ShiftRight') || Boolean(gp1 && (gp1.buttons[6]?.pressed || gp1.buttons[4]?.pressed));
        this.p1.menu = this._isKeyActive('Escape') || Boolean(gp1 && (gp1.buttons[9]?.pressed || gp1.buttons[8]?.pressed));

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

        // Simultaneous L+H Throw / J+L or K+L Full-Screen Rush (within 105ms window for controllers & keyboards)
        const now = performance.now();
        if (this.p1.lJust) this._lastLPress = now;
        if (this.p1.hJust) this._lastHPress = now;
        if (this.p1.sJust) this._lastSPress = now;
        this.p1.throwJust = (this.p1.lJust || this.p1.hJust) && Math.abs(this._lastLPress - this._lastHPress) <= 105;
        this.p1.specialRushJust = (this.p1.lJust && this.p1.s) || (this.p1.sJust && this.p1.l) || (this.p1.hJust && this.p1.s) || (this.p1.sJust && this.p1.h)
            || ((this.p1.lJust || this.p1.hJust || this.p1.sJust) && (Math.abs(this._lastLPress - this._lastSPress) <= 105 || Math.abs(this._lastHPress - this._lastSPress) <= 105));

        this.p1.dashLeftJust = false;
        this.p1.dashRightJust = false;
        if (this.p1.leftJust) {
            if (now - this._lastLeftTap < 240) {
                this.p1.dashLeftJust = true;
                this._lastLeftTap = 0;
            } else {
                this._lastLeftTap = now;
            }
        }
        if (this.p1.rightJust) {
            if (now - this._lastRightTap < 240) {
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
     * Check for Quarter-Circle Forward input (↓↘→ or ↓→ on keyboard/controller/touch)
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasQCF(facing) {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 650);
        if (recent.length < 2) return false;

        const fwd = facing === 1 ? 'right' : 'left';
        let foundDown = false;

        for (const h of recent) {
            if (!foundDown && h.down) {
                foundDown = true;
            } else if (foundDown && h[fwd]) {
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
        const recent = this.inputHistory.filter(h => (now - h.t) < 650);
        if (recent.length < 2) return false;

        const back = facing === 1 ? 'left' : 'right';
        let foundDown = false;

        for (const h of recent) {
            if (!foundDown && h.down) {
                foundDown = true;
            } else if (foundDown && h[back]) {
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
        const recent = this.inputHistory.filter(h => (now - h.t) < 650);
        if (recent.length < 2) return false;

        const fwd = facing === 1 ? 'right' : 'left';
        let foundFwd = false;
        let foundDownAfterFwd = false;
        let foundDown = false;

        for (const h of recent) {
            // Classic Shoryuken: Forward -> Down -> Forward/Down-Forward
            if (!foundFwd && h[fwd]) {
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

    /**
     * Check for Back -> Forward (← →) E. Honda / Blanka / Bison horizontal torpedo motion within 650ms
     * @param {number} facing - 1 for right-facing, -1 for left-facing
     */
    hasBackForward(facing) {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 650);
        if (recent.length < 2) return false;

        const back = facing === 1 ? 'left' : 'right';
        const fwd = facing === 1 ? 'right' : 'left';
        let foundBack = false;

        for (const h of recent) {
            if (!foundBack && h[back] && !h[fwd]) {
                foundBack = true;
            } else if (foundBack && h[fwd] && !h[back]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check for Down -> Up (↓ ↑) Chun-Li / Guile vertical charge motion within 650ms
     */
    hasDownUp() {
        const now = performance.now();
        const recent = this.inputHistory.filter(h => (now - h.t) < 650);
        if (recent.length < 2) return false;

        let foundDown = false;
        for (const h of recent) {
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
