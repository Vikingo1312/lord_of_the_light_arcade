import { ROSTER, SPECIALS, ALL_FIGHTERS, isFighterUnlocked } from '../data.js';

export default class CharacterSelectState {
    constructor(game) {
        this.game = game;
        this.mainRoster = ROSTER;
        this.specials = SPECIALS;
        this.allFighters = ALL_FIGHTERS;
        this.columns = 8; // Change back from 10 to 8 to allow bigger cells while leaving the right side open

        // P1 cursor
        this.p1Index = 0;
        this.p1Locked = false;

        // P2 cursor (AI auto-locks)
        this.p2Index = this.mainRoster.length - 1; // Default to Putin
        this.p2Locked = false;

        this.inputCooldown = 0;
        this.loadingCombat = false;
        this.bgMusic = null;
    }

    enter(data) {
        console.log("Entering Character Select");
        this.arcadeMode = data && data.arcadeMode !== undefined ? data.arcadeMode : false;
        this.p1Index = 0;
        this.p2Index = this.mainRoster.length - 1;
        this.p1Locked = false;
        this.p2Locked = false;

        // In Versus mode, P1 picks P2. So start P2's cursor at P1's position initially.
        if (!this.arcadeMode) {
            this.p2Index = this.p1Index;
        }

        this.inputCooldown = 20;
        this.loadingCombat = false;
        // Play char select music
        this.game.audioManager.playBGM('assets/audio/music/selectmenu_theme.mp3', true, false, 0.15);
    }

    exit() {
        // Automatically handled by State transitions and AudioManager, 
        // but since Combat will overwrite it anyway, we can leave it running or stop it.
        // Combat has its own playStageMusic call.
        this.game.audioManager.stopBGM();
    }

    update(dt) {
        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }
        const p1 = this.game.inputManager.p1;

