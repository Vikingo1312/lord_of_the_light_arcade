import Fighter from '../entities/Fighter.js?v=2.34';
import Projectile from '../entities/Projectile.js?v=2.34';
import Hitbox from '../entities/Hitbox.js?v=2.34';
import StageObjectManager from '../entities/StageObjects.js?v=2.34';
import AIController from '../ai/AIController.js?v=2.34';
import CombatHUD from '../ui/CombatHUD.js?v=2.34';
import {
    preloadFighterSprites,
    preloadStageAssets,
    playAnnouncer,
    playFighterSound,
    playCombatSound
} from '../core/AssetPreloader.js?v=2.34';
import { STAGES, ROSTER, unlockFighter } from '../data.js?v=2.34';
import { STORY_REFLEXION, STORY_EPILOGUE, STORY_OUTRO, STORY_BIRTHDAY } from '../story_data.js?v=2.34';
import { STORY_DIALOGUES } from '../story_dialogues.js?v=2.34';
import CinematicFinisher, { getFinisherMove } from '../fx/CinematicFinisher.js?v=2.34';

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

        // Arcade & Online / Co-Op Mode tracking
        this.arcadeMode = Boolean(data && data.arcadeMode);
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

        // Reset match timers & flags cleanly for every round/fight
        this.time = 0;
        this.matchPhase = 'FIGHT_INTRO';
        this.timer = (this.game.settings && this.game.settings.timer) || 99;
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

        // Story-Driven Match Dialogue Banner
        this.storyDialogue = STORY_DIALOGUES[p2Data.id] || STORY_DIALOGUES[p1Data.id] || null;
        this.storyBannerTimer = 22.0;
        this.introSubPhase = 'STORY_DIALOGUE';
        this.introSubTimer = 0;

        // Street Fighter Trailing Red Damage Bars
        this.p1TrailHP = this.p1.maxHP;
        this.p2TrailHP = this.p2.maxHP;
        this.allyTrailHP = this.ally ? this.ally.maxHP : 0;

        // Street Fighter Super Freeze, Camera Punch-Zoom & Arcade Callouts
        this.superFreezeTimer = 0;
        this.superFreezeFighter = null;
        this.cameraZoom = 1.0;
        this.cameraFocusX = this.game.width / 2;
        this.cameraFocusY = this.game.height * 0.65;
        this.firstAttackAwarded = false;
        this.callout = null;

        // Combo Counter tracking
        this.p1ComboCount = 0;
        this.p1ComboTimer = 0;
        this.p2ComboCount = 0;
        this.p2ComboTimer = 0;

        // Pause State
        this.paused = false;
        this.pauseSelection = 0;

        // Preload sprites
        preloadFighterSprites(this.game.assetManager, p1Data);
        preloadFighterSprites(this.game.assetManager, p2Data);
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

        playFighterSound(this.game.audioManager, p2Data.id, 'intro', () => {
            this._startRoundCall(false);
        });
        // Generous 18s safety fallback (only if browser blocked audio; never cuts off 9-13s intro speeches!)
        this._storyIntroTimeout = setTimeout(() => {
            this._startRoundCall(false);
        }, 18000);

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
            playAnnouncer(this.game.audioManager, 'round_1', () => {
                this._startFightCall();
            });
            // Safety fallback for ROUND 1 duration (announcer_round_1.mp3 is 1.82s long)
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

        const isFinalBoss = (this.arcadeIndex === ROSTER.length - 1);
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

            if (this.koFreezeTimer >= 3.5 || (this.koFreezeTimer >= 0.85 && p1.skipJust)) {
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
                playFighterSound(this.game.audioManager, winnerFighter.data.id, 'win');
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

            if (p1.throwJust && p1Dist <= 165 && this.p1.isGrounded && this.p2.isGrounded) {
                // L + H simultaneously at close range: Unblockable Street Fighter Throw!
                p1InputCopy.commandMove = 'THROW';
                p1InputCopy.lJust = false;
                p1InputCopy.hJust = false;
            } else if (((p1.lJust && hasDP) || (p1.sJust && p1.up)) && this.p1.specialMoveCooldown <= 0) {
                // → ↓ ↘ + L or ↓ ↑ + L or ↑ + S: Rising Shoryuken Dragon Uppercut!
                p1InputCopy.commandMove = 'DRAGON_UPPERCUT';
                p1InputCopy.lJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (((p1.hJust && hasQCB) || (p1.sJust && p1.down)) && this.p1.specialMoveCooldown <= 0) {
                // ↓ ↙ ← + H or ↓ + S: Airborne Tatsumaki Hurricane Kick (3-hit cyclone)!
                p1InputCopy.commandMove = 'HURRICANE_KICK';
                p1InputCopy.hJust = false;
                im.clearMotionHistory();
                playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
            } else if (p1.sJust || ((p1.lJust || p1.hJust) && hasQCF)) {
                if (this.tryExecuteSpecial(this.p1, 'p1')) {
                    im.clearMotionHistory();
                    p1InputCopy.lJust = false;
                    p1InputCopy.hJust = false;
                } else if (hasQCF && this.p1.specialMoveCooldown <= 0) {
                    // Only explicit QCF motion (not raw neutral button mashing!) triggers physical special when Super Energy < 100
                    p1InputCopy.commandMove = p1.lJust ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                    p1InputCopy.lJust = false;
                    p1InputCopy.hJust = false;
                    im.clearMotionHistory();
                    playCombatSound(this.game.audioManager, 'special', this.p1.data.id);
                }
            }
        }

        // --- CO-OP ALLY (Player 2 in Co-Op Story) Input & Special Move Processing ---
        let allyInputCopy = null;
        if (this.coopMode && this.ally) {
            if (this.ally.state !== 'KO') {
                const rawAlly = guestInput || AIController.computeAllyInput(this, dt);
                allyInputCopy = { ...rawAlly, sJust: false, s: false };
                const hasAllyQCF = this.ally.facing === 1 ? Boolean(rawAlly.qcfRight) : Boolean(rawAlly.qcfLeft);
                const isAllySpecial = rawAlly.sJust || ((rawAlly.lJust || rawAlly.hJust) && hasAllyQCF);

                if (isAllySpecial && this.tryExecuteSpecial(this.ally, 'p1')) {
                    allyInputCopy.lJust = false;
                    allyInputCopy.hJust = false;
                }
            } else {
                allyInputCopy = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };
            }
        }

        // --- P2 Input (Online 1v1 Guest OR AI Opponent) ---
        let p2Input = null;
        if (this.onlineMode === 'duel' && guestInput) {
            p2Input = { ...guestInput, sJust: false, s: false };
            const hasP2QCF = this.p2.facing === 1 ? Boolean(guestInput.qcfRight) : Boolean(guestInput.qcfLeft);
            const isP2Special = guestInput.sJust || ((guestInput.lJust || guestInput.hJust) && hasP2QCF);
            if (isP2Special && this.tryExecuteSpecial(this.p2, 'p2')) {
                p2Input.lJust = false;
                p2Input.hJust = false;
            }
        } else {
            p2Input = AIController.computeInput(this, dt);
            if ((p2Input.commandMove === 'DRAGON_UPPERCUT' || p2Input.commandMove === 'HURRICANE_KICK') && this.p2.specialMoveCooldown <= 0) {
                playCombatSound(this.game.audioManager, 'special', this.p2.data.id);
            } else if (p2Input.sJust) {
                const dist = Math.abs(this.p1.x - this.p2.x);
                const useMeleeSpecial = dist <= 200 && this.p2.data.specialType !== 'SPECIAL_DASH' && this.p2.specialMoveCooldown <= 0 && Math.random() < 0.55;
                if (useMeleeSpecial) {
                    p2Input.sJust = false;
                    p2Input.commandMove = (!this.p1.isGrounded || Math.random() < 0.5) ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                    playCombatSound(this.game.audioManager, 'special', this.p2.data.id);
                } else {
                    p2Input.sJust = false;
                    this.tryExecuteSpecial(this.p2, 'p2');
                }
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
            if (!this.finisherTriggered) {
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
            if (!this.finisherTriggered) {
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

        const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
        if (winnerFighter) {
            const fMove = getFinisherMove(winnerFighter.data.id);
            this.triggerCallout(`🎬 ${fMove.name}!`, fMove.color1 || '#ffd700', this.winner);
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
            atkType: f.currentAttack ? f.currentAttack.type : null
        };
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
            f.currentAttack = { type: snap.atkType, startup: 0.05, active: 0.15, recovery: 0.18 };
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

        // Grounded Super requires 100 energy; Airborne Diagonal Fireball works either with 100 energy OR on 0.72s cooldown!
        if (!hasFullSuper && (!isAirCast || fighter.specialMoveCooldown > 0)) return false;
        if (this.projectiles.some(p => p.owner === ownerKey && p.charId === fighter.data.id && p.alive)) return false;

        const charId = fighter.data.id;
        const isSecondVariant = Boolean(fighter.data.special);

        if (fighter.data.specialType === 'SPECIAL_DASH' && !isAirCast) {
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
            if (!fighter.executeProjectileCast()) return false;
            if (isSecondVariant) {
                fighter.specialEnergy = charId === 'SupremeKeano' ? 35 : 25; // Evolved Second-Variant Super Meter Refund!
            }
        } else {
            // Free Diagonal Air Fireball / Lightball while jumping!
            fighter.specialMoveCooldown = 0.72;
            fighter.state = 'ATTACK';
            fighter.stateTimer = 0;
            fighter.attackHasHit = false;
            fighter.attackWasBlocked = false;
            fighter.attackHitCount = 0;
            fighter.activeHitbox = null;
            fighter.vy = -340;
            fighter.vx = -fighter.facing * 140;
            fighter.currentAttack = {
                startup: 0.05, active: 0.16, recovery: 0.18,
                damage: 0, pushback: 0, hitstop: 0, box: null, type: 'SPECIAL'
            };
        }

        this.superFreezeTimer = isAirCast ? (hasFullSuper ? 0.14 : 0.06) : 0.24;
        this.superFreezeFighter = fighter;
        this.cameraZoom = isAirCast && !hasFullSuper ? 1.02 : 1.04;
        this.cameraFocusX = fighter.x;
        this.cameraFocusY = fighter.y - 155;
        this.triggerCallout(
            isAirCast ? `☄️ AIR ${fighter.data.specialName || 'FIREBALL'}!` : (fighter.data.superName || fighter.data.specialName || 'SUPER ARTS!'),
            '#ffd700',
            ownerKey
        );

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

        // Evolved Second-Variant Twin / Barrage Projectile Mechanics!
        if (hasFullSuper && (charId === 'HyperEmely' || charId === 'CayleMinogue' || charId === 'HyperKeano' || charId === 'SupremeKeano' || charId === 'GargamelHoodie' || charId === 'JayX')) {
            if (charId === 'JayX' && !isAirCast) {
                // Jay X lunges forward with a phantom slash while firing his Void Wave!
                fighter.vx = fighter.facing * 680;
                fighter.hitImmunity = Math.max(fighter.hitImmunity, 0.24);
            }
            const twinProj = new Projectile(
                fighter.x + fighter.facing * 15,
                fighter.y - (isAirCast ? 155 : (charId === 'GargamelHoodie' ? 95 : (charId === 'CayleMinogue' ? 110 : 175))),
                fighter.facing,
                ownerKey,
                img,
                this.game
            );
            twinProj.charId = charId;
            twinProj.speed = isAirCast ? 840 : 880;
            twinProj.vy = isAirCast ? 440 : 0;
            twinProj.damage = Math.round(24 * pwrScale);
            this.projectiles.push(twinProj);
            this.spawnSparks(fighter.x + fighter.facing * 75, fighter.y - 145, charId === 'HyperEmely' ? '#ff66cc' : '#00ffff', '#ffffff', 14, 'heavy');
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
        this._resolveMeleeHit(this.p1, this.p2, 'p1');
        if (this.ally) {
            this._resolveMeleeHit(this.ally, this.p2, 'p1');
            this._resolveMeleeHit(this.p2, this.ally, 'p2');
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
        } else {
            // Multi-hit support (e.g. HURRICANE_KICK hits up to 3-4 times, LIGHT_DRAGON DRAGON_UPPERCUT hits 2 times!)
            const maxHits = attacker.currentAttack.maxHits || 1;
            attacker.attackHitCount = (attacker.attackHitCount || 0) + 1;
            if (attacker.attackHitCount < maxHits) {
                attacker.multiHitCooldown = 0.11;
                defender.hitImmunity = 0.08;
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
            } else if (atkType === 'DRAGON_UPPERCUT' || atkType === 'HURRICANE_KICK' || atkType === 'COMBO_FINISHER') {
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

            const isSpecialHit = Boolean(attacker.currentAttack.isSpecialMove || atkType === 'DRAGON_UPPERCUT' || atkType === 'HURRICANE_KICK' || atkType === 'SPECIAL' || atkType === 'SPECIAL_DASH' || atkType === 'COMBO_FINISHER');
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

        // Story Mode Midpoint Check (Always active for EVERY character in Arcade/Story Mode!)
        if (nextIdx === 7 && (this.arcadeMode || (this.combatData && this.combatData.storyMode))) {
            this._transitioning = true;
            const nextOpponent = ROSTER[7];
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

        if (nextIdx >= ROSTER.length) {
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

            if (this.arcadeMode || (this.combatData && this.combatData.storyMode)) {
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
        const opponent = ROSTER[nextIdx];
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);

        const nextCombatData = {
            p1: player1,
            ally: allyChar,
            p2: { ...opponent, rosterIndex: nextIdx },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true,
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
                CombatHUD.drawKO(ctx, this);
                CombatHUD.drawPostMatch(ctx, this);
            } else if (this.matchPhase === 'VICTORY') {
                CombatHUD.drawVictory(ctx, this);
            }
        }

        if (this.paused) {
            CombatHUD.drawPause(ctx, this);
        }
    }
}
