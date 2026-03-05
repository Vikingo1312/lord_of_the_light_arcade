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

        // Game settings (shared via game object)
        this.game.settings = {
            timer: 99,
            speed: 1.0,
            difficulty: 'NORMAL', // EASY, NORMAL, HARD
            musicVolume: 0.3,
            voiceVolume: 0.9,
            sfxVolume: 0.5,
        };
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

        // Play main theme with Low-Pass filter
        this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, true, this.game.settings.musicVolume);
    }

    exit() {
        // Do not stop music here if transitioning to character select or story
        // The new state will handle changing or stopping it via AudioManager
    }

    update(dt) {
        this.time += dt;
        this.coinAngle += dt * 3; // Spinning coins

        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }

        const p1 = this.game.inputManager.p1;

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
                // ARCADE MODE (locked)
                if (!this.storyCompleted) {
                    this.playBuzzer();
                    return;
                }
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect');
                }, 500);
            } else if (this.selectedIndex === 2) {
                // VERSUS MODE (locked)
                if (!this.storyCompleted) {
                    this.playBuzzer();
                    return;
                }
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect');
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
        const optCount = 6; // timer, speed, difficulty, music, voice, sfx
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
        }
    }

    async startStoryMode() {
        const keano = ROSTER[0];
        const opponent = ROSTER[1];
        const stageId = opponent.stageId;
        const stage = STAGES[stageId];

        // Preload combat sprites for both fighters
        const suffixes = ['_right', '_left', '_front', '_punch', '_kick', '_hit', '_ko', '_special', '_win'];
        for (const char of [keano, opponent]) {
            for (const suf of suffixes) {
                const key = `${char.id}${suf}.png`;
                if (!this.game.assetManager.images[key]) {
                    this.game.assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${suf}.png`);
                }
            }
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
            arcadeIndex: 1,
            arcadeWins: 0,
        };

        this.game.stateManager.switchState('Story', {
            ...STORY_PROLOGUE,
            nextState: 'VersusIntro',
            nextData: combatData,
        });
    }

    // Sound stubs — removed synthesized oscillator sounds
    playBlip() { }
    playConfirm() { }
    playBuzzer() { }

    draw(ctx) {
        // Cosmic Shimmer background
        const bg = this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        if (this.inOptions) {
            this.drawOptions(ctx);
            return;
        }

        // ─── KEANO ROMEO ─── Neon Cyan + 3D Shadow + Slow Dimmer
        const pulse = (Math.sin(this.time * 0.8) + 1) / 2;
        const glowSize = 20 + pulse * 50;
        const cx = this.game.width / 2;
        const titleY = this.game.height * 0.18;

        ctx.textAlign = 'center';
        ctx.font = 'bold 160px "Press Start 2P"';

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#001122';
        ctx.fillText("KEANO", cx + 7, titleY + 9);
        ctx.fillText("ROMEO", cx + 7, titleY + 139);

        ctx.fillStyle = '#003355';
        ctx.fillText("KEANO", cx + 4, titleY + 5);
        ctx.fillText("ROMEO", cx + 4, titleY + 135);

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = `rgba(0, 255, 255, ${0.2 + pulse * 0.8})`;
        ctx.shadowBlur = glowSize;
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);

        ctx.shadowBlur = glowSize + 20;
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);
        ctx.shadowBlur = 0;

        // ─── LORD OF THE LIGHT I ───
        ctx.font = 'bold 34px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText("LORD OF THE LIGHT I", cx, titleY + 215);
        ctx.shadowBlur = 0;

        // ─── Menu Options ───
        ctx.font = 'bold 36px "Press Start 2P"';
        const menuStartY = this.game.height * 0.56;
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

        // Credits display
        ctx.font = 'bold 24px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.credits > 0 ? '#fdbf00' : '#ff0033';
        ctx.fillText(`CREDITS: ${this.credits}`, cx, y + 40);

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

        // Click to insert coin (touch/mouse)
        if (this.credits <= 0) {
            // Check for click/tap in INSERT COIN area
            if (this.game.inputManager.p1.l || this.game.inputManager.p1.h) {
                this.credits = this.maxCredits;
                this.inputCooldown = 15;
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
        ctx.fillText('PRESS KICK (L) TO GO BACK', cx, this.game.height - 60);
    }
}
