import Fighter from '../entities/Fighter.js?v=2.75';
import Projectile from '../entities/Projectile.js?v=2.75';
import Hitbox from '../entities/Hitbox.js?v=2.75';
import StageObjectManager from '../entities/StageObjects.js?v=2.75';
import AIController from '../ai/AIController.js?v=2.75';
import CombatHUD from '../ui/CombatHUD.js?v=2.75';
import {
    preloadFighterSprites,
    preloadStageAssets,
    playAnnouncer,
    playFighterSound,
    playCombatSound
} from '../core/AssetPreloader.js?v=2.75';
import { STAGES, ROSTER, unlockFighter } from '../data.js?v=2.75';
import { STORY_REFLEXION, STORY_EPILOGUE, STORY_OUTRO, STORY_BIRTHDAY } from '../story_data.js?v=2.75';
import { STORY_DIALOGUES } from '../story_dialogues.js?v=2.75';
import CinematicFinisher, { getFinisherMove } from '../fx/CinematicFinisher.js?v=2.75';

export default class CombatState {
    constructor(game) {
        this.game = game;
        this.p1 = null;
        this.p2 = null;
        this.stageId = 'Japan';

        // Match flow
        this.time = 0;
        this.matchPhase = 'FIGHT_INTRO';
        this.timer = 99;
        this.introTimer = 0;
        this.koFreezeTimer = 0;
        this.finishHimTimer = 0;
        this.finisherTimer = 0;
        this.finisherTriggered = false;
        this.winner = null;
        this.postMatchIndex = 0;
        this.inputCooldown = 0;
        this.combatData = null;

        // Screen Shake & VFX
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.particles = [];
        this.projectiles = [];

        // Stage destructible objects
        this.stageObjects = new StageObjectManager(game);
    }

    enter(data) {
        console.log("Entering Combat State");
        this.combatData = data;

        // Arcade & Online / Co-Op / Training / Survival Mode tracking
        this.arcadeMode = Boolean(data && data.arcadeMode);
        this.storyMode = Boolean(data && data.storyMode);
        this.trainingMode = Boolean(data && data.trainingMode);
        this.survivalMode = Boolean(data && data.survivalMode);
        this.trainingDummyMode = (data && data.trainingDummyMode) || 'STAND'; // 'STAND' | 'CROUCH' | 'GUARD' | 'CPU'
        this.arcadeLadder = (data && Array.isArray(data.arcadeLadder)) ? data.arcadeLadder : null;
        this.coopMode = Boolean(data && data.coopMode);
        this.onlineMode = (data && data.onlineMode) || null;
        this.arcadeIndex = (data && data.arcadeIndex !== undefined) ? data.arcadeIndex : 1;
        this.arcadeWins = (data && data.arcadeWins) || 0;
        this._netSyncTick = 0;

        // Preserve FULL fighter stats & metadata from data.js (HP, speed, power, largeAura, specialType, multiFrameAnim)
        const baseP1 = (data && data.p1) ? data.p1 : ROSTER[0];
        const baseP2 = (data && data.p2) ? data.p2 : ROSTER[13];
        const p1Data = { ...baseP1, color: 'blue' };
        const p2Data = { ...baseP2, color: 'red' };
        this.stageId = (data && data.stageId) ? data.stageId : (p2Data.stageId || 'Japan');

        if (this.coopMode && data && data.ally) {
            const allyData = { ...data.ally, color: 'purple' };
            this.p1 = new Fighter(this.game, p1Data, this.game.width * 0.19, this.game.height * 0.9, 1);
            this.ally = new Fighter(this.game, allyData, this.game.width * 0.32, this.game.height * 0.9, 1);
            this.p2 = new Fighter(this.game, p2Data, this.game.width * 0.78, this.game.height * 0.9, -1);
            // Boost Boss HP by 1.55x in 2-player Co-Op so team battles feel epic
            this.p2.maxHP = Math.round(this.p2.maxHP * 1.55);
            this.p2.hp = this.p2.maxHP;
            preloadFighterSprites(this.game.assetManager, allyData);
        } else {
            this.ally = null;
            this.p1 = new Fighter(this.game, p1Data, this.game.width * 0.25, this.game.height * 0.9, 1);
            this.p2 = new Fighter(this.game, p2Data, this.game.width * 0.75, this.game.height * 0.9, -1);
        }

        // Link opponent references so instant proximity guard and block priority work accurately
        this.p1.opponent = this.p2;
        this.p2.opponent = this.p1;
        if (this.ally) this.ally.opponent = this.p2;

        // Balanced Street Fighter II Turbo Difficulty & 14-Arena Progression Curve for CPU
        if (!this.onlineMode && !this.trainingMode && !this.coopMode) {
            const diff = (this.game.settings && this.game.settings.difficulty) || 'NORMAL';
            const isLadderMode = Boolean(this.storyMode || this.arcadeMode || this.survivalMode);
            const totalSt = (this.arcadeLadder && this.arcadeLadder.length) ? this.arcadeLadder.length : 15;
            const stageNum = isLadderMode
                ? Math.max(1, Math.min(totalSt, this.arcadeIndex || 1))
                : Math.max(6, Math.min(11, (p2Data.rosterIndex ?? 6) + 1));
            const stageRatio = (stageNum - 1) / Math.max(1, totalSt - 1); // 0.0 in Arena 1 -> 1.0 in Arena 15

            const curve = Math.pow(stageRatio, 1.3); // Gentle in Stages 1-6, ramps up toward Stages 11-14
            if (diff === 'EASY') {
                this.p2.specialEnergy = stageNum >= 8 ? 35 : 0;
                const hpMul = 0.62 + curve * 0.28; // Stage 1: 62% HP -> Stage 14: 90% HP
                this.p2.maxHP = Math.round(this.p2.baseMaxHP * hpMul);
                this.p2.hp = this.p2.maxHP;
                this.p2.power = Math.round((p2Data.power || 100) * (0.58 + curve * 0.28)); // Stage 1: 58% Power -> Stage 14: 86% Power
            } else if (diff === 'NORMAL') {
                // Smooth 14-Stage Arcade Progression Curve:
                // Arena 1-3: 72%-77% HP, 68%-73% Power (relaxed, fun warm-up where player dominates!)
                // Arena 4-8: 80%-90% HP, 76%-86% Power (fair mid-game arcade challenge)
                // Arena 9-12: 92%-100% HP, 89%-98% Power (exciting tournament fights)
                // Arena 13-14: 103%-108% HP, 101%-106% Power (worthy final boss showdown!)
                this.p2.specialEnergy = isLadderMode ? (stageNum <= 4 ? 0 : Math.round((stageNum - 4) * 5)) : 40;
                const hpMul = isLadderMode ? (0.72 + curve * 0.36) : 0.92;
                this.p2.maxHP = Math.round(this.p2.baseMaxHP * hpMul);
                this.p2.hp = this.p2.maxHP;
                const pwrScale = isLadderMode ? (0.68 + curve * 0.38) : 0.90;
                this.p2.power = Math.round((p2Data.power || 100) * pwrScale);
            } else if (diff === 'HARD') {
                this.p2.specialEnergy = stageNum <= 2 ? 25 : 65;
                const hpMul = 0.88 + curve * 0.28; // Stage 1: 88% HP -> Stage 14: 116% HP
                this.p2.maxHP = Math.round(this.p2.baseMaxHP * hpMul);
                this.p2.hp = this.p2.maxHP;
                this.p2.power = Math.round((p2Data.power || 100) * (0.85 + curve * 0.28)); // Stage 1: 85% Power -> Stage 14: 113% Power
            }
        }

        // Carry over healed HP in Survival Mode!
        if (this.survivalMode && data && data.survivalHP) {
            this.p1.hp = Math.min(this.p1.maxHP, Math.max(25, data.survivalHP));
        }

        // Reset match timers & flags cleanly for every round/fight
        this.time = 0;
        this.matchPhase = this.trainingMode ? 'FIGHTING' : 'FIGHT_INTRO';
        this.timer = this.trainingMode ? 99 : ((this.game.settings && this.game.settings.timer) || 99);
        this.introTimer = 0;
        this.koFreezeTimer = 0;
        this.finishHimTimer = 0;
        this.finisherTimer = 0;
        this.finisherTriggered = false;
        this._finisherImpactPlayed = false;
        this._finisherBoomPlayed = false;
        this.winner = null;
        this.postMatchIndex = 0;
        this.postMatchTimer = 0;
        this.autoAdvanceTimer = undefined;
        this.autoAdvanceMax = 3.0;
        this.inputCooldown = 45;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.particles = [];
        this.shockwaves = [];
        this.projectiles = [];
        this._transitioning = false;
        this._koAnnounced = false;
        this._perfectAnnounced = false;
        this._koKnockbackApplied = false;
        this._newlyUnlocked = null;

        // Street Fighter Best-of-3 Rounds State (1 round in Survival/Training, 2-of-3 in Story/Arcade/Versus!)
        this.roundsToWin = (this.survivalMode || this.trainingMode) ? 1 : 2;
        this.currentRound = 1;
        this.p1RoundWins = 0;
        this.p2RoundWins = 0;
        this._roundWinAwarded = false;

        // Story-Driven Match Dialogue Banner
        this.storyDialogue = STORY_DIALOGUES[p2Data.id] || STORY_DIALOGUES[p1Data.id] || null;
        this.storyBannerTimer = this.trainingMode ? 0 : 22.0;
        this.introSubPhase = 'STORY_DIALOGUE';
        this.introSubTimer = 0;

        // Street Fighter Trailing Red Damage Bars
        this.p1TrailHP = this.p1.hp;
        this.p2TrailHP = this.p2.maxHP;
        this.allyTrailHP = this.ally ? this.ally.maxHP : 0;

        // Street Fighter Super Freeze, Camera Punch-Zoom & Arcade Callouts
        this.superFreezeTimer = 0;
        this.superFreezeFighter = null;
        this.cameraZoom = 1.0;
        this.cameraFocusX = this.game.width / 2;
        this.cameraFocusY = this.game.height * 0.65;
        this.firstAttackAwarded = false;
        this.callout = (this.arcadeMode && p2Data.special)
            ? { text: '⚠️ SECRET CHALLENGER!', color: '#ff3366', side: 'p2', timer: 3.2, maxTimer: 3.2 }
            : (this.trainingMode ? { text: '🥋 DOJO TRAINING READY!', color: '#00ff88', side: 'p1', timer: 2.2, maxTimer: 2.2 } : null);

        // Combo Counter tracking
        this.p1ComboCount = 0;
        this.p1ComboTimer = 0;
        this.p2ComboCount = 0;
        this.p2ComboTimer = 0;

        // Pause State
        this.paused = false;
        this.pauseSelection = 0;

        // Preload sprites & stage background
        preloadFighterSprites(this.game.assetManager, p1Data);
        preloadFighterSprites(this.game.assetManager, p2Data);
        preloadStageAssets(this.game.assetManager, this.stageId);
        this.game.assetManager.loadAll();

        // Initialize stage destructibles & music
        this.stageObjects.init(this.stageId);
        this.playStageMusic();

        // Strictly Ordered, Non-Overlapping Street Fighter Intro Sequence:
        // Step 1 ('STORY_DIALOGUE'): Opponent speaks full cinematic Story Intro to the very last word
        // Step 2 ('ROUND_CALL'): After Story Intro finishes + 450ms pause -> Announcer roars "ROUND 1!" (1.82s)
        // Step 3 ('FIGHT_CALL'): After "ROUND 1!" finishes + 200ms pause -> Announcer roars "FIGHT!" -> Match starts!
        this._clearIntroTimers();
        this.game.audioManager.stopVoice?.();
        this.game.audioManager.stopFighterVoice?.();
        this.game.audioManager.stopAnnouncerVoice?.();

        if (!this.trainingMode) {
            playFighterSound(this.game.audioManager, p2Data.id, 'intro', () => {
                this._startRoundCall(false);
            });
            // Generous 18s safety fallback (only if browser blocked audio; never cuts off 9-13s intro speeches!)
            this._storyIntroTimeout = setTimeout(() => {
                this._startRoundCall(false);
            }, 18000);
        }

        this.game.canvas.addEventListener('mousedown', this._onMouseClick);
    }

    _clearIntroTimers() {
        if (this._roundAnnouncerTimeout) {
            clearTimeout(this._roundAnnouncerTimeout);
            this._roundAnnouncerTimeout = null;
        }
        if (this._fightAnnouncerTimeout) {
            clearTimeout(this._fightAnnouncerTimeout);
            this._fightAnnouncerTimeout = null;
        }
        if (this._storyIntroTimeout) {
            clearTimeout(this._storyIntroTimeout);
            this._storyIntroTimeout = null;
        }
    }

    _startRoundCall(immediate = false) {
        if (this.matchPhase !== 'FIGHT_INTRO' || this.introSubPhase !== 'STORY_DIALOGUE') return;
        if (this.paused) {
            this._pendingRoundCall = true;
            return;
        }
        // Never interrupt if fighter intro voice is still actively speaking (unless player explicitly skipped)
        if (!immediate && this.game.audioManager.isFighterVoicePlaying?.()) {
            return;
        }
        if (this._storyIntroTimeout) {
            clearTimeout(this._storyIntroTimeout);
            this._storyIntroTimeout = null;
        }
        if (this._roundAnnouncerTimeout) clearTimeout(this._roundAnnouncerTimeout);

        const delayMs = immediate ? 60 : 480;
        this._roundAnnouncerTimeout = setTimeout(() => {
            if (this.matchPhase !== 'FIGHT_INTRO' || this.introSubPhase !== 'STORY_DIALOGUE') return;
            if (this.paused) {
                this._pendingRoundCall = true;
                return;
            }
            this.introSubPhase = 'ROUND_CALL';
            this.introSubTimer = 0;
            this.storyBannerTimer = Math.min(this.storyBannerTimer, 0.35);
            const roundClip = (this.currentRound === 1) ? 'round_1' : ((this.currentRound === 2) ? 'round_2' : 'round_final');
            playAnnouncer(this.game.audioManager, roundClip, () => {
                this._startFightCall();
            });
            // Safety fallback for ROUND call duration
            if (this._fightAnnouncerTimeout) clearTimeout(this._fightAnnouncerTimeout);
            this._fightAnnouncerTimeout = setTimeout(() => {
                this._startFightCall();
            }, 2600);
        }, delayMs);
    }

    _startFightCall() {
        if (this.matchPhase !== 'FIGHT_INTRO' || this.introSubPhase !== 'ROUND_CALL') return;
        if (this.paused) {
            this._pendingFightCall = true;
            return;
        }
        if (this._fightAnnouncerTimeout) {
            clearTimeout(this._fightAnnouncerTimeout);
            this._fightAnnouncerTimeout = null;
        }
        this._fightAnnouncerTimeout = setTimeout(() => {
            if (this.matchPhase !== 'FIGHT_INTRO' || this.introSubPhase !== 'ROUND_CALL') return;
            if (this.paused) {
                this._pendingFightCall = true;
                return;
            }
            this.introSubPhase = 'FIGHT_CALL';
            this.introSubTimer = 0;
            playAnnouncer(this.game.audioManager, 'fight');
        }, 220);
    }

    preloadFighterSprites(char) {
        preloadFighterSprites(this.game.assetManager, char);
    }

