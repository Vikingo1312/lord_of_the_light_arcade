export default class CaesarSplash {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.duration = 7.0;
    }

    enter() {
        this.time = 0;
        this.logo = this.game.assetManager.images['caesar_logo'];

        // Play a subtle crystal chime
        try {
            this.game.audioManager._initWebAudio();
            // Resume AudioContext if suspended (mobile Safari/Chrome)
            if (this.game.audioManager.audioCtx && this.game.audioManager.audioCtx.state === 'suspended') {
                this.game.audioManager.audioCtx.resume();
            }
            this._playChime();
        } catch (e) {
            console.warn('Splash audio failed:', e);
        }
    }

    exit() { }

    _playChime() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;

        // Single clean bell tone — like a crystal ping
        [1318.5, 1760, 2637].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i * 0.15);
            gain.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 1.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 1.5);
        });
    }

    update(dt) {
        this.time += dt;
        const p1 = this.game.inputManager.p1;
        if (p1.lJust || p1.hJust || p1.sJust) {
            this.time = this.duration;
        }
        if (this.time >= this.duration) {
            this.game.stateManager.switchState('Menu');
        }
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;

        // Reset any shadows left over from Boot state
        ctx.shadowBlur = 0;

        // Pure black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        if (!this.logo) return;

        // Slow, cinematic fade: in 0-1.5s, hold 1.5-5.5s, out 5.5-7s
        let alpha = 0;
        if (this.time < 1.5) alpha = this.time / 1.5;
        else if (this.time < 5.5) alpha = 1;
        else alpha = Math.max(0, 1 - (this.time - 5.5) / 1.5);

        // Draw logo centered
        const logoW = this.logo.naturalWidth;
        const logoH = this.logo.naturalHeight;
        const scale = (w * 0.55) / logoW;
        const fw = logoW * scale;
        const fh = logoH * scale;

        ctx.globalAlpha = alpha;
        ctx.drawImage(this.logo, (w - fw) / 2, (h - fh) / 2, fw, fh);



        ctx.globalAlpha = 1;
    }
}
