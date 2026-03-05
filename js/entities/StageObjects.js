/**
 * StageObjects — Destructible arena props (Street Fighter style)
 * Uses real PNG images from assets/props/ folder.
 * Each object has intact + broken version.
 * Objects break into particles when a fighter is knocked into them.
 */

// Map stage to themed objects with real image assets
const STAGE_OBJECTS = {
    'Cosmic': [
        { x: 300, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 1620, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 450, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Japan': [
        { x: 280, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 1640, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 420, y: 0.85, w: 120, h: 100, img: 'barrel' },
    ],
    'India': [
        { x: 300, y: 0.82, w: 100, h: 140, img: 'incense' },
        { x: 1620, y: 0.82, w: 100, h: 140, img: 'incense' },
        { x: 450, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Brazil': [
        { x: 280, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1640, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 430, y: 0.85, w: 130, h: 100, img: 'crate' },
        { x: 1490, y: 0.85, w: 120, h: 100, img: 'speaker' },
    ],
    'China': [
        { x: 290, y: 0.78, w: 100, h: 160, img: 'pagoda' },
        { x: 1630, y: 0.78, w: 100, h: 160, img: 'pagoda' },
        { x: 440, y: 0.83, w: 100, h: 120, img: 'shrine' },
    ],
    'Italy': [
        { x: 300, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1620, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 450, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Germany': [
        { x: 280, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1640, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 430, y: 0.85, w: 110, h: 100, img: 'server' },
        { x: 1490, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Jamaica': [
        { x: 300, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1620, y: 0.83, w: 120, h: 100, img: 'speaker' },
        { x: 450, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Poland': [
        { x: 280, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1640, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 440, y: 0.85, w: 130, h: 120, img: 'barricade' },
    ],
    'Mexico': [
        { x: 300, y: 0.82, w: 100, h: 120, img: 'barrel' },
        { x: 1620, y: 0.82, w: 100, h: 120, img: 'barrel' },
        { x: 440, y: 0.85, w: 130, h: 110, img: 'chair' },
        { x: 1480, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Spain': [
        { x: 290, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1630, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 450, y: 0.85, w: 130, h: 120, img: 'brazier' },
    ],
    'JapanNight': [
        { x: 280, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 1640, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 440, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Dojo': [
        { x: 300, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1620, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 440, y: 0.84, w: 100, h: 130, img: 'shrine' },
        { x: 1480, y: 0.84, w: 100, h: 130, img: 'shrine' },
    ],
    'Russia': [
        { x: 280, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1640, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 440, y: 0.85, w: 110, h: 100, img: 'ice' },
        { x: 1480, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Valhalla': [
        { x: 300, y: 0.82, w: 120, h: 140, img: 'brazier' },
        { x: 1620, y: 0.82, w: 120, h: 140, img: 'brazier' },
        { x: 440, y: 0.84, w: 120, h: 100, img: 'barrel' },
        { x: 1480, y: 0.84, w: 130, h: 100, img: 'crate' },
    ],
};

export default class StageObjectManager {
    constructor(game) {
        this.game = game;
        this.objects = [];
        this.debris = [];
        this.images = {};  // Cache for loaded prop images
    }

    /** Preload all prop images */
    preloadImages() {
        const propNames = ['barrel', 'crate', 'lantern', 'chair', 'crystal', 'brazier',
            'pagoda', 'speaker', 'neon', 'server', 'shrine', 'incense',
            'ice', 'barricade', 'trashcan'];
        for (const name of propNames) {
            // Intact
            const img = new Image();
            img.src = `assets/props/${name}.png`;
            this.images[name] = img;
            // Broken
            const imgB = new Image();
            imgB.src = `assets/props/${name}_broken.png`;
            this.images[`${name}_broken`] = imgB;
        }
    }

    /** Initialize objects for a given stage */
    init(stageId) {
        this.debris = [];
        // Preload images if not yet done
        if (Object.keys(this.images).length === 0) this.preloadImages();

        const defs = STAGE_OBJECTS[stageId] || [];
        const h = this.game.height;

        this.objects = defs.map(def => ({
            ...def,
            yAbs: h * def.y,       // Convert relative Y to absolute
            broken: false,
            breakTimer: 0,          // Time since broken (for broken image display)
            shakeTime: 0,
        }));
    }

    /** Check if any fighter collides with objects and break them */
    checkCollisions(p1, p2) {
        for (const obj of this.objects) {
            if (obj.broken) continue;

            const fighters = [p1, p2];
            for (const f of fighters) {
                // Only break if fighter is in HIT or KO state (being knocked back)
                if (f.state !== 'HIT' && f.state !== 'KO') continue;

                const fx = f.x;
                const fy = f.y;
                const objLeft = obj.x - obj.w / 1.5; // Wider horizontal catch area
                const objRight = obj.x + obj.w / 1.5;
                const objTop = obj.yAbs - obj.h - 50; // Taller vertical catch area
                const objBottom = obj.yAbs + 50;

                // Simple AABB overlap with fighter center
                if (fx > objLeft && fx < objRight && fy > objTop && fy < objBottom) {
                    this.breakObject(obj);
                }
            }
        }
    }

    /** Shatter an object into debris particles */
    breakObject(obj) {
        obj.broken = true;
        obj.breakTimer = 0;

        // Spawn debris particles
        const count = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            this.debris.push({
                x: obj.x + (Math.random() - 0.5) * obj.w,
                y: obj.yAbs - Math.random() * obj.h,
                vx: (Math.random() - 0.5) * 400,
                vy: -100 - Math.random() * 300,
                size: 4 + Math.random() * 10,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 10,
                life: 1.5 + Math.random(),
                color: ['#8B4513', '#A0522D', '#654321', '#DAA520', '#CD853F'][Math.floor(Math.random() * 5)],
                gravity: 600 + Math.random() * 200,
            });
        }
    }

    /** Update debris physics */
    update(dt) {
        // Update break timers
        for (const obj of this.objects) {
            if (obj.broken) obj.breakTimer += dt;
        }

        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += d.gravity * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.rotation += d.rotSpeed * dt;
            d.life -= dt;
            d.vx *= 0.98; // Air drag
            if (d.life <= 0) this.debris.splice(i, 1);
        }
    }

    /** Draw all objects (intact or broken images) and debris */
    draw(ctx) {
        // Draw objects (intact or broken image)
        for (const obj of this.objects) {
            const imgKey = obj.broken ? `${obj.img}_broken` : obj.img;
            const image = this.images[imgKey];

            if (image && image.complete && image.naturalWidth > 0) {
                ctx.save();
                // Draw image centered at obj.x, with bottom at obj.yAbs
                ctx.drawImage(image, obj.x - obj.w / 2, obj.yAbs - obj.h, obj.w, obj.h);

                // Fade out broken objects after 2 seconds
                if (obj.broken && obj.breakTimer > 2) {
                    const fadeAlpha = Math.min(1, (obj.breakTimer - 2) / 1);
                    ctx.globalAlpha = fadeAlpha;
                    ctx.fillStyle = '#000';
                    ctx.fillRect(obj.x - obj.w / 2, obj.yAbs - obj.h, obj.w, obj.h);
                    ctx.globalAlpha = 1;
                }
                ctx.restore();
            }
        }

        // Draw debris particles
        for (const d of this.debris) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.globalAlpha = Math.min(1, d.life);
            ctx.fillStyle = d.color;
            ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}
