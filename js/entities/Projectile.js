import Hitbox from './Hitbox.js?v=2.37';

export default class Projectile {
    constructor(x, y, facing, owner, img, game) {
        this.x = x;
        this.y = y;
        this.facing = facing;
        this.owner = owner; // 'p1' or 'p2'
        this.img = img; // Custom char_projectile image
        this.game = game; // Settings scope for Shimmer bypass
        this.speed = 950; // A bit faster for visual impact
        this.damage = 30; // High damage so the user notices immediately
        this.pushback = 300;
        this.hitstop = 0.15;
        this.lift = -120;
        this.life = 2.0;
        this.alive = true;
        this.size = 120; // Visual size for draw scaling
        this.time = 0;
        this.vy = 0; // Vertical velocity (used for Supreme Keano's angled projectile)

        // Tight Street Fighter projectile hitbox so jumping/saltoing over fireballs clears cleanly
        this.hitbox = new Hitbox(-44, -32, 88, 64);
        this.trail = [];
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        this.trail.unshift({ x: this.x, y: this.y, t: this.time });
        if (this.trail.length > 7) {
            this.trail.pop();
        }

        this.x += this.speed * this.facing * dt;
        this.y += this.vy * dt; // Apply vertical movement

        // Diagonal air fireballs explode when they strike the arena floor!
        const floorY = (this.game && this.game.height) ? this.game.height * 0.9 : 810;
        if (this.vy > 0 && this.y >= floorY - 16) {
            this.y = floorY - 16;
            this.hitGround = true;
            this.alive = false;
            return;
        }

        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    getHitRect() {
        return {
            x: this.x - this.hitbox.width / 2,
            y: this.y - this.hitbox.height / 2,
            width: this.hitbox.width,
            height: this.hitbox.height,
        };
    }

    getAttackDef() {
        return {
            damage: this.damage,
            pushback: this.pushback,
            hitstop: this.hitstop,
            lift: this.lift,
            type: 'PROJECTILE',
            isOverhead: this.vy > 120 // Diagonal air fireballs hit from above like Street Fighter Zanku Hadoken!
        };
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.save();

        const isP1 = this.owner === 'p1';
        const isAnnikina = this.charId === 'Annikina';
        const isEmely = this.charId === 'Emely' || this.charId === 'HyperEmely';
        const isCayle = this.charId === 'Cayle' || this.charId === 'CayleMinogue';
        const coreColor = isAnnikina ? '#ff6600' : (isEmely ? '#ff66b2' : (isCayle ? '#66f0ff' : (isP1 ? '#00eeff' : '#ff5500')));
        const midRgba = isAnnikina ? '255, 110, 20' : (isEmely ? '255, 110, 190' : (isCayle ? '80, 225, 255' : (isP1 ? '0, 210, 255' : '255, 110, 20')));
        const outerRgba = isAnnikina ? '220, 40, 0' : (isEmely ? '220, 40, 140' : (isCayle ? '20, 150, 255' : (isP1 ? '0, 110, 255' : '220, 30, 0')));
        const hotRgba = isAnnikina ? '255, 240, 180' : (isEmely ? '255, 225, 245' : (isCayle ? '235, 252, 255' : (isP1 ? '210, 250, 255' : '255, 240, 180')));
        const shimmerOn = !this.game || !this.game.settings || this.game.settings.shimmerEnabled !== false;

        ctx.translate(this.x, this.y);

        // Flip horizontally based on facing direction so local +X is always forward
        if (this.facing === -1) {
            ctx.scale(-1, 1);
        }

        // Rotate along diagonal trajectory for angled / airborne fireballs
        if (this.vy !== 0) {
            const angle = Math.atan2(this.vy, this.speed) * 0.85;
            ctx.rotate(angle);
        }

        const drawW = (this.img && (this.img.width || this.img.naturalWidth)) || 100;
        const drawH = (this.img && (this.img.height || this.img.naturalHeight)) || 100;
        const baseW = this.size * 1.5;
        const baseH = (drawH / drawW) * baseW;
        const validImg = this.img && !isNaN(baseH) && baseH > 0 && baseH !== Infinity;

        // Dynamic Street Fighter pulsing scale & forward kinetic stretch
        const pulse = 1.0 + Math.sin(this.time * 34) * 0.065;
        const stretchX = pulse * (1.03 + Math.cos(this.time * 26) * 0.025);
        const stretchY = pulse * (0.98 - Math.cos(this.time * 26) * 0.02);
        const w = baseW * stretchX;
        const h = (validImg ? baseH : baseW) * stretchY;
        const auraRadius = Math.max(w, h) * 0.62;

        if (shimmerOn) {
            ctx.globalCompositeOperation = 'screen';

            // 1. High-energy comet tail extending behind the projectile (-X in local space)
            const tailSegments = 6;
            for (let i = tailSegments; i >= 1; i--) {
                const frac = i / tailSegments;
                const tailX = -i * (w * 0.14);
                const waveY = Math.sin(this.time * 28 - i * 0.85) * (5 * frac);
                const segRadius = auraRadius * (0.72 * (1 - frac * 0.68));
                const tailGrad = ctx.createRadialGradient(tailX, waveY, segRadius * 0.05, tailX, waveY, segRadius);
                const alpha = (1 - frac * 0.75) * 0.38;
                tailGrad.addColorStop(0, `rgba(${hotRgba}, ${alpha * 1.1})`);
                tailGrad.addColorStop(0.45, `rgba(${midRgba}, ${alpha * 0.75})`);
                tailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = tailGrad;
                ctx.beginPath();
                ctx.arc(tailX, waveY, segRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Smooth radial outer aura glow (100% circular falloff to zero alpha, never a box)
            const auraGrad = ctx.createRadialGradient(0, 0, auraRadius * 0.08, 0, 0, auraRadius * 1.15);
            auraGrad.addColorStop(0, `rgba(${hotRgba}, 0.52)`);
            auraGrad.addColorStop(0.4, `rgba(${midRgba}, 0.34)`);
            auraGrad.addColorStop(0.75, `rgba(${outerRgba}, 0.14)`);
            auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(0, 0, auraRadius * 1.15, 0, Math.PI * 2);
            ctx.fill();

            // 3. Pulsing shockwave / vortex energy rings around the projectile wake
            for (let rIdx = 0; rIdx < 2; rIdx++) {
                const phase = (this.time * 5.5 + rIdx * 0.5) % 1;
                const ringX = -w * (0.08 + phase * 0.42);
                const ringRx = auraRadius * (0.22 + phase * 0.18);
                const ringRy = auraRadius * (0.52 + (1 - phase) * 0.22);
                const ringAlpha = (1 - phase) * 0.45;

                ctx.strokeStyle = `rgba(${hotRgba}, ${ringAlpha})`;
                ctx.lineWidth = 2.5 * (1 - phase * 0.5);
                ctx.beginPath();
                ctx.ellipse(ringX, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 4. High-speed plasma spark streaks in the wake
            ctx.lineCap = 'round';
            for (let s = 0; s < 4; s++) {
                const sPhase = (this.time * 9 + s * 0.25) % 1;
                const sx = -w * (0.1 + sPhase * 0.65);
                const sy = ((s % 2 === 0 ? 1 : -1) * (0.18 + (s * 0.09))) * h + Math.sin(this.time * 20 + s) * 6;
                const len = w * (0.16 * (1 - sPhase * 0.5));
                ctx.strokeStyle = `rgba(${hotRgba}, ${(1 - sPhase) * 0.55})`;
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - len, sy);
                ctx.stroke();
            }
        }

        if (validImg) {
            // Additive silhouette bloom pass behind the sprite
            if (shimmerOn) {
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.45;
                ctx.shadowColor = coreColor;
                ctx.shadowBlur = 28;
                ctx.drawImage(this.img, -w * 0.53, -h * 0.53, w * 1.06, h * 1.06);
            }

            // Crisp foreground projectile sprite pass
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.shadowColor = coreColor;
            ctx.shadowBlur = 18;
            ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
        } else {
            // Fallback radial plasma sphere if image failed to load (never a rectangle)
            ctx.globalCompositeOperation = 'screen';
            const fbGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 48);
            fbGrad.addColorStop(0, '#ffffff');
            fbGrad.addColorStop(0.45, coreColor);
            fbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = fbGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 48, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