        if (!this.p1Locked && this.inputCooldown <= 0) {
            // P1 Selection Phase
            if (p1.left) { this.p1Index = Math.max(0, this.p1Index - 1); this.inputCooldown = 10; }
            else if (p1.right) { this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + 1); this.inputCooldown = 10; }
            else if (p1.up) { this.p1Index = Math.max(0, this.p1Index - this.columns); this.inputCooldown = 10; }
            else if (p1.down) { this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + this.columns); this.inputCooldown = 10; }

            if (p1.l || p1.h || p1.s) {
                const char = this.allFighters[this.p1Index];
                if (!isFighterUnlocked(char.id)) {
                    // Locked! Cannot select. Play buzzer or ignore.
                    this.inputCooldown = 15;
                    return;
                }

                this.p1Locked = true;
                this.inputCooldown = 20;

                if (this.arcadeMode) {
                    // Arcade Mode: Skip P2 selection, go straight to ladder
                    this.p2Index = 1; // ROSTER[1] Hattori is the start of the ladder
                    this.p2Locked = true;
                    this.loadingCombat = true;
                    this.preloadAndFight();
                } else {
                    // Versus Mode: Initialize P2 cursor to P1's position to let P1 pick P2
                    this.p2Index = this.p1Index;
                }
            }
        } else if (this.p1Locked && !this.p2Locked && !this.arcadeMode && this.inputCooldown <= 0) {
            // P2 Selection Phase (controlled by P1 input in VS Mode)
            if (p1.left) { this.p2Index = Math.max(0, this.p2Index - 1); this.inputCooldown = 10; }
            else if (p1.right) { this.p2Index = Math.min(this.allFighters.length - 1, this.p2Index + 1); this.inputCooldown = 10; }
            else if (p1.up) { this.p2Index = Math.max(0, this.p2Index - this.columns); this.inputCooldown = 10; }
            else if (p1.down) { this.p2Index = Math.min(this.allFighters.length - 1, this.p2Index + this.columns); this.inputCooldown = 10; }

            if (p1.l || p1.h || p1.s) {
                const char = this.allFighters[this.p2Index];
                if (!isFighterUnlocked(char.id)) {
                    // Locked!
                    this.inputCooldown = 15;
                    return;
                }
                this.p2Locked = true;
                this.inputCooldown = 60;
                this.loadingCombat = true;
                this.preloadAndFight();
            }
        }
    }

    async preloadAndFight() {
        const { STAGES } = await import('../data.js');
        const p1Char = this.allFighters[this.p1Index];
        const p2Char = this.allFighters[this.p2Index];
        // Preload robust combat sprites for both fighters using Combat's centralized logic (includes Special and Projectiles)
        const combatState = this.game.stateManager.states['Combat'];
        if (combatState && typeof combatState.preloadFighterSprites === 'function') {
            combatState.preloadFighterSprites(p1Char);
            combatState.preloadFighterSprites(p2Char);
        } else {
            console.error("Combat state not initialized or missing preloadFighterSprites.");
        }

        // Preload P2's home stage background
        const stageId = p2Char.stageId || 'Cosmic';
        const stage = STAGES[stageId];
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }

        // Stop the select menu music instantly BEFORE we await the large network load for assets.
        // This prevents the select theme from overlapping the next state's audio if loading takes seconds.
        this.game.audioManager.stopBGM();

        await this.game.assetManager.loadAll();
        console.log(`Combat ready: ${p1Char.name} vs ${p2Char.name} @ ${stage?.name || 'Cosmic Portal'}`);

        setTimeout(() => {
            if (this.arcadeMode) {
                // Arcade Mode: fight opponents sequentially starting from ROSTER[0]
                const opponent = ROSTER[0];
                const combatData = {
                    p1: p1Char,
                    p2: { ...opponent, rosterIndex: 0 },
                    stageId: opponent.stageId,
                    arcadeMode: true,
                    storyMode: true,
                    arcadeIndex: 0,
                    arcadeWins: 0,
                };
                this.game.stateManager.switchState('VersusIntro', combatData);
            } else {
                this.game.stateManager.switchState('VersusIntro', {
                    p1: p1Char,
                    p2: { ...p2Char, rosterIndex: this.p2Index },
                    stageId: stageId,
                    arcadeMode: false
                });
            }
        }, 800);
    }

    draw(ctx) {
        // Background
        const bg = this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#0a0015';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        // ─── TITLE ───
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 44px "Press Start 2P"';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 15;
        ctx.fillText("SELECT YOUR FIGHTER", this.game.width / 2, 65);
        ctx.shadowBlur = 0;

        // ─── UNIFIED FIGHTER GRID ───
        const cellW = 160;
        const cellH = 160;
        const mainGridW = this.columns * cellW;
        const startX = 60; // Push to the left edge to leave room on the right
        const startY = 120; // Push down slightly

        for (let i = 0; i < this.allFighters.length; i++) {
            const col = i % this.columns;
            const row = Math.floor(i / this.columns);
            const x = startX + col * cellW;
            const y = startY + row * cellH;
            const char = this.allFighters[i];
            const isSpecial = char.special || false;
            const isP1 = (i === this.p1Index);
            const isP2 = (i === this.p2Index);

            const isUnlocked = isFighterUnlocked(char.id);

            // Cell Border
            if (isP1 && this.p1Locked) {
                ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4;
            } else if (isP1 && !this.p1Locked) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 4;
            } else if (isP2 && !this.arcadeMode && !this.p2Locked && this.p1Locked) {
                ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 4;
            } else if (isP2 && this.p2Locked && !this.arcadeMode) {
                ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 4;
            } else if (!isUnlocked) {
                ctx.strokeStyle = '#111111'; ctx.lineWidth = 1;
            } else if (isSpecial) {
                ctx.strokeStyle = '#fdbf00'; ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#333355'; ctx.lineWidth = 1;
            }

            // Cell Fill
            const isActiveCursor = (isP1 && !this.p1Locked) || (isP2 && this.p1Locked && !this.p2Locked);
            ctx.fillStyle = isActiveCursor ? 'rgba(255,255,255,0.12)' : (!isUnlocked ? 'rgba(0,0,0,0.8)' : (isSpecial ? 'rgba(253,191,0,0.08)' : 'rgba(0,0,0,0.4)'));
            ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
            ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

            // Portrait (Bigger!)
            const portrait = this.game.assetManager.images[`${char.id}_front.png`];
            if (portrait) {
                ctx.drawImage(portrait, x + 8, y + 8, cellW - 16, cellH - 45);
            } else {
                ctx.fillStyle = '#222';
                ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 45);
            }

            // Darken locked portrait
            if (!isUnlocked) {
                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 45);
                ctx.fillStyle = '#ff0000'; ctx.font = '10px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('LOCKED', x + cellW / 2, y + cellH / 2 - 10);
            }

            // Special Badge ★
            if (isSpecial && isUnlocked) {
                ctx.fillStyle = '#fdbf00'; ctx.font = 'bold 22px "Press Start 2P"';
                ctx.textAlign = 'right';
                ctx.fillText('★', x + cellW - 12, y + 30);
            }

            // P1/P2 Cursor Badges in Grid
            ctx.font = 'bold 16px "Press Start 2P"';
            if (isP1) {
                ctx.fillStyle = this.p1Locked ? '#00ff00' : '#00ffff';
                ctx.textAlign = 'left';
                ctx.fillText('P1', x + 10, y + 28);
            }
            if (isP2 && (!this.arcadeMode && this.p1Locked)) {
                ctx.fillStyle = this.p2Locked ? '#ff0055' : '#ffaa00';
                ctx.textAlign = 'right';
                ctx.fillText('P2', x + cellW - 10, y + 28);
            }

            // Name
            ctx.fillStyle = isActiveCursor ? '#ffffff' : (isSpecial ? '#fdbf00' : '#aaaaaa');
            if (isP1 && this.p1Locked) ctx.fillStyle = '#00ff00';
            if (isP2 && this.p2Locked && this.p1Locked && !this.arcadeMode) ctx.fillStyle = '#ff0055';
            if (!isUnlocked) ctx.fillStyle = '#444444';

            ctx.textAlign = 'center'; ctx.font = '12px "Press Start 2P"';
            let displayName = char.name.toUpperCase();
            if (displayName.length > 12) displayName = displayName.substring(0, 11) + '.';
            if (!isUnlocked) displayName = '???';
            ctx.fillText(displayName, x + cellW / 2, y + cellH - 12);
        }

        // ─── SINGLE ACTIVE FIGHTER CARD (RIGHT SIDE) ───
        // Only ever draw ONE card. Either P1's current selection, or P2's if P1 is locked in.
        let activeChar = null;
        let isP1Cursor = true;
        let isCardLocked = false;

        if (!this.p1Locked) {
            activeChar = this.allFighters[this.p1Index];
            isP1Cursor = true;
            isCardLocked = false;
        } else if (this.arcadeMode || this.p2Locked) {
            // Both locked, or Arcade mode (where P2 is AI). Show P2's card so they see who they are fighting.
            activeChar = this.allFighters[this.p2Index];
            isP1Cursor = false;
            isCardLocked = true;
        } else {
            // P1 is locked, P2 is currently selecting
            activeChar = this.allFighters[this.p2Index];
            isP1Cursor = false;
            isCardLocked = false;
        }

        this.drawSingleFighterCard(ctx, activeChar, isP1Cursor, isCardLocked);

        // FIGHT flash
        if (this.p1Locked && (this.arcadeMode || this.p2Locked)) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 80px "Press Start 2P"';
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 25;
            ctx.fillText("FIGHT!", this.game.width / 2, this.game.height / 2 + 300);
            ctx.shadowBlur = 0;
        }
    }

    drawSingleFighterCard(ctx, char, isP1Cursor, isLockedIn) {
        if (!char) return; // Wait
        const isUnlocked = isFighterUnlocked(char.id);

        const cardW = 400;
        const cardH = 680;
        const x = this.game.width - cardW - 80;
        const y = 100;

        // Draw Card Background
        ctx.fillStyle = isUnlocked ? 'rgba(0, 5, 20, 0.85)' : 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(x, y, cardW, cardH);

        // Dynamic Border depending on who is selecting
        ctx.strokeStyle = isP1Cursor ? '#00ffff' : '#ff0055';
        if (isLockedIn) ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 6;
        ctx.strokeRect(x, y, cardW, cardH);

        // Draw Portrait
        const portraitKey = `${char.id}_front.png`;
        const portrait = this.game.assetManager.images[portraitKey];
        if (portrait && isUnlocked) {
            ctx.drawImage(portrait, x + 20, y + 20, cardW - 40, 360);
        } else {
            ctx.fillStyle = '#111';
            ctx.fillRect(x + 20, y + 20, cardW - 40, 360);
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillText(isUnlocked ? 'NO SIGNAL' : 'LOCKED', x + cardW / 2, y + 200);
        }

        // Wait... If arcade P2, just show Arcade Ladder info
        if (!isP1Cursor && this.arcadeMode) {
            ctx.fillStyle = '#ff0055';
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px "Press Start 2P"';
            ctx.fillText("ARCADE", x + cardW / 2, y + 450);
            ctx.fillText("LADDER", x + cardW / 2, y + 510);
            return;
        }

        if (!isUnlocked) return;

        // Player Label
        ctx.fillStyle = isP1Cursor ? '#00ffff' : '#ff0055';
        ctx.textAlign = 'left';
        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillText(isP1Cursor ? 'P1' : 'P2', x + 30, y - 20);

        // Name & Nickname
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fdbf00';
        ctx.font = 'bold 28px "Press Start 2P"';
        ctx.fillText(char.name.toUpperCase(), x + cardW / 2, y + 430);

        ctx.fillStyle = '#aaa';
        ctx.font = '16px "Press Start 2P"';
        ctx.fillText(`"${char.nickname.toUpperCase()}"`, x + cardW / 2, y + 470);

        ctx.fillStyle = '#fff';
        ctx.font = '14px "Press Start 2P"';
        ctx.fillText(`FROM: ${char.country.toUpperCase()}`, x + cardW / 2, y + 510);

        // Stats Bars
        const drawBar = (label, val, max, yPos, color) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#aaa';
            ctx.font = '16px "Press Start 2P"';
            ctx.fillText(label, x + 30, y + yPos);

            const barW = 220;
            ctx.fillStyle = '#222';
            ctx.fillRect(x + 130, y + yPos - 16, barW, 20);
            ctx.fillStyle = color;
            ctx.fillRect(x + 130, y + yPos - 16, barW * (val / max), 20);
        };

        drawBar('HP', char.hp || 400, 700, 560, '#00ff00');
        drawBar('SPD', char.speed || 500, 800, 600, '#00ffff');
        drawBar('PWR', char.power || 100, 200, 640, '#ff0055');
    }
}
