import StateManager from './StateManager.js?v=2.51';
import InputManager from './InputManager.js?v=2.51';
import AssetManager from './AssetManager.js?v=2.51';
import AudioManager from './AudioManager.js?v=2.51';
import TouchPad from './TouchPad.js?v=2.51';
import NetworkManager from './NetworkManager.js?v=2.51';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });

        this.width = canvas.width;
        this.height = canvas.height;

        // Game settings (modified by Options / Sound-Mischpult menu)
        let savedSettings = {};
        try {
            const raw = localStorage.getItem('lotl_settings');
            if (raw) savedSettings = JSON.parse(raw) || {};
        } catch (e) { }

        // Migrate old uncalibrated audio mix to v3 Street Fighter Studio Mix
        const isMixV3 = savedSettings.mixVersion === 3;

        this.settings = {
            mixVersion: 3,
            timer: savedSettings.timer || 99,
            speed: savedSettings.speed || 1.0,
            difficulty: savedSettings.difficulty || 'NORMAL',
            masterVolume: isMixV3 ? (savedSettings.masterVolume ?? 1.0) : 1.0,
            musicVolume: isMixV3 ? (savedSettings.musicVolume ?? 0.22) : 0.22,
            sfxVolume: isMixV3 ? (savedSettings.sfxVolume ?? 0.90) : 0.90,
            voiceVolume: isMixV3 ? (savedSettings.voiceVolume ?? 1.00) : 1.00,
            announcerVolume: isMixV3 ? (savedSettings.announcerVolume ?? 0.95) : 0.95,

            // Effect Bypass Flags — set to false to disable
            chromaKeyEnabled: false,  // Sprites are already transparent — DO NOT process!
            hitFlashEnabled: true,    // White flash on hit
            bgmFilterEnabled: savedSettings.bgmFilterEnabled ?? true, // Auto-duck BGM during voiceover
            autoFacingEnabled: true,  // Auto-mirror sprites based on position
        };

        this.stateManager = new StateManager(this);
        this.inputManager = new InputManager();
        this.assetManager = new AssetManager(this);
        this.audioManager = new AudioManager(this);
        this.touchPad = new TouchPad(this);
        this.networkManager = new NetworkManager(this);

        this.saveSettings();

        this.lastTime = 0;
        this.accumulator = 0;
        this.fps = 60;
        this.timestep = 1000 / this.fps;
        this.isRunning = false;

        this.loop = this.loop.bind(this);
    }

    saveSettings() {
        try {
            localStorage.setItem('lotl_settings', JSON.stringify(this.settings));
        } catch (e) { }
        if (this.audioManager && typeof this.audioManager.applyMixerSettings === 'function') {
            this.audioManager.applyMixerSettings();
        }
    }

    resetAudioMixDefaults() {
        this.settings.mixVersion = 3;
        this.settings.masterVolume = 1.00;
        this.settings.musicVolume = 0.22;
        this.settings.sfxVolume = 0.90;
        this.settings.voiceVolume = 1.00;
        this.settings.announcerVolume = 0.95;
        this.settings.bgmFilterEnabled = true;
        this.saveSettings();
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

            while (this.accumulator >= this.timestep) {
                this.inputManager.update();
                this.touchPad.injectInput(this.inputManager);

                const speedMul = (this.settings && this.settings.speed) ? this.settings.speed : 1.0;
                const dt = (this.timestep / 1000) * speedMul;
                if (this.networkManager) {
                    this.networkManager.update(dt);
                }
                this.stateManager.update(dt);
                this.accumulator -= this.timestep;
            }

            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.width, this.height);
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
