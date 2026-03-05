/**
 * StorySequence - Cinematic text crawl with starfield background
 * Used for Prologue, Midpoint Reflexion, Epilogue, and Outro.
 * 
 * Features:
 * - Black background with sparkling stars (purple/blue/cyan)
 * - Text lines scroll upward from bottom, synchronized to voice
 * - Main soundtrack plays with Low Pass Filter (dreamy/muffled)
 * - Voiceover plays on top
 * - Auto-advances to next state when voice finishes
 */
export default class StorySequence {
    constructor(game) {
        this.game = game;
        this.lines = [];
        this.voicePath = '';
        this.nextState = 'Menu';
        this.nextData = null;

        // Audio
        this.bgMusic = null;
        this.voiceAudio = null;
        this.audioCtx = null;
        this.lpFilter = null;

        // Stars
        this.stars = [];
        this.numStars = 200;

        // Text scroll
        this.scrollY = 0;
        this.lineHeight = 60;
        this.scrollSpeed = 20;
        this.time = 0;
        this.fadeIn = 0;
        this.finished = false;
        this.finishTimer = 0;

        // Shooting stars
        this.shootingStars = [];
        this.shootingStarTimer = 0;
    }

    enter(data) {
        this.lines = (data && data.lines) || [];
        this.voicePath = (data && data.voicePath) || '';
        this.nextState = (data && data.nextState) || 'Menu';
        this.nextData = (data && data.nextData) || null;
        this.time = 0;
        this.fadeIn = 0;
        this.finished = false;
        this.finishTimer = 0;
        this.shootingStars = [];
        this.shootingStarTimer = 0;
        this._advanced = false;
    }

    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.lines = [];
        this.voicePath = '';
        this.nextState = 'Menu';
        this.nextData = null;

        this.scrollY = this.game.height + 50;
        this.lineHeight = 45;
        this.scrollSpeed = 30; // pixels per second
        this.time = 0;
        this.fadeIn = 0;

