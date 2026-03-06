import { ROSTER, STAGES } from '../data.js';
import { STORY_PROLOGUE } from '../story_data.js';

export default class MenuState {
    constructor(game) {
        this.game = game;
        this.options = ['STORY MODE', 'ARCADE MODE', 'VERSUS MODE', 'OPTIONS'];
        this.selectedIndex = 0;
        this.inputCooldown = 0;
        this.time = 0;
        this.bgMusic = null;

        // Credits system
        this.credits = 3;
        this.maxCredits = 3;
        this.coinAngle = 0;

        // Story completion flag (unlocks Arcade/Versus)
        this.storyCompleted = false;

        // Sub-menu state
        this.inOptions = false;
        this.optionIndex = 0;

        // Game settings (merge with existing — Game.js may have already set bgmFilterEnabled etc.)
        Object.assign(this.game.settings, {
            timer: this.game.settings.timer || 99,
            speed: this.game.settings.speed || 1.0,
            difficulty: this.game.settings.difficulty || 'NORMAL',
            musicVolume: this.game.settings.musicVolume ?? 0.3,
            voiceVolume: this.game.settings.voiceVolume ?? 0.9,
            sfxVolume: this.game.settings.sfxVolume ?? 0.5,
        });

        // Ambient Background Particles
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                speed: 0.02 + Math.random() * 0.05,
                size: 2 + Math.random() * 5,
                alpha: Math.random(),
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    enter(data) {
        console.log("Entering Main Menu");
        this.selectedIndex = 0;
        this.inputCooldown = 15;
        this.inOptions = false;

        // Check story completion
        try {
            this.storyCompleted = localStorage.getItem('lotl_story_complete') === 'true';
        } catch (e) { this.storyCompleted = false; }

        // Play main theme — start quiet and fade in gently after the calm splash screen
        this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.02);
        // Gradually ramp volume up over ~2 seconds
        this._fadeInTimer = 0;
        this._fadeInTarget = this.game.settings.musicVolume;
    }

    exit() {
        // Do not stop music here if transitioning to character select or story
        // The new state will handle changing or stopping it via AudioManager
    }

    update(dt) {
        this.time += dt;
        this.coinAngle += dt * 3; // Spinning coins

        // Update ambient particles
        for (const p of this.particles) {
            p.y -= p.speed * dt;
            p.wobble += dt;
            p.x += Math.sin(p.wobble) * 0.0005; // horizontal drift
            if (p.y < 0) {
                p.y = 1;
                p.x = Math.random();
            }
        }

        // Smooth BGM fade-in over 2 seconds
        if (this._fadeInTimer !== undefined && this._fadeInTimer < 2.0) {
            this._fadeInTimer += dt;
            const vol = Math.min(this._fadeInTarget, (this._fadeInTimer / 2.0) * this._fadeInTarget);
            if (this.game.audioManager.gainNode && this.game.audioManager.audioCtx) {
                this.game.audioManager.gainNode.gain.setTargetAtTime(vol, this.game.audioManager.audioCtx.currentTime, 0.1);
            } else if (this.game.audioManager.bgm) {
                this.game.audioManager.bgm.volume = vol;
            }
        }

        const p1 = this.game.inputManager.p1;

        // Unlock hidden channels on first user interaction
        if (p1.lJust || p1.hJust || p1.sJust || p1.up || p1.down || p1.left || p1.right) {
            if (this.game.audioManager.unlockAudio) {
                this.game.audioManager.unlockAudio();
            }
        }

        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }

        if (this.inOptions) {
            this.updateOptions(p1);
            return;
        }

        if (this.inputCooldown <= 0) {
            if (p1.up) {
                this.selectedIndex--;
                if (this.selectedIndex < 0) this.selectedIndex = this.options.length - 1;
                this.inputCooldown = 15;
                this.playBlip();
            } else if (p1.down) {
                this.selectedIndex++;
                if (this.selectedIndex > this.options.length - 1) this.selectedIndex = 0;
                this.inputCooldown = 15;
                this.playBlip();
            }
        }

