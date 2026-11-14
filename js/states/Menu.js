import { ROSTER, STAGES } from '../data.js';
import { STORY_PROLOGUE } from '../story_data.js';
import { preloadFighterSprites, preloadStageAssets } from '../core/AssetPreloader.js';

export default class MenuState {
    constructor(game) {
        this.game = game;
        this.options = ['STORY MODE', 'ARCADE MODE', 'VERSUS MODE', 'ONLINE / KOOP', 'MISCHPULT / OPTIONEN'];
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
        this.isTransitioning = false;
        this._draggingSlider = false;

        // Ensure all mixer channels exist in game.settings
        Object.assign(this.game.settings, {
            timer: this.game.settings.timer || 99,
            speed: this.game.settings.speed || 1.0,
            difficulty: this.game.settings.difficulty || 'NORMAL',
            masterVolume: this.game.settings.masterVolume ?? 1.0,
            musicVolume: this.game.settings.musicVolume ?? 0.22,
            sfxVolume: this.game.settings.sfxVolume ?? 0.90,
            voiceVolume: this.game.settings.voiceVolume ?? 1.00,
            announcerVolume: this.game.settings.announcerVolume ?? 0.95,
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
        // Mobile tap & drag handlers (bound references for cleanup)
        this._onMenuTap = null;
        this._onMenuMove = null;
        this._onMenuUp = null;
    }

    enter(data) {
        console.log("Entering Main Menu");
        this.selectedIndex = 0;
        this.inputCooldown = 15;
        this.inOptions = false;
        this._tapConfirmPending = false;
        this.isTransitioning = false;
        this._draggingSlider = false;

        // Check story completion
        try {
            this.storyCompleted = localStorage.getItem('lotl_story_complete') === 'true';
        } catch (e) { this.storyCompleted = false; }

        // Play main theme — start quiet and fade in gently to user's configured musicVolume
        this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.02);
        this._fadeInTimer = 0;
        this._fadeInTarget = this.game.settings.musicVolume ?? 0.22;

        // Setup direct tap & slider drag on menu for mobile & desktop
        this._setupMenuTap();
    }

    exit() {
        this._removeMenuTap();
    }

    _mapEventToCanvas(e) {
        const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
        if (window.mapTouchToCanvas) {
            return window.mapTouchToCanvas(touch.clientX, touch.clientY, this.game.canvas);
        }
        const rect = this.game.canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) * (this.game.canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (this.game.canvas.height / rect.height)
        };
    }

    _handleOptionsPointer(tx, ty, isDrag = false) {
        const cx = this.game.width / 2;
        const startY = 205;
        const rowStep = 64;
        const barX = cx - 40;
        const barW = 360;

        // Top-left back button or bottom back area
        if (!isDrag && ((tx < 340 && ty < 120) || ty >= this.game.height - 95)) {
            this.inOptions = false;
            this.inputCooldown = 15;
            this.playBlip();
            return;
        }

        for (let i = 0; i < 10; i++) {
            const rowY = startY + i * rowStep;
            if (ty >= rowY - 32 && ty <= rowY + 24 && tx >= cx - 540 && tx <= cx + 540) {
                this.optionIndex = i;
                // Rows 0..4 are volume faders
                if (i >= 0 && i <= 4) {
                    const maxVal = (i === 1) ? 1.0 : 1.5;
                    if (tx >= barX - 12 && tx <= barX + barW + 12) {
                        const ratio = Math.max(0, Math.min(1, (tx - barX) / barW));
                        const stepped = Math.round(ratio * maxVal * 20) / 20;
                        this._setSliderValue(i, stepped, !isDrag);
                        this._draggingSlider = true;
                        return;
                    } else if (!isDrag) {
                        const dir = tx < barX ? -1 : 1;
                        this.adjustOption(dir);
                        return;
                    }
                } else if (!isDrag) {
                    if (i === 8) {
                        // Reset to Street Fighter Studio Mix defaults
                        this.game.resetAudioMixDefaults?.();
                        this._fadeInTarget = this.game.settings.musicVolume;
                        this.playConfirm();
                        this.game.audioManager?.playHitImpactSound?.(true, true);
                    } else if (i === 9) {
                        this.inOptions = false;
                        this.inputCooldown = 15;
                        this.playBlip();
                    } else {
                        const dir = tx < cx ? -1 : 1;
                        this.adjustOption(dir);
                    }
                    return;
                }
            }
        }
    }