    playStageMusic() {
        const stage = STAGES[this.stageId];
        if (!stage || !stage.music) return;
        const path = `assets/audio/music/${stage.music}`;
        const preloadedBGM = this.game.assetManager.audioBuffer[path];

        this.game.audioManager.stopBGM();
        this.game.audioManager.playBGM(path, true, false, null, preloadedBGM);
    }

    exit() {
        this._clearIntroTimers();
        this.game.audioManager.stopFighterVoice?.();
        this.game.audioManager.stopAnnouncerVoice?.();

        const totalSt = (this.arcadeLadder && this.arcadeLadder.length) ? this.arcadeLadder.length : (ROSTER.length - 1);
        const isFinalBoss = (this.arcadeIndex === totalSt);
        const wonBossFight = (isFinalBoss && this.winner === 'p1');
        if (!wonBossFight) {
            this.game.audioManager.stopBGM();
        }
        this.game.canvas.removeEventListener('mousedown', this._onMouseClick);
    }

    _updateTrailBars(dt) {
        if (this.p1) {
            if (this.p1.hp <= 0 || this.p1.state === 'KO') {
                this.p1.hp = 0;
                this.p1TrailHP = 0;
            } else if (this.p1TrailHP > this.p1.hp) {
                const rate = this.p1.state === 'HIT' ? 65 : 220;
                this.p1TrailHP = Math.max(this.p1.hp, this.p1TrailHP - rate * dt);
            } else {
                this.p1TrailHP = this.p1.hp;
            }
        }
        if (this.p2) {
            if (this.p2.hp <= 0 || this.p2.state === 'KO') {
                this.p2.hp = 0;
                this.p2TrailHP = 0;
            } else if (this.p2TrailHP > this.p2.hp) {
                const rate = this.p2.state === 'HIT' ? 65 : 220;
                this.p2TrailHP = Math.max(this.p2.hp, this.p2TrailHP - rate * dt);
            } else {
                this.p2TrailHP = this.p2.hp;
            }
        }
        if (this.ally) {
            if (this.ally.hp <= 0 || this.ally.state === 'KO') {
                this.ally.hp = 0;
                this.allyTrailHP = 0;
            } else if (this.allyTrailHP > this.ally.hp) {
                const rate = this.ally.state === 'HIT' ? 65 : 220;
                this.allyTrailHP = Math.max(this.ally.hp, this.allyTrailHP - rate * dt);
            } else {
                this.allyTrailHP = this.ally.hp;
            }
        }
    }

    _adjustPauseVolume(rowIdx, delta) {
        const s = this.game.settings;
        if (!s) return;
        if (rowIdx === 1) {
            s.musicVolume = Math.round(Math.max(0, Math.min(1.0, (s.musicVolume ?? 0.22) + delta)) * 100) / 100;
            this.game.saveSettings?.();
        } else if (rowIdx === 2) {
            s.sfxVolume = Math.round(Math.max(0, Math.min(1.5, (s.sfxVolume ?? 0.90) + delta)) * 100) / 100;
            this.game.saveSettings?.();
            this.game.audioManager?.playHitImpactSound?.(true, false);
        } else if (rowIdx === 3) {
            s.voiceVolume = Math.round(Math.max(0, Math.min(1.5, (s.voiceVolume ?? 1.00) + delta)) * 100) / 100;
            this.game.saveSettings?.();
            playFighterSound(this.game.audioManager, this.p1?.data?.id || 'Keano', 'special');
        }
    }

    setPaused(val) {
        this.paused = Boolean(val);
        this.pauseSelection = 0;
        if (!this.paused) {
            document.getElementById('mobile-menu')?.classList.add('hidden');
            if (this.matchPhase === 'FIGHT_INTRO') {
                if (this._pendingRoundCall && this.introSubPhase === 'STORY_DIALOGUE') {
                    this._pendingRoundCall = false;
                    this._startRoundCall(true);
                } else if (this._pendingFightCall && this.introSubPhase === 'ROUND_CALL') {
                    this._pendingFightCall = false;
                    this._startFightCall();
                }
            }
        }
    }

    _cycleTrainingDummyMode() {
        const modes = ['STAND', 'CROUCH', 'GUARD', 'CPU'];
        const idx = modes.indexOf(this.trainingDummyMode || 'STAND');
        this.trainingDummyMode = modes[(idx + 1) % modes.length];
        this.triggerCallout(`🥋 DUMMY: ${this.trainingDummyMode}`, '#00ff88', 'p2');
    }

    _handleCanvasTap(x, y) {
        const cx = this.game.width / 2;
        const cy = this.game.height / 2;

        // Top-Right MENU button or Top-Center PAUSE button toggles pause
        const hitTopRightMenu = (x > this.game.width - 210 && y < 85);
        const hitTopCenterPause = (x >= cx - 90 && x <= cx + 90 && y < 52);

        if (this.paused) {
            if (hitTopRightMenu || hitTopCenterPause) {
                this.setPaused(false);
                return true;
            }
            const startY = cy - 110;
            const rowStep = 68;
            for (let i = 0; i < 5; i++) {
                const ry = startY + i * rowStep;
                if (y >= ry - 36 && y <= ry + 22 && x >= cx - 420 && x <= cx + 420) {
                    this.pauseSelection = i;
                    if (i === 0) {
                        this.setPaused(false);
                    } else if (i === 4) {
                        this.setPaused(false);
                        if (this.game.networkManager?.active) this.game.networkManager.disconnect();
                        this.game.stateManager.switchState('Menu');
                    } else if (i >= 1 && i <= 3) {
                        const barX = cx - 40;
                        const barW = 280;
                        const maxVal = i === 1 ? 1.0 : 1.5;
                        if (x >= barX && x <= barX + barW) {
                            const ratio = Math.max(0, Math.min(1, (x - barX) / barW));
                            const val = Math.round(ratio * maxVal * 20) / 20;
                            if (i === 1) this.game.settings.musicVolume = val;
                            if (i === 2) this.game.settings.sfxVolume = val;
                            if (i === 3) this.game.settings.voiceVolume = val;
                            this.game.saveSettings?.();
                            if (i === 2) this.game.audioManager?.playHitImpactSound?.(true, false);
                            if (i === 3) playFighterSound(this.game.audioManager, this.p1?.data?.id || 'Keano', 'special');
                        } else if (x < barX) {
                            this._adjustPauseVolume(i, -0.05);
                        } else {
                            this._adjustPauseVolume(i, 0.05);
                        }
                    }
                    return true;
                }
            }
            if (x < cx - 450 || x > cx + 450 || y < cy - 260 || y > cy + 260) {
                this.setPaused(false);
            }
            return true;
        }

        if (hitTopRightMenu || hitTopCenterPause) {
            this.setPaused(true);
            return true;
        }

        // Training Mode: tap the top-center Dojo Telemetry Banner to cycle Dummy mode!
        if (this.trainingMode && x >= cx - 460 && x <= cx + 460 && y >= 142 && y <= 198) {
            this._cycleTrainingDummyMode();
            return true;
        }
        return false;
    }

    _onMouseClick = (e) => {
        if (!this.game || !this.game.canvas) return;
        let pt;
        if (window.mapTouchToCanvas) {
            pt = window.mapTouchToCanvas(e.clientX, e.clientY, this.game.canvas);
        } else {
            const rect = this.game.canvas.getBoundingClientRect();
            pt = {
                x: (e.clientX - rect.left) * (this.game.width / Math.max(1, rect.width)),
                y: (e.clientY - rect.top) * (this.game.height / Math.max(1, rect.height)),
            };
        }
        this._handleCanvasTap(pt.x, pt.y);
    };

