/**
 * StorySequence - Cinematic text crawl with starfield background
 * Used for Prologue, Midpoint Reflexion, Epilogue, Outro, and Birthday Scene.
 *
 * Features:
 * - Black background with sparkling stars (purple/blue/cyan)
 * - Text lines scroll upward from bottom, synchronized to voice
 * - Audio routed entirely through the global AudioManager
 * - Voiceover plays on top with low-pass filter
 * - Auto-advances to next state when voice finishes or text scrolls past
 * - Birthday Scene: golden "Lichtkristall" explosion effect
 */
export default class StorySequence {
    constructor(game) {
        this.game = game;
        this.lines = [];
        this.voicePath = '';
        this.nextState = 'Menu';
        this.nextData = null;

        this.scrollY = 0;
        this.lineHeight = 45;
        this.scrollSpeed = 30;
        this.time = 0;
        this.fadeIn = 0;
        this.finished = false;
        this.finishTimer = 0;
        this._advanced = false;

        this.stars = [];
        this.shootingStars = [];
        this.shootingStarTimer = 0;

        // Birthday Scene special effects
        this.isBirthdayScene = false;
        this.lichtkristallTriggered = false;
        this.explosions = [];
    }

    enter(data) {
        console.log("Entering Story Sequence");

        // Reset state
        this.time = 0;
        this.fadeIn = 0;
        this.finished = false;
        this.finishTimer = 0;
        this._advanced = false;
        this.shootingStars = [];
        this.shootingStarTimer = 0;
        this.isBirthdayScene = false;
        this.lichtkristallTriggered = false;
        this._unvoicedReadTimerStarted = false;
        this.explosions = [];
        this.startedOwnBGM = false;

        // Parse data
        this.lines = (data && data.lines) || [];
        this.voicePath = (data && data.voicePath) || '';
        this.nextState = (data && data.nextState) || 'Menu';
        this.nextData = (data && data.nextData) || null;
        this.unlockedFighter = (data && data.unlockedFighter) || null;

        if (this.unlockedFighter) {
            const key = `${this.unlockedFighter.id}_front.png`;
            if (!this.game.assetManager.images[key]) {
                const path = `assets/sprites/${this.unlockedFighter.folder}/2D/${key}`;
                this.game.assetManager.queueImage(key, path);
                this.game.assetManager.loadAll(); // Kick off lazy-load
            }
        }

        // Start text from bottom of screen
        this.scrollY = this.game.height + 50;

        // Check if this is the Birthday scene
        if (this.lines.length > 0 && this.lines[0].includes('HAPPY BIRTHDAY')) {
            this.isBirthdayScene = true;
            // Birthday: text scrolls up from bottom at gentle speed, stops when centered
            this.scrollSpeed = 40;
        }

        // Generate stars
        this.stars = [];
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

        // --- Audio Routing Logic ---
        // During voiceover scenes, BGM plays MUFFLED (low-pass filter).
        // Voice always plays CLEAN on top.
        if (this.isBirthdayScene) {
            // Birthday: main soundtrack, clean
            this.game.audioManager.playBGM('assets/audio/music/Main_soundtrack.wav', true, false, 0.4);
            this.startedOwnBGM = true;
        } else if (this.lines.length > 0 && this.lines[0].includes('Nicht jede')) {
            // Prologue: Main Theme MUFFLED (voice narrates clean on top)
            this.game.audioManager.playBGM('assets/audio/music/Main_soundtrack.wav', true, this.game.settings.bgmFilterEnabled, 0.4);
            this.startedOwnBGM = true;
        } else if (this.lines.length > 0 && this.lines[0].includes('Arenen')) {
            // Reflexion: Main Theme MUFFLED (voice narrates clean on top)
            this.game.audioManager.playBGM('assets/audio/music/Main_soundtrack.wav', true, this.game.settings.bgmFilterEnabled, 0.4);
            this.startedOwnBGM = true;
        } else if (this.lines.length > 0 && this.lines[0].includes('Der letzte')) {
            // Epilogue: Valhalla music MUFFLED
            this.game.audioManager.playBGM(this.game.audioManager.currentPath, true, this.game.settings.bgmFilterEnabled, 0.4);
            this.startedOwnBGM = false;
        } else if (this.lines.length > 0 && this.lines[0].includes('Der Kampf')) {
            // Outro: Valhalla music MUFFLED
            this.game.audioManager.playBGM(this.game.audioManager.currentPath, true, this.game.settings.bgmFilterEnabled, 0.4);
            this.startedOwnBGM = false;
        }

        // Calculate base total height
        const totalHeight = this.lines.length * this.lineHeight + this.game.height * 0.5; // Allow text to scroll to center before stopping

        if (this.voicePath) {
            this.game.audioManager.playVoice(this.voicePath, () => {
                this.finished = true;
            });
            // Default arbitrary speed until duration loads
            this.scrollSpeed = totalHeight / 70;
        } else {
            this.scrollSpeed = totalHeight / 15;
            // We now handle auto-finishing dynamically in the update loop 
            // once the text reaches the center of the screen.
        }

        // Fade-out state for smooth transitions
        this.fadeOut = 0;   // 0 = fully visible, 1 = fully faded
        this.fading = false;
    }