        this.stars = [];
        this.shootingStars = [];
        this.shootingStarTimer = 0;

        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * this.game.width,
                y: Math.random() * this.game.height,
                size: Math.random() * 2 + 0.5,
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random(),
                color: this.randomStarColor(),
            });
        }

        this.finished = false;
        this.finishTimer = 0;
        this._advanced = false;

        // Birthday Scene special effects
        this.isBirthdayScene = false;
        this.lichtkristallTriggered = false;
        this.explosions = [];
    }

    enter(data) {
        console.log("Entering Story Sequence");
        this.reset();

        if (data) {
            this.lines = data.lines || [];
            this.voicePath = data.voicePath || '';
            this.nextState = data.nextState || 'Menu';
            this.nextData = data.nextData || null;
            // Check if this is the Birthday scene (first line check)
            if (this.lines.length > 0 && this.lines[0].includes('HAPPY BIRTHDAY')) {
                this.isBirthdayScene = true;
            }
        }

        // --- Audio Routing Logic ---
        // If it's the Birthday scene, we switch back to the main soundtrack without a filter.
        // Otherwise, it's Prologue/Reflexion (Main theme, muffled) or Epilogue/Outro (Valhalla Boss track, carried over, no filter mapping needed because the boss track isn't muffled).
        if (this.isBirthdayScene) {
            this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.4);
        } else if (this.nextState !== 'Story' && this.nextState !== 'Menu') {
            // It's the Prologue. Muffled Main Theme.
            this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, true, 0.4);
        } else if (this.lines.length > 0 && this.lines[0].includes('Reflexion')) {
            // Reflexion. Muffled Main Theme.
            this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, true, 0.4);
        }
        // NOTE: Epilogue and Outro DO NOT call playBGM here. They inherit the Valhalla track playing from the boss fight!

        if (this.voicePath) {
            // Voice overs automatically duck the BGM and apply the lowpass filter via the AudioManager
            this.game.audioManager.playVoice(this.voicePath);

            // Note: The previous logic of checking voiceAudio.duration is removed.
            // We just let the text scroll based on a fixed speed.
            const totalHeight = this.lines.length * this.lineHeight + this.game.height;
            this.scrollSpeed = totalHeight / 40; // Assume 40s duration roughly
        } else {
            // Birthday doesn't have a voice path currently
            const totalHeight = this.lines.length * this.lineHeight + this.game.height;
            this.scrollSpeed = totalHeight / 25; // 25 seconds for Birthday text
        }
    }

    exit() {
        // Only stop the BGM if we are truly exiting the story flow to the Main Menu (except if coming from Outro -> Menu skip). 
        // We let the AudioManager handle smooth crossfades elsewhere.
        if (this.nextState === 'Menu' && !this.isBirthdayScene) {
            this.game.audioManager.stopBGM();
        }
    }

    randomStarColor() {
        const colors = [
            '#8855ff', // Purple
            '#aa66ff', // Light purple
            '#5566ff', // Blue
            '#4488ff', // Bright blue
            '#00ccff', // Cyan
            '#66aaff', // Sky blue
            '#cc88ff', // Lavender
            '#ffffff', // White
            '#ffaaff', // Pink
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    spawnShootingStar() {
        const w = this.game.width;
        const h = this.game.height;
        const fromLeft = Math.random() > 0.5;
        const x = fromLeft ? -20 : w + 20;
        const y = Math.random() * h * 0.6 + 50;
        const speed = 150 + Math.random() * 200;
        const angle = fromLeft ? (-0.15 + Math.random() * 0.3) : (Math.PI - 0.3 + Math.random() * 0.3);

        this.shootingStars.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + 30,
            life: 2 + Math.random() * 2,
            maxLife: 4,
            size: 2 + Math.random() * 1.5,
            trail: [],
            color: this.randomStarColor(),
        });
    }

    update(dt) {
        this.time += dt;
        this.fadeIn = Math.min(1, this.time / 2); // 2s fade in

        // Scroll text upward
        this.scrollY -= this.scrollSpeed * dt;

        // Update star twinkle
        for (const star of this.stars) {
            star.phase += star.speed * dt * 3;
        }

        // Shooting stars — spawn gently, max 5 on screen
        this.shootingStarTimer += dt;
        if (this.shootingStarTimer > 2.5 + Math.random() * 3 && this.shootingStars.length < 5) {
            this.shootingStarTimer = 0;
            this.spawnShootingStar();
        }
        // Target the "Lichtkristall" line for the birthday scene explosion
        if (this.isBirthdayScene && !this.lichtkristallTriggered) {
            // Find the index of the Lichtkristall line
            const krIdx = this.lines.findIndex(l => l.includes('Lichtkristall'));
            if (krIdx !== -1) {
                const krY = this.scrollY + krIdx * this.lineHeight;
                // If it scrolls into the middle of the screen
                if (krY < this.game.height / 2 + 50) {
                    this.lichtkristallTriggered = true;
                    // Switch music back to main theme (without filter)
                    this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.5);
                    this.game.audioManager.playSFX('assets/audio/sfx/special.mp3', true); // generic boom/special

                    // Spawn huge golden explosion
                    for (let i = 0; i < 400; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 50 + Math.random() * 800; // very fast burst
                        this.explosions.push({
                            x: this.game.width / 2,
                            y: krY,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 2 + Math.random() * 2,
                            maxLife: 4,
                            size: 2 + Math.random() * 6,
                            color: Math.random() > 0.5 ? '#fdbf00' : '#ffffff'
                        });
                    }
                }
            }
        }

        // Update golden explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.x += exp.vx * dt;
            exp.y += exp.vy * dt;
            exp.vy += 200 * dt; // gravity
            exp.life -= dt;
            if (exp.life <= 0) this.explosions.splice(i, 1);
        }

        // Update shooting stars
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const ss = this.shootingStars[i];
            ss.x += ss.vx * dt;
            ss.y += ss.vy * dt;
            ss.life -= dt;
            // Update trail positions
            ss.trail.unshift({ x: ss.x, y: ss.y });
            if (ss.trail.length > 12) ss.trail.pop();
            if (ss.life <= 0) this.shootingStars.splice(i, 1);
        }

        // Check for advancement (only fire once)
        if (this._advanced) return;
        const p1 = this.game.inputManager.p1;

        if (this.finished) {
            this.finishTimer += dt;
            if (this.finishTimer > 2 || (p1.lJust || p1.hJust || p1.sJust)) {
                this._advanced = true;
                this.game.stateManager.switchState(this.nextState, this.nextData);
            }
        }

        // Allow skip with any button press after 3s
        if (this.time > 3 && (p1.lJust || p1.hJust || p1.sJust)) {
            this._advanced = true;
            this.game.stateManager.switchState(this.nextState, this.nextData);
        }
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;

        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        // Sparkling stars
        for (const star of this.stars) {
            const twinkle = (Math.sin(star.phase) + 1) / 2;
            const alpha = 0.3 + twinkle * 0.7;
            const size = star.size * (0.6 + twinkle * 0.4);

            ctx.globalAlpha = alpha * this.fadeIn;
            ctx.fillStyle = star.color;
            ctx.shadowColor = star.color;
            ctx.shadowBlur = size * 3;
            ctx.beginPath();
            ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Shooting star trails
        for (const ss of this.shootingStars) {
            const alpha = Math.max(0, ss.life / ss.maxLife) * this.fadeIn;
            for (let t = 0; t < ss.trail.length; t++) {
                const trailAlpha = alpha * (1 - t / ss.trail.length) * 0.7;
                const trailSize = ss.size * (1 - t / ss.trail.length * 0.6);
                ctx.globalAlpha = trailAlpha;
                ctx.fillStyle = ss.color;
                ctx.shadowColor = ss.color;
                ctx.shadowBlur = trailSize * 4;
                ctx.beginPath();
                ctx.arc(ss.trail[t].x, ss.trail[t].y, trailSize, 0, Math.PI * 2);
                ctx.fill();
            }
            // Head glow
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = ss.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(ss.x, ss.y, ss.size * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Text lines scrolling upward (modern Outfit font)
        ctx.textAlign = 'center';

        const colorMap = {
            gold: '#fdbf00',
            cyan: '#00ffff',
            purple: '#cc88ff',
            red: '#ff4466',
        };

        // Draw explosions Behind text but in front of stars
        for (const exp of this.explosions) {
            const alpha = Math.max(0, exp.life / exp.maxLife) * this.fadeIn;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = exp.color;
            ctx.shadowColor = exp.color;
            ctx.shadowBlur = exp.size * 2;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        for (let i = 0; i < this.lines.length; i++) {
            const y = this.scrollY + i * this.lineHeight;

            if (y > -40 && y < h + 40) {
                const fadeZone = 150;
                let alpha = this.fadeIn;
                if (y < fadeZone) alpha *= y / fadeZone;
                else if (y > h - fadeZone) alpha *= (h - y) / fadeZone;
                alpha = Math.max(0, Math.min(1, alpha));

                ctx.globalAlpha = alpha;
                this.drawColoredLine(ctx, this.lines[i], w / 2, y, colorMap);
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Skip hint
        if (this.time > 5) {
            ctx.globalAlpha = 0.3;
            ctx.font = '12px "Press Start 2P"'; // Adjusted size for retro font
            ctx.textAlign = 'right';
            ctx.fillStyle = '#666';
            ctx.fillText('PRESS ATTACK TO SKIP ▸', w - 40, h - 25);
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Parse and render a line with {color:text} markup.
     * Renders each segment with the correct color, centered.
     */
    drawColoredLine(ctx, rawLine, cx, y, colorMap) {
        // Parse segments: plain text or {color:text}
        const segments = [];
        const regex = /\{(\w+):([^}]+)\}/g;
        let lastIdx = 0;
        let match;

        while ((match = regex.exec(rawLine)) !== null) {
            if (match.index > lastIdx) {
                segments.push({ text: rawLine.slice(lastIdx, match.index), color: '#ffffff' });
            }
            segments.push({ text: match[2], color: colorMap[match[1]] || '#ffffff' });
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < rawLine.length) {
            segments.push({ text: rawLine.slice(lastIdx), color: '#ffffff' });
        }

        // Empty line = spacer
        if (segments.length === 0) return;

        // Measure total width for centering
        ctx.font = '20px "Press Start 2P"'; // Adjusted size for retro font
        let totalWidth = 0;
        for (const seg of segments) totalWidth += ctx.measureText(seg.text).width;

        // If too wide, scale down
        if (totalWidth > this.game.width - 60) {
            ctx.font = '14px "Press Start 2P"'; // Adjusted size for retro font
            totalWidth = 0;
            for (const seg of segments) totalWidth += ctx.measureText(seg.text).width;
        }

        // Draw centered
        let drawX = cx - totalWidth / 2;
        for (const seg of segments) {
            const segW = ctx.measureText(seg.text).width;
            ctx.fillStyle = seg.color;

            // Add glow for colored text
            if (seg.color !== '#ffffff') {
                ctx.shadowColor = seg.color;
                ctx.shadowBlur = 12;
            } else {
                ctx.shadowColor = '#8855ff';
                ctx.shadowBlur = 6;
            }

            ctx.textAlign = 'left';
            ctx.fillText(seg.text, drawX, y);
            drawX += segW;
        }
        ctx.shadowBlur = 0;
    }
}