    update(dt) {
        this.time += dt;
        const p1 = this.game.inputManager.p1;
        const net = this.game.networkManager;
        const isOnlineHost = Boolean(net && net.active && net.role === 'host' && this.onlineMode);
        const isOnlineGuest = Boolean(net && net.active && net.role === 'guest' && this.onlineMode);

        // If mobile top-right HTML menu (#mobile-menu) is open during Combat, automatically pause Gameplay!
        const mobileMenuEl = document.getElementById('mobile-menu');
        if (mobileMenuEl && !mobileMenuEl.classList.contains('hidden') && !this.paused) {
            this.setPaused(true);
        }

        if (p1.menuJust) {
            this.setPaused(!this.paused);
            return;
        }

        if (this.paused) {
            if (p1.downJust) this.pauseSelection = (this.pauseSelection + 1) % 5;
            if (p1.upJust) this.pauseSelection = (this.pauseSelection + 4) % 5;
            if (p1.leftJust && this.pauseSelection >= 1 && this.pauseSelection <= 3) {
                this._adjustPauseVolume(this.pauseSelection, -0.05);
            } else if (p1.rightJust && this.pauseSelection >= 1 && this.pauseSelection <= 3) {
                this._adjustPauseVolume(this.pauseSelection, 0.05);
            } else if (p1.lJust || p1.hJust || p1.sJust) {
                if (this.pauseSelection === 0) {
                    this.setPaused(false);
                } else if (this.pauseSelection >= 1 && this.pauseSelection <= 3) {
                    this._adjustPauseVolume(this.pauseSelection, 0.05);
                } else if (this.pauseSelection === 4) {
                    this.setPaused(false);
                    if (net && net.active) net.disconnect();
                    this.game.stateManager.switchState('Menu');
                }
            }
            return;
        }

        if (this.inputCooldown > 0) this.inputCooldown--;
        if (this.storyBannerTimer > 0) this.storyBannerTimer = Math.max(0, this.storyBannerTimer - dt);

        // ─── ONLINE GUEST: Receive & interpolate Host snapshots ───
        if (isOnlineGuest) {
            this._updateAsGuest(dt);
            return;
        }

        // ─── FIGHT INTRO (Ordered: Story Dialogue -> ROUND 1 -> FIGHT!) ───
        if (this.matchPhase === 'FIGHT_INTRO') {
            this.introTimer += dt;
            this.introSubTimer = (this.introSubTimer || 0) + dt;

            // Allow instant skipping of the entire intro & voiceover in ALL modes when player presses Skip (Space/Enter/J/K/L/Click)
            const remoteSkip = isOnlineHost ? Boolean(net.consumeRemoteInput()?.skipJust) : false;
            if (this.introTimer > 0.30 && (p1.skipJust || p1.menuJust || remoteSkip)) {
                this._clearIntroTimers();
                this.game.audioManager.stopFighterVoice?.();
                this.game.audioManager.stopAnnouncerVoice?.();
                this.storyBannerTimer = 0;
                this.matchPhase = 'FIGHTING';
                if (isOnlineHost) this._broadcastHostSnapshot();
                return;
            }

            if (this.introSubPhase === 'FIGHT_CALL') {
                if (this.introSubTimer >= 1.35) {
                    this.matchPhase = 'FIGHTING';
                }
            }

            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // Keep gravity running for airborne KO characters during POST_MATCH and VICTORY
        if (this.matchPhase === 'POST_MATCH' || this.matchPhase === 'VICTORY') {
            this._updateTrailBars(dt);
            const floorY = this.game.height * 0.9;
            const fighters = this.ally ? [this.p1, this.ally, this.p2] : [this.p1, this.p2];
            for (const f of fighters) {
                if (f && f.state === 'KO' && f.y < floorY) {
                    f.vy += f.gravity * dt;
                    f.y += f.vy * dt;
                    f.x += f.vx * dt;
                    f.vx *= 0.95;
                    if (f.y >= floorY) {
                        f.y = floorY;
                        f.vy = 0;
                        f.vx *= 0.3;
                    }
                }
            }
        }

        // ─── POST MATCH ───
        if (this.matchPhase === 'POST_MATCH') {
            this.postMatchTimer = (this.postMatchTimer || 0) + dt;

            if (this.autoAdvanceTimer === undefined) {
                this.autoAdvanceMax = (this.arcadeMode && this.winner === 'p1') ? 8.5 : 10.0;
                this.autoAdvanceTimer = this.autoAdvanceMax;
            }

            // If player doesn't press skip, wait until the winner's victory speech finishes completely before auto-advancing
            const winVoicePlaying = Boolean(this.game.audioManager.isFighterVoicePlaying?.()) && this.postMatchTimer < 14.0;

            if (this.inputCooldown <= 0 && !this._transitioning) {
                if (!winVoicePlaying) {
                    this.autoAdvanceTimer -= dt;
                }
                const confirmPressed = (p1.lJust || p1.hJust || p1.sJust || p1.skipJust);
                const timeOut = !winVoicePlaying && this.autoAdvanceTimer <= 0;

                if (confirmPressed && winVoicePlaying) {
                    this.game.audioManager.stopFighterVoice?.();
                }

                if (this.arcadeMode) {
                    if (this.winner === 'p1') {
                        if (timeOut || confirmPressed) {
                            this.advanceArcadeLadder();
                        }
                    } else {
                        if (p1.upJust || p1.downJust) {
                            this.postMatchIndex = this.postMatchIndex === 0 ? 1 : 0;
                            this.inputCooldown = 10;
                            this.autoAdvanceMax = 10.0;
                            this.autoAdvanceTimer = 10.0;
                        } else if (confirmPressed || timeOut) {
                            this._transitioning = true;
                            if (this.postMatchIndex === 0) {
                                if (isOnlineHost) {
                                    net.send({ type: 'STATE_SWITCH', stateName: 'Combat', stateData: this.combatData });
                                }
                                this.game.stateManager.switchState('Combat', this.combatData);
                            } else {
                                if (isOnlineHost) {
                                    net.send({ type: 'STATE_SWITCH', stateName: 'Menu', stateData: null });
                                }
                                this.game.stateManager.switchState('Menu');
                            }
                        }
                    }
                } else {
                    if (p1.upJust) {
                        this.postMatchIndex = Math.max(0, this.postMatchIndex - 1);
                        this.inputCooldown = 10;
                        this.autoAdvanceMax = 10.0;
                        this.autoAdvanceTimer = 10.0;
                    } else if (p1.downJust) {
                        this.postMatchIndex = Math.min(2, this.postMatchIndex + 1);
                        this.inputCooldown = 10;
                        this.autoAdvanceMax = 10.0;
                        this.autoAdvanceTimer = 10.0;
                    } else if (confirmPressed || timeOut) {
                        this._transitioning = true;
                        if (this.postMatchIndex === 0) {
                            if (isOnlineHost) {
                                net.send({ type: 'STATE_SWITCH', stateName: 'Combat', stateData: this.combatData });
                            }
                            this.game.stateManager.switchState('Combat', this.combatData);
                        } else if (this.postMatchIndex === 1) {
                            const nextSt = this.onlineMode ? 'OnlineLobby' : 'CharSelect';
                            if (isOnlineHost) {
                                net.send({ type: 'STATE_SWITCH', stateName: nextSt, stateData: { step: 'room' } });
                            }
                            this.game.stateManager.switchState(nextSt, this.onlineMode ? { step: 'room' } : undefined);
                        } else {
                            if (isOnlineHost) {
                                net.send({ type: 'STATE_SWITCH', stateName: 'Menu', stateData: null });
                            }
                            this.game.stateManager.switchState('Menu');
                        }
                    }
                }
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // ─── VICTORY (Arcade complete) ───
        if (this.matchPhase === 'VICTORY') {
            if (this.inputCooldown <= 0 && !this._transitioning && (p1.lJust || p1.hJust || p1.sJust || p1.skipJust)) {
                this._transitioning = true;
                this.game.audioManager.stopFighterVoice?.();
                const bdayPayload = {
                    ...STORY_BIRTHDAY,
                    nextState: 'Menu',
                    nextData: null,
                };
                if (isOnlineHost) {
                    net.send({ type: 'STATE_SWITCH', stateName: 'Story', stateData: bdayPayload });
                }
                this.game.stateManager.switchState('Story', bdayPayload);
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // ─── MORTAL KOMBAT STYLE "FINISH HIM!" WINDOW ───
        if (this.matchPhase === 'FINISH_HIM') {
            this.finishHimTimer -= dt;
            this._updateTrailBars(dt);
            this.updateParticles(dt);
            this.stageObjects.update(dt);
            if (this.shakeTimer > 0) this.shakeTimer -= dt;

            const loser = this.winner === 'p1' ? this.p2 : this.p1;
            const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
            if (loser) {
                loser.state = 'DIZZY';
                loser.hp = 1;
                loser.vx = 0;
                loser.vy = 0;
                loser.y = loser.groundY;
                loser.isGrounded = true;
                loser.animTime = (loser.animTime || 0) + dt;
            }
            if (winnerFighter) {
                winnerFighter.animTime = (winnerFighter.animTime || 0) + dt;
                winnerFighter.state = 'IDLE';
            }

            // Wait 0.35s so the player sees the "FINISH HIM!" banner, then any attack/special button triggers the Widescreen Finisher Film-Sequence!
            const elapsedFinishWindow = 4.5 - this.finishHimTimer;
            const p1TriggeredFinisher = this.winner === 'p1' && elapsedFinishWindow >= 0.32 && (p1.sJust || p1.lJust || p1.hJust || p1.throwJust || p1.pointerJust);
            const aiTriggeredFinisher = this.winner === 'p2' && !this.onlineMode && elapsedFinishWindow >= 1.15;

            if (p1TriggeredFinisher || aiTriggeredFinisher) {
                this._startCinematicFinisher();
                if (isOnlineHost) this._broadcastHostSnapshot();
                return;
            }

            if (this.finishHimTimer <= 0) {
                // Time expired without triggering Finisher -> normal K.O. collapse
                if (loser) {
                    loser.hp = 0;
                    loser.state = 'KO';
                }
                if (!this._koAnnounced && loser) {
                    this._koAnnounced = true;
                    playCombatSound(this.game.audioManager, 'ko', loser.data.id, true, true);
                }
                this.matchPhase = 'KO_FREEZE';
                this.koFreezeTimer = 0;
                this._koKnockbackApplied = false;
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // ─── MORTAL KOMBAT WIDESCREEN CINEMATIC FINISHER ("FILM-SEQUENZ") ───
        if (this.matchPhase === 'CINEMATIC_FINISHER') {
            this.finisherTimer += dt;
            if (this.shakeTimer > 0) this.shakeTimer -= dt;

            const loser = this.winner === 'p1' ? this.p2 : this.p1;
            const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;

            if (this.finisherTimer >= 1.10 && !this._finisherImpactPlayed) {
                this._finisherImpactPlayed = true;
                this.triggerShake(8, 0.35);
                if (loser) {
                    playCombatSound(this.game.audioManager, 'hit', loser.data.id, true, true);
                }
            }
            if (this.finisherTimer >= 2.35 && !this._finisherBoomPlayed) {
                this._finisherBoomPlayed = true;
                this.triggerShake(12, 0.55);
                if (loser) {
                    this._koAnnounced = true;
                    playCombatSound(this.game.audioManager, 'ko', loser.data.id, true, true);
                }
            }
            if (this.finisherTimer >= 3.85) {
                if (loser) {
                    loser.hp = 0;
                    loser.state = 'KO';
                    if (loser === this.p2) this.p2TrailHP = 0;
                    else this.p1TrailHP = 0;
                }
                if (winnerFighter) {
                    winnerFighter.state = 'WIN';
                }
                this.matchPhase = 'KO_FREEZE';
                this.koFreezeTimer = 0;
                this._koKnockbackApplied = false;
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // ─── KO FREEZE (Slow-motion cinematic KO with flyback) ───
        if (this.matchPhase === 'KO_FREEZE') {
            this._updateTrailBars(dt);
            const slowDt = dt * 0.3;
            this.koFreezeTimer += dt;
            const loser = this.winner === 'p1' ? this.p2 : this.p1;

            if (!this._koKnockbackApplied) {
                this._koKnockbackApplied = true;
                loser.vx = loser.facing === 1 ? -350 : 350;
                loser.vy = -450;
                this.triggerShake(6, 1.0);
            }

            loser.vy += loser.gravity * slowDt;
            loser.y += loser.vy * slowDt;
            loser.x += loser.vx * slowDt;
            loser.vx *= 0.995;

            if (loser.x < 50) { loser.x = 50; loser.vx *= -0.3; }
            if (loser.x > this.game.width - 50) { loser.x = this.game.width - 50; loser.vx *= -0.3; }

            const floorY = this.game.height * 0.9;
            if (loser.y > floorY) { loser.y = floorY; loser.vy = 0; loser.vx *= 0.3; }

            if (this.koFreezeTimer >= 1.0 && this.shakeTimer > 0) {
                this.shakeTimer = 0;
                this.shakeIntensity = 0;
            }

            const koSpeechStillPlaying = Boolean(
                (this.game.audioManager.isFighterVoicePlaying?.() || this.game.audioManager.isAnnouncerPlaying?.()) &&
                this.koFreezeTimer < 6.2
            );

            if ((!koSpeechStillPlaying && this.koFreezeTimer >= 3.2) || (this.koFreezeTimer >= 0.85 && p1.skipJust)) {
                if (!this._roundWinAwarded) {
                    this._roundWinAwarded = true;
                    if (this.winner === 'p1') this.p1RoundWins = (this.p1RoundWins || 0) + 1;
                    else this.p2RoundWins = (this.p2RoundWins || 0) + 1;
                }
                const matchDecided = (this.p1RoundWins >= this.roundsToWin) || (this.p2RoundWins >= this.roundsToWin);
                if (!matchDecided) {
                    // Advance to Round 2 / Final Round!
                    this._startNextRound();
                    if (isOnlineHost) this._broadcastHostSnapshot();
                    return;
                }

                this.matchPhase = 'POST_MATCH';
                this.inputCooldown = 15;
                this.shakeTimer = 0;
                this.shakeIntensity = 0;
                const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
                if (winnerFighter.state !== 'KO') {
                    winnerFighter.state = 'WIN';
                }
                if (this.winner === 'p1' && this.ally && this.ally.state !== 'KO') {
                    this.ally.state = 'WIN';
                }
                // Authentic Street Fighter End-of-Match Audio Sequence:
                // 1. Announcer calls "PERFECT!" or "YOU WIN!" / "YOU LOSE!"
                // 2. Immediately after Announcer finishes -> Winning Fighter speaks their Victory Quote!
                setTimeout(() => {
                    if (this.matchPhase !== 'POST_MATCH') return;
                    const isPerf = winnerFighter.hp >= winnerFighter.maxHP;
                    const endClip = isPerf ? 'perfect' : (this.winner === 'p1' ? 'win' : 'lose');
                    playAnnouncer(this.game.audioManager, endClip, () => {
                        if (this.matchPhase === 'POST_MATCH') {
                            playFighterSound(this.game.audioManager, winnerFighter.data.id, 'win');
                        }
                    });
                }, 140);
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // ─── FIGHTING ───
        // Smoothly decay Camera Punch-Zoom & Arcade Callout banner
        if (this.cameraZoom > 1.001) {
            this.cameraZoom += (1.0 - this.cameraZoom) * Math.min(1, dt * 8.5);
        } else {
            this.cameraZoom = 1.0;
        }
        if (this.callout && this.callout.timer > 0) {
            this.callout.timer -= dt;
            if (this.callout.timer <= 0) this.callout = null;
        }

        // Smoothly drain Street Fighter Red Trailing Damage Bars (and snap to 0 immediately on KO!)
        this._updateTrailBars(dt);

        // ─── STREET FIGHTER SUPER COMBO FREEZE ───
        if (this.superFreezeTimer > 0) {
            this.superFreezeTimer -= dt;
            this.updateParticles(dt);
            if (this.shakeTimer > 0) this.shakeTimer -= dt;
            if (this.superFreezeTimer <= 0) {
                this.superFreezeTimer = 0;
                this.superFreezeFighter = null;
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        if (this.trainingMode) {
            this.timer = 99;
            this.p1.specialEnergy = 100;
            this.p2.hp = Math.max(15, this.p2.hp);
            if ((this.p2.state === 'IDLE' || this.p2.state === 'CROUCH') && this.p1ComboTimer <= 0 && this.p2.hp < this.p2.maxHP) {
                this.p2.hp = Math.min(this.p2.maxHP, this.p2.hp + 340 * dt);
            }
        } else {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                const teamP1HP = this.p1.hp + (this.ally ? this.ally.hp : 0);
                this.winner = (teamP1HP >= this.p2.hp) ? 'p1' : 'p2';
                this.matchPhase = 'KO_FREEZE';
                this.koFreezeTimer = 0;
                this._koKnockbackApplied = false;
                if (isOnlineHost) this._broadcastHostSnapshot();
                return;
            }
        }

        // Decay combo timers
        if (this.p1ComboTimer > 0) {
            this.p1ComboTimer -= dt;
            if (this.p1ComboTimer <= 0) this.p1ComboCount = 0;
        }
        if (this.p2ComboTimer > 0) {
            this.p2ComboTimer -= dt;
            if (this.p2ComboTimer <= 0) this.p2ComboCount = 0;
        }

        // Consume remote Guest input once per frame if connected
        const guestInput = (isOnlineHost && net.status === 'connected') ? net.consumeRemoteInput() : null;

        // --- P1 Input, Motion Command Moves & Special Move Processing ---
        const p1InputCopy = { ...p1, sJust: false, s: false, commandMove: null };
        const im = this.game.inputManager;
        const p1Dist = Math.abs(this.p1.x - this.p2.x);

        if (this.p1.state !== 'KO') {
            const hasDP = im.hasDP(this.p1.facing);
            const hasQCB = im.hasQCB(this.p1.facing);
            const hasQCF = im.hasQCF(this.p1.facing);
            const hasBF = im.hasBackForward(this.p1.facing);
            const hasDU = im.hasDownUp();
            const fwdDir = this.p1.facing === 1 ? 'right' : 'left';
            const backDir = this.p1.facing === 1 ? 'left' : 'right';
            const anyLiveDir = Boolean(p1.up || p1.down || p1.left || p1.right);
            const holdingFwd = Boolean(p1[fwdDir] || (!anyLiveDir && im.wasDirRecent(fwdDir, 150)));
            const holdingBack = Boolean(p1[backDir] || (!anyLiveDir && im.wasDirRecent(backDir, 150)));
            const holdingUp = Boolean(p1.up || (!anyLiveDir && im.wasDirRecent('up', 150)));
            const holdingDown = Boolean(p1.down || (!anyLiveDir && im.wasDirRecent('down', 150)));
            const canGroundedOrEarlyJump = this.p1.isGrounded || this.p1.state === 'DASH' || (this.p1.state === 'JUMP' && this.p1.stateTimer < 0.28);

            const p1GrabRange = (this.p1.data && this.p1.data.styleId === 'TITAN_GRAPPLER') ? 178 : 148;
            if ((p1.throwJust || (p1.lJust && (holdingBack || p1.dash))) && p1Dist <= p1GrabRange && this.p1.isGrounded && this.p2.isGrounded) {
                // ← + P (Back + Punch at close range), D + P, or P + K: Unblockable Street Fighter Throw!
                p1InputCopy.commandMove = 'THROW';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
            } else if ((p1.sJust && holdingBack && !holdingUp && !holdingDown) && this.p1.specialMoveCooldown <= 0) {
                // ← + S (Back + Special): Full-Screen 4-Hit Street Fighter Signature Rush Combo!
                p1InputCopy.commandMove = 'DRAGON_RUSH_COMBO';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if ((p1.sJust && holdingFwd && !holdingUp && !holdingDown) && this.p1.specialMoveCooldown <= 0) {
                // → + S (Forward + Special): Character-Specific Signature Flight!
                p1InputCopy.commandMove = 'FLYING_TORPEDO';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (((p1.lJust && holdingUp && canGroundedOrEarlyJump) || (p1.sJust && holdingUp && canGroundedOrEarlyJump) || (p1.hJust && holdingUp && canGroundedOrEarlyJump && this.p1.data?.styleId === 'SONIC_STRIKER') || ((p1.lJust || p1.hJust) && (hasDP || hasDU))) && this.p1.specialMoveCooldown <= 0) {
                // ↑ + P, ↑ + S, ↓ ↑ + K (Guile Somersault Flash Kick), or → ↓ ↘ + P: Rising Shoryuken Dragon Uppercut / Somersault Flash Kick!
                p1InputCopy.commandMove = 'DRAGON_UPPERCUT';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (((p1.hJust && (holdingBack || hasQCB) && canGroundedOrEarlyJump) || (p1.sJust && holdingDown)) && this.p1.specialMoveCooldown <= 0) {
                // ← + K, ↓ + S, or ↓ ↙ ← + K: Airborne Tatsumaki Hurricane Kick (3-hit cyclone)!
                p1InputCopy.commandMove = 'HURRICANE_KICK';
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if ((p1.specialRushJust || (p1.hJust && hasQCF)) && this.p1.specialMoveCooldown <= 0) {
                // P+S simultaneously or ↓ ↘ → + K: Full-Screen 4-Hit Rush Combo!
                p1InputCopy.commandMove = 'DRAGON_RUSH_COMBO';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (p1.lJust && hasBF && this.p1.data?.styleId === 'SONIC_STRIKER' && this.tryExecuteSpecial(this.p1, 'p1')) {
                // Guile Classic ← → + P: Fires SONIC MATRIX BOOM when energy is ready!
                im.clearMotionHistory();
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
            } else if (((p1.lJust || p1.hJust) && hasBF) && this.p1.specialMoveCooldown <= 0) {
                // ← → + P/K: Character-Specific Signature Flight!
                p1InputCopy.commandMove = 'FLYING_TORPEDO';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (p1.sJust || (p1.lJust && hasQCF)) {
                if (this.tryExecuteSpecial(this.p1, 'p1')) {
                    im.clearMotionHistory();
                    p1InputCopy.lJust = false;
                    p1InputCopy.hJust = false;
                } else if (this.p1.state === 'ATTACK' && this.p1.specialEnergy >= 100) {
                    // Keep sJust active so Fighter's 320ms Dial-A-Combo input buffer triggers the Super/Special cancel!
                    p1InputCopy.sJust = true;
                } else if (this.p1.specialMoveCooldown <= 0) {
                    // When Super Energy < 100%, pressing S or ↓↘→+P immediately executes the fighter's Signature Move instead of doing nothing!
                    p1InputCopy.commandMove = hasQCF ? 'DRAGON_UPPERCUT' : 'FLYING_TORPEDO';
                    p1InputCopy.lJust = false;
                    p1InputCopy.hJust = false;
                    if (p1.sJust) p1InputCopy.sJust = true; // Also buffer in case we're mid-combo!
                    im.clearMotionHistory();
                    playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
                }
            } else if (p1.hJust && holdingFwd && this.p1.isGrounded) {
                // → + K: Overhead Axe Kick (breaks crouching guard!)
                p1InputCopy.commandMove = 'AXE_KICK';
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
            } else if (p1.lJust && holdingFwd && this.p1.isGrounded && this.p1.comboChainStep === 0) {
                // → + P: Spinning Overhead Backfist / Command Punch!
                p1InputCopy.commandMove = 'COMMAND_PUNCH';
                p1InputCopy.lJust = false;
                im.clearMotionHistory();
            } else if (p1.hJust && holdingDown && !holdingFwd && this.p1.isGrounded) {
                // ↓ + K: Low Sweep (breaks standing guard & knocks down!)
                p1InputCopy.commandMove = 'SWEEP';
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
            } else if (p1.lJust && holdingDown && !holdingFwd && this.p1.isGrounded) {
                // ↓ + P: Fast Low Crouch Jab!
                p1InputCopy.commandMove = 'CROUCH_LIGHT';
                p1InputCopy.lJust = false;
                im.clearMotionHistory();
            }
        }

        // --- CO-OP ALLY (Player 2 in Co-Op Story) Input & Full Street Fighter Moveset Processing ---
        let allyInputCopy = null;
        if (this.coopMode && this.ally) {
            if (this.ally.state !== 'KO') {
                const rawAlly = guestInput || AIController.computeAllyInput(this, dt);
                allyInputCopy = this._processPlayerCombatInput(this.ally, this.p2, rawAlly, 'p1');
            } else {
                allyInputCopy = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };
            }
        }

        // --- P2 Input (Online 1v1 Guest, Training Dummy, OR AI Opponent) ---
        let p2Input = null;
        if (this.onlineMode === 'duel' && guestInput) {
            p2Input = this._processPlayerCombatInput(this.p2, this.p1, guestInput, 'p2');
        } else if (this.trainingMode && this.trainingDummyMode !== 'CPU') {
            const isCrouchDummy = this.trainingDummyMode === 'CROUCH';
            const isGuardDummy = this.trainingDummyMode === 'GUARD';
            const shouldCrouchGuard = isGuardDummy && (this.p1.state === 'CROUCH' || (this.p1.currentAttack && this.p1.currentAttack.isLow));
            p2Input = {
                up: false,
                down: Boolean(isCrouchDummy || shouldCrouchGuard),
                left: Boolean(isGuardDummy && this.p2.facing === 1),
                right: Boolean(isGuardDummy && this.p2.facing === -1),
                l: false, h: false, s: false,
                lJust: false, hJust: false, sJust: false
            };
        } else {
            p2Input = AIController.computeInput(this, dt);
            const dist = Math.abs(this.p1.x - this.p2.x);
            const diff = this.game.settings?.difficulty || 'NORMAL';
            const stageTier = (this.arcadeMode || this.storyMode || this.survivalMode) ? (this.arcadeIndex || 1) : 4;
            if ((p2Input.commandMove === 'DRAGON_UPPERCUT' || p2Input.commandMove === 'HURRICANE_KICK' || p2Input.commandMove === 'FLYING_TORPEDO' || p2Input.commandMove === 'DRAGON_RUSH_COMBO') && this.p2.specialMoveCooldown <= 0) {
                playCombatSound(this.game.audioManager, 'special', this.p2.data.id);
            } else if (diff !== 'EASY' && dist >= 270 && stageTier >= 5 && this.p2.specialMoveCooldown <= 0 && this.p2.isGrounded && (this.p2.state === 'IDLE' || this.p2.state === 'WALK') && Math.random() < 0.0045) {
                // On higher stages in Normal/Hard, AI occasionally uses its Signature Torpedo or Rush Combo at long range
                p2Input.commandMove = Math.random() < 0.55 ? 'FLYING_TORPEDO' : 'DRAGON_RUSH_COMBO';
                p2Input.sJust = false;
                playCombatSound(this.game.audioManager, 'special', this.p2.data.id);
            } else if (p2Input.sJust) {
                p2Input.sJust = false;
                this.tryExecuteSpecial(this.p2, 'p2');
            }
        }

        const p1WasDash = this.p1.state === 'DASH';
        const p2WasDash = this.p2.state === 'DASH';
        const allyWasDash = this.ally ? (this.ally.state === 'DASH') : false;
        const p1WasGrounded = this.p1.isGrounded;
        const p2WasGrounded = this.p2.isGrounded;

        p1InputCopy.opponentThreat = Boolean(
            (this.p2.state === 'ATTACK' && p1Dist <= 340) ||
            this.projectiles.some(pr => pr.owner === 'p2' && pr.alive)
        );
        if (this.ally && allyInputCopy) {
            allyInputCopy.opponentThreat = Boolean(
                (this.p2.state === 'ATTACK' && Math.abs(this.ally.x - this.p2.x) <= 340) ||
                this.projectiles.some(pr => pr.owner === 'p2' && pr.alive)
            );
        }
        p2Input.opponentThreat = Boolean(
            (this.p1.state === 'ATTACK' && p1Dist <= 340) ||
            (this.ally && this.ally.state === 'ATTACK' && Math.abs(this.ally.x - this.p2.x) <= 340) ||
            this.projectiles.some(pr => pr.owner === 'p1' && pr.alive)
        );

        this.p1.update(dt, p1InputCopy);
        if (this.ally && allyInputCopy) {
            this.ally.update(dt, allyInputCopy);
        }
        this.p2.update(dt, p2Input);

        // Spawn ground dust burst on new dash start, jump takeoff, or landing
        if ((!p1WasDash && this.p1.state === 'DASH') || (p1WasGrounded !== this.p1.isGrounded)) {
            this.spawnGroundDust(this.p1.x, this.p1.groundY, '#88ddff');
        }
        if (this.ally && !allyWasDash && this.ally.state === 'DASH') {
            this.spawnGroundDust(this.ally.x, this.ally.groundY, '#cc88ff');
        }
        if ((!p2WasDash && this.p2.state === 'DASH') || (p2WasGrounded !== this.p2.isGrounded)) {
            this.spawnGroundDust(this.p2.x, this.p2.groundY, '#ffaa44');
        }

        // Street Fighter Triangle Wall-Jump shockwave sparks & Fight Style signature callouts!
        for (const [f, side] of [[this.p1, 'p1'], [this.ally, 'p1'], [this.p2, 'p2']]) {
            if (f && f.justWallJumped) {
                const wallX = f.justWallJumped === 1 ? 148 : (this.game.width - 148);
                this.spawnSparks(wallX, f.y - 140, '#00ffcc', '#ffffff', 12, 'heavy');
                this.triggerCallout('WALL JUMP!', '#00ffcc', side);
                f.justWallJumped = 0;
            }
            if (f && f.pendingStyleCallout) {
                this.triggerCallout(f.pendingStyleCallout, f.styleInfo?.color || '#ffd700', side);
                f.pendingStyleCallout = null;
            }
        }

        // --- Boundaries & Pushbox Separation ---
        this.enforceBoundaries(this.p1);
        if (this.ally) this.enforceBoundaries(this.ally);
        this.enforceBoundaries(this.p2);

        this._separateFighters(this.p1, this.p2);
        if (this.ally) {
            this._separateFighters(this.ally, this.p2);
        }

        this.enforceBoundaries(this.p1);
        if (this.ally) this.enforceBoundaries(this.ally);
        this.enforceBoundaries(this.p2);

        // --- Combat & Projectile Collisions ---
        this.checkCombatCollisions();

        for (const proj of this.projectiles) {
            proj.update(dt);
            if (proj.hitGround) {
                proj.hitGround = false;
                this.spawnSparks(proj.x, proj.y, '#00eeff', '#ffffff', 12, 'heavy');
                this.spawnGroundDust(proj.x, this.p1.groundY, '#88eeff');
            }
        }
        this.checkProjectileCollisions();
        this.projectiles = this.projectiles.filter(p => p.alive && p.x > -50 && p.x < this.game.width + 50);

        // --- Particles & Stage Objects ---
        this.updateParticles(dt);
        this.stageObjects.update(dt);
        this.stageObjects.checkCollisions(this.p1, this.p2);
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        // --- Auto-Facing (Immediate flip on jump-over / cross-up & Co-Op wall protection) ---
        if (!this.game.settings || this.game.settings.autoFacingEnabled !== false) {
            const canTurn = (f) => {
                if (!f || f.state === 'KO') return false;
                if (f.state === 'DASH') return false;
                if (f.state === 'ATTACK' && f.currentAttack) {
                    const st = f.currentAttack.startup || 0.05;
                    const act = f.currentAttack.active || 0.15;
                    // Allow turning during very early startup OR once active frames end
                    return f.stateTimer < st * 0.5 || f.stateTimer >= st + act;
                }
                return true;
            };

            const distP1 = this.p1.x - this.p2.x;
            if (Math.abs(distP1) > 2 && canTurn(this.p1)) {
                this.p1.facing = (distP1 > 0) ? -1 : 1;
            }

            if (this.ally && canTurn(this.ally)) {
                const allyDist = this.ally.x - this.p2.x;
                if (Math.abs(allyDist) > 2) {
                    this.ally.facing = (allyDist > 0) ? -1 : 1;
                }
            }

            if (this.p2 && this.p2.state !== 'KO') {
                // Determine primary hero target for P2
                let targetHero = this.p1;
                if (this.ally && this.ally.state !== 'KO') {
                    if (this.p1.state === 'KO' || Math.abs(this.ally.x - this.p2.x) + 40 < Math.abs(this.p1.x - this.p2.x)) {
                        targetHero = this.ally;
                    }
                }
                const d2 = targetHero.x - this.p2.x;
                // If ALL alive heroes are on the same side of P2, P2 MUST face that side even mid-attack!
                const allLeft = (this.p1.state === 'KO' || this.p1.x < this.p2.x - 4) && (!this.ally || this.ally.state === 'KO' || this.ally.x < this.p2.x - 4);
                const allRight = (this.p1.state === 'KO' || this.p1.x > this.p2.x + 4) && (!this.ally || this.ally.state === 'KO' || this.ally.x > this.p2.x + 4);
                if (allLeft) {
                    this.p2.facing = -1;
                } else if (allRight) {
                    this.p2.facing = 1;
                } else if (Math.abs(d2) > 2 && canTurn(this.p2)) {
                    this.p2.facing = (d2 > 0) ? 1 : -1;
                }
            }
        }

        // --- Check K.O. / MORTAL KOMBAT "FINISH HIM!" PHASE ---
        const p2Defeated = this.p2.state === 'KO' || this.p2.hp <= 0;
        const teamP1Defeated = this.coopMode && this.ally
            ? ((this.p1.state === 'KO' || this.p1.hp <= 0) && (this.ally.state === 'KO' || this.ally.hp <= 0))
            : (this.p1.state === 'KO' || this.p1.hp <= 0);

        if (p2Defeated) {
            if (this.p1.hp <= 0) {
                this.p1.hp = 1;
                this.p1.state = 'IDLE';
            }
            const isMatchPointForP1 = ((this.p1RoundWins || 0) + 1 >= (this.roundsToWin || 2));
            if (isMatchPointForP1 && !this.finisherTriggered) {
                this._enterFinishHimPhase('p1');
            } else {
                this.p2.hp = 0;
                this.p2.state = 'KO';
                this.p2TrailHP = 0;
                this.winner = 'p1';
                this.matchPhase = 'KO_FREEZE';
                this.koFreezeTimer = 0;
                this._koKnockbackApplied = false;
            }
        } else if (teamP1Defeated) {
            const isMatchPointForP2 = ((this.p2RoundWins || 0) + 1 >= (this.roundsToWin || 2));
            if (isMatchPointForP2 && !this.finisherTriggered) {
                this._enterFinishHimPhase('p2');
            } else {
                this.p1.hp = 0;
                this.p1.state = 'KO';
                this.p1TrailHP = 0;
                this.winner = 'p2';
                this.matchPhase = 'KO_FREEZE';
                this.koFreezeTimer = 0;
                this._koKnockbackApplied = false;
            }
        }

        if (isOnlineHost) {
            this._netSyncTick++;
            if (this._netSyncTick % 2 === 0 || this.matchPhase !== 'FIGHTING') {
                this._broadcastHostSnapshot();
            }
        }
    }

    _startNextRound() {
        this.currentRound = (this.currentRound || 1) + 1;
        this._roundWinAwarded = false;
        this.winner = null;
        this.timer = this.trainingMode ? 99 : ((this.game.settings && this.game.settings.timer) || 99);
        this.koFreezeTimer = 0;
        this.finishHimTimer = 0;
        this.finisherTimer = 0;
        this.finisherTriggered = false;
        this._finisherImpactPlayed = false;
        this._finisherBoomPlayed = false;
        this._koAnnounced = false;
        this._perfectAnnounced = false;
        this._koKnockbackApplied = false;
        this.firstAttackAwarded = false;
        this.projectiles = [];
        this.particles = [];
        this.shockwaves = [];
        this.p1ComboCount = 0;
        this.p1ComboTimer = 0;
        this.p2ComboCount = 0;
        this.p2ComboTimer = 0;

        // Reset fighter positions & full HP for the new round (preserving carried-over Super Energy like Street Fighter Alpha / III!)
        const floorY = this.game.height * 0.9;
        const resetFighterForRound = (f, xPos, dir) => {
            if (!f) return;
            f.x = xPos;
            f.y = floorY;
            f.vx = 0;
            f.vy = 0;
            f.facing = dir;
            f.hp = f.maxHP;
            f.state = 'IDLE';
            f.stateTimer = 0;
            f.isGrounded = true;
            f.isKnockedDown = false;
            f.stunMeter = 0;
            f.midFightDizzyTimer = 0;
            f.hitStop = 0;
            f.blockStun = 0;
            f.hitImmunity = 0;
            f.activeHitbox = null;
            f.currentAttack = null;
            f.consecutiveHitsTaken = 0;
        };
        if (this.ally) {
            resetFighterForRound(this.p1, this.game.width * 0.28, 1);
            resetFighterForRound(this.ally, this.game.width * 0.16, 1);
            resetFighterForRound(this.p2, this.game.width * 0.76, -1);
            this.allyTrailHP = this.ally.maxHP;
        } else {
            resetFighterForRound(this.p1, this.game.width * 0.25, 1);
            resetFighterForRound(this.p2, this.game.width * 0.75, -1);
        }
        this.p1TrailHP = this.p1.maxHP;
        this.p2TrailHP = this.p2.maxHP;

        // Enter FIGHT_INTRO directly at ROUND_CALL ("ROUND 2!" / "FINAL ROUND!" -> "FIGHT!")
        this._clearIntroTimers();
        this.game.audioManager.stopFighterVoice?.();
        this.game.audioManager.stopAnnouncerVoice?.();
        this.matchPhase = 'FIGHT_INTRO';
        this.introTimer = 0;
        this.introSubPhase = 'STORY_DIALOGUE';
        this.introSubTimer = 0;
        this.storyBannerTimer = 0;
        this._startRoundCall(true);
    }

    _enterFinishHimPhase(winnerSide) {
        this.finisherTriggered = true;
        this.winner = winnerSide;
        this.matchPhase = 'FINISH_HIM';
        this.finishHimTimer = 4.5;

        const loser = winnerSide === 'p1' ? this.p2 : this.p1;
        const winnerFighter = winnerSide === 'p1' ? this.p1 : this.p2;

        if (loser) {
            loser.hp = 1;
            loser.state = 'DIZZY';
            loser.vx = 0;
            loser.vy = 0;
            loser.y = loser.groundY;
            loser.isGrounded = true;
            loser.activeHitbox = null;
            loser.currentAttack = null;
            loser.hitStop = 0;
            loser.blockStun = 0;
            if (loser === this.p2) this.p2TrailHP = 1;
            else this.p1TrailHP = 1;
        }
        if (winnerFighter) {
            winnerFighter.specialEnergy = 100;
            winnerFighter.state = 'IDLE';
            winnerFighter.vx = 0;
            winnerFighter.vy = 0;
            winnerFighter.y = winnerFighter.groundY;
            winnerFighter.isGrounded = true;
            winnerFighter.activeHitbox = null;
            winnerFighter.currentAttack = null;
        }
        for (const pr of this.projectiles) pr.alive = false;

        this.triggerCallout('⚡ FINISH HIM! ⚡', '#ff2200', winnerSide);
        this.triggerShake(5, 0.28);
    }

    _startCinematicFinisher() {
        this.matchPhase = 'CINEMATIC_FINISHER';
        this.finisherTimer = 0;
        this._finisherImpactPlayed = false;
        this._finisherBoomPlayed = false;
        this.p1ComboTimer = 0;
        this.p2ComboTimer = 0;

        const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
        if (winnerFighter) {
            const fMove = getFinisherMove(winnerFighter.data.id);
            this.triggerCallout(`🎬 ${fMove.title || fMove.name || 'MORTAL FINISHER'}!`, fMove.color1 || '#ffd700', this.winner);
            playCombatSound(this.game.audioManager, 'super', winnerFighter.data.id);
            this._emitNetEvent({ combatSound: { type: 'super', charId: winnerFighter.data.id }, shake: { i: 6, d: 0.4 } });
        }
        this.triggerShake(6, 0.4);
    }

    _separateFighters(fA, fB) {
        if (!fA || !fB || fA.state === 'KO' || fB.state === 'KO') return;
        // Street Fighter Body Pushbox & Blockbox Solver:
        // Active whenever vertical distance is within torso height (< 185px),
        // while high jumps (>= 185px above the opponent) cleanly cross over!
        if (Math.abs(fA.y - fB.y) >= 185) return;

        // Solid Blockbox expands pushbox to 144px so no fighter can walk, dash, or kick through a blocking opponent!
        const eitherBlocking = Boolean(
            fA.isActivelyGuarding || fA.blockStun > 0 ||
            fB.isActivelyGuarding || fB.blockStun > 0
        );
        const minDistance = eitherBlocking ? 144 : 128;
        const dx = fB.x - fA.x;
        const dist = Math.abs(dx);

        if (dist < minDistance) {
            const totalOverlap = minDistance - dist;
            // Deterministic direction even if landing directly on top of each other (dist < 4)
            const dir = dist >= 4 ? (dx >= 0 ? 1 : -1) : (fA.facing === 1 ? 1 : -1);
            const leftWall = 158;
            const rightWall = this.game.width - 158;

            // Corner-Aware Separation: If one fighter is pinned at the stage corner,
            // push the other fighter 100% of the overlap away from the wall so they NEVER get glued together!
            const aPinnedLeft = (dir === 1 && fA.x <= leftWall);
            const aPinnedRight = (dir === -1 && fA.x >= rightWall);
            const bPinnedRight = (dir === 1 && fB.x >= rightWall);
            const bPinnedLeft = (dir === -1 && fB.x <= leftWall);

            if (aPinnedLeft || aPinnedRight) {
                fB.x += dir * totalOverlap;
            } else if (bPinnedRight || bPinnedLeft) {
                fA.x -= dir * totalOverlap;
            } else {
                const half = totalOverlap * 0.5;
                fA.x -= dir * half;
                fB.x += dir * half;
            }
        }
    }

    _serializeFighter(f) {
        if (!f) return null;
        return {
            x: Math.round(f.x),
            y: Math.round(f.y),
            vx: Math.round(f.vx),
            vy: Math.round(f.vy),
            hp: f.hp,
            maxHP: f.maxHP,
            sp: Math.round(f.specialEnergy),
            state: f.state,
            stTimer: Number((f.stateTimer || 0).toFixed(3)),
            anTimer: Number((f.animTimer || 0).toFixed(3)),
            facing: f.facing,
            grounded: f.isGrounded,
            blocking: f.isBlocking,
            atkType: f.currentAttack ? f.currentAttack.type : null,
            atkSt: f.currentAttack ? Number((f.currentAttack.startup || 0.05).toFixed(3)) : 0.05,
            atkAct: f.currentAttack ? Number((f.currentAttack.active || 0.15).toFixed(3)) : 0.15,
            atkRec: f.currentAttack ? Number((f.currentAttack.recovery || 0.18).toFixed(3)) : 0.18
        };
    }

    _processPlayerCombatInput(fighter, opponent, rawInput, ownerTag) {
        const inputCopy = { ...rawInput, sJust: false, s: false };
        if (!fighter || fighter.state === 'KO') return inputCopy;

        const hasQCF = fighter.facing === 1 ? Boolean(rawInput.qcfRight) : Boolean(rawInput.qcfLeft);
        const hasQCB = fighter.facing === 1 ? Boolean(rawInput.qcfLeft) : Boolean(rawInput.qcfRight);
        const fwdDir = fighter.facing === 1 ? 'right' : 'left';
        const backDir = fighter.facing === 1 ? 'left' : 'right';
        const holdingFwd = Boolean(rawInput[fwdDir]);
        const holdingBack = Boolean(rawInput[backDir]);
        const holdingUp = Boolean(rawInput.up);
        const holdingDown = Boolean(rawInput.down);
        const canGroundedOrEarlyJump = fighter.isGrounded || fighter.state === 'DASH' || (fighter.state === 'JUMP' && fighter.stateTimer < 0.28);
        const dist = opponent ? Math.abs(fighter.x - opponent.x) : 300;
        const grabRange = (fighter.data && fighter.data.styleId === 'TITAN_GRAPPLER') ? 178 : 148;

        if ((rawInput.throwJust || (rawInput.lJust && (holdingBack || rawInput.dash))) && dist <= grabRange && fighter.isGrounded && (!opponent || opponent.isGrounded)) {
            inputCopy.commandMove = 'THROW';
            inputCopy.lJust = false;
            inputCopy.hJust = false;
        } else if ((rawInput.sJust && holdingBack && !holdingUp && !holdingDown) && fighter.specialMoveCooldown <= 0) {
            inputCopy.commandMove = 'DRAGON_RUSH_COMBO';
            inputCopy.lJust = false;
            inputCopy.hJust = false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        } else if ((rawInput.sJust && holdingFwd && !holdingUp && !holdingDown) && fighter.specialMoveCooldown <= 0) {
            inputCopy.commandMove = 'FLYING_TORPEDO';
            inputCopy.lJust = false;
            inputCopy.hJust = false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        } else if (((rawInput.lJust && holdingUp && canGroundedOrEarlyJump) || (rawInput.sJust && holdingUp && canGroundedOrEarlyJump) || (rawInput.hJust && holdingUp && canGroundedOrEarlyJump && fighter.data?.styleId === 'SONIC_STRIKER')) && fighter.specialMoveCooldown <= 0) {
            inputCopy.commandMove = 'DRAGON_UPPERCUT';
            inputCopy.lJust = false;
            inputCopy.hJust = false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        } else if (((rawInput.hJust && (holdingBack || hasQCB) && canGroundedOrEarlyJump) || (rawInput.sJust && holdingDown)) && fighter.specialMoveCooldown <= 0) {
            inputCopy.commandMove = 'HURRICANE_KICK';
            inputCopy.hJust = false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        } else if ((rawInput.specialRushJust || (rawInput.hJust && hasQCF)) && fighter.specialMoveCooldown <= 0) {
            inputCopy.commandMove = 'DRAGON_RUSH_COMBO';
            inputCopy.lJust = false;
            inputCopy.hJust = false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        } else if (rawInput.sJust || (rawInput.lJust && hasQCF)) {
            if (this.tryExecuteSpecial(fighter, ownerTag)) {
                inputCopy.lJust = false;
                inputCopy.hJust = false;
            } else if (fighter.state === 'ATTACK' && fighter.specialEnergy >= 100) {
                inputCopy.sJust = true;
            } else if (fighter.specialMoveCooldown <= 0) {
                inputCopy.commandMove = hasQCF ? 'DRAGON_UPPERCUT' : 'FLYING_TORPEDO';
                inputCopy.lJust = false;
                inputCopy.hJust = false;
                if (rawInput.sJust) inputCopy.sJust = true;
                playCombatSound(this.game.audioManager, 'special', fighter.data.id);
            }
        } else if (rawInput.hJust && holdingFwd && fighter.isGrounded) {
            inputCopy.commandMove = 'AXE_KICK';
            inputCopy.hJust = false;
        } else if (rawInput.lJust && holdingFwd && fighter.isGrounded && fighter.comboChainStep === 0) {
            inputCopy.commandMove = 'COMMAND_PUNCH';
            inputCopy.lJust = false;
        } else if (rawInput.hJust && holdingDown && !holdingFwd && fighter.isGrounded) {
            inputCopy.commandMove = 'SWEEP';
            inputCopy.hJust = false;
        } else if (rawInput.lJust && holdingDown && !holdingFwd && fighter.isGrounded) {
            inputCopy.commandMove = 'CROUCH_LIGHT';
            inputCopy.lJust = false;
        }
        return inputCopy;
    }

    _applyFighterSnapshot(f, snap) {
        if (!f || !snap) return;
        f.x += (snap.x - f.x) * 0.6;
        f.y += (snap.y - f.y) * 0.6;
        f.vx = snap.vx;
        f.vy = snap.vy;
        f.hp = snap.hp;
        f.maxHP = snap.maxHP;
        f.specialEnergy = snap.sp;
        f.state = snap.state;
        f.stateTimer = snap.stTimer;
        f.animTimer = snap.anTimer;
        f.facing = snap.facing;
        f.isGrounded = snap.grounded;
        f.isBlocking = snap.blocking;
        if (snap.atkType) {
            f.currentAttack = {
                type: snap.atkType,
                startup: snap.atkSt || 0.05,
                active: snap.atkAct || 0.15,
                recovery: snap.atkRec || 0.18
            };
        } else {
            f.currentAttack = null;
        }
    }

    _broadcastHostSnapshot() {
        const net = this.game.networkManager;
        if (!net || !net.active || net.role !== 'host') return;
        net.send({
            type: 'COMBAT_SNAPSHOT',
            matchPhase: this.matchPhase,
            timer: this.timer,
            introTimer: this.introTimer,
            koFreezeTimer: this.koFreezeTimer,
            winner: this.winner,
            postMatchIndex: this.postMatchIndex,
            autoAdvanceTimer: this.autoAdvanceTimer,
            p1ComboCount: this.p1ComboCount,
            p1ComboTimer: this.p1ComboTimer,
            p2ComboCount: this.p2ComboCount,
            p2ComboTimer: this.p2ComboTimer,
            p1: this._serializeFighter(this.p1),
            p2: this._serializeFighter(this.p2),
            ally: this._serializeFighter(this.ally),
            projectiles: this.projectiles.map(p => ({
                x: Math.round(p.x),
                y: Math.round(p.y),
                vy: Math.round(p.vy || 0),
                facing: p.facing,
                owner: p.owner,
                charId: p.charId || this.p1.data.id
            }))
        });
    }

    _updateAsGuest(dt) {
        this.updateParticles(dt);
        this.stageObjects.update(dt);
        if (this.shakeTimer > 0) this.shakeTimer -= dt;
        if (this.cameraZoom > 1.001) {
            this.cameraZoom += (1.0 - this.cameraZoom) * Math.min(1, dt * 8.5);
        } else {
            this.cameraZoom = 1.0;
        }
        if (this.callout && this.callout.timer > 0) {
            this.callout.timer -= dt;
            if (this.callout.timer <= 0) this.callout = null;
        }

        const net = this.game.networkManager;
        if (!net) return;

        while (net.pendingCombatEvents.length > 0) {
            const ev = net.pendingCombatEvents.shift();
            if (ev.sparks) {
                this.spawnSparks(ev.sparks.x, ev.sparks.y, ev.sparks.c1, ev.sparks.c2, ev.sparks.count, ev.sparks.kind || 'hit');
            }
            if (ev.shake) {
                this.triggerShake(ev.shake.i, ev.shake.d);
            }
            if (ev.combatSound) {
                playCombatSound(this.game.audioManager, ev.combatSound.type, ev.combatSound.charId);
            }
        }

        const snap = net.latestSnapshot;
        if (!snap) return;

        this.matchPhase = snap.matchPhase;
        this.timer = snap.timer;
        this.introTimer = snap.introTimer;
        this.koFreezeTimer = snap.koFreezeTimer;
        this.winner = snap.winner;
        this.postMatchIndex = snap.postMatchIndex;
        this.autoAdvanceTimer = snap.autoAdvanceTimer;
        this.p1ComboCount = snap.p1ComboCount;
        this.p1ComboTimer = snap.p1ComboTimer;
        this.p2ComboCount = snap.p2ComboCount;
        this.p2ComboTimer = snap.p2ComboTimer;

        this._applyFighterSnapshot(this.p1, snap.p1);
        this._applyFighterSnapshot(this.p2, snap.p2);
        if (this.ally && snap.ally) {
            this._applyFighterSnapshot(this.ally, snap.ally);
        }

        this._updateTrailBars(dt);

        if (Array.isArray(snap.projectiles)) {
            this.projectiles = snap.projectiles.map(sp => {
                const img = this.game.assetManager.images[`${sp.charId}_Cutin`];
                const pr = new Projectile(sp.x, sp.y, sp.facing, sp.owner, img, this.game);
                pr.charId = sp.charId;
                pr.vy = sp.vy || 0;
                return pr;
            });
        }
    }

    /**
     * Unified Special Attack execution for P1, Ally, and P2 (Grounded & Airborne Diagonal Projectiles + Dash Specials).
     * Properly consumes 100 Special Energy and supports Combo Canceling from connected attacks AND Jumping Air Casts!
     */
    tryExecuteSpecial(fighter, ownerKey) {
        const canCancelAttack = fighter.state === 'ATTACK' && (fighter.attackHasHit || !fighter.isGrounded) && !fighter.attackWasBlocked;
        if (fighter.state !== 'IDLE' && fighter.state !== 'WALK' && fighter.state !== 'CROUCH' && fighter.state !== 'DASH' && fighter.state !== 'JUMP' && !canCancelAttack) {
            return false;
        }
        const isAirCast = !fighter.isGrounded && (fighter.groundY - fighter.y > 35);
        const hasFullSuper = fighter.specialEnergy >= 100;

        // Authentic Street Fighter Projectile vs Super Arts System:
        // - With 100% Super Energy -> Unleashes SUPER ARTS (Super Freeze, `super` voice callout, high damage)!
        // - With < 100% Super Energy -> Unleashes standard Street Fighter Projectile (Hadoken / Sonic Boom, `special` voice callout, 0.52s cooldown, max 1 active on screen)!
        if (!hasFullSuper && fighter.specialMoveCooldown > 0) return false;
        if (this.projectiles.some(p => p.owner === ownerKey && p.charId === fighter.data.id && p.alive)) return false;

        const charId = fighter.data.id;
        const isSecondVariant = Boolean(fighter.data.special);

        // Authentic E. Honda / Döner-Spieß Torpedo Special Weapon for Ali Abi:
        // Pressing S launches Ali Abi himself horizontally across the screen like E. Honda's Flying Headbutt Torpedo!
        if (charId === 'AliAbi' || fighter.data.styleId === 'HONDA_SUMO_BRAWLER') {
            if (hasFullSuper && !isAirCast) {
                if (!fighter.executeAttack('SPECIAL_DASH')) return false;
                fighter.specialEnergy = 25; // Second-variant Super Meter refund
                const img = this.game.assetManager.images[`${charId}_Cutin`];
                if (img) {
                    const spitWave = new Projectile(fighter.x + fighter.facing * 75, fighter.y - 140, fighter.facing, ownerKey, img, this.game);
                    spitWave.charId = charId;
                    spitWave.speed = 1150;
                    spitWave.damage = 28;
                    this.projectiles.push(spitWave);
                }
                this.superFreezeTimer = 0.26;
                this.superFreezeFighter = fighter;
                this.cameraZoom = 1.045;
                this.cameraFocusX = fighter.x;
                this.cameraFocusY = fighter.y - 160;
                this.triggerCallout('🥙🔥 SUPER E. HONDA DÖNER-TORPEDO!', '#ffd700', ownerKey);
                this.spawnSparks(fighter.x + fighter.facing * 60, fighter.y - 140, '#ffd700', '#ff5500', 16, 'heavy');
                playCombatSound(this.game.audioManager, 'super', fighter.data.id);
                this.triggerShake(5, 0.5);
                this._emitNetEvent({ combatSound: { type: 'super', charId: fighter.data.id }, shake: { i: 5, d: 0.5 } });
                return true;
            } else {
                if (!fighter.executeAttack('FLYING_TORPEDO')) return false;
                fighter.specialEnergy = Math.min(fighter.maxSpecialEnergy, fighter.specialEnergy + 15);
                this.cameraZoom = 1.022;
                this.cameraFocusX = fighter.x;
                this.cameraFocusY = fighter.y - 150;
                this.triggerCallout('🚀 E. HONDA DÖNER-SPIESS TORPEDO!', '#ff9900', ownerKey);
                this.spawnSparks(fighter.x + fighter.facing * 50, fighter.y - 135, '#ffd700', '#ff6600', 12, 'heavy');
                playCombatSound(this.game.audioManager, 'special', fighter.data.id);
                this.triggerShake(3.0, 0.16);
                this._emitNetEvent({ combatSound: { type: 'special', charId: fighter.data.id }, shake: { i: 3.0, d: 0.16 } });
                return true;
            }
        }

        if (fighter.data.specialType === 'SPECIAL_DASH' && !isAirCast && hasFullSuper) {
            if (!fighter.executeAttack('SPECIAL_DASH')) return false;
            if (isSecondVariant) {
                fighter.specialEnergy = 25; // Second-variant meter refund!
            }
            // Shirtless Vikingo & Dark Vikingo ALSO launch a trailing Bifröst Thunder Wave during their dash!
            if (charId === 'Vikingo' || charId === 'DarkVikingo') {
                const img = this.game.assetManager.images[`${charId}_Cutin`];
                const bolt = new Projectile(fighter.x + fighter.facing * 70, fighter.y - 140, fighter.facing, ownerKey, img, this.game);
                bolt.charId = charId;
                bolt.speed = 920;
                bolt.damage = 28;
                this.projectiles.push(bolt);
            }
            this.superFreezeTimer = 0.26;
            this.superFreezeFighter = fighter;
            this.cameraZoom = 1.045;
            this.cameraFocusX = fighter.x;
            this.cameraFocusY = fighter.y - 160;
            this.triggerCallout(fighter.data.superName || fighter.data.specialName || 'SUPER ARTS!', '#ffd700', ownerKey);
            playCombatSound(this.game.audioManager, 'super', fighter.data.id);
            this.triggerShake(5, 0.5);
            this._emitNetEvent({ combatSound: { type: 'super', charId: fighter.data.id }, shake: { i: 5, d: 0.5 } });
            return true;
        }

        if (hasFullSuper) {
            if (!fighter.executeProjectileCast(true)) return false;
            if (isSecondVariant) {
                fighter.specialEnergy = charId === 'SupremeKeano' ? 35 : 25; // Evolved Second-Variant Super Meter Refund!
            }
        } else {
            // Standard Street Fighter Projectile (Hadoken / Sonic Boom / Air Fireball) without consuming Super Meter!
            if (!fighter.executeProjectileCast(false)) return false;
            fighter.specialEnergy = Math.min(fighter.maxSpecialEnergy, fighter.specialEnergy + 12);
        }

        if (hasFullSuper) {
            this.superFreezeTimer = isAirCast ? 0.14 : 0.24;
            this.superFreezeFighter = fighter;
            this.cameraZoom = 1.04;
            this.cameraFocusX = fighter.x;
            this.cameraFocusY = fighter.y - 155;
            this.triggerCallout(
                isAirCast ? `☄️ SUPER ${fighter.data.superName || fighter.data.specialName}!` : (fighter.data.superName || fighter.data.specialName || 'SUPER ARTS!'),
                '#ffd700',
                ownerKey
            );
        } else {
            this.cameraZoom = 1.015;
            this.cameraFocusX = fighter.x;
            this.cameraFocusY = fighter.y - 150;
            this.triggerCallout(
                isAirCast ? `☄️ AIR ${fighter.data.specialName || 'FIREBALL'}!` : `🔥 ${fighter.data.specialName || 'HADOKEN'}!`,
                fighter.styleInfo?.color || '#00e5ff',
                ownerKey
            );
        }

        const imgKey = `${charId}_Cutin`;
        const img = this.game.assetManager.images[imgKey];
        const pwrScale = (fighter.power || 100) / 100;

        // Primary Projectile (Diagonal Downward when jumping in the air!)
        const proj = new Projectile(
            fighter.x + fighter.facing * 80,
            fighter.y - (isAirCast ? 115 : 145),
            fighter.facing,
            ownerKey,
            img,
            this.game
        );
        proj.charId = charId;
        proj.damage = Math.round((hasFullSuper ? proj.damage : 22) * pwrScale);
        if (isAirCast) {
            proj.speed = isSecondVariant ? 960 : 880;
            proj.vy = isSecondVariant ? 590 : 530; // Diagonal downward 32-degree trajectory!
        } else if (isSecondVariant) {
            proj.speed = 1040; // Faster evolved projectile velocity!
        }
        this.projectiles.push(proj);

        // Evolved Second-Variant Twin / Barrage Projectile Mechanics! (Dom fires a single classic Guile Sonic Boom)
        if (hasFullSuper && (charId === 'Annikina' || charId === 'HyperEmely' || charId === 'CayleMinogue' || charId === 'HyperKeano' || charId === 'SupremeKeano' || charId === 'GargamelHoodie' || charId === 'JayX')) {
            if (charId === 'JayX' && !isAirCast) {
                // Jay X lunges forward with a phantom slash while firing his Void Wave!
                fighter.vx = fighter.facing * 680;
                fighter.hitImmunity = Math.max(fighter.hitImmunity, 0.24);
            }
            const twinProj = new Projectile(
                fighter.x + fighter.facing * 15,
                fighter.y - (isAirCast ? 155 : (charId === 'GargamelHoodie' ? 95 : (charId === 'CayleMinogue' || charId === 'Annikina' || charId === 'Dom' ? 110 : 175))),
                fighter.facing,
                ownerKey,
                img,
                this.game
            );
            twinProj.charId = charId;
            twinProj.speed = isAirCast ? 840 : 880;
            twinProj.vy = isAirCast ? 440 : (charId === 'Annikina' ? -55 : 0);
            twinProj.damage = Math.round(24 * pwrScale);
            this.projectiles.push(twinProj);
            this.spawnSparks(fighter.x + fighter.facing * 75, fighter.y - 145, charId === 'Dom' ? '#00ff66' : (charId === 'Annikina' ? '#ff6600' : (charId === 'HyperEmely' ? '#ff66cc' : '#00ffff')), '#ffffff', 14, 'heavy');
        }

        playCombatSound(this.game.audioManager, hasFullSuper ? 'super' : 'special', fighter.data.id);
        this.triggerShake(2.5, 0.10);
        this._emitNetEvent({ combatSound: { type: hasFullSuper ? 'super' : 'special', charId: fighter.data.id }, shake: { i: 2.5, d: 0.10 } });
        return true;
    }

    triggerCallout(text, color, side = 'p1') {
        this.callout = {
            text,
            color,
            side,
            timer: 1.15,
            maxTimer: 1.15
        };
    }

    _emitNetEvent(ev) {
        const net = this.game.networkManager;
        if (net && net.active && net.role === 'host' && this.onlineMode) {
            net.send({ type: 'COMBAT_EVENT', ...ev });
        }
    }

    checkCombatCollisions() {
        // 1. Street Fighter Throw Tech (Throw Escape):
        // If P1 and P2 both execute THROW within 0.16s at close range, or defender presses Throw/Punch+Kick during the first 120ms of an incoming Throw,
        // both fighters tech-break the grab with blue sparks and push apart cleanly!
        if (!this.ally && this.p1 && this.p2 && this.p1.state !== 'KO' && this.p2.state !== 'KO') {
            const p1Throwing = this.p1.state === 'ATTACK' && this.p1.currentAttack?.type === 'THROW' && this.p1.stateTimer <= 0.16;
            const p2Throwing = this.p2.state === 'ATTACK' && this.p2.currentAttack?.type === 'THROW' && this.p2.stateTimer <= 0.16;
            const p1TechInput = Boolean(this.game.inputManager?.p1?.throwJust || (this.game.inputManager?.p1?.lJust && this.game.inputManager?.p1?.hJust));
            if ((p1Throwing && p2Throwing) || (p2Throwing && p1TechInput && Math.abs(this.p1.x - this.p2.x) <= 185)) {
                this.p1.state = 'IDLE';
                this.p2.state = 'IDLE';
                this.p1.currentAttack = null;
                this.p2.currentAttack = null;
                this.p1.activeHitbox = null;
                this.p2.activeHitbox = null;
                this.p1.hitImmunity = 0.25;
                this.p2.hitImmunity = 0.25;
                const dir = this.p1.x <= this.p2.x ? -1 : 1;
                this.p1.vx = dir * 420;
                this.p2.vx = -dir * 420;
                const midX = (this.p1.x + this.p2.x) * 0.5;
                const midY = this.p1.y - 140;
                this.spawnSparks(midX, midY, '#00ffff', '#ffffff', 16, 'block');
                this.triggerCallout('⚡ THROW TECH!', '#00ffff', 'p1');
                this.game.audioManager?.playBlockSound?.();
                return;
            }
        }

        // 2. Snapshot both active hitboxes BEFORE resolving so simultaneous Street Fighter Trades (Double Hits) work fairly!
        const p1HitSnap = (!this.ally && this.p1?.activeHitbox && this.p1?.currentAttack)
            ? { box: this.p1.activeHitbox, atk: this.p1.currentAttack, x: this.p1.x, y: this.p1.y, facing: this.p1.facing }
            : null;
        const p2HitSnap = (!this.ally && this.p2?.activeHitbox && this.p2?.currentAttack)
            ? { box: this.p2.activeHitbox, atk: this.p2.currentAttack, x: this.p2.x, y: this.p2.y, facing: this.p2.facing }
            : null;
        const isSimultaneousTrade = Boolean(
            p1HitSnap && p2HitSnap &&
            Hitbox.checkCollision(p1HitSnap.box.getWorldRect(p1HitSnap.x, p1HitSnap.y, p1HitSnap.facing), this.p2.hurtbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing)) &&
            Hitbox.checkCollision(p2HitSnap.box.getWorldRect(p2HitSnap.x, p2HitSnap.y, p2HitSnap.facing), this.p1.hurtbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing))
        );

        this._resolveMeleeHit(this.p1, this.p2, 'p1');
        if (this.ally) {
            this._resolveMeleeHit(this.ally, this.p2, 'p1');
            this._resolveMeleeHit(this.p2, this.ally, 'p2');
        }
        if (isSimultaneousTrade && !this.p2.activeHitbox && p2HitSnap && this.p2.hp > 0 && this.p1.hp > 0) {
            // Restore P2's snapshot for this frame so both fighters trade hits simultaneously like in Street Fighter II!
            this.p2.activeHitbox = p2HitSnap.box;
            this.p2.currentAttack = p2HitSnap.atk;
        }
        this._resolveMeleeHit(this.p2, this.p1, 'p2');
    }

    _resolveMeleeHit(attacker, defender, attackerKey) {
        if (!attacker || !defender || !attacker.activeHitbox) return;
        if (attacker.state === 'KO' || attacker.hp <= 0 || defender.state === 'KO' || defender.hp <= 0) return;

        // Grounded reeling defenders cannot be infinite-jabbed by repeated Light punches,
        // but CAN be combo-linked into Heavy, Command Moves, Sweep, or Special attacks!
        const atkType = attacker.currentAttack ? attacker.currentAttack.type : '';
        const isRepeatableJab = (atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT') && attacker.isGrounded;
        if (defender.state === 'HIT' && defender.isGrounded && isRepeatableJab) return;

        const hitR = attacker.activeHitbox.getWorldRect(attacker.x, attacker.y, attacker.facing);
        const hurtR = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facing);

        if (!Hitbox.checkCollision(hitR, hurtR)) return;

        const wasDefenderAttacking = defender.state === 'ATTACK';
        const result = defender.takeDamage(attacker.currentAttack, attacker.facing);
        if (!result || result === 'IMMUNE') return;

        if (result === 'BLOCKED') {
            attacker.attackWasBlocked = true;
            attacker.attackHasHit = true;
            // Street Fighter Guard Bounce: Blocked Flying Torpedo / Rush / Hurricane Kick bounces off guard immediately!
            if (atkType === 'FLYING_TORPEDO' || atkType === 'DRAGON_RUSH_COMBO' || atkType === 'HURRICANE_KICK' || atkType === 'SPECIAL_DASH') {
                attacker.activeHitbox = null;
                attacker.vx = -attacker.facing * 260;
                if (!attacker.isGrounded) {
                    attacker.vy = -240;
                }
            }
        } else {
            // Multi-hit support (e.g. HURRICANE_KICK hits up to 3-4 times, LIGHT_DRAGON DRAGON_UPPERCUT hits 2 times!)
            const maxHits = attacker.currentAttack.maxHits || 1;
            attacker.attackHitCount = (attacker.attackHitCount || 0) + 1;
            if (attacker.attackHitCount < maxHits && !defender.isKnockedDown) {
                attacker.multiHitCooldown = 0.11;
                defender.hitImmunity = Math.max(defender.hitImmunity || 0, 0.08);
            } else {
                attacker.attackHasHit = true;
            }
        }

        attacker.hitStop = result === 'BLOCKED'
            ? Math.max(0.05, (attacker.currentAttack.hitstop || 0.06) * 0.75)
            : attacker.currentAttack.hitstop;
        attacker.activeHitbox = null;

        // Street Fighter Guard Pushback & Corner Recoil:
        // Blocked grounded attacks push the attacker back so button-mashing into a guard leaves the masher minus and out of range!
        if (result === 'BLOCKED' && attacker.isGrounded) {
            const pb = attacker.currentAttack.pushback || 210;
            attacker.vx = -attacker.facing * Math.max(195, pb * 0.68);
        } else if (defender.isGrounded && (defender.x <= 175 || defender.x >= this.game.width - 175)) {
            const pb = attacker.currentAttack.pushback || 220;
            attacker.vx = -attacker.facing * pb * 0.68;
        }

        // Award Special Energy (LIGHT_DRAGON gets +30% Solar Meter bonus!)
        const attackerStyle = (attacker.data && attacker.data.styleId) || 'LIGHT_DRAGON';
        const gain = result === 'BLOCKED' ? 6 : 16;
        const styleGainMul = attackerStyle === 'LIGHT_DRAGON' ? 1.30 : 1.0;
        const regenMul = (attacker.data.id === 'SupremeKeano' ? 2.0 : 1.0) * styleGainMul;
        attacker.specialEnergy = Math.min(attacker.maxSpecialEnergy, attacker.specialEnergy + gain * regenMul);
        defender.specialEnergy = Math.min(defender.maxSpecialEnergy, defender.specialEnergy + 10);

        const impactX = (attacker.x + defender.x) / 2;
        const impactY = defender.y - (atkType === 'SWEEP' || atkType === 'CROUCH_LIGHT' ? 60 : 150);
        if (result === 'BLOCKED') {
            const defenderSide = attackerKey === 'p1' ? 'p2' : 'p1';
            if (!this.callout || this.callout.timer < 0.65) {
                this.triggerCallout('GUARD!', '#00eeff', defenderSide);
            }
            this.spawnSparks(impactX, impactY, '#00eeff', '#ffffff', 14, 'block');
            playCombatSound(this.game.audioManager, 'block', defender.data.id);
            this._emitNetEvent({
                sparks: { x: impactX, y: impactY, c1: '#00eeff', c2: '#ffffff', count: 14, kind: 'block' },
                combatSound: { type: 'block', charId: defender.data.id }
            });
            if (defender.hp <= 0) {
                defender.hp = 0;
                defender.state = 'KO';
                defender.activeHitbox = null;
                if (defender === this.p2) {
                    this.p2TrailHP = 0;
                    for (const pr of this.projectiles) if (pr.owner === 'p2') pr.alive = false;
                } else if (defender === this.p1) {
                    this.p1TrailHP = 0;
                }
                const isFinalKO = defender === this.p2 || (!this.ally || (this.p1.hp <= 0 && this.ally.hp <= 0));
                if (!this._koAnnounced && (!isFinalKO || this.finisherTriggered)) {
                    if (isFinalKO) this._koAnnounced = true;
                    playCombatSound(this.game.audioManager, 'ko', defender.data.id, true, true);
                    this._emitNetEvent({ combatSound: { type: 'ko', charId: defender.data.id } });
                }
            }
        } else {
            // Street Fighter Arcade Callouts: FIRST ATTACK!, COUNTER HIT!, THROW SLAM!, Story Special Name!
            if (!this.firstAttackAwarded) {
                this.firstAttackAwarded = true;
                this.triggerCallout('FIRST ATTACK!', '#00ffcc', attackerKey);
            } else if (atkType === 'THROW') {
                this.triggerCallout('THROW SLAM!', '#00ffcc', attackerKey);
            } else if (atkType === 'DRAGON_UPPERCUT' || atkType === 'HURRICANE_KICK' || atkType === 'FLYING_TORPEDO' || atkType === 'DRAGON_RUSH_COMBO' || atkType === 'COMBO_FINISHER') {
                this.triggerCallout(attacker.data.specialName || 'SPECIAL STRIKE!', '#00e5ff', attackerKey);
                if (attacker.attackHitCount === 1) {
                    playCombatSound(this.game.audioManager, 'special', attacker.data.id);
                }
            } else if (wasDefenderAttacking) {
                const counterRatio = attackerStyle === 'MASTER_STRIKER' ? 0.28 : 0.20;
                const bonusDmg = Math.max(3, Math.round((attacker.currentAttack.damage || 10) * counterRatio));
                defender.hp = Math.max(0, defender.hp - bonusDmg);
                if (defender.hp <= 0) defender.state = 'KO';
                attacker.hitStop += 0.035;
                defender.hitStop += 0.035;
                this.triggerCallout(attackerStyle === 'MASTER_STRIKER' ? '⚔️ MASTER COUNTER!' : 'COUNTER HIT!', '#ffdd00', attackerKey);
            }

            // Valhalla Berserker Ground Shockwave on heavy finishers!
            if (attackerStyle === 'VALHALLA_BERSERKER' && (atkType === 'AXE_KICK' || atkType === 'COMBO_FINISHER' || atkType === 'HEAVY')) {
                this.spawnGroundDust(defender.x, defender.groundY, '#ff6622');
            }

            // Increment Combo Counter!
            if (attackerKey === 'p1') {
                this.p1ComboCount = (this.p1ComboTimer > 0) ? this.p1ComboCount + 1 : 1;
                this.p1ComboTimer = 1.45;
            } else {
                this.p2ComboCount = (this.p2ComboTimer > 0) ? this.p2ComboCount + 1 : 1;
                this.p2ComboTimer = 1.45;
            }

            const isSpecialHit = Boolean(attacker.currentAttack.isSpecialMove || atkType === 'DRAGON_UPPERCUT' || atkType === 'HURRICANE_KICK' || atkType === 'FLYING_TORPEDO' || atkType === 'DRAGON_RUSH_COMBO' || atkType === 'SPECIAL' || atkType === 'SPECIAL_DASH' || atkType === 'COMBO_FINISHER');
            const isHeavyHit = (attacker.currentAttack.damage >= 26) || wasDefenderAttacking || isSpecialHit || atkType === 'AXE_KICK' || atkType === 'COMMAND_PUNCH';
            const sparkKind = isHeavyHit ? 'heavy' : 'hit';
            this.spawnSparks(impactX, impactY, '#ffaa00', '#ff3300', isHeavyHit ? 14 : 10, sparkKind);
            if (atkType === 'SWEEP' || atkType === 'THROW') {
                this.spawnGroundDust(defender.x, defender.groundY, '#ffcc66');
            }
            if (isHeavyHit) {
                this.cameraZoom = 1.042;
                this.cameraFocusX = impactX;
                this.cameraFocusY = impactY;
                this.triggerShake(isSpecialHit ? 4.5 : 3.5, 0.14);
            }
            if (atkType === 'THROW') {
                playCombatSound(this.game.audioManager, 'throw', defender.data.id, true, true);
            } else {
                playCombatSound(this.game.audioManager, 'hit', defender.data.id, isHeavyHit, isSpecialHit);
            }
            this._emitNetEvent({
                sparks: { x: impactX, y: impactY, c1: '#ffaa00', c2: '#ff3300', count: isHeavyHit ? 14 : 10, kind: sparkKind },
                combatSound: { type: atkType === 'THROW' ? 'throw' : 'hit', charId: defender.data.id },
                shake: isHeavyHit ? { i: 3.5, d: 0.14 } : null
            });
            if (defender.hp <= 0) {
                defender.hp = 0;
                defender.state = 'KO';
                defender.activeHitbox = null;
                if (defender === this.p2) {
                    this.p2TrailHP = 0;
                    for (const pr of this.projectiles) if (pr.owner === 'p2') pr.alive = false;
                } else if (defender === this.p1) {
                    this.p1TrailHP = 0;
                }
                const isFinalKO = defender === this.p2 || (!this.ally || (this.p1.hp <= 0 && this.ally.hp <= 0));
                if (!this._koAnnounced && (!isFinalKO || this.finisherTriggered)) {
                    if (isFinalKO) this._koAnnounced = true;
                    playCombatSound(this.game.audioManager, 'ko', defender.data.id, true, true);
                    this._emitNetEvent({ combatSound: { type: 'ko', charId: defender.data.id } });
                }
            }
        }
    }

    checkProjectileCollisions() {
        // 1. Street Fighter Projectile-vs-Projectile Mid-Air Clash!
        for (let i = 0; i < this.projectiles.length; i++) {
            const pA = this.projectiles[i];
            if (!pA || !pA.alive) continue;
            for (let j = i + 1; j < this.projectiles.length; j++) {
                const pB = this.projectiles[j];
                if (!pB || !pB.alive || pA.owner === pB.owner) continue;
                if (Math.abs(pA.x - pB.x) < 110 && Math.abs(pA.y - pB.y) < 95) {
                    pA.alive = false;
                    pB.alive = false;
                    const midX = (pA.x + pB.x) * 0.5;
                    const midY = (pA.y + pB.y) * 0.5;
                    this.spawnSparks(midX, midY, '#ffd700', '#00ffff', 18, 'heavy');
                    this.triggerCallout('⚡ PROJECTILE CLASH!', '#ffd700', 'p1');
                    this.triggerShake(3.5, 0.14);
                    this.game.audioManager?.playHitImpactSound?.(true, true);
                    break;
                }
            }
        }

        for (const proj of this.projectiles) {
            if (!proj.alive) continue;
            if (proj.owner === 'p2' && (this.p2.state === 'KO' || this.p2.hp <= 0)) {
                proj.alive = false;
                continue;
            }
            const pRect = proj.getHitRect();
            const targets = proj.owner === 'p1'
                ? [this.p2]
                : (this.ally ? [this.p1, this.ally] : [this.p1]);

            for (const defender of targets) {
                if (!defender || defender.state === 'KO' || defender.hp <= 0) continue;

                const hurtR = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facing);
                if (Hitbox.checkCollision(pRect, hurtR)) {
                    // Zangief Double Lariat / Bison Psycho Crusher deflects & destroys incoming projectiles during FLYING_TORPEDO!
                    const defArch = defender._getSignatureArchetype?.();
                    if (defender.state === 'ATTACK' && defender.currentAttack && defender.currentAttack.type === 'FLYING_TORPEDO' && (defArch === 'ZANGIEF_LARIAT' || defArch === 'BISON_PSYCHO_CRUSHER')) {
                        proj.alive = false;
                        const defenderSide = proj.owner === 'p1' ? 'p2' : 'p1';
                        this.spawnSparks(proj.x, proj.y, '#ffd700', '#00ffff', 16, 'heavy');
                        this.triggerCallout('🌪️ LARIAT DEFLECT!', '#ffd700', defenderSide);
                        this.game.audioManager?.playHitImpactSound?.(true, true);
                        break;
                    }
                    const result = defender.takeDamage(proj.getAttackDef(), proj.facing);
                    if (!result || result === 'IMMUNE') continue;

                    proj.alive = false;
                    if (result === 'BLOCKED') {
                        const defenderSide = proj.owner === 'p1' ? 'p2' : 'p1';
                        if (!this.callout || this.callout.timer < 0.65) {
                            this.triggerCallout('GUARD!', '#00eeff', defenderSide);
                        }
                        this.spawnSparks(proj.x, proj.y, '#00eeff', '#ffffff', 14, 'block');
                        playCombatSound(this.game.audioManager, 'block', defender.data.id);
                        this._emitNetEvent({
                            sparks: { x: proj.x, y: proj.y, c1: '#00eeff', c2: '#ffffff', count: 14, kind: 'block' },
                            combatSound: { type: 'block', charId: defender.data.id }
                        });
                    } else {
                        if (!this.firstAttackAwarded) {
                            this.firstAttackAwarded = true;
                            this.triggerCallout('FIRST ATTACK!', '#00ffcc', proj.owner);
                        }
                        if (proj.owner === 'p1') {
                            this.p1ComboCount = (this.p1ComboTimer > 0) ? this.p1ComboCount + 1 : 1;
                            this.p1ComboTimer = 1.45;
                        } else {
                            this.p2ComboCount = (this.p2ComboTimer > 0) ? this.p2ComboCount + 1 : 1;
                            this.p2ComboTimer = 1.45;
                        }
                        const hitColor = proj.owner === 'p1' ? '#ffaa00' : '#ff4400';
                        this.spawnSparks(proj.x, proj.y, hitColor, '#ffffff', 12, 'heavy');
                        this.cameraZoom = 1.038;
                        this.cameraFocusX = proj.x;
                        this.cameraFocusY = proj.y;
                        playCombatSound(this.game.audioManager, 'hit', defender.data.id, true, true);
                        this.triggerShake(3, 0.12);
                        this._emitNetEvent({
                            sparks: { x: proj.x, y: proj.y, c1: hitColor, c2: '#ffffff', count: 12, kind: 'heavy' },
                            combatSound: { type: 'hit', charId: defender.data.id },
                            shake: { i: 3, d: 0.12 }
                        });
                    }
                    if (defender.hp <= 0) {
                        defender.hp = 0;
                        defender.state = 'KO';
                        defender.activeHitbox = null;
                        if (defender === this.p2) {
                            this.p2TrailHP = 0;
                            for (const pr of this.projectiles) if (pr.owner === 'p2') pr.alive = false;
                        } else if (defender === this.p1) {
                            this.p1TrailHP = 0;
                        }
                        const isFinalKO = defender === this.p2 || (!this.ally || (this.p1.hp <= 0 && this.ally.hp <= 0));
                        if (!this._koAnnounced && (!isFinalKO || this.finisherTriggered)) {
                            if (isFinalKO) this._koAnnounced = true;
                            playCombatSound(this.game.audioManager, 'ko', defender.data.id, true, true);
                            this._emitNetEvent({ combatSound: { type: 'ko', charId: defender.data.id } });
                        }
                    }
                    break;
                }
            }
        }
    }

    triggerShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    spawnGroundDust(x, y, color = '#ffffff') {
        this.shockwaves.push({
            x,
            y: y - 4,
            color1: color,
            color2: '#ffffff',
            radius: 12,
            maxRadius: 68,
            life: 0.24,
            maxLife: 0.24,
            kind: 'dust',
            angle: 0
        });
    }

    spawnSparks(x, y, color1, color2, count, kind = 'hit') {
        // Multi-ring Street Fighter impact starburst + shockwave ring
        this.shockwaves.push({
            x,
            y,
            color1,
            color2,
            radius: 8,
            maxRadius: kind === 'heavy' ? 115 : (kind === 'block' ? 78 : 85),
            life: kind === 'heavy' ? 0.24 : 0.18,
            maxLife: kind === 'heavy' ? 0.24 : 0.18,
            kind,
            angle: Math.random() * Math.PI
        });

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 900,
                vy: (Math.random() - 0.5) * 700 - 200,
                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.4,
                size: 3 + Math.random() * 5,
                color: Math.random() > 0.5 ? color1 : color2,
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 1500 * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.life -= dt;
            const prog = 1 - Math.max(0, sw.life / sw.maxLife);
            sw.radius = 8 + (sw.maxRadius - 8) * Math.pow(prog, 0.55);
            if (sw.life <= 0) this.shockwaves.splice(i, 1);
        }
    }

    advanceArcadeLadder() {
        const nextIdx = this.arcadeIndex + 1;
        const net = this.game.networkManager;
        const isOnlineHost = Boolean(net && net.active && net.role === 'host' && this.onlineMode);
        const totalStages = this.arcadeLadder ? this.arcadeLadder.length : (ROSTER.length - 1);

        if (this.survivalMode) {
            const wins = this.arcadeWins + 1;
            try {
                const best = Math.max(Number(localStorage.getItem('lotl_survival_best') || 0), wins);
                localStorage.setItem('lotl_survival_best', String(best));
            } catch (e) { }
            const wrappedIdx = ((nextIdx - 1) % Math.max(1, totalStages)) + 1;
            this._transitioning = true;
            this.startArcadeFight(wrappedIdx, wins);
            return;
        }

        // Story Mode Midpoint Check (Active for Story Mode at Fight 7!)
        if (nextIdx === 7 && this.storyMode) {
            this._transitioning = true;
            const nextOpponent = (this.arcadeLadder && this.arcadeLadder[6]) ? this.arcadeLadder[6] : ROSTER[7];
            preloadFighterSprites(this.game.assetManager, nextOpponent);
            preloadStageAssets(this.game.assetManager, nextOpponent.stageId);
            const reflexionPayload = {
                ...STORY_REFLEXION,
                nextState: 'VersusIntro',
                nextData: {
                    p1: this.p1.data,
                    ally: this.combatData ? this.combatData.ally : null,
                    p2: { ...nextOpponent, rosterIndex: 7 },
                    stageId: nextOpponent.stageId,
                    arcadeMode: true,
                    storyMode: true,
                    arcadeLadder: this.arcadeLadder,
                    coopMode: this.coopMode,
                    onlineMode: this.onlineMode,
                    arcadeIndex: 7,
                    arcadeWins: this.arcadeWins + 1,
                }
            };
            if (isOnlineHost) {
                net.send({ type: 'STATE_SWITCH', stateName: 'Story', stateData: reflexionPayload });
            }
            this.game.stateManager.switchState('Story', reflexionPayload);
            return;
        }

        if (nextIdx > totalStages) {
            // Beat the game!
            try { localStorage.setItem('lotl_story_complete', 'true'); } catch (e) { }

            const newlyUnlocked = unlockFighter(this.p1.data.id);
            const allyUnlocked = (this.coopMode && this.ally) ? unlockFighter(this.ally.data.id) : null;
            if (newlyUnlocked) {
                console.log(`%c[UNLOCK] You unlocked ${newlyUnlocked.name}!`, 'color: #00ff00; font-size: 16px; font-weight: bold;');
            }
            if (allyUnlocked) {
                console.log(`%c[CO-OP UNLOCK] Partner unlocked ${allyUnlocked.name}!`, 'color: #bb66ff; font-size: 16px; font-weight: bold;');
            }

            if (isOnlineHost) {
                net.send({
                    type: 'UNLOCK_FIGHTERS',
                    fighterIds: [this.p1.data.id, this.ally ? this.ally.data.id : null].filter(Boolean)
                });
            }

            if (this.storyMode) {
                this._transitioning = true;
                const epiloguePayload = {
                    ...STORY_EPILOGUE,
                    unlockedFighter: newlyUnlocked || allyUnlocked,
                    allyUnlockedFighter: (newlyUnlocked && allyUnlocked) ? allyUnlocked : null,
                    nextState: 'Story',
                    nextData: {
                        ...STORY_OUTRO,
                        nextState: 'Story',
                        nextData: {
                            ...STORY_BIRTHDAY,
                            nextState: 'Menu',
                            nextData: null,
                        },
                    },
                };
                if (isOnlineHost) {
                    net.send({ type: 'STATE_SWITCH', stateName: 'Story', stateData: epiloguePayload });
                }
                this.game.stateManager.switchState('Story', epiloguePayload);
            } else {
                this._newlyUnlocked = newlyUnlocked || allyUnlocked;
                this.matchPhase = 'VICTORY';
                this.inputCooldown = 60;
                this.game.audioManager.stopBGM();
                if (isOnlineHost) this._broadcastHostSnapshot();
            }
            return;
        }

        this._transitioning = true;
        this.startArcadeFight(nextIdx, this.arcadeWins + 1);
    }

    startArcadeFight(nextIdx, wins) {
        const player1 = this.combatData ? this.combatData.p1 : ROSTER[0];
        const allyChar = this.combatData ? this.combatData.ally : null;
        const opponent = (this.arcadeLadder && this.arcadeLadder[nextIdx - 1])
            ? this.arcadeLadder[nextIdx - 1]
            : ROSTER[nextIdx];
        const stageId = opponent.stageId || 'Japan';

        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);
        this.game.assetManager.loadAll();

        const healedHP = this.survivalMode
            ? Math.min(this.p1.maxHP, Math.max(1, this.p1.hp) + Math.round(this.p1.maxHP * 0.30))
            : undefined;

        const nextCombatData = {
            p1: player1,
            ally: allyChar,
            p2: { ...opponent, rosterIndex: nextIdx },
            stageId: stageId,
            arcadeMode: true,
            storyMode: this.storyMode,
            survivalMode: this.survivalMode,
            survivalHP: healedHP,
            arcadeLadder: this.arcadeLadder,
            coopMode: this.coopMode,
            onlineMode: this.onlineMode,
            arcadeIndex: nextIdx,
            arcadeWins: wins,
        };

        const net = this.game.networkManager;
        if (net && net.active && net.role === 'host' && this.onlineMode) {
            net.send({
                type: 'STATE_SWITCH',
                stateName: 'VersusIntro',
                stateData: nextCombatData
            });
        }

        this.game.stateManager.switchState('VersusIntro', nextCombatData);
    }

    enforceBoundaries(f) {
        if (f.x < 150) f.x = 150;
        if (f.x > this.game.width - 150) f.x = this.game.width - 150;
    }

    draw(ctx) {
        ctx.save();

        // Street Fighter Camera Punch-Zoom
        if (this.cameraZoom > 1.001) {
            const zx = this.cameraFocusX || (this.game.width / 2);
            const zy = this.cameraFocusY || (this.game.height * 0.65);
            ctx.translate(zx, zy);
            ctx.scale(this.cameraZoom, this.cameraZoom);
            ctx.translate(-zx, -zy);
        }

        // Screen Shake offset
        if (this.shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
            const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
            ctx.translate(sx, sy);
        }

        // 1. Stage Background
        const stageKey = `Stage_${this.stageId}`;
        const bg = this.game.assetManager.images[stageKey] || this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#0a0011';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        // 1a. Dynamic Street Fighter Animated Stage Atmosphere (Grill Embers, Cherry Blossoms, Frost, Neon Sparks)
        this._drawStageAtmosphere(ctx);

        // 1b. Street Fighter Alpha K.O. Sunburst Background Flash (during first 1.25s of KO_FREEZE)
        if (this.matchPhase === 'KO_FREEZE' && this.koFreezeTimer < 1.25) {
            ctx.save();
            const koAlpha = Math.max(0, 1 - (this.koFreezeTimer / 1.25)) * 0.72;
            ctx.globalAlpha = koAlpha;
            const cx = this.game.width / 2;
            const cy = this.game.height * 0.55;
            const numRays = 20;
            const rot = this.koFreezeTimer * 2.5;
            for (let i = 0; i < numRays; i++) {
                const a1 = rot + (i * Math.PI * 2) / numRays;
                const a2 = a1 + (Math.PI / numRays) * 0.85;
                ctx.fillStyle = i % 2 === 0 ? '#ff2200' : '#ffbb00';
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a1) * 1800, cy + Math.sin(a1) * 1800);
                ctx.lineTo(cx + Math.cos(a2) * 1800, cy + Math.sin(a2) * 1800);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        // 2. Destructible Stage Objects
        this.stageObjects.draw(ctx);

        // 2b. Street Fighter Super Combo Screen Darkening & Sonic Aura Ring
        if (this.superFreezeTimer > 0 && this.superFreezeFighter) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 6, 24, 0.72)';
            ctx.fillRect(0, 0, this.game.width, this.game.height);

            const sf = this.superFreezeFighter;
            const prog = 1 - Math.max(0, this.superFreezeTimer / 0.26);
            const fx = sf.x;
            const fy = sf.y - 190;
            const ringR = 35 + prog * 340;

            ctx.globalCompositeOperation = 'screen';
            const grad = ctx.createRadialGradient(fx, fy, 10, fx, fy, 240);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.35, 'rgba(0, 229, 255, 0.65)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(fx, fy, 240, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 24;
            ctx.lineWidth = Math.max(2, 16 * (1 - prog));
            ctx.beginPath();
            ctx.arc(fx, fy, ringR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = Math.max(1.5, 8 * (1 - prog));
            ctx.beginPath();
            ctx.arc(fx, fy, ringR * 0.68, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 3. Fighters (draw attacker on top)
        if (this.ally) {
            this.ally.draw(ctx);
        }
        if (this.p1.state === 'ATTACK') {
            this.p2.draw(ctx);
            this.p1.draw(ctx);
        } else {
            this.p1.draw(ctx);
            this.p2.draw(ctx);
        }

        // 4. Projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx);
        }

        // 5. Street Fighter Multi-Ring Impact Starbursts & Ground Dust Shockwaves
        for (const sw of this.shockwaves) {
            const alpha = Math.max(0, sw.life / sw.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            if (sw.kind === 'dust') {
                ctx.strokeStyle = sw.color1;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 4 * alpha;
                ctx.beginPath();
                ctx.ellipse(sw.x, sw.y, sw.radius * 1.35, sw.radius * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.globalCompositeOperation = 'screen';
                ctx.translate(sw.x, sw.y);
                ctx.rotate(sw.angle);

                // Expanding shockwave ring
                ctx.strokeStyle = sw.color1;
                ctx.shadowColor = sw.color1;
                ctx.shadowBlur = 16;
                ctx.lineWidth = (sw.kind === 'heavy' ? 8 : 5) * alpha;
                ctx.beginPath();
                ctx.arc(0, 0, sw.radius, 0, Math.PI * 2);
                ctx.stroke();

                // 8-point Street Fighter cross starburst spikes
                const spikes = sw.kind === 'heavy' ? 10 : 8;
                const outerR = sw.radius * 1.25;
                const innerR = sw.radius * 0.24;
                ctx.fillStyle = sw.color2;
                ctx.beginPath();
                for (let i = 0; i < spikes * 2; i++) {
                    const r = i % 2 === 0 ? outerR : innerR;
                    const a = (i * Math.PI) / spikes;
                    const px = Math.cos(a) * r;
                    const py = Math.sin(a) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();

                // Hot white core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, sw.radius * 0.32, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 5b. Flying Hit Sparks
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.restore();

        // 6. HUD & Overlays
        if (this.matchPhase === 'CINEMATIC_FINISHER') {
            const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
            const loserFighter = this.winner === 'p1' ? this.p2 : this.p1;
            CinematicFinisher.drawCinematicScene(ctx, this.game, winnerFighter, loserFighter, this.finisherTimer);
        } else {
            CombatHUD.drawHUD(ctx, this);

            if (this.matchPhase === 'FIGHT_INTRO') {
                CombatHUD.drawFightIntro(ctx, this);
            } else if (this.matchPhase === 'FINISH_HIM') {
                CombatHUD.drawFinishHim(ctx, this);
            } else if (this.matchPhase === 'KO_FREEZE') {
                CombatHUD.drawKO(ctx, this);
            } else if (this.matchPhase === 'POST_MATCH') {
                CombatHUD.drawPostMatch(ctx, this);
            } else if (this.matchPhase === 'VICTORY') {
                CombatHUD.drawVictory(ctx, this);
            }
        }

        if (this.paused) {
            CombatHUD.drawPause(ctx, this);
        }
    }

    _drawStageAtmosphere(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        const t = (performance.now() * 0.001);
        const st = this.stageId || 'Japan';

        ctx.save();
        // 1. Subtle dynamic arena spotlight pulse on combos / heavy action
        if ((this.p1ComboCount >= 2 && this.p1ComboTimer > 0) || (this.p2ComboCount >= 2 && this.p2ComboTimer > 0) || this.shakeTimer > 0) {
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = st === 'Annikina_Pub' || st === 'Valhalla' || st === 'Spain'
                ? 'rgba(255, 110, 20, 0.08)'
                : (st === 'Russia' ? 'rgba(0, 200, 255, 0.08)' : 'rgba(255, 220, 90, 0.07)');
            ctx.fillRect(0, 0, w, h);
        }

        // 2. Stage-specific animated floating elements (zero GC allocations)
        ctx.globalCompositeOperation = 'screen';
        const isMatrixStage = (st === 'Cyber_Matrix');
        const isFireStage = (st === 'Annikina_Pub' || st === 'Valhalla' || st === 'Spain' || st === 'Mexico' || st === 'India');
        const isSnowStage = (st === 'Russia' || st === 'Canada');
        const isBlossomStage = (st === 'Japan' || st === 'China');

        const count = 24;
        for (let i = 0; i < count; i++) {
            const seed = i * 137.5;
            if (isMatrixStage) {
                // Falling emerald-green & cyan Cyber-Matrix digital code streams!
                const px = ((seed * 23) % w + w) % w;
                const speed = 135 + (i % 6) * 28;
                const py = ((t * speed + seed * 19) % (h * 0.92));
                const trailLen = 38 + (i % 4) * 14;
                ctx.strokeStyle = (i % 3 === 0) ? 'rgba(0, 255, 220, 0.52)' : 'rgba(0, 255, 102, 0.58)';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.moveTo(px, py - trailLen);
                ctx.lineTo(px, py);
                ctx.stroke();
                ctx.fillStyle = '#ccffdd';
                ctx.fillRect(px - 2, py - 2, 4, 4);
            } else if (isFireStage) {
                // Rising grill/forge embers
                const px = ((seed * 19 + Math.sin(t * 1.8 + i) * 45) % w + w) % w;
                const py = h - (((t * (55 + (i % 5) * 14) + seed * 11) % (h * 0.85)));
                const alpha = Math.max(0.1, Math.min(0.75, (py / h) * 0.75));
                const r = 2 + (i % 3) * 1.4;
                ctx.fillStyle = (i % 2 === 0) ? `rgba(255, 140, 20, ${alpha})` : `rgba(255, 220, 80, ${alpha})`;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
            } else if (isSnowStage) {
                // Whipping Siberian frost crystals
                const px = ((seed * 23 - t * (140 + (i % 4) * 28)) % w + w) % w;
                const py = ((t * (75 + (i % 5) * 15) + seed * 17) % h);
                ctx.fillStyle = 'rgba(210, 245, 255, 0.55)';
                ctx.beginPath();
                ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
                ctx.fill();
            } else if (isBlossomStage) {
                // Drifting sakura / temple petals
                const px = ((seed * 17 + t * 42 + Math.sin(t * 1.5 + i) * 35) % w + w) % w;
                const py = ((t * (38 + (i % 4) * 10) + seed * 13) % h);
                ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 160, 210, 0.55)' : 'rgba(255, 220, 240, 0.48)';
                ctx.beginPath();
                ctx.ellipse(px, py, 4.5, 2.4, t + i, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Neon / Cosmic arena light motes
                const px = ((seed * 29 + Math.sin(t * 1.2 + i) * 50) % w + w) % w;
                const py = h - (((t * (34 + (i % 4) * 9) + seed * 19) % (h * 0.85)));
                ctx.fillStyle = (i % 2 === 0) ? 'rgba(0, 229, 255, 0.42)' : 'rgba(255, 215, 0, 0.38)';
                ctx.beginPath();
                ctx.arc(px, py, 2.2 + (i % 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}