    _setSliderValue(rowIndex, val, playPreview = true) {
        const s = this.game.settings;
        if (rowIndex === 0) {
            s.masterVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 1) {
            s.musicVolume = Math.max(0, Math.min(1.0, val));
            this._fadeInTarget = s.musicVolume;
            this._fadeInTimer = 2.0;
        } else if (rowIndex === 2) {
            s.sfxVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 3) {
            s.voiceVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 4) {
            s.announcerVolume = Math.max(0, Math.min(1.5, val));
        }
        this.game.saveSettings?.();

        if (playPreview) {
            const now = performance.now();
            if (!this._lastPreviewAt || now - this._lastPreviewAt > 220) {
                this._lastPreviewAt = now;
                if (rowIndex === 2) {
                    this.game.audioManager?.playHitImpactSound?.(true, false);
                } else if (rowIndex === 3) {
                    this.game.audioManager?.playFighterVoice?.('assets/audio/voice/keano_special.mp3', 'special');
                } else if (rowIndex === 4) {
                    this.game.audioManager?.playAnnouncerVoice?.('assets/audio/voice/announcer_fight.mp3');
                }
            }
        }
    }

    /**
     * Direct tap & slider drag support for mobile & desktop.
     */
    _setupMenuTap() {
        this._removeMenuTap();

        this._onMenuTap = (e) => {
            const pt = this._mapEventToCanvas(e);
            const tx = pt.x;
            const ty = pt.y;

            // Unlock audio on any tap
            if (this.game.audioManager.unlockAudio) {
                this.game.audioManager.unlockAudio();
            }

            if (this.inOptions) {
                this._handleOptionsPointer(tx, ty, false);
                return;
            }

            // INSERT COIN: if no credits, any tap adds coins
            if (this.credits <= 0) {
                this.credits = this.maxCredits;
                this.inputCooldown = 15;
                return;
            }

            // Check if tap hits a menu item
            const menuStartY = this.game.height * 0.61;
            const itemHeight = 56;
            const hitPadding = 28;

            for (let i = 0; i < this.options.length; i++) {
                const itemY = menuStartY + (i * itemHeight);
                if (ty >= itemY - hitPadding && ty <= itemY + hitPadding) {
                    this.selectedIndex = i;
                    this._tapConfirmPending = true;
                    return;
                }
            }
        };

        this._onMenuMove = (e) => {
            if (!this.inOptions) return;
            if (e.type === 'mousemove' && e.buttons !== 1 && !this._draggingSlider) return;
            const pt = this._mapEventToCanvas(e);
            this._handleOptionsPointer(pt.x, pt.y, true);
        };

        this._onMenuUp = () => {
            this._draggingSlider = false;
        };

        this.game.canvas.addEventListener('touchend', this._onMenuTap, { passive: true });
        this.game.canvas.addEventListener('click', this._onMenuTap, { passive: true });
        this.game.canvas.addEventListener('touchmove', this._onMenuMove, { passive: true });
        this.game.canvas.addEventListener('mousemove', this._onMenuMove, { passive: true });
        window.addEventListener('mouseup', this._onMenuUp, { passive: true });
        window.addEventListener('touchend', this._onMenuUp, { passive: true });
    }

    _removeMenuTap() {
        if (this._onMenuTap) {
            this.game.canvas.removeEventListener('touchend', this._onMenuTap);
            this.game.canvas.removeEventListener('click', this._onMenuTap);
            this._onMenuTap = null;
        }
        if (this._onMenuMove) {
            this.game.canvas.removeEventListener('touchmove', this._onMenuMove);
            this.game.canvas.removeEventListener('mousemove', this._onMenuMove);
            this._onMenuMove = null;
        }
        if (this._onMenuUp) {
            window.removeEventListener('mouseup', this._onMenuUp);
            window.removeEventListener('touchend', this._onMenuUp);
            this._onMenuUp = null;
        }
    }