        if ((p1.h || p1.l || p1.s) && this.inputCooldown <= 0) {
            if (this.credits <= 0) return; // No credits!

            if (this.selectedIndex === 0) {
                // STORY MODE
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.startStoryMode();
            } else if (this.selectedIndex === 1) {
                // ARCADE MODE — locked until story complete
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: true });
                }, 500);
            } else if (this.selectedIndex === 2) {
                // VERSUS MODE — locked until story complete
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: false });
                }, 500);
            } else if (this.selectedIndex === 3) {
                // OPTIONS
                this.playConfirm();
                this.inOptions = true;
                this.optionIndex = 0;
                this.inputCooldown = 15;
            }
        }
    }

    updateOptions(p1) {
        const optCount = 8; // timer, speed, difficulty, music, voice, sfx, eq, fullscreen
        if (this.inputCooldown <= 0) {
            if (p1.up) {
                this.optionIndex = (this.optionIndex - 1 + optCount) % optCount;
                this.inputCooldown = 12;
                this.playBlip();
            } else if (p1.down) {
                this.optionIndex = (this.optionIndex + 1) % optCount;
                this.inputCooldown = 12;
                this.playBlip();
            } else if (p1.right) {
                this.adjustOption(1);
                this.inputCooldown = 10;
            } else if (p1.left) {
                this.adjustOption(-1);
                this.inputCooldown = 10;
            } else if (p1.s) {
                // Back
                this.inOptions = false;
                this.inputCooldown = 15;
            }
        }
    }

    adjustOption(dir) {
        const s = this.game.settings;
        switch (this.optionIndex) {
            case 0: // Timer
                s.timer = s.timer === 99 ? 66 : 99;
                break;
            case 1: // Speed
                s.speed = Math.max(0.5, Math.min(2.0, s.speed + dir * 0.25));
                break;
            case 2: // Difficulty
                const diffs = ['EASY', 'NORMAL', 'HARD'];
                const idx = diffs.indexOf(s.difficulty);
                s.difficulty = diffs[Math.max(0, Math.min(2, idx + dir))];
                break;
            case 3: // Music Vol
                s.musicVolume = Math.max(0, Math.min(1, s.musicVolume + dir * 0.1));
                if (this.bgMusic) this.bgMusic.volume = s.musicVolume;
                break;
            case 4: // Voice Vol
                s.voiceVolume = Math.max(0, Math.min(1, s.voiceVolume + dir * 0.1));
                break;
            case 5: // SFX Vol
                s.sfxVolume = Math.max(0, Math.min(1, s.sfxVolume + dir * 0.1));
                break;
            case 6: // EQ (BGM Filter)
                s.bgmFilterEnabled = !s.bgmFilterEnabled;
                break;
            case 7: // Fullscreen
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => { });
                } else {
                    document.exitFullscreen().catch(() => { });
                }
                break;
        }
    }

    async startStoryMode() {
        const keano = ROSTER[0];
        const opponent = ROSTER[1];
        const stageId = opponent.stageId;
        const stage = STAGES[stageId];

        // Preload robust combat sprites for both fighters using Combat's centralized logic
        const combatState = this.game.stateManager.states['Combat'];
        if (combatState && typeof combatState.preloadFighterSprites === 'function') {
            combatState.preloadFighterSprites(keano);
            combatState.preloadFighterSprites(opponent);
        }
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }
        await this.game.assetManager.loadAll();

        const combatData = {
            p1: keano,
            p2: { ...opponent, rosterIndex: 1 },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true, // Special flag to denote true story run vs. pure arcade mode
            arcadeIndex: 1,
            arcadeWins: 0,
        };

        this.game.audioManager.stopBGM();
        this.game.stateManager.switchState('Story', {
            ...STORY_PROLOGUE,
            nextState: 'VersusIntro',
            nextData: combatData,
        });
    }

    async startEndgameTest() {
        const keano = ROSTER[0];
        const pushIndex = ROSTER.length - 2; // Index 13: Putin
        const opponent = ROSTER[pushIndex];
        const stageId = opponent.stageId;
        const stage = STAGES[stageId];

        const combatState = this.game.stateManager.states['Combat'];
        if (combatState && typeof combatState.preloadFighterSprites === 'function') {
            combatState.preloadFighterSprites(keano);
            combatState.preloadFighterSprites(opponent);
        }
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }
        await this.game.assetManager.loadAll();

        const combatData = {
            p1: keano,
            p2: { ...opponent, rosterIndex: pushIndex },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true, // Run as story so we get the Epilogue sequence afterwards
            arcadeIndex: pushIndex,
            arcadeWins: pushIndex, // Ensure it registers as the final boss victory
        };

        this.game.audioManager.stopBGM();
        this.game.stateManager.switchState('VersusIntro', combatData);
    }

    // Sound stubs — removed synthesized oscillator sounds
    playBlip() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playConfirm() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        [600, 800].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + (idx * 0.1));
            gain.gain.setValueAtTime(0, now + (idx * 0.1));
            gain.gain.linearRampToValueAtTime(0.1, now + (idx * 0.1) + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.1) + 0.2);
            // Lowpass filter for smooth 16-bit sound
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 2000;
            osc.connect(gain);
            gain.connect(lp);
            lp.connect(ctx.destination);
            osc.start(now + (idx * 0.1));
            osc.stop(now + (idx * 0.1) + 0.2);
        });
    }

    playBuzzer() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    // Draw random lightning from top to bottom
    _drawLightning(ctx) {
        if (!this.lightningActive) {
            // Random chance to strike
            if (Math.random() < 0.005) { // 0.5% chance per frame (~once every few seconds typical)
                this.lightningActive = true;
                this.lightningTimer = 0.5; // lasts half a second
                this.lightningPoints = [];

                let startX = Math.random() * this.game.width;
                let currentX = startX;
                let currentY = 0;
                this.lightningPoints.push({ x: currentX, y: currentY });

                while (currentY < this.game.height) {
                    currentX += (Math.random() - 0.5) * 100;
                    currentY += Math.random() * 50 + 20;
                    this.lightningPoints.push({ x: currentX, y: currentY });
                }
            }
        } else {
            this.lightningTimer -= 1 / 60; // Approx 60fps decrement
            if (this.lightningTimer <= 0) {
                this.lightningActive = false;
            } else {
                // Draw lightning
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.lightningPoints[0].x, this.lightningPoints[0].y);
                for (let i = 1; i < this.lightningPoints.length; i++) {
                    ctx.lineTo(this.lightningPoints[i].x, this.lightningPoints[i].y);
                }

                // Opacity flickers
                let alpha = (Math.random() * 0.5 + 0.5) * (this.lightningTimer / 0.5);

                ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 15;
                ctx.stroke();


                ctx.restore();
            }
        }
    }

    draw(ctx) {
        // Draw original background image first
        const bg = this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        // Modern animated gradient background as an overlay
        ctx.save();
        ctx.globalAlpha = 0.5; // Let the background image show through clearly
        const t = this.time * 0.3;
        const grad = ctx.createLinearGradient(0, 0, this.game.width, this.game.height);

        // Deep modern synthwave/cyberpunk colors
        const color1 = `hsl(${190 + Math.sin(t) * 20}, 90%, 12%)`; // Deep Cyan/Blue
        const color2 = `hsl(${280 + Math.cos(t) * 20}, 90%, 8%)`;  // Deep Purple

        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.restore();

        // Draw ambient particles (slightly softer flicker)
        ctx.save();
        ctx.fillStyle = '#00ffff';
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha * (0.2 + Math.sin(this.time * 2 + p.wobble) * 0.15);
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x * this.game.width, p.y * this.game.height, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        this._drawLightning(ctx);

        if (this.inOptions) {
            this.drawOptions(ctx);
            return;
        }

        // ─── KEANO ROMEO ─── Neon Cyan + Deep 3D Shadow + Slow Dimmer
        const pulse = (Math.sin(this.time * 0.8) + 1) / 2;
        const glowSize = 20 + pulse * 50;
        const cx = this.game.width / 2;

        // Push everything down
        const titleY = this.game.height * 0.30;

        ctx.textAlign = 'center';
        ctx.font = 'bold 160px "Press Start 2P"';

        ctx.save();

        // Stretch width by 1.2
        ctx.translate(cx, titleY);
        ctx.scale(1.2, 1);
        ctx.translate(-cx, -titleY);

        // Deep 3D Shadow
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000810';
        for (let i = 25; i >= 1; i--) {
            ctx.fillText("KEANO", cx, titleY + 10 + i * 2);
            ctx.fillText("ROMEO", cx, titleY + 140 + i * 2);
        }

        // Inner shadow edge
        ctx.fillStyle = '#003355';
        ctx.fillText("KEANO", cx, titleY + 15);
        ctx.fillText("ROMEO", cx, titleY + 145);

        // Core text - Enhanced contrast glow, but keep base bright enough to hide overlaps
        ctx.fillStyle = `rgba(0, 255, 255, ${0.7 + pulse * 0.3})`;
        ctx.shadowColor = `rgba(0, 255, 255, ${0.1 + pulse * 0.8})`; // Dynamic shadow alpha 
        ctx.shadowBlur = glowSize * 0.8;
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);

        ctx.shadowBlur = (glowSize + 25) * 0.8; // Second layer of glow
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);

        ctx.restore();
        ctx.shadowBlur = 0;

        // ─── LORD OF THE LIGHT I ───
        ctx.font = 'bold 34px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText("LORD OF THE LIGHT I", cx, titleY + 235);
        ctx.shadowBlur = 0;

        // ─── Menu Options ───
        ctx.font = 'bold 36px "Press Start 2P"';
        const menuStartY = this.game.height * 0.65; // Pushed down
        for (let i = 0; i < this.options.length; i++) {
            const y = menuStartY + (i * 65);
            const isLocked = (i === 1 || i === 2) && !this.storyCompleted;

            if (i === this.selectedIndex) {
                ctx.fillStyle = isLocked ? '#663333' : '#00ffff';
                const label = isLocked ? `🔒 ${this.options[i]}` : `> ${this.options[i]} <`;
                ctx.fillText(label, cx, y);
            } else {
                ctx.fillStyle = isLocked ? '#444444' : '#aaaaaa';
                const label = isLocked ? `🔒 ${this.options[i]}` : this.options[i];
                ctx.fillText(label, cx, y);
            }
        }

        // ─── INSERT COIN + Credits ───
        this.drawInsertCoin(ctx);
    }

    drawInsertCoin(ctx) {
        const cx = this.game.width / 2;
        const y = this.game.height - 80;

        // Credits display - Bottom right in Cyan
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`CREDITS: ${this.credits}`, this.game.width - 30, this.game.height - 30);

        // Reset textAlign for the rest of the text
        ctx.textAlign = 'center';

        // INSERT COIN text (blinks when no credits)
        if (this.credits <= 0) {
            const blink = Math.sin(this.time * 6) > 0;
            if (blink) {
                ctx.font = 'bold 40px "Press Start 2P"';
                ctx.fillStyle = '#ff0033';
                ctx.shadowColor = '#ff0033';
                ctx.shadowBlur = 15;
                ctx.fillText('INSERT COIN', cx, y);
                ctx.shadowBlur = 0;
            }
        } else {
            ctx.font = 'bold 30px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.shadowColor = '#fdbf00';
            ctx.shadowBlur = 10;
            ctx.fillText('INSERT COIN', cx, y);
            ctx.shadowBlur = 0;
        }

        // Spinning coins (left and right)
        this.drawSpinningCoin(ctx, cx - 280, y - 10);
        this.drawSpinningCoin(ctx, cx + 280, y - 10);

        // Insert coin via button press OR screen tap
        if (this.credits <= 0) {
            const p1 = this.game.inputManager.p1;
            // Accept any input: keyboard punch/kick, touchpad button, or screen tap
            if (p1.l || p1.h || p1.lJust || p1.hJust || p1.sJust || p1.up || p1.down) {
                this.credits = this.maxCredits;
                this.inputCooldown = 15;
                this.game.audioManager.unlockAudio();
            }
        }
    }

    drawSpinningCoin(ctx, x, y) {
        ctx.save();
        const scaleX = Math.cos(this.coinAngle);
        const absScale = Math.abs(scaleX);

        // 3D coin effect
        ctx.translate(x, y);
        ctx.scale(scaleX > 0 ? absScale : -absScale, 1);

        // Outer ring
        ctx.fillStyle = '#fdbf00';
        ctx.shadowColor = '#fdbf00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Star/L symbol
        ctx.fillStyle = '#cc8800';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.textAlign = 'center';
        if (absScale > 0.3) {
            ctx.fillText('L', 0, 7);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawOptions(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        const cx = this.game.width / 2;
        ctx.textAlign = 'center';

        // Title
        ctx.font = 'bold 60px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('OPTIONS', cx, 120);

        const s = this.game.settings;
        const opts = [
            { label: 'TIMER', value: `${s.timer}s` },
            { label: 'SPEED', value: `${(s.speed * 100).toFixed(0)}%` },
            { label: 'DIFFICULTY', value: s.difficulty },
            { label: 'MUSIC', value: `${(s.musicVolume * 100).toFixed(0)}%` },
            { label: 'VOICE', value: `${(s.voiceVolume * 100).toFixed(0)}%` },
            { label: 'SFX', value: `${(s.sfxVolume * 100).toFixed(0)}%` },
            { label: 'EQ FILTER', value: s.bgmFilterEnabled ? 'ON' : 'OFF' },
            { label: 'FULLSCREEN', value: document.fullscreenElement ? 'ON' : 'OFF' },
        ];

        ctx.font = 'bold 28px "Press Start 2P"';
        const startY = 250;
        for (let i = 0; i < opts.length; i++) {
            const y = startY + i * 70;
            const isSel = i === this.optionIndex;
            ctx.fillStyle = isSel ? '#00ffff' : '#888888';

            // Label on left
            ctx.textAlign = 'right';
            ctx.fillText(opts[i].label, cx - 40, y);

            // Value on right with arrows
            ctx.textAlign = 'left';
            if (isSel) {
                ctx.fillText(`< ${opts[i].value} >`, cx + 40, y);
            } else {
                ctx.fillText(opts[i].value, cx + 60, y);
            }
        }

        // Back hint
        ctx.font = '18px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('PRESS PUNCH (J) OR KICK (K) TO GO BACK', cx, this.game.height - 60);
    }
}
