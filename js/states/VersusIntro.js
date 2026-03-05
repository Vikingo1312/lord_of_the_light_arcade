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
    }

    enter(data) {
        this.time = 0;
        this.combatData = data;
        this.p1Data = data.p1;
        this.p2Data = data.p2;
        this.stageNum = data.arcadeIndex || 1;
        this._advanced = false;
    }

    exit() { }

    update(dt) {
        this.time += dt;
        if (this._advanced) return;
        const p1 = this.game.inputManager.p1;

        if (this.time > 4 || (this.time > 1.5 && (p1.lJust || p1.hJust || p1.sJust))) {
            this._advanced = true;
            this.game.stateManager.switchState('Combat', this.combatData);
        }
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;

        // Deep dark background with subtle cosmic gradient
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#050015');
        grad.addColorStop(0.5, '#0a0030');
        grad.addColorStop(1, '#050015');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Animated energy lines
        const t = this.time;
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = i % 2 === 0 ? '#00ffff' : '#8855ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const yy = (h * 0.3) + Math.sin(t * 1.5 + i) * 50 + i * 30;
            ctx.moveTo(0, yy);
            ctx.lineTo(w, yy + Math.sin(t * 2 + i * 0.5) * 40);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // ─── STAGE NUMBER ───
        const stageIn = Math.min(1, this.time / 0.8);
        ctx.globalAlpha = stageIn;
        ctx.textAlign = 'center';
        ctx.font = '600 28px "Outfit"';
        ctx.fillStyle = '#888';
        ctx.fillText(`STAGE ${this.stageNum}`, w / 2, 80);

        // ─── P1 PORTRAIT (left side) ───
        const slideIn = Math.min(1, this.time / 0.6);
        const p1X = -400 + slideIn * 400 + w * 0.15;

        const p1Img = this.game.assetManager.images[`${this.p1Data.id}_front.png`];
        if (p1Img) {
            const scale = 500 / p1Img.naturalHeight;
            const dw = p1Img.naturalWidth * scale;
            const dh = p1Img.naturalHeight * scale;
            ctx.save();
            ctx.globalAlpha = slideIn;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 20 + Math.sin(t * 3) * 10;
            ctx.drawImage(p1Img, p1X - dw / 2, h * 0.2, dw, dh);
            ctx.restore();
        }

        // P1 Name
        ctx.globalAlpha = slideIn;
        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.fillText(this.p1Data.name, p1X, h * 0.85);
        ctx.shadowBlur = 0;

        // ─── P2 PORTRAIT (right side, slides from right) ───
        const p2X = w + 400 - slideIn * 400 - w * 0.15;

        const p2Img = this.game.assetManager.images[`${this.p2Data.id}_front.png`];
        if (p2Img) {
            const scale = 500 / p2Img.naturalHeight;
            const dw = p2Img.naturalWidth * scale;
            const dh = p2Img.naturalHeight * scale;
            ctx.save();
            ctx.globalAlpha = slideIn;
            ctx.shadowColor = '#ff4466';
            ctx.shadowBlur = 20 + Math.sin(t * 3 + 1) * 10;
            ctx.drawImage(p2Img, p2X - dw / 2, h * 0.2, dw, dh);
            ctx.restore();
        }

        // P2 Name
        ctx.globalAlpha = slideIn;
        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillStyle = '#ff4466';
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur = 15;
        ctx.fillText(this.p2Data.name, p2X, h * 0.85);
        ctx.shadowBlur = 0;

        // ─── VS TEXT (center, dramatic) ───
        const vsIn = Math.max(0, Math.min(1, (this.time - 0.3) / 0.5));
        const vsScale = 1 + (1 - vsIn) * 2; // Starts big, shrinks to normal

        ctx.save();
        ctx.globalAlpha = vsIn;
        ctx.translate(w / 2, h / 2);
        ctx.scale(vsScale, vsScale);
        ctx.font = 'bold 120px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.shadowColor = '#fdbf00';
        ctx.shadowBlur = 40;
        ctx.textAlign = 'center';
        ctx.fillText('VS', 0, 30);
        ctx.shadowBlur = 60;
        ctx.fillText('VS', 0, 30);
        ctx.restore();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}
