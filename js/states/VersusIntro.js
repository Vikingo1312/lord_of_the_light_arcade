/**
 * VersusIntro — "STAGE X — VS" screen shown before each fight.
 * Shows both fighters' portraits (front card images) with names,
 * stage number, and a dramatic VS splash.
 * Auto-advances to Combat after ~4 seconds or on button press.
 */
export default class VersusIntro {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.combatData = null;
        this.p1Data = null;
        this.p2Data = null;
        this.stageNum = 1;
        this.particles = [];

        // Pre-generate 150 particles for the background
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: Math.random() * game.width,
                y: Math.random() * game.height,
                vy: Math.random() * -15 - 5,
                vx: Math.random() * 4 - 2,
                size: Math.random() * 8 + 2,
                alpha: Math.random() * 0.8 + 0.2,
                color: Math.random() > 0.5 ? '#ff2255' : '#00ffff'
            });
        }
    }

    enter(data) {
        this.time = 0;
        this.combatData = data;
        this.p1Data = data.p1;
        this.allyData = data.ally || null;
        this.p2Data = data.p2;
        this.stageNum = data.arcadeIndex || 1;
        this._advanced = false;
        this.loaded = false;
        this.loadingTimer = 0;
        this.loadProgress = 0;

        this.game.assetManager.loadAll((pct) => {
            this.loadProgress = pct;
        }).then(() => {
            this.loaded = true;
        });
    }

    exit() { }

    update(dt) {
        if (!this.loaded) {
            this.loadingTimer += dt;
            return;
        }

        this.time += dt;
        if (this._advanced) return;
        const p1 = this.game.inputManager.p1;
        const net = this.game.networkManager;
        const remoteSkip = (net && net.active && net.role === 'host') ? net.consumeRemoteInput().skipJust : false;

        if (net && net.active && net.role === 'guest') {
            // Guest waits for Host STATE_SWITCH, with a 6.0s fallback
            if (this.time > 6.0) {
                this._advanced = true;
                this.game.stateManager.switchState('Combat', this.combatData);
            }
            return;
        }

        if (this.time > 4 || (this.time > 0.2 && (p1.skipJust || remoteSkip))) {
            this._advanced = true;
            if (net && net.active && net.role === 'host') {
                net.send({
                    type: 'STATE_SWITCH',
                    stateName: 'Combat',
                    stateData: this.combatData
                });
            }
            this.game.stateManager.switchState('Combat', this.combatData);
        }
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;

        if (!this.loaded) {
            ctx.fillStyle = '#0a0022';
            ctx.fillRect(0, 0, w, h);
            
            for (const p of this.particles) {
                p.x += p.vx * 0.2; p.y += p.vy * 0.2; 
                if (p.y < -20) p.y = h + 20;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            }
            ctx.globalAlpha = 1;

            ctx.globalAlpha = 0.5 + Math.sin(this.loadingTimer * 4) * 0.5;
            ctx.fillStyle = '#00ffff';
            ctx.font = '24px "Press Start 2P"';
            ctx.textAlign = 'right';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;
            ctx.fillText(`LOADING ASSETS... ${Math.floor(this.loadProgress * 100)}%`, w - 30, h - 30);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            return;
        }

        const t = this.time;

        // Visual Shake impact on VS slam (at 0.5s)
        let shakeX = 0;
        let shakeY = 0;
        if (t >= 0.5 && t < 0.7) {
            const intensity = (0.7 - t) * 100;
            shakeX = (Math.random() - 0.5) * intensity;
            shakeY = (Math.random() - 0.5) * intensity;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Split Background (P1 Cyan, P2 Red)
        ctx.fillStyle = '#0a0022';
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'screen';
        const p1Grad = ctx.createLinearGradient(0, 0, w * 0.7, 0);
        p1Grad.addColorStop(0, 'rgba(0, 255, 255, 0.4)'); p1Grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = p1Grad; ctx.fillRect(0, 0, w / 2 + 50, h);

        const p2Grad = ctx.createLinearGradient(w, 0, w * 0.3, 0);
        p2Grad.addColorStop(0, 'rgba(255, 0, 85, 0.4)'); p2Grad.addColorStop(1, 'rgba(255, 0, 85, 0)');
        ctx.fillStyle = p2Grad; ctx.fillRect(w / 2 - 50, 0, w / 2 + 50, h);

        ctx.globalCompositeOperation = 'source-over';

        // Animate background particles upward
        for (const p of this.particles) {
            p.x += p.vx; p.y += p.vy;
            if (p.y < -20) p.y = h + 20;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha * Math.min(1, t / 0.5);
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // ─── STAGE NUMBER ───
        const stageIn = Math.min(1, t / 0.4);
        ctx.globalAlpha = stageIn;
        ctx.textAlign = 'center';
        ctx.font = '800 32px "Outfit"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.fillText(`STAGE ${this.stageNum}`, w / 2, 80);
        ctx.shadowBlur = 0;

        // ─── P1 (+ CO-OP ALLY) PORTRAIT (Slides in aggressive from left) ───
        // Uses easeOutExpo for a fast snap
        const easeSnap = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
        const p1Slide = easeSnap(Math.min(1, t / 0.6));
        const p1X = -500 + p1Slide * 500 + (this.allyData ? w * 0.14 : w * 0.18);

        if (this.allyData) {
            const allyImg = this.game.assetManager.images[`${this.allyData.id}_front.png`];
            if (allyImg && allyImg.naturalHeight) {
                const scale = 470 / allyImg.naturalHeight;
                const dw = allyImg.naturalWidth * scale;
                const dh = allyImg.naturalHeight * scale;
                ctx.save();
                ctx.globalAlpha = p1Slide * 0.92;
                ctx.shadowColor = '#bb55ff';
                ctx.shadowBlur = 25;
                ctx.drawImage(allyImg, (p1X + 195) - dw / 2, h * 0.28, dw, dh);
                ctx.restore();
            }
        }

        const p1Img = this.game.assetManager.images[`${this.p1Data.id}_front.png`];
        if (p1Img) {
            const scale = (this.allyData ? 510 : 550) / p1Img.naturalHeight;
            const dw = p1Img.naturalWidth * scale;
            const dh = p1Img.naturalHeight * scale;
            ctx.save();
            ctx.globalAlpha = p1Slide;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 30 + Math.sin(t * 10) * 15;
            ctx.drawImage(p1Img, p1X - dw / 2, h * 0.25, dw, dh);
            ctx.restore();
        }

        // P1 Name
        ctx.globalAlpha = p1Slide;
        ctx.font = this.allyData ? 'bold 30px "Press Start 2P"' : 'bold 44px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        const leftName = this.allyData
            ? `${this.p1Data.name.toUpperCase()} & ${this.allyData.name.toUpperCase()}`
            : this.p1Data.name.toUpperCase();
        ctx.fillText(leftName, 50, h - 60);

        // ─── P2 PORTRAIT (Slides in aggressive from right) ───
        const p2Slide = easeSnap(Math.min(1, Math.max(0, t - 0.2) / 0.6)); // Slight delay
        const p2X = w + 500 - p2Slide * 500 - w * 0.18;

        const p2Img = this.game.assetManager.images[`${this.p2Data.id}_front.png`];
        if (p2Img) {
            const scale = 550 / p2Img.naturalHeight;
            const dw = p2Img.naturalWidth * scale;
            const dh = p2Img.naturalHeight * scale;
            ctx.save();
            ctx.globalAlpha = p2Slide;
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 30 + Math.sin(t * 10 + 2) * 15;

            // Hack for JJ Dark: his portrait natively faces right, but P2 needs to face left
            if (this.p2Data.id === 'JJDark') {
                ctx.translate(p2X, h * 0.25);
                ctx.scale(-1, 1);
                ctx.drawImage(p2Img, -dw / 2, 0, dw, dh);
            } else {
                ctx.drawImage(p2Img, p2X - dw / 2, h * 0.25, dw, dh);
            }
            ctx.restore();
        }

        // P2 Name
        ctx.globalAlpha = p2Slide;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ff0055';
        ctx.fillText(this.p2Data.name.toUpperCase(), w - 50, h - 60);
        ctx.shadowBlur = 0;

        // ─── IMPACT VS TEXT ───
        if (t >= 0.5) {
            const vsIn = Math.min(1, (t - 0.5) / 0.2);
            // Starts huge (3x) and slams into place
            const vsScale = 1 + Math.pow(1 - vsIn, 3) * 4;

            ctx.save();
            ctx.globalAlpha = Math.min(1, vsIn * 2);
            ctx.translate(w / 2, h / 2);
            ctx.scale(vsScale, vsScale);
            // Shake effect on the text itself
            const tx = vsIn < 1 ? (Math.random() - 0.5) * 10 : 0;
            const ty = vsIn < 1 ? (Math.random() - 0.5) * 10 : 0;

            ctx.font = 'bold 130px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#fdbf00';
            ctx.shadowBlur = 40;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillText('VS', tx, ty);
            ctx.shadowBlur = 80;
            ctx.fillText('VS', tx, ty);
            ctx.restore();
            ctx.shadowBlur = 0;
        }

        // Screen Flash on slam
        if (t >= 0.5 && t < 0.6) {
            ctx.fillStyle = `rgba(255,255,255,${1 - ((t - 0.5) * 10)})`;
            ctx.fillRect(0, 0, w, h);
        }

        ctx.restore();
    }
}