    update(dt) {
        if (this.isTransitioning) return;

        this.time += dt;
        this.coinAngle += dt * 3;

        // Update ambient particles
        for (const p of this.particles) {
            p.y -= p.speed * dt;
            p.wobble += dt;
            p.x += Math.sin(p.wobble) * 0.0005;
            if (p.y < 0) {
                p.y = 1;
                p.x = Math.random();
            }
        }

        // Smooth BGM fade-in over 2 seconds to user's configured musicVolume
        if (this._fadeInTimer !== undefined && this._fadeInTimer < 2.0) {
            this._fadeInTimer += dt;
            this._fadeInTarget = this.game.settings.musicVolume ?? 0.22;
            const vol = Math.min(this._fadeInTarget, (this._fadeInTimer / 2.0) * this._fadeInTarget);
            if (this.game.audioManager.gainNode && this.game.audioManager.audioCtx) {
                this.game.audioManager.gainNode.gain.setTargetAtTime(vol, this.game.audioManager.audioCtx.currentTime, 0.1);
            } else if (this.game.audioManager.bgm) {
                try { this.game.audioManager.bgm.volume = vol; } catch (e) { }
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

        // Confirm via controller buttons OR direct tap on menu item
        const confirmPressed = (p1.h || p1.l || p1.s) && this.inputCooldown <= 0;
        const tapConfirm = this._tapConfirmPending;
        this._tapConfirmPending = false;

        if (confirmPressed || tapConfirm) {
            if (this.credits <= 0) return;

            if (this.selectedIndex === 0) {
                // STORY MODE
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
                this.startStoryMode();
            } else if (this.selectedIndex === 1) {
                // ARCADE MODE — locked until story complete
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
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
                this.isTransitioning = true;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: false });
                }, 500);
            } else if (this.selectedIndex === 3) {
                // ONLINE / KOOP — always available
                this.playConfirm();
                this.inputCooldown = 30;
                this.isTransitioning = true;
                setTimeout(() => {
                    this.game.stateManager.switchState('OnlineLobby');
                }, 250);
            } else if (this.selectedIndex === 4) {
                // SOUND-MISCHPULT & OPTIONEN
                this.playConfirm();
                this.inOptions = true;
                this.optionIndex = 0;
                this.inputCooldown = 15;
            }
        }
    }

    updateOptions(p1) {
        const optCount = 10;
        if (this.inputCooldown <= 0) {
            if (p1.up) {
                this.optionIndex = (this.optionIndex - 1 + optCount) % optCount;
                this.inputCooldown = 10;
                this.playBlip();
            } else if (p1.down) {
                this.optionIndex = (this.optionIndex + 1) % optCount;
                this.inputCooldown = 10;
                this.playBlip();
            } else if (p1.right) {
                this.adjustOption(1);
                this.inputCooldown = 8;
            } else if (p1.left) {
                this.adjustOption(-1);
                this.inputCooldown = 8;
            } else if (p1.lJust || p1.hJust) {
                if (this.optionIndex === 8) {
                    this.game.resetAudioMixDefaults?.();
                    this._fadeInTarget = this.game.settings.musicVolume;
                    this.playConfirm();
                    this.game.audioManager?.playHitImpactSound?.(true, true);
                    this.inputCooldown = 15;
                } else if (this.optionIndex === 9) {
                    this.inOptions = false;
                    this.inputCooldown = 15;
                    this.playBlip();
                } else {
                    this.adjustOption(1);
                    this.inputCooldown = 10;
                }
            } else if (p1.s || p1.menuJust) {
                // Back
                this.inOptions = false;
                this.inputCooldown = 15;
                this.playBlip();
            }
        }
    }

    adjustOption(dir) {
        const s = this.game.settings;
        const step = 0.05;
        switch (this.optionIndex) {
            case 0: // Master Vol (0% - 150%)
                this._setSliderValue(0, Math.round(((s.masterVolume ?? 1.0) + dir * step) * 20) / 20, true);
                break;
            case 1: // Music Vol (0% - 100%)
                this._setSliderValue(1, Math.round(((s.musicVolume ?? 0.22) + dir * step) * 20) / 20, false);
                break;
            case 2: // FX & Hits Vol (0% - 150%)
                this._setSliderValue(2, Math.round(((s.sfxVolume ?? 0.90) + dir * step) * 20) / 20, true);
                break;
            case 3: // Fighter Voices Vol (0% - 150%)
                this._setSliderValue(3, Math.round(((s.voiceVolume ?? 1.00) + dir * step) * 20) / 20, true);
                break;
            case 4: // Announcer / Story Vol (0% - 150%)
                this._setSliderValue(4, Math.round(((s.announcerVolume ?? 0.95) + dir * step) * 20) / 20, true);
                break;
            case 5: // Voice-Ducking EQ Filter
                s.bgmFilterEnabled = !s.bgmFilterEnabled;
                this.game.saveSettings?.();
                break;
            case 6: // Difficulty
                const diffs = ['EASY', 'NORMAL', 'HARD'];
                const idx = diffs.indexOf(s.difficulty);
                s.difficulty = diffs[Math.max(0, Math.min(2, idx + dir))];
                this.game.saveSettings?.();
                break;
            case 7: // Timer & Speed
                if (dir > 0) {
                    s.timer = s.timer === 99 ? 66 : 99;
                } else {
                    s.speed = s.speed >= 1.25 ? 1.0 : (s.speed + 0.25);
                }
                this.game.saveSettings?.();
                break;
            case 8: // Reset Studio Mix
                this.game.resetAudioMixDefaults?.();
                this._fadeInTarget = this.game.settings.musicVolume;
                this.playConfirm();
                break;
            case 9: // Back to Menu
                this.inOptions = false;
                this.inputCooldown = 15;
                break;
        }
    }

    startStoryMode() {
        const keano = ROSTER[0];
        const opponent = ROSTER[1];
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, keano);
        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);
        this.game.assetManager.loadAll();

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

        preloadFighterSprites(this.game.assetManager, keano);
        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);

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
        ctx.font = 'bold 34px "Press Start 2P"';
        const menuStartY = this.game.height * 0.61;
        for (let i = 0; i < this.options.length; i++) {
            const y = menuStartY + (i * 56);
            const isLocked = (i === 1 || i === 2) && !this.storyCompleted;
            const isOnline = (i === 3);

            if (i === this.selectedIndex) {
                ctx.fillStyle = isLocked ? '#663333' : (isOnline ? '#00ff88' : '#00ffff');
                const label = isLocked ? `🔒 ${this.options[i]}` : `> ${this.options[i]} <`;
                ctx.fillText(label, cx, y);
            } else {
                ctx.fillStyle = isLocked ? '#444444' : (isOnline ? '#88ffbb' : '#aaaaaa');
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
        ctx.fillStyle = 'rgba(4, 6, 18, 0.92)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        const cx = this.game.width / 2;
        const s = this.game.settings;

        ctx.save();
        // Studio Console Outer Frame
        ctx.fillStyle = 'rgba(10, 14, 34, 0.95)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.fillRect(cx - 560, 48, 1120, this.game.height - 96);
        ctx.strokeRect(cx - 560, 48, 1120, this.game.height - 96);

        // Top-left back button pill for mobile/touch
        ctx.fillStyle = 'rgba(255, 0, 85, 0.22)';
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 535, 66, 210, 44);
        ctx.strokeRect(cx - 535, 66, 210, 44);
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('← ZURÜCK', cx - 430, 95);

        // Title
        ctx.font = 'bold 42px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 14;
        ctx.fillText('SOUND-MISCHPULT & OPTIONEN', cx + 70, 102);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 13px "Press Start 2P"';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('DIREKT AUF DIE REGLER TIPPEN / ZIEHEN ODER MIT [← / →] EINSTELLEN', cx, 142);

        const rows = [
            { label: 'MASTER VOL', type: 'slider', val: s.masterVolume ?? 1.00, max: 1.5, color: '#ffffff' },
            { label: 'MUSIK (BGM)', type: 'slider', val: s.musicVolume ?? 0.22, max: 1.0, color: '#00e5ff' },
            { label: 'FX & HITS', type: 'slider', val: s.sfxVolume ?? 0.90, max: 1.5, color: '#ff3366' },
            { label: 'KÄMPFER-STIMMEN', type: 'slider', val: s.voiceVolume ?? 1.00, max: 1.5, color: '#ffd700' },
            { label: 'ANNOUNCER / STORY', type: 'slider', val: s.announcerVolume ?? 0.95, max: 1.5, color: '#bb66ff' },
            { label: 'VOICE-DUCKING (EQ)', type: 'value', value: s.bgmFilterEnabled ? 'AN (AUTO-MIX)' : 'AUS' },
            { label: 'SCHWIERIGKEIT', type: 'value', value: s.difficulty },
            { label: 'TIMER & TEMPO', type: 'value', value: `${s.timer}s · ${Math.round((s.speed || 1) * 100)}%` },
            { label: '↺ STANDARD-STUDIO-MIX LADEN', type: 'action', color: '#00ff88' },
            { label: '✓ SPEICHERN & ZURÜCK ZUM MENÜ', type: 'action', color: '#00ffff' },
        ];

        const startY = 205;
        const rowStep = 64;
        const barX = cx - 40;
        const barW = 360;
        const barH = 24;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const y = startY + i * rowStep;
            const isSel = i === this.optionIndex;

            if (isSel) {
                ctx.fillStyle = 'rgba(0, 229, 255, 0.14)';
                ctx.fillRect(cx - 520, y - 34, 1040, 50);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 520, y - 34, 1040, 50);
            }

            if (r.type === 'slider') {
                ctx.textAlign = 'left';
                ctx.font = 'bold 21px "Press Start 2P"';
                ctx.fillStyle = isSel ? '#ffffff' : '#bbbbbb';
                ctx.fillText(r.label, cx - 495, y - 2);

                // [-] button
                ctx.fillStyle = isSel ? '#00ffff' : '#667799';
                ctx.font = 'bold 20px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('[-]', barX - 36, y - 2);

                // Fader Track
                const by = y - 23;
                const ratio = Math.max(0, Math.min(1, r.val / r.max));
                ctx.fillStyle = '#121629';
                ctx.fillRect(barX, by, barW, barH);

                // Fader Fill
                ctx.fillStyle = r.color;
                ctx.fillRect(barX, by, barW * ratio, barH);

                // 100% reference tick on 150% sliders
                if (r.max > 1.0) {
                    const tickX = barX + (1.0 / r.max) * barW;
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.fillRect(tickX - 1, by - 3, 2, barH + 6);
                }

                // Fader Knob
                const knobX = barX + barW * ratio;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(knobX - 6, by - 4, 12, barH + 8);

                ctx.strokeStyle = isSel ? '#ffffff' : '#445577';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX, by, barW, barH);

                // [+] button
                ctx.fillStyle = isSel ? '#00ffff' : '#667799';
                ctx.fillText('[+]', barX + barW + 36, y - 2);

                // Percentage readout
                ctx.textAlign = 'right';
                ctx.font = 'bold 21px "Press Start 2P"';
                ctx.fillStyle = isSel ? r.color : '#dddddd';
                ctx.fillText(`${Math.round(r.val * 100)}%`, cx + 495, y - 2);
            } else if (r.type === 'value') {
                ctx.textAlign = 'left';
                ctx.font = 'bold 21px "Press Start 2P"';
                ctx.fillStyle = isSel ? '#ffffff' : '#bbbbbb';
                ctx.fillText(r.label, cx - 495, y - 2);

                ctx.textAlign = 'center';
                ctx.fillStyle = isSel ? '#00ffff' : '#cccccc';
                ctx.fillText(isSel ? `< ${r.value} >` : r.value, barX + barW / 2, y - 2);
            } else if (r.type === 'action') {
                ctx.textAlign = 'center';
                ctx.font = 'bold 23px "Press Start 2P"';
                ctx.fillStyle = isSel ? r.color : '#88aa99';
                ctx.fillText(isSel ? `> ${r.label} <` : r.label, cx, y - 2);
            }
        }

        ctx.font = '14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#88aacc';
        ctx.fillText('[↑/↓] KANAL WÄHLEN   [←/→ ODER ZIEHEN] MIX ANPASSEN   [S / ESC] ZURÜCK', cx, this.game.height - 66);
        ctx.restore();
    }
}
