import { ROSTER, SPECIALS, ALL_FIGHTERS } from '../data.js';

export default class CharacterSelectState {
    constructor(game) {
        this.game = game;
        this.mainRoster = ROSTER;
        this.specials = SPECIALS;
        this.allFighters = ALL_FIGHTERS;
        this.columns = 7; // 7 per row for 14 main = 2 clean rows

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
        this.p1Index = 0;
        this.p2Index = this.mainRoster.length - 1;
        this.p1Locked = false;
        this.p2Locked = false;
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
            if (p1.left) {
                this.p1Index = Math.max(0, this.p1Index - 1);
                this.inputCooldown = 10;
            } else if (p1.right) {
                this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + 1);
                this.inputCooldown = 10;
            } else if (p1.up) {
                this.p1Index = Math.max(0, this.p1Index - this.columns);
                this.inputCooldown = 10;
            } else if (p1.down) {
                this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + this.columns);
                this.inputCooldown = 10;
            }

            if (p1.l || p1.h || p1.s) {
                this.p1Locked = true;
                this.p2Locked = true;
                this.inputCooldown = 60;
                this.loadingCombat = true;

                // Preload ALL combat sprites for the two selected fighters
                this.preloadAndFight();
            }
        }
    }

    async preloadAndFight() {
        const { STAGES } = await import('../data.js');
        const p1Char = this.allFighters[this.p1Index];
        const p2Char = this.allFighters[this.p2Index];
        const poses = ['_front.png', '_right.png', '_left.png', '_punch.png', '_kick.png', '_hit.png', '_ko.png'];

        // Preload combat sprites for both fighters
        for (const char of [p1Char, p2Char]) {
            for (const pose of poses) {
                const key = `${char.id}${pose}`;
                if (!this.game.assetManager.images[key]) {
                    this.game.assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${pose}`);
                }
            }
        }

        // Preload P2's home stage background
        const stageId = p2Char.stageId || 'Cosmic';
        const stage = STAGES[stageId];
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }

        await this.game.assetManager.loadAll();
        console.log(`Combat ready: ${p1Char.name} vs ${p2Char.name} @ ${stage?.name || 'Cosmic Portal'}`);

        setTimeout(() => {
            this.game.stateManager.switchState('Combat', {
                p1: p1Char,
                p2: { ...p2Char, rosterIndex: this.p2Index },
                stageId: stageId,
            });
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

        // ─── UNIFIED FIGHTER GRID (Main + Specials in one grid) ───
        const cellW = 170;
        const cellH = 200;
        const mainGridW = this.columns * cellW;
        const startX = (this.game.width - mainGridW) / 2;
        const startY = 85;

        for (let i = 0; i < this.allFighters.length; i++) {
            const col = i % this.columns;
            const row = Math.floor(i / this.columns);
            const x = startX + col * cellW;
            const y = startY + row * cellH;
            const char = this.allFighters[i];
            const isSpecial = char.special || false;
            const isP1 = (i === this.p1Index);
            const isP2 = (i === this.p2Index);

            // Cell Border
            if (isP1 && this.p1Locked) {
                ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4;
            } else if (isP1) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3;
            } else if (isP2) {
                ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 3;
            } else if (isSpecial) {
                ctx.strokeStyle = '#fdbf00'; ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#333355'; ctx.lineWidth = 1;
            }

            // Cell Fill
            ctx.fillStyle = (isP1 || isP2) ? 'rgba(255,255,255,0.12)' : (isSpecial ? 'rgba(253,191,0,0.08)' : 'rgba(0,0,0,0.4)');
            ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
            ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

            // Portrait
            const portrait = this.game.assetManager.images[`${char.id}_front.png`];
            if (portrait) {
                ctx.drawImage(portrait, x + 12, y + 8, cellW - 24, cellH - 45);
            } else {
                ctx.fillStyle = '#222';
                ctx.fillRect(x + 12, y + 8, cellW - 24, cellH - 45);
                ctx.fillStyle = '#555'; ctx.textAlign = 'center'; ctx.font = '10px "Press Start 2P"';
                ctx.fillText('???', x + cellW / 2, y + cellH / 2 - 15);
            }

            // Special Badge ★
            if (isSpecial) {
                ctx.fillStyle = '#fdbf00'; ctx.font = 'bold 18px "Press Start 2P"';
                ctx.textAlign = 'right';
                ctx.fillText('★', x + cellW - 12, y + 24);
            }

            // Name
            ctx.fillStyle = isP1 ? '#00ffff' : (isP2 ? '#ff0055' : (isSpecial ? '#fdbf00' : '#aaaaaa'));
            ctx.textAlign = 'center'; ctx.font = '11px "Press Start 2P"';
            let displayName = char.name.toUpperCase();
            if (displayName.length > 12) displayName = displayName.substring(0, 11) + '.';
            ctx.fillText(displayName, x + cellW / 2, y + cellH - 12);
        }

        // ─── P1 / P2 Labels ───
        ctx.font = 'bold 24px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#00ffff';
        const p1Name = this.allFighters[this.p1Index]?.name?.toUpperCase() || '???';
        ctx.fillText(`P1: ${p1Name}`, 80, this.game.height - 35);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff0055';
        const p2Name = this.allFighters[this.p2Index]?.name?.toUpperCase() || '???';
        ctx.fillText(`CPU: ${p2Name}`, this.game.width - 80, this.game.height - 35);

        // FIGHT flash
        if (this.p1Locked) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 80px "Press Start 2P"';
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 25;
            ctx.fillText("FIGHT!", this.game.width / 2, this.game.height / 2);
            ctx.shadowBlur = 0;
        }
    }
}
