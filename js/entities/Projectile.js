import Hitbox from './Hitbox.js';

export default class Projectile {
    constructor(x, y, facing, owner) {
        this.x = x;
        this.y = y;
        this.facing = facing;
        this.owner = owner; // 'p1' or 'p2'
        this.speed = 650;
        this.damage = 15;
        this.pushback = 220;
        this.hitstop = 0.12;
        this.lift = -120;
        this.life = 2.0;
        this.alive = true;
        this.size = 50; // Much bigger (was 30)
        this.time = 0;

        // Energy trail history
        this.trail = [];
        this.maxTrail = 12;

        // Hitbox centered on projectile
        this.hitbox = new Hitbox(-30, -30, 60, 60);
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        // Record trail position
        this.trail.unshift({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > this.maxTrail) this.trail.pop();
        // Fade trail
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].alpha = 1 - (i / this.maxTrail);
        }

        this.x += this.speed * this.facing * dt;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }

    getHitRect() {
        return {
            x: this.x - this.size / 2,
            y: this.y - this.size / 2,
            w: this.size,
            h: this.size,
        };
    }

    getAttackDef() {
        return {
            damage: this.damage,
            pushback: this.pushback,
            hitstop: this.hitstop,
            lift: this.lift,
        };
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.save();

        const isP1 = this.owner === 'p1';
        const coreColor = isP1 ? '#00ddff' : '#ff4400';
        const glowColor = isP1 ? '#0088cc' : '#cc2200';
        const pulse = 1 + Math.sin(this.time * 15) * 0.15;
        const sz = this.size * pulse;

        // Draw energy trail
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const t = this.trail[i];
            const trailSize = sz * (1 - i / this.maxTrail) * 0.6;
            ctx.globalAlpha = t.alpha * 0.4;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Core energy ball — outer glow
        ctx.globalAlpha = 0.6;
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = 40;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, sz, 0, Math.PI * 2);
        ctx.fill();

        // Core energy ball — inner bright
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 25;
        const gradient = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, sz * 0.6);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, coreColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, sz * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Sparks around the projectile
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < 4; i++) {
            const angle = this.time * 8 + (i * Math.PI / 2);
            const sparkX = this.x + Math.cos(angle) * sz * 0.7;
            const sparkY = this.y + Math.sin(angle) * sz * 0.7;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sparkX - 2, sparkY - 2, 4, 4);
        }

        ctx.restore();
    }
}
