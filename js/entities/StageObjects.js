/**
 * StageObjects — Destructible arena props (Street Fighter style)
 * Uses real PNG images from assets/props/ folder.
 * Each object has intact + broken version.
 * Objects break into particles when a fighter is knocked into them.
 */

// Map stage to themed objects with real image assets
const STAGE_OBJECTS = {
    'Cosmic': [
        { x: 90, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 1830, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Japan': [
        { x: 90, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 1830, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 300, y: 0.85, w: 120, h: 100, img: 'barrel' },
    ],
    'India': [
        { x: 90, y: 0.82, w: 100, h: 140, img: 'incense' },
        { x: 1830, y: 0.82, w: 100, h: 140, img: 'incense' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Brazil': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
        { x: 1620, y: 0.85, w: 120, h: 100, img: 'speaker' },
    ],
    'China': [
        { x: 90, y: 0.78, w: 100, h: 160, img: 'pagoda' },
        { x: 1830, y: 0.78, w: 100, h: 160, img: 'pagoda' },
        { x: 300, y: 0.83, w: 100, h: 120, img: 'shrine' },
    ],
    'Italy': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Germany': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 110, h: 100, img: 'server' },
        { x: 1620, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Jamaica': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'speaker' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Poland': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 130, h: 120, img: 'barricade' },
    ],
    'Mexico': [
        { x: 90, y: 0.82, w: 100, h: 120, img: 'barrel' },
        { x: 1830, y: 0.82, w: 100, h: 120, img: 'barrel' },
        { x: 300, y: 0.85, w: 130, h: 110, img: 'chair' },
        { x: 1620, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Spain': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 130, h: 120, img: 'brazier' },
    ],
    'JapanNight': [
        { x: 90, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 1830, y: 0.78, w: 100, h: 160, img: 'lantern' },
        { x: 300, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Dojo': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.84, w: 100, h: 130, img: 'shrine' },
        { x: 1620, y: 0.84, w: 100, h: 130, img: 'shrine' },
    ],
    'Russia': [
        { x: 90, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 1830, y: 0.83, w: 120, h: 100, img: 'barrel' },
        { x: 300, y: 0.85, w: 110, h: 100, img: 'ice' },
        { x: 1620, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
    'Valhalla': [
        { x: 90, y: 0.82, w: 120, h: 140, img: 'brazier' },
        { x: 1830, y: 0.82, w: 120, h: 140, img: 'brazier' },
        { x: 300, y: 0.84, w: 120, h: 100, img: 'barrel' },
        { x: 1620, y: 0.84, w: 130, h: 100, img: 'crate' },
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
            // Add a +45 pixel offset so objects sit lower on the 2.5D plane,
            // appearing closer to the foreground instead of deep in the background.
            yAbs: (h * def.y) + 45,
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
                const objLeft = obj.x - obj.w / 2;
                const objRight = obj.x + obj.w / 2;
                const objTop = obj.yAbs - obj.h;
                const objBottom = obj.yAbs;

                // The game uses a 2.5D perspective, so the fighter's feet (Y) 
                // might not perfectly align with the object's base Y.
                // It's safer to just check X-axis overlap when they are in HIT/KO state.
                if (fx > objLeft - 40 && fx < objRight + 40) {
                    this.breakObject(obj);
                }
            }
        }
    }

    /** Shatter an object into debris particles */
    breakObject(obj) {
        if (obj.broken) return;

        obj.broken = true;
        obj.breakTimer = 0;

        // Try playing a generic break sound if available, otherwise just break visually
        if (this.game.audioManager) {
            this.game.audioManager.playSFX('assets/audio/keano_hit.mp3', true);
        }

        // Spawn debris particles
        const count = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < count; i++) {
            this.debris.push({
                x: obj.x + (Math.random() - 0.5) * obj.w,
                y: obj.yAbs - Math.random() * obj.h,
                vx: (Math.random() - 0.5) * 600, // wider spread
                vy: -200 - Math.random() * 400, // more upward explosion
                size: 6 + Math.random() * 12,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 15,
                life: 1.0 + Math.random() * 1.5,
                color: ['#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460'][Math.floor(Math.random() * 5)],
                gravity: 800 + Math.random() * 200,
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

    /** Draw all objects (intact or broken image) and debris */
    draw(ctx) {
        // Draw objects (intact or fading broken)
        for (const obj of this.objects) {
            // Fully broken objects disappear after 3 seconds
            if (obj.broken && obj.breakTimer > 3) continue;

            const imgKey = obj.broken ? `${obj.img}_broken` : obj.img;
            const image = this.images[imgKey];

            if (image && image.complete && image.naturalWidth > 0) {
                ctx.save();

                // Fade out broken objects gracefully
                if (obj.broken) {
                    const fadeAlpha = Math.max(0, 1 - (obj.breakTimer / 2.5));
                    ctx.globalAlpha = fadeAlpha;
                }

                ctx.drawImage(image, obj.x - obj.w / 2, obj.yAbs - obj.h, obj.w, obj.h);
                ctx.restore();
            } else if (!obj.broken) {
                // Fallback: draw a simple colored box for missing prop images
                ctx.save();
                ctx.fillStyle = 'rgba(80, 60, 40, 0.6)';
                ctx.fillRect(obj.x - obj.w / 2, obj.yAbs - obj.h, obj.w, obj.h);
                ctx.restore();
            }
            // Don't draw anything for broken objects with missing images
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
