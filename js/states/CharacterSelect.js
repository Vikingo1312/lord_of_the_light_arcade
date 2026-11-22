import { ROSTER, SPECIALS, ALL_FIGHTERS, STAGES, isFighterUnlocked, getFighterStyle } from '../data.js?v=2.70';
import { STORY_PROLOGUE } from '../story_data.js?v=2.70';
import { preloadFighterSprites, preloadStageAssets, playFighterSound, playAnnouncer } from '../core/AssetPreloader.js?v=2.70';

export default class CharacterSelectState {
    constructor(game) {
        this.game = game;
        this.mainRoster = ROSTER;
        this.specials = SPECIALS;
        this.allFighters = ALL_FIGHTERS;
        this.columns = 10; // 10 columns x 3 rows fits all 28 fighters cleanly while leaving the right card open

        // P1 cursor
        this.p1Index = 0;
        this.p1Locked = false;

        // P2 cursor (AI auto-locks)
        this.p2Index = this.mainRoster.length - 1; // Default to Putin
        this.p2Locked = false;

        this.selectedStageKeys = Object.keys(STAGES);
        this.stageIndex = 0;
        this._customStagePicked = false;

        this.inputCooldown = 0;
        this.loadingCombat = false;
        this.bgMusic = null;
    }

    enter(data) {
        console.log("Entering Character Select");
        this.arcadeMode = data && data.arcadeMode !== undefined ? data.arcadeMode : false;
        this.storyMode = Boolean(data && data.storyMode);
        this.trainingMode = Boolean(data && data.trainingMode);
        this.survivalMode = Boolean(data && data.survivalMode);
        this.selectedStageKeys = Object.keys(STAGES);
        this.stageIndex = 0;
        this._customStagePicked = false;
        this.p1Index = 0;
        if (typeof localStorage !== 'undefined' && localStorage.getItem('lotl_single_claim_AliAbi') === 'true') {
            const aliIdx = this.allFighters.findIndex(f => f.id === 'AliAbi');
            if (aliIdx >= 0) this.p1Index = aliIdx;
        }
        this.p2Index = this.mainRoster.length - 1;
        this.p1Locked = false;
        this.p2Locked = false;

        // Guarantee all fighter portraits are queued & loaded
        let needsLoad = false;
        for (const char of this.allFighters) {
            const key = `${char.id}_front.png`;
            if (!this.game.assetManager.images[key]) {
                this.game.assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/_front.png?v=2.70`);
                needsLoad = true;
            }
        }
        if (needsLoad) {
            this.game.assetManager.loadAll();
        }

        // In Versus mode, P1 picks P2. So start P2's cursor at P1's position initially.
        if (!this.arcadeMode) {
            this.p2Index = this.p1Index;
        }

        this.inputCooldown = 20;
        this.loadingCombat = false;
        // Play continuous main theme across menu and select screens
        this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.15);
        playAnnouncer(this.game.audioManager, 'select');
        this._setupSelectTap();
    }

    exit() {
        this._removeSelectTap();
        if (this._selectFallbackTimer) {
            clearTimeout(this._selectFallbackTimer);
            this._selectFallbackTimer = null;
        }
        this._finishTransitionNow = null;
        this.game.audioManager.stopFighterVoice?.();
        this.game.audioManager.stopAnnouncerVoice?.();
        this.game.audioManager.stopBGM();
    }

    _cycleVersusStage(dir) {
        if (!this.selectedStageKeys || !this.selectedStageKeys.length) {
            this.selectedStageKeys = Object.keys(STAGES);
        }
        this._customStagePicked = true;
        this.stageIndex = (this.stageIndex + dir + this.selectedStageKeys.length) % this.selectedStageKeys.length;
        const stKey = this.selectedStageKeys[this.stageIndex];
        preloadStageAssets(this.game.assetManager, stKey);
        this.game.assetManager.loadAll();
    }

    /**
     * Builds a 14-opponent Arcade Shuffle Challenger Ladder from ALL 27 fighters in ALL_FIGHTERS
     * (including Secret / Special fighters even if not unlocked yet!), assigning each fighter
     * their signature Arena or one of the 22 stages!
     */
    _buildArcadeShuffleLadder(p1Char) {
        const customStageMap = {
            Annikina: 'Annikina_Pub',
            Dom: 'Cyber_Matrix',
            AliAbi: 'Ali_Abi_Bazar',
            CayleMinogue: 'France',
            Vikingo: 'Canada',
            SupremeKeano: 'Supreme_Keano',
            HyperKeano: 'Japan_Night',
            JayX: 'USA',
            GargamelHoodie: 'UK',
            AlCapone: 'Colosseum',
            HyperEmely: 'Japan_Night',
            Cayle: 'Russia'
        };
        const shuffle = (arr) => {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        };

        const bossIds = ['Vikingo', 'SupremeKeano', 'Annikina', 'VikingoRaw'];
        const allPool = this.allFighters.filter(f => f.id !== p1Char.id);
        const bossPool = shuffle(allPool.filter(f => bossIds.includes(f.id)));
        const finalBoss = bossPool[0] || ROSTER[ROSTER.length - 1];

        const remainingSpecials = shuffle(SPECIALS.filter(s => s.id !== p1Char.id && s.id !== finalBoss.id));
        const remainingRoster = shuffle(ROSTER.filter(r => r.id !== p1Char.id && r.id !== finalBoss.id));

        // Always ensure Ali Abi (in his Döner-Palast stage!) is part of the 14-stage Arcade Shuffle Ladder!
        const aliObj = SPECIALS.find(s => s.id === 'AliAbi');
        let pickedSpecials = remainingSpecials.slice(0, 6);
        if (aliObj && p1Char.id !== 'AliAbi' && finalBoss.id !== 'AliAbi' && !pickedSpecials.some(s => s.id === 'AliAbi')) {
            pickedSpecials = [aliObj, ...remainingSpecials.filter(s => s.id !== 'AliAbi').slice(0, 5)];
        }
        const pickedRoster = remainingRoster.slice(0, 13 - pickedSpecials.length);
        const midPool = shuffle([...pickedSpecials, ...pickedRoster]).sort((a, b) => {
            const scoreA = (a.power || 100) * 1.6 + (a.hp || 300) * 0.35 + (Math.random() * 8 - 4);
            const scoreB = (b.power || 100) * 1.6 + (b.hp || 300) * 0.35 + (Math.random() * 8 - 4);
            return scoreA - scoreB;
        });
        const fullList = [...midPool, finalBoss];

        return fullList.map((f, idx) => {
            const assignedStage = customStageMap[f.id] || f.stageId || 'Japan';
            return {
                ...f,
                stageId: assignedStage,
                rosterIndex: idx + 1
            };
        });
    }

    /**
     * Builds the 14-Stage Story Mode Ladder including Ali Abi in his Döner-Palast Arena
     * while preserving the 14-stage Story journey (ending with JJ Dark, Putin, and Dark Vikingo).
     */
    _buildStoryLadder(p1Char) {
        const baseStory = ROSTER.slice(1).map(f => ({ ...f })); // 14 stages (ROSTER[1]..ROSTER[14])
        const aliObj = SPECIALS.find(s => s.id === 'AliAbi');
        if (aliObj && p1Char.id !== 'AliAbi') {
            // Place Ali Abi at Stage 7 (right after the Story Midpoint Reflexion!) so total Story length remains 14 stages!
            baseStory[6] = { ...aliObj, stageId: 'Ali_Abi_Bazar' };
        }
        return baseStory.map((f, idx) => ({
            ...f,
            stageId: f.stageId || 'Japan',
            rosterIndex: idx + 1
        }));
    }

    _setupSelectTap() {
        this._removeSelectTap();
        this._onSelectTap = (e) => {
            if (this.loadingCombat) return;
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const pt = window.mapTouchToCanvas
                ? window.mapTouchToCanvas(touch.clientX, touch.clientY, this.game.canvas)
                : (() => {
                    const rect = this.game.canvas.getBoundingClientRect();
                    return {
                        x: (touch.clientX - rect.left) * (this.game.canvas.width / rect.width),
                        y: (touch.clientY - rect.top) * (this.game.canvas.height / rect.height)
                    };
                })();
            const tx = pt.x;
            const ty = pt.y;

            // Top-left BACK / MENU button area (x: 40..280, y: 20..95)
            if (tx >= 20 && tx <= 300 && ty >= 15 && ty <= 100) {
                if (this.p1Locked && !this.p2Locked && !this.arcadeMode) {
                    this.p1Locked = false;
                    this.inputCooldown = 15;
                } else {
                    this.game.stateManager.switchState('Menu');
                }
                return;
            }

            // Versus Mode Interactive Arena Selector Pill (x: 55..1387, y: 655..725)
            const cellW = 133;
            const cellH = 175;
            if (!this.arcadeMode && tx >= 55 && tx <= 55 + this.columns * cellW && ty >= 655 && ty <= 725) {
                const midPillX = 55 + (this.columns * cellW) / 2;
                this._cycleVersusStage(tx < midPillX ? -1 : 1);
                return;
            }

            // Fighter Grid cells (startX=55, startY=115, cellW=133, cellH=175, columns=10)
            const startX = 55;
            const startY = 115;
            if (tx >= startX && tx <= startX + this.columns * cellW && ty >= startY && ty < startY + 3 * cellH) {
                const col = Math.floor((tx - startX) / cellW);
                const row = Math.floor((ty - startY) / cellH);
                const idx = row * this.columns + col;
                if (col >= 0 && col < this.columns && idx >= 0 && idx < this.allFighters.length) {
                    const char = this.allFighters[idx];
                    if (!isFighterUnlocked(char.id)) return;
                    if (!this.p1Locked) {
                        this.p1Index = idx;
                        this.p1Locked = true;
                        this.inputCooldown = 20;
                        if (this.arcadeMode) {
                            this.p2Index = 1;
                            this.p2Locked = true;
                            this.loadingCombat = true;
                            this.preloadAndFight(char.id);
                        } else {
                            playFighterSound(this.game.audioManager, char.id, 'select');
                            this.p2Index = this.p1Index;
                        }
                    } else if (!this.p2Locked && !this.arcadeMode) {
                        this.p2Index = idx;
                        if (!this._customStagePicked && char.stageId) {
                            const stIdx = this.selectedStageKeys.indexOf(char.stageId);
                            if (stIdx >= 0) this.stageIndex = stIdx;
                        }
                        this.p2Locked = true;
                        this.inputCooldown = 60;
                        this.loadingCombat = true;
                        this.preloadAndFight(char.id);
                    }
                }
            }
        };
        this.game.canvas.addEventListener('touchend', this._onSelectTap, { passive: true });
        this.game.canvas.addEventListener('click', this._onSelectTap, { passive: true });
    }

    _removeSelectTap() {
        if (this._onSelectTap) {
            this.game.canvas.removeEventListener('touchend', this._onSelectTap);
            this.game.canvas.removeEventListener('click', this._onSelectTap);
            this._onSelectTap = null;
        }
    }

    update(dt) {
        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }
        const p1 = this.game.inputManager.p1;

        // If a fighter was just locked and their select voice is playing, pressing any action/skip button after 0.35s advances immediately
        if (this.loadingCombat && this._finishTransitionNow && this.inputCooldown <= 8 && (p1.lJust || p1.hJust || p1.sJust || p1.skipJust)) {
            this._finishTransitionNow();
            return;
        }

        if (!this.p1Locked && this.inputCooldown <= 0) {
            // P1 Selection Phase
            if (p1.left) { this.p1Index = Math.max(0, this.p1Index - 1); this.inputCooldown = 10; }
            else if (p1.right) { this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + 1); this.inputCooldown = 10; }
            else if (p1.up) { this.p1Index = Math.max(0, this.p1Index - this.columns); this.inputCooldown = 10; }
            else if (p1.down) { this.p1Index = Math.min(this.allFighters.length - 1, this.p1Index + 1 * this.columns); this.inputCooldown = 10; }

            if (p1.l || p1.h) {
                const char = this.allFighters[this.p1Index];
                if (!isFighterUnlocked(char.id)) {
                    // Locked! Cannot select. Play buzzer or ignore.
                    this.inputCooldown = 15;
                    return;
                }

                this.p1Locked = true;
                this.inputCooldown = 20;

                if (this.arcadeMode) {
                    // Arcade Mode: Skip P2 selection, go straight to ladder after select voice finishes
                    this.p2Index = 1; // ROSTER[1] Hattori is the start of the ladder
                    this.p2Locked = true;
                    this.loadingCombat = true;
                    this.preloadAndFight(char.id);
                } else {
                    playFighterSound(this.game.audioManager, char.id, 'select');
                    // Versus Mode: Initialize P2 cursor to P1's position to let P1 pick P2
                    this.p2Index = this.p1Index;
                }
            } else if (p1.s) {
                // Return to Main Menu
                this.inputCooldown = 20;
                this.game.stateManager.switchState('Menu');
            }
        } else if (this.p1Locked && !this.p2Locked && !this.arcadeMode && this.inputCooldown <= 0) {
            // P2 Selection Phase (controlled by P1 input in VS Mode)
            if (p1.left) { this.p2Index = Math.max(0, this.p2Index - 1); this.inputCooldown = 10; }
            else if (p1.right) { this.p2Index = Math.min(this.allFighters.length - 1, this.p2Index + 1); this.inputCooldown = 10; }
            else if (p1.up) { this.p2Index = Math.max(0, this.p2Index - this.columns); this.inputCooldown = 10; }
            else if (p1.down) { this.p2Index = Math.min(this.allFighters.length - 1, this.p2Index + this.columns); this.inputCooldown = 10; }

            if (!this._customStagePicked) {
                const hoverChar = this.allFighters[this.p2Index];
                if (hoverChar && hoverChar.stageId) {
                    const stIdx = this.selectedStageKeys.indexOf(hoverChar.stageId);
                    if (stIdx >= 0) this.stageIndex = stIdx;
                }
            }

            if (p1.l || p1.h) {
                const char = this.allFighters[this.p2Index];
                if (!isFighterUnlocked(char.id)) {
                    // Locked!
                    this.inputCooldown = 15;
                    return;
                }
                this.p2Locked = true;
                this.inputCooldown = 20;
                this.loadingCombat = true;
                this.preloadAndFight(char.id);
            } else if (p1.s) {
                // Cancel P1 lock
                this.p1Locked = false;
                this.inputCooldown = 20;
            }
        }
    }

    async preloadAndFight(selectedVoiceCharId = null) {
        const p1Char = this.allFighters[this.p1Index];
        let p2Char = this.allFighters[this.p2Index];
        let arcadeLadder = null;

        if (this.arcadeMode && !this.storyMode) {
            // Pure ARCADE Shuffle Challenger Mode: 14-stage shuffled ladder including Ali Abi!
            arcadeLadder = this._buildArcadeShuffleLadder(p1Char);
            p2Char = arcadeLadder[0];
        } else if (this.arcadeMode) {
            // 14-Stage Story Mode Ladder (includes Ali Abi in his Döner-Palast Arena at Stage 7!)
            arcadeLadder = this._buildStoryLadder(p1Char);
            p2Char = arcadeLadder[0];
        }

        preloadFighterSprites(this.game.assetManager, p1Char);
        preloadFighterSprites(this.game.assetManager, p2Char);

        const chosenStageKey = (!this.arcadeMode && this.selectedStageKeys && this.selectedStageKeys[this.stageIndex])
            ? this.selectedStageKeys[this.stageIndex]
            : (p2Char.stageId || 'Japan');
        preloadStageAssets(this.game.assetManager, chosenStageKey);
        this.game.assetManager.loadAll();

        // Stop the select menu music instantly so the fighter's select voice rings out crystal-clear.
        this.game.audioManager.stopBGM();

        let transitioned = false;
        const doTransition = () => {
            if (transitioned) return;
            transitioned = true;
            if (this._selectFallbackTimer) {
                clearTimeout(this._selectFallbackTimer);
                this._selectFallbackTimer = null;
            }
            this._finishTransitionNow = null;
            // Ensure no select voice or announcer bleeds into StorySequence or VersusIntro
            this.game.audioManager.stopFighterVoice?.();
            this.game.audioManager.stopAnnouncerVoice?.();

            if (this.arcadeMode && !this.storyMode && arcadeLadder) {
                const firstOpponent = arcadeLadder[0];
                const combatData = {
                    p1: p1Char,
                    p2: firstOpponent,
                    stageId: firstOpponent.stageId,
                    arcadeMode: true,
                    storyMode: false,
                    survivalMode: this.survivalMode,
                    arcadeLadder: arcadeLadder,
                    arcadeIndex: 1,
                    arcadeWins: 0,
                };
                this.game.stateManager.switchState('VersusIntro', combatData);
            } else if (this.arcadeMode) {
                const opponent = (arcadeLadder && arcadeLadder[0]) ? arcadeLadder[0] : ROSTER[1];
                const combatData = {
                    p1: p1Char,
                    p2: { ...opponent, rosterIndex: 1 },
                    stageId: opponent.stageId,
                    arcadeMode: true,
                    storyMode: true,
                    arcadeLadder: arcadeLadder,
                    arcadeIndex: 1,
                    arcadeWins: 0,
                };
                this.game.stateManager.switchState('Story', {
                    ...STORY_PROLOGUE,
                    nextState: 'VersusIntro',
                    nextData: combatData,
                });
            } else if (this.trainingMode) {
                this.game.stateManager.switchState('Combat', {
                    p1: p1Char,
                    p2: { ...p2Char, rosterIndex: this.p2Index },
                    stageId: chosenStageKey,
                    arcadeMode: false,
                    trainingMode: true
                });
            } else {
                this.game.stateManager.switchState('VersusIntro', {
                    p1: p1Char,
                    p2: { ...p2Char, rosterIndex: this.p2Index },
                    stageId: chosenStageKey,
                    arcadeMode: false,
                    trainingMode: false
                });
            }
        };

        this._finishTransitionNow = doTransition;

        if (selectedVoiceCharId) {
            // Play the fighter's select voice clip in full, then wait 180ms and transition cleanly into Story / VersusIntro!
            playFighterSound(this.game.audioManager, selectedVoiceCharId, 'select', () => {
                setTimeout(doTransition, 180);
            });
            // Safety fallback (max 7.5s) in case audio is muted or blocked
            this._selectFallbackTimer = setTimeout(doTransition, 7500);
        } else {
            this._selectFallbackTimer = setTimeout(doTransition, 800);
        }
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

        // ─── TOP-LEFT BACK / MENU BUTTON (Touch & Mouse friendly) ───
        ctx.save();
        ctx.fillStyle = 'rgba(20, 25, 45, 0.85)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.fillRect(60, 25, 190, 50);
        ctx.strokeRect(60, 25, 190, 50);
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(this.p1Locked && !this.p2Locked && !this.arcadeMode ? '← ZURÜCK' : '← MENU', 155, 58);
        ctx.restore();

        // ─── TITLE ───
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 44px "Press Start 2P"';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 15;
        ctx.fillText("SELECT YOUR FIGHTER", this.game.width / 2, 65);
        ctx.shadowBlur = 0;

        // ─── UNIFIED FIGHTER GRID ───
        const cellW = 133;
        const cellH = 175;
        const mainGridW = this.columns * cellW;
        const startX = 55; // Push to the left edge to leave room on the right
        const startY = 115; // Push down slightly

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

        // ─── VERSUS MODE ARENA SELECTOR PILL OR ARCADE SHUFFLE CHALLENGER BANNER (BELOW GRID) ───
        const pillX = startX;
        const pillY = 660;
        const pillW = mainGridW;
        const pillH = 56;
        ctx.save();
        if (!this.arcadeMode) {
            const stKey = (this.selectedStageKeys && this.selectedStageKeys[this.stageIndex]) || 'Japan';
            const stName = (STAGES[stKey] && STAGES[stKey].name) ? STAGES[stKey].name.toUpperCase() : stKey.toUpperCase();
            ctx.fillStyle = 'rgba(8, 16, 38, 0.92)';
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2.5;
            ctx.fillRect(pillX, pillY, pillW, pillH);
            ctx.strokeRect(pillX, pillY, pillW, pillH);
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`ARENA: ◀ ${stName} ▶  [ANTIPPEN ZUM WECHSELN]`, pillX + pillW / 2, pillY + 35);
        } else if (!this.storyMode) {
            ctx.fillStyle = 'rgba(28, 12, 42, 0.92)';
            ctx.strokeStyle = '#ff66dd';
            ctx.lineWidth = 2.5;
            ctx.fillRect(pillX, pillY, pillW, pillH);
            ctx.strokeRect(pillX, pillY, pillW, pillH);
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('🎲 ARCADE SHUFFLE-LADDER: ALLE 28 KÄMPFER (INKL. SECRET-BOSSES) & 23 ARENEN!', pillX + pillW / 2, pillY + 35);
        }
        ctx.restore();

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
            ctx.font = 'bold 34px "Press Start 2P"';
            ctx.fillText(this.storyMode ? "STORY" : "SHUFFLE", x + cardW / 2, y + 450);
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
        ctx.font = 'bold 26px "Press Start 2P"';
        ctx.fillText(char.name.toUpperCase(), x + cardW / 2, y + 418);

        ctx.fillStyle = '#aaa';
        ctx.font = '14px "Press Start 2P"';
        ctx.fillText(`"${char.nickname.toUpperCase()}"`, x + cardW / 2, y + 448);

        // Fight Style Badge & Signature Combo
        const style = getFighterStyle(char);
        ctx.fillStyle = style.color || '#00ffff';
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.fillText(`STYLE: ${style.badge}`, x + cardW / 2, y + 480);

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillText(`KOMBO: ${style.sig1Badges.join(' ')}`, x + cardW / 2, y + 506);

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
