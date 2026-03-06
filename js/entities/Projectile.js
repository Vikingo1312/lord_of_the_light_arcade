import Hitbox from './Hitbox.js';

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

        // Hitbox enlarged to ensure reliable collision
        this.hitbox = new Hitbox(-50, -50, 100, 100);
    }

    update(dt) {
        if (!this.alive) return;
        this.time += dt;

        this.x += this.speed * this.facing * dt;
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
        };
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.save();

        const isP1 = this.owner === 'p1';
        const coreColor = isP1 ? '#00ddff' : '#ff4400';

        // Add a subtle glow behind the projectile
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = 30;

        // Draw the custom projectile image if it exists
        if (this.img) {
            ctx.translate(this.x, this.y);

            // Flip the projectile image depending on facing direction
            if (this.facing === -1) {
                ctx.scale(-1, 1);
            }

            // Draw it centered and scaled
            // Fallback to width/height properties, defaulting to a 1:1 aspect ratio if Safari memory drops the properties
            const drawW = this.img.width || this.img.naturalWidth || 100;
            const drawH = this.img.height || this.img.naturalHeight || 100;

            const w = this.size * 1.5;
            const h = (drawH / drawW) * w;

            if (isNaN(h) || h === 0 || h === Infinity) {
                // Failsafe rendering if the image data is completely broken
                ctx.fillStyle = coreColor;
                ctx.fillRect(-w / 2, -w / 2, w, w);
            } else {
                // --- SHIMMER EFFECT (Behind the Image) ---
                if (!this.game || !this.game.settings || this.game.settings.shimmerEnabled !== false) {
                    ctx.globalCompositeOperation = 'lighter';
                    const flicker = 0.1 + Math.random() * 0.15;
                    ctx.fillStyle = isP1 ? `rgba(0, 200, 255, ${flicker})` : `rgba(255, 100, 0, ${flicker})`;
                    ctx.fillRect(-w * 0.6, -h * 0.6, w * 1.2, h * 1.2);
                    ctx.globalCompositeOperation = 'source-over';
                }

                // Draw the actual Custom Projectile over the glow
                ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
            }
        } else {
            // Backup generic energy ball if image failed to load
            ctx.globalAlpha = 1;
            ctx.fillStyle = coreColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
