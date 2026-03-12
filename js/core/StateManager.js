export default class StateManager {
    constructor(game) {
        this.game = game;
        this.states = {};
        this.currentState = null;

        // Simple fade-in overlay (no blocking fade-out)
        this.fadeAlpha = 0;
        this.fadeSpeed = 3.0;
    }

    addState(key, stateInstance) {
        this.states[key] = stateInstance;
    }

    switchState(key, data = null) {
        if (!this.states[key]) {
            console.error(`State [${key}] does not exist.`);
            return;
        }

        // Exit old state
        if (this.currentState && this.currentState.exit) {
            this.currentState.exit();
        }

        // Enter new state immediately
        this.currentState = this.states[key];
        if (this.currentState.enter) {
            this.currentState.enter(data);
        }

        // Start a quick fade-in from black
        this.fadeAlpha = 1;
    }

    update(dt) {
        // Fade-in effect (from black to clear)
        if (this.fadeAlpha > 0) {
            this.fadeAlpha = Math.max(0, this.fadeAlpha - this.fadeSpeed * dt);
        }

        if (this.currentState && this.currentState.update) {
            this.currentState.update(dt);
        }
    }

    draw(ctx) {
        if (this.currentState && this.currentState.draw) {
            this.currentState.draw(ctx);
        }

        // Fade overlay
        if (this.fadeAlpha > 0.01) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }
    }
}