    exit() {
        if (this.autoFinishTimer) clearTimeout(this.autoFinishTimer);
        // Always stop voice when leaving a story scene
        this.game.audioManager.stopVoice();

        // Stop BGM if this scene started its own music (Prologue/Reflexion/Birthday)
        // Epilogue/Outro inherit the boss track and don't start their own BGM, so it persists
        if (this.startedOwnBGM) {
            this.game.audioManager.stopBGM();
        }
    }

    randomStarColor() {
        const colors = [
            '#8855ff', '#aa66ff', '#5566ff', '#4488ff',
            '#00ccff', '#66aaff', '#cc88ff', '#ffffff', '#ffaaff',
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
        this.fadeIn = Math.min(1, this.time / 2);

        // Smooth fade-out transition
        if (this.fading) {
            this.fadeOut += dt / 2; // 2 second fade
            if (this.fadeOut >= 1 && !this._advanced) {
                this._advanced = true;
                this.game.stateManager.switchState(this.nextState, this.nextData);
            }
            return; // Stop all other updates during fade
        }

        // Sync text scroll speed to audio duration if playing
        if (this.voicePath && !this._hasGoodSpeed && this.game.audioManager.voiceChannel) {
            const actualDuration = this.game.audioManager.voiceChannel.duration;
            const totalHeight = this.lines.length * this.lineHeight + this.game.height * 0.5;
            if (!isNaN(actualDuration) && actualDuration > 1 && actualDuration !== Infinity) {
                // Add a small 2-second buffer so text finishes slightly after voice ends naturally
                this.scrollSpeed = totalHeight / (actualDuration + 2);
                this._hasGoodSpeed = true;
            } else if (this.time > 2.0) {
                // If 2 seconds have passed and duration is STILL broken/NaN, 
                // Safari or macOS has 100% blocked the audio. Fallback to a safe reading speed!
                console.warn("Audio duration unavailable/blocked. Using 15s fallback speed.");
                this.scrollSpeed = totalHeight / 15;
                this._hasGoodSpeed = true;
            }
        }

        // Scroll text upward
        if (!this.finished) {
            const lastLineY = this.scrollY + (this.lines.length * this.lineHeight);
            // Birthday: stop when the text block is vertically centered (not too high!)
            const totalTextHeight = this.lines.length * this.lineHeight;
            const centeredY = (this.game.height - totalTextHeight) / 2 + 30; // +30 to sit slightly lower
            if (this.isBirthdayScene && this.scrollY <= centeredY) {
                // BIRTHDAY CARD: Freeze text permanently centered. Never auto-advance.
                this.scrollY = centeredY;
                this.scrollSpeed = 0;
                // Don't set finished — birthday stays on screen forever until manual exit
            } else if (!this.voicePath && lastLineY <= this.game.height / 2) {
                // UNVOICED NON-BIRTHDAY: Freeze at center + start reading timer
                this.scrollSpeed = 0;
                if (!this._unvoicedReadTimerStarted) {
                    this._unvoicedReadTimerStarted = true;
                    setTimeout(() => {
                        this.finished = true;
                    }, 10000); // 10 seconds reading time
                }
            } else {
                this.scrollY -= this.scrollSpeed * dt;
            }
        }

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

        // --- Birthday Scene: "Lichtkristall" explosion trigger ---
        if (this.isBirthdayScene && !this.lichtkristallTriggered) {
            const krIdx = this.lines.findIndex(l => l.includes('Lichtkristall'));
            if (krIdx !== -1) {
                const krY = this.scrollY + krIdx * this.lineHeight;
                if (krY < this.game.height / 2 + 50) {
                    this.lichtkristallTriggered = true;
                    this.game.audioManager.playBGM('assets/audio/music/Main_soundtrack.wav', true, false, 0.5);

                    // Spawn huge golden explosion
                    for (let i = 0; i < 400; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 50 + Math.random() * 800;
                        this.explosions.push({
                            x: this.game.width / 2,
                            y: krY,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 2 + Math.random() * 2,
                            maxLife: 4,
                            size: 2 + Math.random() * 6,
                            color: Math.random() > 0.5 ? '#fdbf00' : '#ffffff',
                        });
                    }
                }
            }
            // If no Lichtkristall line, trigger immediately
            if (krIdx === -1 && this.time > 1) {
                this.lichtkristallTriggered = true;
            }
        }

        // --- Birthday Scene: CONTINUOUS MEGA FIREWORKS ---
        if (this.isBirthdayScene && this.time > 0.5) {
            this._fireworkTimer = (this._fireworkTimer || 0) + dt;
            // Spawn firework bursts every 0.3 seconds
            if (this._fireworkTimer > 0.3) {
                this._fireworkTimer = 0;
                const burstX = Math.random() * this.game.width;
                const burstY = Math.random() * this.game.height * 0.5 + 50;
                const colors = ['#ff0055', '#ffaa00', '#00ff88', '#00aaff', '#ff44ff', '#ffff00', '#ff6600', '#00ffff'];
                const burstColor = colors[Math.floor(Math.random() * colors.length)];
                for (let i = 0; i < 60; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 40 + Math.random() * 300;
                    this.explosions.push({
                        x: burstX,
                        y: burstY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 50,
                        size: 1.5 + Math.random() * 3,
                        life: 1.5 + Math.random() * 1.5,
                        maxLife: 1.5 + Math.random() * 1.5,
                        color: burstColor,
                        gravity: 60 + Math.random() * 40,
                    });
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
            ss.trail.unshift({ x: ss.x, y: ss.y });
            if (ss.trail.length > 12) ss.trail.pop();
            if (ss.life <= 0) this.shootingStars.splice(i, 1);
        }

        // Check for advancement (only fire once)
        if (this._advanced) return;
        const p1 = this.game.inputManager.p1;

        // Voiceover ended → auto-advance with smooth fade (but NOT for Birthday!)
        if (this.finished && !this.fading && !this.isBirthdayScene) {
            this.finishTimer += dt;
            if (this.finishTimer > 1) {
                this.fading = true; // Start smooth fade-out
            }
        }

        // Allow skip with any button press after 5s (starts fade, doesn't cut)
        // Birthday: this is the ONLY way to exit
        if (this.time > 5 && (p1.lJust || p1.hJust || p1.sJust) && !this.fading) {
            this.fading = true;
        }
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;

        // Black background
        // Fill slightly past bounds to prevent lower sub-pixel artifacting/glitching
        ctx.fillStyle = '#000000';
        ctx.fillRect(-10, -10, w + 20, h + 50);

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

        // Golden explosion particles (Birthday Scene)
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

        // Text lines scrolling upward
        ctx.textAlign = 'center';

        for (let i = 0; i < this.lines.length; i++) {
            const y = this.scrollY + i * this.lineHeight;

            if (y > -40 && y < h + 40) {
                const fadeZone = 150;
                let alpha = this.fadeIn;
                if (y < fadeZone) alpha *= y / fadeZone;
                else if (y > h - fadeZone) alpha *= (h - y) / fadeZone;
                alpha = Math.max(0, Math.min(1, alpha));

                ctx.globalAlpha = alpha;
                this.drawStyledLine(ctx, this.lines[i], w / 2, y);
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Draw unlocked character card if present — BEHIND text for birthday, ON TOP for others
        if (this.unlockedFighter && !this.isBirthdayScene) {
            this._drawUnlockCard(ctx, w, h);
        }

        // Skip hint — Birthday shows "HAUPTMENÜ", others show "SKIP"
        if (this.time > 5 && !this.fading) {
            ctx.globalAlpha = 0.5;
            ctx.font = '300 18px "Outfit"';
            ctx.textAlign = 'center';
            ctx.fillStyle = this.isBirthdayScene ? '#ffaa00' : '#666';
            ctx.fillText(
                this.isBirthdayScene ? '⬅ TASTE DRÜCKEN FÜR HAUPTMENÜ ⬅' : 'PRESS ATTACK TO SKIP ▸',
                w / 2, h - 25
            );
            ctx.globalAlpha = 1;
        }

        // Smooth fade-out overlay
        if (this.fading && this.fadeOut > 0) {
            ctx.globalAlpha = Math.min(1, this.fadeOut);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }
    }

    /** Draw the unlocked character card (used by non-birthday scenes) */
    _drawUnlockCard(ctx, w, h) {
        const cx = w / 2;
        const cy = h * 0.4;
        ctx.globalAlpha = this.fadeIn;

        // "BLOODLINE UNLOCKED" Title
        ctx.fillStyle = '#ff0055';
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px "Press Start 2P"';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 10;
        ctx.fillText("BLOODLINE UNLOCKED:", cx, cy - 140);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px "Press Start 2P"';
        ctx.fillText(this.unlockedFighter.name.toUpperCase(), cx, cy - 90);
        ctx.shadowBlur = 0;

        // Portrait
        const portraitKey = `${this.unlockedFighter.id}_front.png`;
        const portrait = this.game.assetManager.images[portraitKey];

        // Draw box background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 40;
        ctx.fillRect(cx - 150, cy - 60, 300, 420);

        ctx.shadowBlur = 0;
        if (portrait) {
            ctx.drawImage(portrait, cx - 130, cy - 40, 260, 380);
        } else {
            ctx.fillStyle = '#111';
            ctx.fillRect(cx - 130, cy - 40, 260, 380);
        }

        // Glowing border
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 6;
        ctx.strokeRect(cx - 150, cy - 60, 300, 420);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    /**
     * Parse and render a line with {hl:text} and {u:text} markup.
     * hl = Keano-blue highlight, u = underlined epic word.
     * Everything else renders in clean white.
     */
    drawStyledLine(ctx, rawLine, cx, y) {
        const KEANO_BLUE = '#00d4ff';
        const segments = [];
        const regex = /\{(hl|u):([^}]+)\}/g;
        let lastIdx = 0;
        let match;

        while ((match = regex.exec(rawLine)) !== null) {
            if (match.index > lastIdx) {
                segments.push({ text: rawLine.slice(lastIdx, match.index), style: 'normal' });
            }
            segments.push({ text: match[2], style: match[1] }); // 'hl' or 'u'
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < rawLine.length) {
            segments.push({ text: rawLine.slice(lastIdx), style: 'normal' });
        }

        // Empty line = spacer
        if (segments.length === 0) return;

        // Measure total width for centering
        ctx.font = '300 30px "Outfit"';
        let totalWidth = 0;
        for (const seg of segments) totalWidth += ctx.measureText(seg.text).width;

        // If too wide, scale down
        if (totalWidth > this.game.width - 100) {
            ctx.font = '300 22px "Outfit"';
            totalWidth = 0;
            for (const seg of segments) totalWidth += ctx.measureText(seg.text).width;
        }

        // Draw centered
        let drawX = cx - totalWidth / 2;
        for (const seg of segments) {
            const segW = ctx.measureText(seg.text).width;

            if (seg.style === 'hl') {
                // Keano-blue highlight with subtle glow
                ctx.fillStyle = KEANO_BLUE;
                ctx.shadowColor = KEANO_BLUE;
                ctx.shadowBlur = 8;
            } else if (seg.style === 'u') {
                // White underlined text
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 4;
            } else {
                // Normal white text, minimal glow
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            ctx.textAlign = 'left';
            ctx.fillText(seg.text, drawX, y);

            // Draw underline for {u:} segments
            if (seg.style === 'u') {
                ctx.beginPath();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.moveTo(drawX, y + 4);
                ctx.lineTo(drawX + segW, y + 4);
                ctx.stroke();
            }

            drawX += segW;
        }
        ctx.shadowBlur = 0;
    }
}
