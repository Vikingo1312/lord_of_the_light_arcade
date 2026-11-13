/**
 * StageObjects — Destructible arena props & Street Fighter Alpha / V level
 * living stage atmospheric layers, dynamic weather, light beams, and floor rim reflections.
 * Uses real PNG images from assets/props/ folder for destructible props.
 * Each object has intact + broken version and shatters into particles on impact.
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
    'Japan_Night': [
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
    'Supreme_Keano': [
        { x: 90, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 1830, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 300, y: 0.85, w: 120, h: 140, img: 'brazier' },
    ],
    'Canada': [
        { x: 90, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 1830, y: 0.82, w: 120, h: 150, img: 'crystal' },
        { x: 300, y: 0.85, w: 110, h: 100, img: 'ice' },
        { x: 1620, y: 0.85, w: 130, h: 100, img: 'crate' },
    ],
};

// Stage-specific floor rim & reflection tint palettes
const STAGE_FLOOR_THEMES = {
    'Japan': { rim: 'rgba(255, 183, 197, 0.55)', glowTop: 'rgba(255, 160, 120, 0.16)', glowBottom: 'rgba(40, 15, 25, 0.35)', accent: '#ffb7c5' },
    'India': { rim: 'rgba(255, 195, 60, 0.60)', glowTop: 'rgba(255, 153, 51, 0.20)', glowBottom: 'rgba(60, 25, 5, 0.38)', accent: '#ff9933' },
    'Brazil': { rim: 'rgba(255, 180, 50, 0.55)', glowTop: 'rgba(191, 255, 0, 0.14)', glowBottom: 'rgba(35, 20, 10, 0.35)', accent: '#bfff00' },
    'China': { rim: 'rgba(255, 80, 60, 0.58)', glowTop: 'rgba(255, 200, 60, 0.16)', glowBottom: 'rgba(50, 10, 10, 0.40)', accent: '#ffd700' },
    'Italy': { rim: 'rgba(255, 190, 110, 0.55)', glowTop: 'rgba(255, 140, 50, 0.18)', glowBottom: 'rgba(45, 28, 15, 0.36)', accent: '#ffae42' },
    'Germany': { rim: 'rgba(0, 245, 255, 0.60)', glowTop: 'rgba(0, 210, 255, 0.18)', glowBottom: 'rgba(10, 20, 35, 0.42)', accent: '#00f5ff' },
    'Jamaica': { rim: 'rgba(255, 215, 70, 0.55)', glowTop: 'rgba(80, 220, 100, 0.15)', glowBottom: 'rgba(15, 35, 20, 0.35)', accent: '#ffd700' },
    'Poland': { rim: 'rgba(255, 100, 30, 0.62)', glowTop: 'rgba(255, 80, 20, 0.22)', glowBottom: 'rgba(35, 12, 8, 0.44)', accent: '#ff5500' },
    'Mexico': { rim: 'rgba(255, 205, 50, 0.60)', glowTop: 'rgba(255, 170, 30, 0.18)', glowBottom: 'rgba(45, 25, 10, 0.38)', accent: '#ffd700' },
    'Spain': { rim: 'rgba(255, 70, 90, 0.58)', glowTop: 'rgba(255, 200, 90, 0.18)', glowBottom: 'rgba(50, 12, 18, 0.38)', accent: '#dc143c' },
    'Japan_Night': { rim: 'rgba(255, 0, 170, 0.68)', glowTop: 'rgba(0, 245, 255, 0.24)', glowBottom: 'rgba(15, 5, 30, 0.48)', accent: '#00f5ff' },
    'Dojo': { rim: 'rgba(185, 50, 255, 0.62)', glowTop: 'rgba(220, 20, 90, 0.20)', glowBottom: 'rgba(20, 5, 30, 0.45)', accent: '#b932ff' },
    'Russia': { rim: 'rgba(180, 240, 255, 0.68)', glowTop: 'rgba(130, 215, 255, 0.24)', glowBottom: 'rgba(10, 25, 45, 0.42)', accent: '#b3e5fc' },
    'Valhalla': { rim: 'rgba(255, 215, 80, 0.68)', glowTop: 'rgba(140, 80, 255, 0.24)', glowBottom: 'rgba(15, 8, 35, 0.48)', accent: '#ffd700' },
    'Supreme_Keano': { rim: 'rgba(125, 249, 255, 0.70)', glowTop: 'rgba(255, 215, 100, 0.22)', glowBottom: 'rgba(12, 15, 40, 0.45)', accent: '#7df9ff' },
    'Canada': { rim: 'rgba(100, 255, 218, 0.65)', glowTop: 'rgba(160, 120, 255, 0.22)', glowBottom: 'rgba(10, 20, 38, 0.44)', accent: '#64ffda' },
    'Cosmic': { rim: 'rgba(125, 249, 255, 0.68)', glowTop: 'rgba(180, 100, 255, 0.22)', glowBottom: 'rgba(10, 10, 35, 0.45)', accent: '#7df9ff' },
};

const VALHALLA_RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᛉ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛞ', 'ᛟ'];

export default class StageObjectManager {
    constructor(game) {
        this.game = game;
        this.objects = [];
        this.debris = [];
        this.particles = [];
        this.ripples = [];
        this.lightningArcs = [];
        this.lightningTimer = 0;
        this.stageId = 'Japan';
        this.time = 0;
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

    /** Initialize destructible objects and atmospheric layers for a given stage */
    init(stageId) {
        this.stageId = stageId || 'Japan';
        this.debris = [];
        this.particles = [];
        this.ripples = [];
        this.lightningArcs = [];
        this.lightningTimer = 0.4;
        this.time = 0;

        // Preload images if not yet done
        if (Object.keys(this.images).length === 0) this.preloadImages();

        const defs = STAGE_OBJECTS[this.stageId] || STAGE_OBJECTS['Japan'] || [];
        const w = this.game.width || 1920;
        const h = this.game.height || 1080;

        this.objects = defs.map(def => ({
            ...def,
            // Add a +45 pixel offset so objects sit lower on the 2.5D plane,
            // appearing closer to the foreground instead of deep in the background.
            yAbs: (h * def.y) + 45,
            broken: false,
            breakTimer: 0,          // Time since broken (for broken image display)
            shakeTime: 0,
        }));

        this.initAtmosphere(w, h);
    }

    /** Spawn 60–90 stage-specific weather & ambiance particles */
    initAtmosphere(w, h) {
        const floorY = h * 0.9;
        const s = this.stageId;

        const addParticle = (overrides) => {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * floorY,
                vx: 0,
                vy: 0,
                size: 6,
                alpha: 0.4 + Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2,
                phaseSpeed: 1.5 + Math.random() * 2.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 2,
                color: '#ffffff',
                secondaryColor: '#ffd700',
                type: 'mote',
                layer: Math.random() < 0.35 ? 'fg' : 'bg',
                ...overrides,
            });
        };

        if (s === 'Japan') {
            // 60 drifting pink/white sakura cherry blossom petals + 16 warm lantern motes
            const sakuraColors = ['#ffb7c5', '#ffc0cb', '#ffe4e9', '#ff9ebb', '#fff0f5'];
            for (let i = 0; i < 60; i++) {
                addParticle({
                    type: 'sakura',
                    vx: 35 + Math.random() * 55,
                    vy: 30 + Math.random() * 45,
                    size: 6 + Math.random() * 8,
                    color: sakuraColors[i % sakuraColors.length],
                    rotSpeed: (Math.random() - 0.5) * 3.5,
                });
            }
            for (let i = 0; i < 16; i++) {
                const nearLeft = i % 2 === 0;
                addParticle({
                    type: 'lantern_glow',
                    x: (nearLeft ? 110 : 1810) + (Math.random() - 0.5) * 220,
                    y: h * 0.45 + Math.random() * (floorY * 0.5),
                    vx: (Math.random() - 0.5) * 18,
                    vy: -18 - Math.random() * 25,
                    size: 4 + Math.random() * 6,
                    color: '#ffae42',
                    secondaryColor: '#ff5500',
                });
            }
        } else if (s === 'India') {
            // 46 rising saffron heat embers + 30 shimmering palace dust motes
            const emberColors = ['#ff9933', '#ffcc33', '#ff6600', '#ffd700'];
            for (let i = 0; i < 46; i++) {
                addParticle({
                    type: 'ember',
                    y: floorY * 0.3 + Math.random() * (floorY * 0.7),
                    vx: (Math.random() - 0.5) * 25,
                    vy: -35 - Math.random() * 55,
                    size: 3.5 + Math.random() * 5.5,
                    color: emberColors[i % emberColors.length],
                });
            }
            for (let i = 0; i < 30; i++) {
                addParticle({
                    type: 'palace_dust',
                    vx: 10 + Math.random() * 20,
                    vy: (Math.random() - 0.5) * 14,
                    size: 3 + Math.random() * 5,
                    color: '#ffe89e',
                    secondaryColor: '#ffd700',
                });
            }
        } else if (s === 'Brazil') {
            // 52 floating golden-green tropical fireflies + 22 Rio sunset dust motes
            const fireflyColors = ['#bfff00', '#ffd700', '#7cfc00', '#ffe135'];
            for (let i = 0; i < 52; i++) {
                addParticle({
                    type: 'firefly',
                    y: h * 0.25 + Math.random() * (floorY * 0.72),
                    vx: (Math.random() - 0.5) * 45,
                    vy: (Math.random() - 0.5) * 30,
                    size: 4 + Math.random() * 5,
                    color: fireflyColors[i % fireflyColors.length],
                    phaseSpeed: 2.5 + Math.random() * 3.5,
                });
            }
            for (let i = 0; i < 22; i++) {
                addParticle({
                    type: 'palace_dust',
                    vx: 18 + Math.random() * 24,
                    vy: -10 - Math.random() * 15,
                    size: 3 + Math.random() * 4.5,
                    color: '#ff9e66',
                    secondaryColor: '#ffd700',
                });
            }
        } else if (s === 'China') {
            // 24 floating glowing red sky-lanterns + 50 golden dragon mist wisps
            for (let i = 0; i < 24; i++) {
                addParticle({
                    type: 'sky_lantern',
                    y: Math.random() * (floorY * 0.85),
                    vx: 8 + Math.random() * 16,
                    vy: -18 - Math.random() * 22,
                    size: 10 + Math.random() * 12,
                    color: '#ff2a1a',
                    secondaryColor: '#ffd700',
                    layer: 'bg',
                });
            }
            for (let i = 0; i < 50; i++) {
                addParticle({
                    type: 'dragon_mist',
                    y: h * 0.35 + Math.random() * (floorY * 0.62),
                    vx: 35 + Math.random() * 55,
                    vy: (Math.random() - 0.5) * 18,
                    size: 14 + Math.random() * 22,
                    color: i % 3 === 0 ? '#ff4d2e' : '#ffd700',
                });
            }
        } else if (s === 'Italy') {
            // 48 drifting golden gladiator arena dust + 28 flickering Colosseum torch embers
            for (let i = 0; i < 48; i++) {
                addParticle({
                    type: 'arena_dust',
                    y: h * 0.3 + Math.random() * (floorY * 0.68),
                    vx: 22 + Math.random() * 38,
                    vy: -8 + (Math.random() - 0.5) * 18,
                    size: 4 + Math.random() * 7,
                    color: '#e8c888',
                    secondaryColor: '#ffd700',
                });
            }
            for (let i = 0; i < 28; i++) {
                const torchCenters = [140, 560, 1360, 1780];
                const tx = torchCenters[i % torchCenters.length];
                addParticle({
                    type: 'ember',
                    x: tx + (Math.random() - 0.5) * 130,
                    y: h * 0.45 + Math.random() * (floorY * 0.5),
                    vx: (Math.random() - 0.5) * 30,
                    vy: -45 - Math.random() * 65,
                    size: 3.5 + Math.random() * 5,
                    color: i % 2 === 0 ? '#ff7700' : '#ffcc33',
                });
            }
        } else if (s === 'Germany') {
            // 54 electric street sparks (cyan/amber) + 22 Berlin night mist particles
            for (let i = 0; i < 54; i++) {
                const isCyan = i % 3 !== 0;
                addParticle({
                    type: 'electric_spark',
                    y: h * 0.2 + Math.random() * (floorY * 0.78),
                    vx: (Math.random() - 0.5) * 90,
                    vy: -25 - Math.random() * 65,
                    size: 3 + Math.random() * 5,
                    color: isCyan ? '#00f5ff' : '#ffaa00',
                    secondaryColor: '#ffffff',
                });
            }
            for (let i = 0; i < 22; i++) {
                addParticle({
                    type: 'steam_puff',
                    y: floorY - 120 + Math.random() * 120,
                    vx: 20 + Math.random() * 30,
                    vy: -12 - Math.random() * 18,
                    size: 24 + Math.random() * 32,
                    alpha: 0.14 + Math.random() * 0.14,
                    color: '#88d8ff',
                });
            }
        } else if (s === 'Jamaica') {
            // 32 drifting tropical breeze leaves + 42 warm Caribbean golden sun sparks
            const leafColors = ['#32cd32', '#9acd32', '#00e676', '#ffd700'];
            for (let i = 0; i < 32; i++) {
                addParticle({
                    type: 'tropical_leaf',
                    vx: 45 + Math.random() * 65,
                    vy: 18 + Math.random() * 32,
                    size: 7 + Math.random() * 9,
                    color: leafColors[i % leafColors.length],
                    rotSpeed: (Math.random() - 0.5) * 4,
                });
            }
            for (let i = 0; i < 42; i++) {
                addParticle({
                    type: 'palace_dust',
                    vx: 25 + Math.random() * 35,
                    vy: -12 + (Math.random() - 0.5) * 24,
                    size: 4 + Math.random() * 5.5,
                    color: '#ffe135',
                    secondaryColor: '#00ff88',
                });
            }
        } else if (s === 'Poland') {
            // 55 iron forge rising embers + 26 industrial steam puffs
            const forgeColors = ['#ff3b00', '#ff7700', '#ffaa00', '#ffd700'];
            for (let i = 0; i < 55; i++) {
                addParticle({
                    type: 'ember',
                    y: h * 0.3 + Math.random() * (floorY * 0.7),
                    vx: (Math.random() - 0.5) * 45,
                    vy: -55 - Math.random() * 85,
                    size: 3.5 + Math.random() * 6,
                    color: forgeColors[i % forgeColors.length],
                });
            }
            for (let i = 0; i < 26; i++) {
                addParticle({
                    type: 'steam_puff',
                    y: h * 0.45 + Math.random() * (floorY * 0.55),
                    vx: 15 + Math.random() * 25,
                    vy: -28 - Math.random() * 35,
                    size: 28 + Math.random() * 44,
                    alpha: 0.12 + Math.random() * 0.16,
                    color: '#cfd8dc',
                });
            }
        } else if (s === 'Mexico') {
            // 26 floating golden sun-temple runes + 50 solar-flare embers
            for (let i = 0; i < 26; i++) {
                addParticle({
                    type: 'aztec_rune',
                    y: h * 0.2 + Math.random() * (floorY * 0.75),
                    vx: (Math.random() - 0.5) * 20,
                    vy: -16 - Math.random() * 24,
                    size: 10 + Math.random() * 10,
                    color: i % 4 === 0 ? '#00e5ff' : '#ffd700',
                    secondaryColor: '#ff9900',
                    rotSpeed: (Math.random() - 0.5) * 1.2,
                });
            }
            for (let i = 0; i < 50; i++) {
                addParticle({
                    type: 'ember',
                    vx: (Math.random() - 0.5) * 32,
                    vy: -30 - Math.random() * 50,
                    size: 3.5 + Math.random() * 5.5,
                    color: i % 3 === 0 ? '#ff6f00' : '#ffd700',
                });
            }
        } else if (s === 'Spain') {
            // 38 swirling crimson rose petals + 40 golden bullring sand motes
            const roseColors = ['#dc143c', '#ff1744', '#b71c1c', '#ff5252'];
            for (let i = 0; i < 38; i++) {
                addParticle({
                    type: 'rose_petal',
                    vx: 50 + Math.random() * 70,
                    vy: 20 + Math.random() * 38,
                    size: 7 + Math.random() * 8,
                    color: roseColors[i % roseColors.length],
                    rotSpeed: (Math.random() - 0.5) * 4.5,
                });
            }
            for (let i = 0; i < 40; i++) {
                addParticle({
                    type: 'arena_dust',
                    y: h * 0.4 + Math.random() * (floorY * 0.58),
                    vx: 40 + Math.random() * 65,
                    vy: (Math.random() - 0.5) * 25,
                    size: 4 + Math.random() * 6.5,
                    color: '#ffcc66',
                    secondaryColor: '#ffd700',
                });
            }
        } else if (s === 'Japan_Night') {
            // 68 diagonal cyberpunk neon rain streaks + 18 neon bokeh motes
            const neonRainColors = ['#00f5ff', '#ff00aa', '#70d6ff', '#ff4dff'];
            for (let i = 0; i < 68; i++) {
                addParticle({
                    type: 'neon_rain',
                    vx: -140 - Math.random() * 80,
                    vy: 680 + Math.random() * 360,
                    size: 18 + Math.random() * 24,
                    alpha: 0.45 + Math.random() * 0.45,
                    color: neonRainColors[i % neonRainColors.length],
                    layer: i % 3 === 0 ? 'fg' : 'bg',
                });
            }
            for (let i = 0; i < 18; i++) {
                addParticle({
                    type: 'firefly',
                    y: h * 0.2 + Math.random() * (floorY * 0.7),
                    vx: (Math.random() - 0.5) * 25,
                    vy: -12 - Math.random() * 18,
                    size: 5 + Math.random() * 8,
                    color: i % 2 === 0 ? '#ff00aa' : '#00f5ff',
                });
            }
        } else if (s === 'Dojo') {
            // 46 swirling purple-crimson shadow wisps + 32 flickering dojo spirit flames
            const shadowColors = ['#9c27b0', '#e91e63', '#7b1fa2', '#ff1744'];
            for (let i = 0; i < 46; i++) {
                addParticle({
                    type: 'shadow_wisp',
                    y: h * 0.25 + Math.random() * (floorY * 0.72),
                    vx: (Math.random() - 0.5) * 55,
                    vy: -20 - Math.random() * 35,
                    size: 10 + Math.random() * 18,
                    color: shadowColors[i % shadowColors.length],
                });
            }
            for (let i = 0; i < 32; i++) {
                addParticle({
                    type: 'spirit_flame',
                    y: h * 0.45 + Math.random() * (floorY * 0.52),
                    vx: (Math.random() - 0.5) * 22,
                    vy: -40 - Math.random() * 60,
                    size: 6 + Math.random() * 9,
                    color: i % 2 === 0 ? '#d500f9' : '#ff1744',
                    secondaryColor: '#ffffff',
                });
            }
        } else if (s === 'Russia') {
            // 66 Siberian blizzard wind-driven snow + 22 icy frost floor mist clouds
            const snowColors = ['#ffffff', '#e0f7fa', '#b3e5fc', '#e1f5fe'];
            for (let i = 0; i < 66; i++) {
                addParticle({
                    type: 'blizzard_snow',
                    vx: 220 + Math.random() * 180,
                    vy: 140 + Math.random() * 140,
                    size: 3.5 + Math.random() * 7.5,
                    alpha: 0.55 + Math.random() * 0.4,
                    color: snowColors[i % snowColors.length],
                    layer: i % 3 === 0 ? 'fg' : 'bg',
                });
            }
            for (let i = 0; i < 22; i++) {
                addParticle({
                    type: 'frost_mist',
                    y: floorY - 75 + Math.random() * 85,
                    vx: 65 + Math.random() * 85,
                    vy: (Math.random() - 0.5) * 8,
                    size: 38 + Math.random() * 55,
                    alpha: 0.14 + Math.random() * 0.16,
                    color: '#cceeff',
                    layer: 'fg',
                });
            }
        } else if (s === 'Valhalla') {
            // 28 rising golden Valhalla runes + 54 dark-matter & Bifrost embers
            for (let i = 0; i < 28; i++) {
                addParticle({
                    type: 'valhalla_rune',
                    y: h * 0.25 + Math.random() * (floorY * 0.72),
                    vx: (Math.random() - 0.5) * 28,
                    vy: -24 - Math.random() * 38,
                    size: 16 + Math.random() * 12,
                    color: i % 3 === 0 ? '#00e5ff' : '#ffd700',
                    rune: VALHALLA_RUNES[i % VALHALLA_RUNES.length],
                });
            }
            const valhallaEmbers = ['#ffd700', '#9d4edd', '#00f5ff', '#ff5400'];
            for (let i = 0; i < 54; i++) {
                addParticle({
                    type: 'ember',
                    vx: (Math.random() - 0.5) * 45,
                    vy: -45 - Math.random() * 75,
                    size: 4 + Math.random() * 6.5,
                    color: valhallaEmbers[i % valhallaEmbers.length],
                });
            }
        } else {
            // Supreme_Keano, Canada, Cosmic (and any extra stage):
            // 56 ascending starlight particles + 26 cosmic aurora orbs
            const starColors = ['#ffffff', '#ffd700', '#7df9ff', '#c77dff', '#64ffda'];
            for (let i = 0; i < 56; i++) {
                addParticle({
                    type: 'starlight',
                    vx: (Math.random() - 0.5) * 22,
                    vy: -25 - Math.random() * 48,
                    size: 5 + Math.random() * 8,
                    color: starColors[i % starColors.length],
                });
            }
            for (let i = 0; i < 26; i++) {
                addParticle({
                    type: 'aurora_orb',
                    y: h * 0.15 + Math.random() * (floorY * 0.75),
                    vx: 18 + Math.random() * 28,
                    vy: (Math.random() - 0.5) * 16,
                    size: 10 + Math.random() * 18,
                    color: starColors[(i + 2) % starColors.length],
                });
            }
        }
    }

    /** Generate a jagged Bifrost lightning bolt in the sky for Valhalla */
    spawnValhallaLightning(w, h) {
        const startX = w * (0.12 + Math.random() * 0.76);
        const startY = -10;
        const segments = [];
        let cx = startX;
        let cy = startY;
        const steps = 8 + Math.floor(Math.random() * 6);
        const maxY = h * (0.35 + Math.random() * 0.28);
        const stepY = (maxY - startY) / steps;

        for (let i = 0; i < steps; i++) {
            const nx = cx + (Math.random() - 0.5) * 110;
            const ny = cy + stepY;
            segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
            // Occasional side branch
            if (Math.random() < 0.35) {
                segments.push({
                    x1: nx,
                    y1: ny,
                    x2: nx + (Math.random() - 0.5) * 95,
                    y2: ny + stepY * (1.2 + Math.random()),
                    branch: true,
                });
            }
            cx = nx;
            cy = ny;
        }

        const colors = ['#ffd700', '#00f5ff', '#c77dff'];
        this.lightningArcs.push({
            segments,
            life: 0.22 + Math.random() * 0.16,
            maxLife: 0.38,
            color: colors[Math.floor(Math.random() * colors.length)],
        });
    }

    /** Check if any fighter collides with objects and break them */
    checkCollisions(p1, p2) {
        for (const obj of this.objects) {
            if (obj.broken) continue;

            const fighters = [p1, p2];
            for (const f of fighters) {
                if (!f) continue;
                // Only break if fighter is in HIT or KO state (being knocked back)
                if (f.state !== 'HIT' && f.state !== 'KO') continue;

                const fx = f.x;
                const objLeft = obj.x - obj.w / 2;
                const objRight = obj.x + obj.w / 2;

                // The game uses a 2.5D perspective, so the fighter's feet (Y)
                // might not perfectly align with the object's base Y.
                // Check X-axis overlap when they are in HIT/KO state.
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

        // Choose debris palette matching prop material
        let palette = ['#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460'];
        if (obj.img === 'crystal' || obj.img === 'ice') {
            palette = ['#7df9ff', '#00e5ff', '#b3e5fc', '#ffffff', '#80d8ff'];
        } else if (obj.img === 'lantern' || obj.img === 'brazier') {
            palette = ['#ff5500', '#ffae42', '#ffd700', '#8B4513', '#d32f2f'];
        } else if (obj.img === 'server' || obj.img === 'speaker') {
            palette = ['#37474f', '#00f5ff', '#78909c', '#ffaa00', '#263238'];
        }

        // Spawn debris particles
        const count = 16 + Math.floor(Math.random() * 10);
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
                color: palette[Math.floor(Math.random() * palette.length)],
                gravity: 800 + Math.random() * 200,
            });
        }
    }

    /** Update destructible debris and stage atmospheric particles */
    update(dt) {
        const safeDt = Math.min(dt || 0.016, 0.1);
        this.time += safeDt;

        const w = this.game.width || 1920;
        const h = this.game.height || 1080;
        const floorY = h * 0.9;

        // Update break timers
        for (const obj of this.objects) {
            if (obj.broken) obj.breakTimer += safeDt;
        }

        // Update debris physics
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += d.gravity * safeDt;
            d.x += d.vx * safeDt;
            d.y += d.vy * safeDt;
            d.rotation += d.rotSpeed * safeDt;
            d.life -= safeDt;
            d.vx *= 0.98; // Air drag
            if (d.life <= 0) this.debris.splice(i, 1);
        }

        // Update stage weather & ambiance particles
        for (const p of this.particles) {
            p.phase += p.phaseSpeed * safeDt;
            p.rotation += p.rotSpeed * safeDt;

            // Horizontal wave sway for organic particles
            let swayX = 0;
            let swayY = 0;
            if (p.type === 'sakura' || p.type === 'tropical_leaf' || p.type === 'rose_petal') {
                swayX = Math.sin(p.phase) * 35;
                swayY = Math.cos(p.phase * 0.7) * 12;
            } else if (p.type === 'firefly' || p.type === 'shadow_wisp' || p.type === 'dragon_mist') {
                swayX = Math.sin(p.phase) * 42;
                swayY = Math.cos(p.phase * 1.1) * 28;
            } else if (p.type === 'ember' || p.type === 'spirit_flame' || p.type === 'starlight') {
                swayX = Math.sin(p.phase * 1.3) * 24;
            } else if (p.type === 'blizzard_snow') {
                swayY = Math.sin(p.phase * 2.0) * 35;
            }

            p.x += (p.vx + swayX) * safeDt;
            p.y += (p.vy + swayY) * safeDt;

            // Wrap around screen bounds seamlessly
            if (p.type === 'neon_rain') {
                if (p.y >= floorY) {
                    // Spawn neon puddle ripple on the floor in Japan_Night
                    if (this.ripples.length < 28 && Math.random() < 0.45) {
                        this.ripples.push({
                            x: ((p.x % w) + w) % w,
                            y: floorY - 12 + Math.random() * 34,
                            rx: 4,
                            maxRx: 26 + Math.random() * 28,
                            alpha: 0.75,
                            color: p.color,
                        });
                    }
                    p.y = -20 - Math.random() * 80;
                    p.x = Math.random() * (w + 260);
                }
                if (p.x < -60) p.x += w + 120;
            } else if (p.type === 'frost_mist') {
                if (p.x > w + 80) p.x = -80;
                p.y = floorY - 65 + Math.sin(p.phase * 0.5) * 22;
            } else {
                if (p.x > w + 50) p.x = -40;
                if (p.x < -50) p.x = w + 40;
                if (p.y > floorY + 25) {
                    p.y = -20;
                    p.x = Math.random() * w;
                } else if (p.y < -40) {
                    p.y = floorY + 10;
                    p.x = Math.random() * w;
                }
            }
        }

        // Update neon puddle ripples (Japan_Night)
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.rx += 55 * safeDt;
            r.alpha = Math.max(0, 1 - r.rx / r.maxRx) * 0.65;
            if (r.rx >= r.maxRx) this.ripples.splice(i, 1);
        }

        // Update Valhalla cosmic Bifrost lightning arcs
        if (this.stageId === 'Valhalla') {
            this.lightningTimer -= safeDt;
            if (this.lightningTimer <= 0) {
                this.spawnValhallaLightning(w, h);
                this.lightningTimer = 0.65 + Math.random() * 1.4;
            }
            for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
                this.lightningArcs[i].life -= safeDt;
                if (this.lightningArcs[i].life <= 0) {
                    this.lightningArcs.splice(i, 1);
                }
            }
        }
    }

    /** Render stage-specific light beams, searchlights, sun-rays, torches, or cosmic auras */
    drawStageLighting(ctx, w, h, floorY) {
        const s = this.stageId;
        const t = this.time;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        if (s === 'Japan') {
            // Warm diagonal temple god-rays + paper-lantern radial glow
            for (let i = 0; i < 4; i++) {
                const bx = 240 + i * 380 + Math.sin(t * 0.6 + i) * 30;
                const grad = ctx.createLinearGradient(bx - 120, 0, bx + 220, floorY);
                grad.addColorStop(0, 'rgba(255, 210, 165, 0.09)');
                grad.addColorStop(0.7, 'rgba(255, 175, 190, 0.04)');
                grad.addColorStop(1, 'rgba(255, 160, 140, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(bx - 90, 0);
                ctx.lineTo(bx + 70, 0);
                ctx.lineTo(bx + 310, floorY);
                ctx.lineTo(bx + 60, floorY);
                ctx.closePath();
                ctx.fill();
            }
            // Paper lantern warm pools
            for (const lx of [90, 1830]) {
                const pulse = 135 + Math.sin(t * 3.2 + lx) * 18;
                const rad = ctx.createRadialGradient(lx, h * 0.72, 8, lx, h * 0.72, pulse);
                rad.addColorStop(0, 'rgba(255, 170, 70, 0.26)');
                rad.addColorStop(0.5, 'rgba(255, 100, 40, 0.10)');
                rad.addColorStop(1, 'rgba(255, 80, 20, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(lx, h * 0.72, pulse, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (s === 'India') {
            // Golden Ganges sun-rays fanning from upper sky
            const sunX = w * 0.68;
            for (let i = 0; i < 5; i++) {
                const spread = (i - 2) * 290 + Math.sin(t * 0.7 + i) * 35;
                const grad = ctx.createLinearGradient(sunX, 0, sunX + spread, floorY);
                grad.addColorStop(0, 'rgba(255, 205, 70, 0.11)');
                grad.addColorStop(0.65, 'rgba(255, 150, 40, 0.05)');
                grad.addColorStop(1, 'rgba(255, 120, 20, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(sunX - 60, 0);
                ctx.lineTo(sunX + 60, 0);
                ctx.lineTo(sunX + spread + 160, floorY);
                ctx.lineTo(sunX + spread - 160, floorY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'Brazil') {
            // Vibrant Rio sunset diagonal rays
            for (let i = 0; i < 4; i++) {
                const x0 = 100 + i * 360;
                const grad = ctx.createLinearGradient(x0, 0, x0 + 420, floorY);
                grad.addColorStop(0, 'rgba(255, 140, 50, 0.10)');
                grad.addColorStop(0.5, 'rgba(255, 210, 60, 0.05)');
                grad.addColorStop(1, 'rgba(180, 255, 60, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x0, 0);
                ctx.lineTo(x0 + 150, 0);
                ctx.lineTo(x0 + 540, floorY);
                ctx.lineTo(x0 + 280, floorY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'China') {
            // Imperial crimson-gold dragon mist aura & pagoda glow
            for (const px of [90, 960, 1830]) {
                const r = px === 960 ? 340 : 180;
                const cy = px === 960 ? h * 0.45 : h * 0.72;
                const rad = ctx.createRadialGradient(px, cy, 10, px, cy, r);
                rad.addColorStop(0, 'rgba(255, 80, 40, 0.16)');
                rad.addColorStop(0.6, 'rgba(255, 190, 50, 0.06)');
                rad.addColorStop(1, 'rgba(255, 50, 20, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(px, cy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (s === 'Italy') {
            // Colosseum flickering torchlight pools
            const torchX = [140, 560, 1360, 1780];
            for (let i = 0; i < torchX.length; i++) {
                const tx = torchX[i];
                const ty = h * 0.62;
                const flicker = 140 + Math.sin(t * 14 + i * 2.1) * 22 + Math.cos(t * 23 + i) * 12;
                const rad = ctx.createRadialGradient(tx, ty, 6, tx, ty, flicker);
                rad.addColorStop(0, 'rgba(255, 190, 80, 0.24)');
                rad.addColorStop(0.5, 'rgba(255, 110, 30, 0.10)');
                rad.addColorStop(1, 'rgba(255, 60, 10, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(tx, ty, flicker, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (s === 'Germany') {
            // Moving neon-cyan and amber Berlin searchlight beams
            const beams = [
                { baseX: 260, color: '0, 245, 255', speed: 0.75, phase: 0 },
                { baseX: 960, color: '255, 170, 0', speed: 0.55, phase: 2.1 },
                { baseX: 1660, color: '0, 245, 255', speed: 0.85, phase: 4.2 },
            ];
            for (const b of beams) {
                const topX = b.baseX + Math.sin(t * b.speed + b.phase) * 460;
                const grad = ctx.createLinearGradient(b.baseX, floorY, topX, 0);
                grad.addColorStop(0, `rgba(${b.color}, 0.14)`);
                grad.addColorStop(0.6, `rgba(${b.color}, 0.06)`);
                grad.addColorStop(1, `rgba(${b.color}, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(b.baseX - 35, floorY);
                ctx.lineTo(b.baseX + 35, floorY);
                ctx.lineTo(topX + 210, 0);
                ctx.lineTo(topX - 210, 0);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'Jamaica') {
            // Warm Caribbean golden sunbeams
            for (let i = 0; i < 4; i++) {
                const sx = 180 + i * 420 + Math.sin(t * 0.5 + i) * 25;
                const grad = ctx.createLinearGradient(sx, 0, sx + 260, floorY);
                grad.addColorStop(0, 'rgba(255, 230, 90, 0.11)');
                grad.addColorStop(0.6, 'rgba(100, 255, 140, 0.04)');
                grad.addColorStop(1, 'rgba(255, 200, 50, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(sx - 70, 0);
                ctx.lineTo(sx + 70, 0);
                ctx.lineTo(sx + 340, floorY);
                ctx.lineTo(sx + 90, floorY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'Poland') {
            // Iron forge molten under-glow pulsing from the floor
            const pulseAlpha = 0.16 + Math.sin(t * 2.8) * 0.04;
            const forgeGrad = ctx.createLinearGradient(0, floorY, 0, h * 0.45);
            forgeGrad.addColorStop(0, `rgba(255, 85, 15, ${pulseAlpha})`);
            forgeGrad.addColorStop(0.5, 'rgba(255, 140, 30, 0.06)');
            forgeGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
            ctx.fillStyle = forgeGrad;
            ctx.fillRect(0, h * 0.45, w, floorY - h * 0.45);
        } else if (s === 'Mexico') {
            // Ancient Aztec solar-flare beams + golden sun-temple halo
            const cx = w * 0.5;
            const cy = h * 0.22;
            const sunRad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 420);
            sunRad.addColorStop(0, 'rgba(255, 215, 70, 0.18)');
            sunRad.addColorStop(0.5, 'rgba(255, 140, 20, 0.07)');
            sunRad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = sunRad;
            ctx.beginPath();
            ctx.arc(cx, cy, 420, 0, Math.PI * 2);
            ctx.fill();

            for (let i = -2; i <= 2; i++) {
                const targetX = cx + i * 360 + Math.sin(t * 0.8 + i) * 40;
                const grad = ctx.createLinearGradient(cx, cy, targetX, floorY);
                grad.addColorStop(0, 'rgba(255, 210, 60, 0.09)');
                grad.addColorStop(1, 'rgba(255, 140, 20, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(cx - 30, cy);
                ctx.lineTo(cx + 30, cy);
                ctx.lineTo(targetX + 130, floorY);
                ctx.lineTo(targetX - 130, floorY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'Spain') {
            // Dramatic bullring spotlight beams converging on the arena
            const spots = [320, 760, 1160, 1600];
            for (let i = 0; i < spots.length; i++) {
                const sx = spots[i];
                const sway = Math.sin(t * 0.9 + i * 1.4) * 90;
                const grad = ctx.createLinearGradient(sx, 0, sx + sway, floorY);
                grad.addColorStop(0, 'rgba(255, 225, 150, 0.12)');
                grad.addColorStop(0.6, 'rgba(220, 40, 70, 0.05)');
                grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(sx - 45, 0);
                ctx.lineTo(sx + 45, 0);
                ctx.lineTo(sx + sway + 170, floorY);
                ctx.lineTo(sx + sway - 170, floorY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (s === 'Japan_Night') {
            // Cyberpunk neon signage ambient glow + floor puddle ripples
            const neonPools = [
                { x: 340, y: h * 0.55, color: '255, 0, 170', r: 320 },
                { x: 960, y: h * 0.48, color: '0, 245, 255', r: 360 },
                { x: 1580, y: h * 0.55, color: '255, 0, 170', r: 320 },
            ];
            for (const np of neonPools) {
                const rad = ctx.createRadialGradient(np.x, np.y, 15, np.x, np.y, np.r);
                rad.addColorStop(0, `rgba(${np.color}, 0.14)`);
                rad.addColorStop(1, `rgba(${np.color}, 0)`);
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(np.x, np.y, np.r, 0, Math.PI * 2);
                ctx.fill();
            }
            // Draw splashing neon puddle ripples on the floor
            for (const r of this.ripples) {
                ctx.save();
                ctx.strokeStyle = r.color;
                ctx.globalAlpha = r.alpha;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(r.x, r.y, r.rx, r.rx * 0.28, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else if (s === 'Dojo') {
            // Swirling purple-crimson shadow pillars
            for (const px of [300, 960, 1620]) {
                const pulse = 200 + Math.sin(t * 2.5 + px) * 35;
                const rad = ctx.createRadialGradient(px, floorY - 80, 10, px, floorY - 80, pulse);
                rad.addColorStop(0, 'rgba(185, 40, 255, 0.18)');
                rad.addColorStop(0.5, 'rgba(220, 20, 80, 0.09)');
                rad.addColorStop(1, 'rgba(80, 0, 120, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(px, floorY - 80, pulse, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (s === 'Russia') {
            // Cold Siberian arctic haze band near floor
            const iceGrad = ctx.createLinearGradient(0, floorY + 20, 0, floorY - 160);
            iceGrad.addColorStop(0, 'rgba(170, 235, 255, 0.18)');
            iceGrad.addColorStop(0.6, 'rgba(120, 200, 255, 0.06)');
            iceGrad.addColorStop(1, 'rgba(120, 200, 255, 0)');
            ctx.fillStyle = iceGrad;
            ctx.fillRect(0, floorY - 160, w, 180);
        } else if (s === 'Valhalla') {
            // Cosmic Bifrost lightning arcs in the sky
            for (const arc of this.lightningArcs) {
                const alpha = Math.min(1, arc.life / arc.maxLife);
                ctx.save();
                ctx.strokeStyle = arc.color;
                ctx.shadowColor = arc.color;
                ctx.shadowBlur = 18;
                for (const seg of arc.segments) {
                    ctx.globalAlpha = seg.branch ? alpha * 0.55 : alpha * 0.95;
                    ctx.lineWidth = seg.branch ? 2 : 3.5;
                    ctx.beginPath();
                    ctx.moveTo(seg.x1, seg.y1);
                    ctx.lineTo(seg.x2, seg.y2);
                    ctx.stroke();
                }
                ctx.restore();
            }
        } else {
            // Supreme_Keano, Canada, Cosmic: Cosmic aurora rings in the sky
            const cx = w * 0.5;
            const cy = h * 0.32;
            const ringColors = ['rgba(100, 255, 218, 0.12)', 'rgba(125, 249, 255, 0.10)', 'rgba(199, 125, 255, 0.10)', 'rgba(255, 215, 100, 0.09)'];
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.translate(cx, cy + Math.sin(t * 0.9 + i) * 18);
                ctx.rotate(Math.sin(t * 0.35 + i) * 0.12);
                ctx.strokeStyle = ringColors[i];
                ctx.lineWidth = 14 - i * 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, 380 + i * 135, 75 + i * 24, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore();
    }

    /** Render subtle stage-tinted ground rim & reflection strip along the floor (y = h * 0.9) */
    drawFloorRim(ctx, w, h, floorY) {
        const theme = STAGE_FLOOR_THEMES[this.stageId] || STAGE_FLOOR_THEMES['Japan'];
        ctx.save();

        // Soft vertical reflection band anchoring fighter feet to the stage floor
        const bandTop = floorY - 30;
        const bandHeight = 78;
        const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.38, theme.glowTop);
        grad.addColorStop(0.55, theme.glowBottom);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, bandTop, w, bandHeight);

        // Glowing stage-tinted floor horizon rim line right at y = this.game.height * 0.9
        const pulse = 0.75 + Math.sin(this.time * 2.6) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = theme.rim;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(w, floorY);
        ctx.stroke();

        ctx.restore();
    }

    /** Draw a subset of atmospheric particles ('bg' or 'fg' layer) */
    drawParticleLayer(ctx, targetLayer) {
        for (const p of this.particles) {
            if (p.layer !== targetLayer) continue;

            ctx.save();
            const twinkle = 0.65 + 0.35 * Math.sin(p.phase);
            ctx.globalAlpha = Math.max(0.05, Math.min(1, p.alpha * twinkle));

            if (p.type === 'sakura' || p.type === 'rose_petal' || p.type === 'tropical_leaf') {
                // Tumbling petal / leaf ellipse with notch
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                const flutter = 0.45 + 0.55 * Math.abs(Math.cos(p.phase));
                ctx.scale(1, flutter);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'neon_rain') {
                // Diagonal cyberpunk neon rain streak
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.size * 0.22, p.y + p.size);
                ctx.stroke();
            } else if (p.type === 'sky_lantern') {
                // Floating glowing red & gold Chinese sky lantern
                ctx.translate(p.x, p.y);
                const sway = Math.sin(p.phase * 0.6) * 0.12;
                ctx.rotate(sway);
                const rad = ctx.createRadialGradient(0, 0, 2, 0, 0, p.size * 1.8);
                rad.addColorStop(0, 'rgba(255, 230, 120, 0.95)');
                rad.addColorStop(0.45, 'rgba(255, 60, 30, 0.65)');
                rad.addColorStop(1, 'rgba(255, 30, 0, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 1.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size * 0.45, -p.size * 0.6, p.size * 0.9, p.size * 1.1);
                ctx.fillStyle = p.secondaryColor;
                ctx.fillRect(-p.size * 0.25, p.size * 0.2, p.size * 0.5, p.size * 0.3);
            } else if (p.type === 'valhalla_rune') {
                // Glowing Norse rune ascending
                ctx.translate(p.x, p.y);
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                ctx.font = `bold ${Math.round(p.size)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.rune || 'ᚠ', 0, 0);
            } else if (p.type === 'aztec_rune') {
                // Sacred golden geometric sun-diamond glyph
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                const s = p.size * 0.65;
                ctx.strokeRect(-s, -s, s * 2, s * 2);
                ctx.fillStyle = p.secondaryColor;
                ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
            } else if (p.type === 'starlight') {
                // 4-point celestial star sparkle
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * 0.3);
                ctx.fillStyle = p.color;
                const r = p.size;
                ctx.beginPath();
                ctx.moveTo(0, -r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.quadraticCurveTo(0, 0, 0, r);
                ctx.quadraticCurveTo(0, 0, -r, 0);
                ctx.quadraticCurveTo(0, 0, 0, -r);
                ctx.closePath();
                ctx.fill();
            } else if (
                p.type === 'steam_puff' ||
                p.type === 'frost_mist' ||
                p.type === 'dragon_mist' ||
                p.type === 'shadow_wisp' ||
                p.type === 'aurora_orb'
            ) {
                // Soft radial mist / wisp / aurora orb
                const rad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size);
                rad.addColorStop(0, p.color);
                rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'electric_spark') {
                // Sharp jittering electric spark segment
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.cos(p.phase * 3) * p.size * 2.2, p.y + Math.sin(p.phase * 3) * p.size * 2.2);
                ctx.stroke();
            } else {
                // Glowing ember, firefly, snow crystal, spirit flame, or palace dust mote
                const rad = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, p.size * 1.7);
                rad.addColorStop(0, '#ffffff');
                rad.addColorStop(0.35, p.color);
                rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = rad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 1.7, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /** Draw stage lighting, floor rim, background/foreground ambiance, destructible props, and debris */
    draw(ctx) {
        const w = this.game.width || 1920;
        const h = this.game.height || 1080;
        const floorY = h * 0.9;

        // 1. Stage atmospheric lighting (god-rays, searchlights, torches, lightning, neon puddles, auroras)
        this.drawStageLighting(ctx, w, h, floorY);

        // 2. Stage-tinted ground rim & reflection strip along the floor (y = h * 0.9)
        this.drawFloorRim(ctx, w, h, floorY);

        // 3. Background atmospheric particle layer
        this.drawParticleLayer(ctx, 'bg');

        // 4. Destructible stage objects (intact or fading broken)
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

        // 5. Shattered prop debris particles
        for (const d of this.debris) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.globalAlpha = Math.min(1, d.life);
            ctx.fillStyle = d.color;
            ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
            ctx.restore();
        }

        // 6. Foreground atmospheric particle layer
        this.drawParticleLayer(ctx, 'fg');

        ctx.globalAlpha = 1;
    }
}
