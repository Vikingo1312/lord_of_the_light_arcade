import StateManager from './StateManager.js';
import InputManager from './InputManager.js';
import AssetManager from './AssetManager.js';
import AudioManager from './AudioManager.js';
import TouchPad from './TouchPad.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });

        this.width = canvas.width;
        this.height = canvas.height;

        this.stateManager = new StateManager(this);
        this.inputManager = new InputManager();
        this.assetManager = new AssetManager();
        this.audioManager = new AudioManager();
        this.touchPad = new TouchPad(this);

        // Game settings (modified by Options menu)
        this.settings = {
            timer: 99,
            speed: 1.0,
            difficulty: 'NORMAL',
            musicVolume: 0.5,
            voiceVolume: 0.9,
            sfxVolume: 0.5,
        };

        this.lastTime = 0;
        this.accumulator = 0;
        this.fps = 60;
        this.timestep = 1000 / this.fps;
        this.isRunning = false;

        this.loop = this.loop.bind(this);
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop);
        }
    }

    pause() {
        this.isRunning = false;
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        try {
            let frameTime = timestamp - this.lastTime;
            this.lastTime = timestamp;

            if (frameTime > 250) frameTime = 250;

            this.accumulator += frameTime;

            this.inputManager.update();
            this.touchPad.injectInput(this.inputManager);

            while (this.accumulator >= this.timestep) {
                const dt = this.timestep / 1000;
                this.stateManager.update(dt);
                this.accumulator -= this.timestep;
            }

            this.ctx.clearRect(0, 0, this.width, this.height);
            this.stateManager.draw(this.ctx);
            this.touchPad.draw(this.ctx);
            this._lastError = null;
        } catch (e) {
            console.error('Game loop error:', e);
            this._lastError = e;
        }

        // Draw error on-screen if one occurred
        if (this._lastError) {
            this.ctx.fillStyle = 'rgba(200,0,0,0.85)';
            this.ctx.fillRect(10, 10, this.width - 20, 80);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('❌ GAME ERROR: ' + this._lastError.message, 30, 45);
            this.ctx.fillText('📍 ' + (this._lastError.stack || '').split('\n')[1]?.trim() || '', 30, 72);
        }

        requestAnimationFrame(this.loop);
    }
}
