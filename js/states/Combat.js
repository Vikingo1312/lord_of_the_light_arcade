import Fighter from '../entities/Fighter.js';
import Projectile from '../entities/Projectile.js';
import Hitbox from '../entities/Hitbox.js';
import StageObjectManager from '../entities/StageObjects.js';
import AIController from '../ai/AIController.js';
import CombatHUD from '../ui/CombatHUD.js';
import {
    preloadFighterSprites,
    preloadStageAssets,
    playAnnouncer,
    playFighterSound,
    playCombatSound
} from '../core/AssetPreloader.js';
import { STAGES, ROSTER, unlockFighter } from '../data.js';
import { STORY_REFLEXION, STORY_EPILOGUE, STORY_OUTRO, STORY_BIRTHDAY } from '../story_data.js';

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
        this.winner = null;
        this.postMatchIndex = 0;
        this.postMatchTimer = 0;
        this.autoAdvanceTimer = undefined;
        this.autoAdvanceMax = 3.0;
        this.inputCooldown = 45;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.particles = [];
        this.projectiles = [];
        this._transitioning = false;
        this._koAnnounced = false;
        this._perfectAnnounced = false;
        this._koKnockbackApplied = false;
        this._newlyUnlocked = null;

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

        // Announcer: "ROUND 1!" -> "FIGHT!"
        playAnnouncer(this.game.audioManager, 'round_1');
        if (this._fightAnnouncerTimeout) clearTimeout(this._fightAnnouncerTimeout);
        this._fightAnnouncerTimeout = setTimeout(() => {
            playAnnouncer(this.game.audioManager, 'fight');
        }, 1000);

        this.game.canvas.addEventListener('mousedown', this._onMouseClick);
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
        if (this._fightAnnouncerTimeout) {
            clearTimeout(this._fightAnnouncerTimeout);
            this._fightAnnouncerTimeout = null;
        }

        const isFinalBoss = (this.arcadeIndex === ROSTER.length - 1);
        const wonBossFight = (isFinalBoss && this.winner === 'p1');
        if (!wonBossFight) {
            this.game.audioManager.stopBGM();
        }
        this.game.canvas.removeEventListener('mousedown', this._onMouseClick);
    }

    _onMouseClick = (e) => {
        if (!this.game || !this.game.canvas) return;
        const rect = this.game.canvas.getBoundingClientRect();
        const scaleX = this.game.width / rect.width;
        const scaleY = this.game.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.paused) {
            this.paused = false;
            return;
        }

        if (x > this.game.width - 200 && y < 80) {
            this.paused = true;
            this.pauseSelection = 0;
        }
    };

    update(dt) {
        this.time += dt;
        const p1 = this.game.inputManager.p1;
        const net = this.game.networkManager;
        const isOnlineHost = Boolean(net && net.active && net.role === 'host' && this.onlineMode);
        const isOnlineGuest = Boolean(net && net.active && net.role === 'guest' && this.onlineMode);

        if (p1.menuJust) {
            this.paused = !this.paused;
            this.pauseSelection = 0;
            return;
        }

        if (this.paused) {
            if (p1.downJust) this.pauseSelection = 1;
            if (p1.upJust) this.pauseSelection = 0;
            if (p1.lJust || p1.hJust || p1.sJust) {
                if (this.pauseSelection === 0) {
                    this.paused = false;
                } else {
                    if (net && net.active) net.disconnect();
                    this.game.stateManager.switchState('Menu');
                }
            }
            return;
        }

        if (this.inputCooldown > 0) this.inputCooldown--;

        // ─── ONLINE GUEST: Receive & interpolate Host snapshots ───
        if (isOnlineGuest) {
            this._updateAsGuest(dt);
            return;
        }

        // ─── FIGHT INTRO ("ROUND 1 — FIGHT!" banner) ───
        if (this.matchPhase === 'FIGHT_INTRO') {
            this.introTimer += dt;
            if (this.introTimer >= 1.8) {
                this.matchPhase = 'FIGHTING';
            }
            if (isOnlineHost) this._broadcastHostSnapshot();
            return;
        }

        // Keep gravity running for airborne KO characters during POST_MATCH and VICTORY
        if (this.matchPhase === 'POST_MATCH' || this.matchPhase === 'VICTORY') {
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
                this.autoAdvanceMax = (this.arcadeMode && this.winner === 'p1') ? 3.0 : 10.0;
                this.autoAdvanceTimer = this.autoAdvanceMax;
            }

            if (this.inputCooldown <= 0 && !this._transitioning) {
                this.autoAdvanceTimer -= dt;
                const confirmPressed = p1.lJust || p1.hJust || p1.sJust;
                const timeOut = this.autoAdvanceTimer <= 0;

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
            if (this.inputCooldown <= 0 && !this._transitioning && (p1.lJust || p1.hJust || p1.sJust)) {
                this._transitioning = true;
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

        // ─── KO FREEZE (Slow-motion cinematic KO with flyback) ───
        if (this.matchPhase === 'KO_FREEZE') {
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

            if (this.koFreezeTimer >= 3.5) {
                this.matchPhase = 'POST_MATCH';
                this.inputCooldown = 60;
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

        // --- P1 Input & Special Move Processing ---
        const p1InputCopy = { ...p1, sJust: false, s: false };
        const isP1Special = p1.sJust || ((p1.lJust || p1.hJust) && this.game.inputManager.hasQCF(this.p1.facing));

        if (this.p1.state !== 'KO' && isP1Special && this.tryExecuteSpecial(this.p1, 'p1')) {
            this.game.inputManager.clearMotionHistory();
            p1InputCopy.lJust = false;
            p1InputCopy.hJust = false;
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
            if (p2Input.sJust) {
                const dist = Math.abs(this.p1.x - this.p2.x);
                const useMeleeSpecial = dist <= 200 && this.p2.data.specialType !== 'SPECIAL_DASH' && Math.random() < 0.55;
                if (useMeleeSpecial) {
                    if (this.p2.specialEnergy >= 100 && (this.p2.state === 'IDLE' || this.p2.state === 'WALK')) {
                        playCombatSound(this.game.audioManager, 'special', this.p2.data.id);
                        this.triggerShake(2, 0.08);
                    }
                } else {
                    p2Input.sJust = false;
                    this.tryExecuteSpecial(this.p2, 'p2');
                }
            }
        }

        const p1WasDash = this.p1.state === 'DASH';
        const p2WasDash = this.p2.state === 'DASH';
        const allyWasDash = this.ally ? (this.ally.state === 'DASH') : false;

        this.p1.update(dt, p1InputCopy);
        if (this.ally && allyInputCopy) {
            this.ally.update(dt, allyInputCopy);
        }
        this.p2.update(dt, p2Input);

        // Spawn ground dust burst on new dash start
        if (!p1WasDash && this.p1.state === 'DASH') {
            this.spawnSparks(this.p1.x, this.p1.y - 10, '#88ddff', '#ffffff', 6);
        }
        if (this.ally && !allyWasDash && this.ally.state === 'DASH') {
            this.spawnSparks(this.ally.x, this.ally.y - 10, '#cc88ff', '#ffffff', 6);
        }
        if (!p2WasDash && this.p2.state === 'DASH') {
            this.spawnSparks(this.p2.x, this.p2.y - 10, '#ffaa44', '#ffffff', 6);
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
        }
        this.checkProjectileCollisions();
        this.projectiles = this.projectiles.filter(p => p.alive && p.x > -50 && p.x < this.game.width + 50);

        // --- Particles & Stage Objects ---
        this.updateParticles(dt);
        this.stageObjects.update(dt);
        this.stageObjects.checkCollisions(this.p1, this.p2);
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        // --- Auto-Facing with Hysteresis ---
        if (!this.game.settings || this.game.settings.autoFacingEnabled !== false) {
            const dist = this.p1.x - this.p2.x;
            if (Math.abs(dist) > 15) {
                if (this.p1.state !== 'ATTACK' && this.p1.state !== 'DASH' && this.p1.state !== 'KO') {
                    this.p1.facing = (dist > 0) ? -1 : 1;
                }
                if (this.p2.state !== 'ATTACK' && this.p2.state !== 'DASH' && this.p2.state !== 'KO') {
                    // Face whichever alive hero is closer
                    let targetHero = this.p1;
                    if (this.ally && this.ally.state !== 'KO') {
                        if (this.p1.state === 'KO' || Math.abs(this.ally.x - this.p2.x) < Math.abs(this.p1.x - this.p2.x)) {
                            targetHero = this.ally;
                        }
                    }
                    const d2 = targetHero.x - this.p2.x;
                    if (Math.abs(d2) > 15) {
                        this.p2.facing = (d2 > 0) ? 1 : -1;
                    }
                }
            }
            if (this.ally && this.ally.state !== 'ATTACK' && this.ally.state !== 'DASH' && this.ally.state !== 'KO') {
                const allyDist = this.ally.x - this.p2.x;
                if (Math.abs(allyDist) > 15) {
                    this.ally.facing = (allyDist > 0) ? -1 : 1;
                }
            }
        }

        // --- Check K.O. ---
        const teamP1Defeated = this.coopMode && this.ally
            ? (this.p1.state === 'KO' && this.ally.state === 'KO')
            : (this.p1.state === 'KO');

        if (teamP1Defeated) {
            this.winner = 'p2';
            this.matchPhase = 'KO_FREEZE';
            this.koFreezeTimer = 0;
            this._koKnockbackApplied = false;
        } else if (this.p2.state === 'KO') {
            this.winner = 'p1';
            this.matchPhase = 'KO_FREEZE';
            this.koFreezeTimer = 0;
            this._koKnockbackApplied = false;
        }

        if (isOnlineHost) {
            this._netSyncTick++;
            if (this._netSyncTick % 2 === 0 || this.matchPhase !== 'FIGHTING') {
                this._broadcastHostSnapshot();
            }
        }
    }

    _separateFighters(fA, fB) {
        if (!fA || !fB || fA.state === 'KO' || fB.state === 'KO' || !fA.isGrounded || !fB.isGrounded) return;
        const minDistance = 110;
        const dx = fB.x - fA.x;
        const dist = Math.abs(dx);
        if (dist < minDistance) {
            const overlap = (minDistance - dist) / 2;
            if (dx >= 0) {
                fA.x -= overlap;
                fB.x += overlap;
            } else {
                fA.x += overlap;
                fB.x -= overlap;
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

        const net = this.game.networkManager;
        if (!net) return;

        while (net.pendingCombatEvents.length > 0) {
            const ev = net.pendingCombatEvents.shift();
            if (ev.sparks) {
                this.spawnSparks(ev.sparks.x, ev.sparks.y, ev.sparks.c1, ev.sparks.c2, ev.sparks.count);
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

        if (Array.isArray(snap.projectiles)) {
            this.projectiles = snap.projectiles.map(sp => {
                const img = this.game.assetManager.images[`${sp.charId}_Cutin`];
                const pr = new Projectile(sp.x, sp.y, sp.facing, sp.owner, img, this.game);
                pr.charId = sp.charId;
                return pr;
            });
        }
    }

    /**
     * Unified Special Attack execution for P1, Ally, and P2 (Projectiles & Dash Specials).
     * Properly consumes 100 Special Energy and supports Combo Canceling from connected attacks!
     */
    tryExecuteSpecial(fighter, ownerKey) {
        const canCancelAttack = fighter.state === 'ATTACK' && fighter.attackHasHit;
        if (fighter.state !== 'IDLE' && fighter.state !== 'WALK' && fighter.state !== 'CROUCH' && fighter.state !== 'DASH' && !canCancelAttack) {
            return false;
        }
        if (fighter.specialEnergy < 100) return false;
        if (this.projectiles.some(p => p.owner === ownerKey && p.charId === fighter.data.id && p.alive)) return false;

        if (fighter.data.specialType === 'SPECIAL_DASH') {
            if (!fighter.executeAttack('SPECIAL_DASH')) return false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
            this.triggerShake(5, 0.5);
            this._emitNetEvent({ combatSound: { type: 'special', charId: fighter.data.id }, shake: { i: 5, d: 0.5 } });
            return true;
        }

        if (!fighter.executeProjectileCast()) return false;

        const imgKey = `${fighter.data.id}_Cutin`;
        const img = this.game.assetManager.images[imgKey];
        const proj = new Projectile(
            fighter.x + fighter.facing * 80,
            fighter.y - 180,
            fighter.facing,
            ownerKey,
            img,
            this.game
        );
        proj.charId = fighter.data.id;
        proj.damage = Math.round(proj.damage * ((fighter.power || 100) / 100));
        this.projectiles.push(proj);

        playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        this.triggerShake(2, 0.08);
        this._emitNetEvent({ combatSound: { type: 'special', charId: fighter.data.id }, shake: { i: 2, d: 0.08 } });
        return true;
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
        if (!attacker || !defender || !attacker.activeHitbox || defender.state === 'KO') return;

        // Grounded reeling defenders cannot be infinite-jabbed by repeated Light punches,
        // but CAN be combo-linked into Heavy, Sweep, or Special attacks!
        const atkType = attacker.currentAttack ? attacker.currentAttack.type : '';
        const isRepeatableJab = (atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT');
        if (defender.state === 'HIT' && defender.isGrounded && isRepeatableJab) return;

        const hitR = attacker.activeHitbox.getWorldRect(attacker.x, attacker.y, attacker.facing);
        const hurtR = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facing);

        if (!Hitbox.checkCollision(hitR, hurtR)) return;

        const result = defender.takeDamage(attacker.currentAttack, attacker.facing);
        if (!result || result === 'IMMUNE') return;

        attacker.attackHasHit = true;
        attacker.hitStop = attacker.currentAttack.hitstop;
        attacker.activeHitbox = null;

        // Award Special Energy
        const gain = result === 'BLOCKED' ? 5 : 15;
        const regenMul = attacker.data.id === 'SupremeKeano' ? 2 : 1;
        attacker.specialEnergy = Math.min(attacker.maxSpecialEnergy, attacker.specialEnergy + gain * regenMul);
        defender.specialEnergy = Math.min(defender.maxSpecialEnergy, defender.specialEnergy + 10);

        const impactX = (attacker.x + defender.x) / 2;
        const impactY = defender.y - (atkType === 'SWEEP' || atkType === 'CROUCH_LIGHT' ? 60 : 150);
        if (result === 'BLOCKED') {
            this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
            playCombatSound(this.game.audioManager, 'block', defender.data.id);
            this._emitNetEvent({
                sparks: { x: impactX, y: impactY, c1: '#00ccff', c2: '#ffffff', count: 6 },
                combatSound: { type: 'block', charId: defender.data.id }
            });
        } else {
            // Increment Combo Counter!
            if (attackerKey === 'p1') {
                this.p1ComboCount = (this.p1ComboTimer > 0) ? this.p1ComboCount + 1 : 1;
                this.p1ComboTimer = 1.45;
            } else {
                this.p2ComboCount = (this.p2ComboTimer > 0) ? this.p2ComboCount + 1 : 1;
                this.p2ComboTimer = 1.45;
            }

            this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
            playCombatSound(this.game.audioManager, 'hit', defender.data.id);
            if (attacker.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
            this._emitNetEvent({
                sparks: { x: impactX, y: impactY, c1: '#ffaa00', c2: '#ff4400', count: 10 },
                combatSound: { type: 'hit', charId: defender.data.id },
                shake: attacker.currentAttack.damage >= 12 ? { i: 3, d: 0.12 } : null
            });
            if (defender.hp <= 0 && !this._koAnnounced) {
                const isFinalKO = defender === this.p2 || (!this.ally || (this.p1.hp <= 0 && this.ally.hp <= 0));
                if (isFinalKO) {
                    this._koAnnounced = true;
                }
                playCombatSound(this.game.audioManager, 'ko', defender.data.id);
                this._emitNetEvent({ combatSound: { type: 'ko', charId: defender.data.id } });
            }
        }
    }

    checkProjectileCollisions() {
        for (const proj of this.projectiles) {
            if (!proj.alive) continue;
            const pRect = proj.getHitRect();
            const targets = proj.owner === 'p1'
                ? [this.p2]
                : (this.ally ? [this.p1, this.ally] : [this.p1]);

            for (const defender of targets) {
                if (!defender || defender.state === 'KO') continue;

                const hurtR = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facing);
                if (Hitbox.checkCollision(pRect, hurtR)) {
                    const result = defender.takeDamage(proj.getAttackDef(), proj.facing);
                    if (!result || result === 'IMMUNE') continue;

                    proj.alive = false;
                    if (result === 'BLOCKED') {
                        this.spawnSparks(proj.x, proj.y, '#00ccff', '#ffffff', 8);
                        playCombatSound(this.game.audioManager, 'block', defender.data.id);
                        this._emitNetEvent({
                            sparks: { x: proj.x, y: proj.y, c1: '#00ccff', c2: '#ffffff', count: 8 },
                            combatSound: { type: 'block', charId: defender.data.id }
                        });
                    } else {
                        if (proj.owner === 'p1') {
                            this.p1ComboCount = (this.p1ComboTimer > 0) ? this.p1ComboCount + 1 : 1;
                            this.p1ComboTimer = 1.45;
                        } else {
                            this.p2ComboCount = (this.p2ComboTimer > 0) ? this.p2ComboCount + 1 : 1;
                            this.p2ComboTimer = 1.45;
                        }
                        const hitColor = proj.owner === 'p1' ? '#ffaa00' : '#ff4400';
                        this.spawnSparks(proj.x, proj.y, hitColor, '#ffffff', 8);
                        playCombatSound(this.game.audioManager, 'hit', defender.data.id);
                        this.triggerShake(2, 0.08);
                        this._emitNetEvent({
                            sparks: { x: proj.x, y: proj.y, c1: hitColor, c2: '#ffffff', count: 8 },
                            combatSound: { type: 'hit', charId: defender.data.id },
                            shake: { i: 2, d: 0.08 }
                        });
                        if (defender.hp <= 0 && !this._koAnnounced) {
                            const isFinalKO = defender === this.p2 || (!this.ally || (this.p1.hp <= 0 && this.ally.hp <= 0));
                            if (isFinalKO) {
                                this._koAnnounced = true;
                            }
                            playCombatSound(this.game.audioManager, 'ko', defender.data.id);
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

    spawnSparks(x, y, color1, color2, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 800,
                vy: (Math.random() - 0.5) * 600 - 200,
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
    }

    advanceArcadeLadder() {
        const nextIdx = this.arcadeIndex + 1;
        const net = this.game.networkManager;
        const isOnlineHost = Boolean(net && net.active && net.role === 'host' && this.onlineMode);

        // Story Mode Midpoint Check
        if (nextIdx === 7 && this.combatData && this.combatData.storyMode) {
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

            if (this.combatData && this.combatData.storyMode) {
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
            storyMode: this.combatData ? this.combatData.storyMode : false,
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

        // 2. Destructible Stage Objects
        this.stageObjects.draw(ctx);

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

        // 5. Hit Sparks
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
        CombatHUD.drawHUD(ctx, this);

        if (this.matchPhase === 'FIGHT_INTRO') {
            CombatHUD.drawFightIntro(ctx, this);
        } else if (this.matchPhase === 'KO_FREEZE') {
            CombatHUD.drawKO(ctx, this);
        } else if (this.matchPhase === 'POST_MATCH') {
            CombatHUD.drawKO(ctx, this);
            CombatHUD.drawPostMatch(ctx, this);
        } else if (this.matchPhase === 'VICTORY') {
            CombatHUD.drawVictory(ctx, this);
        }

        if (this.paused) {
            CombatHUD.drawPause(ctx, this);
        }
    }
}
