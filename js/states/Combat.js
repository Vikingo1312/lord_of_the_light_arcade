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

        // Arcade Mode tracking
        this.arcadeMode = Boolean(data && data.arcadeMode);
        this.arcadeIndex = (data && data.arcadeIndex !== undefined) ? data.arcadeIndex : 1;
        this.arcadeWins = (data && data.arcadeWins) || 0;

        // Preserve FULL fighter stats & metadata from data.js (HP, speed, power, largeAura, specialType, multiFrameAnim)
        const baseP1 = (data && data.p1) ? data.p1 : ROSTER[0];
        const baseP2 = (data && data.p2) ? data.p2 : ROSTER[13];
        const p1Data = { ...baseP1, color: 'blue' };
        const p2Data = { ...baseP2, color: 'red' };
        this.stageId = (data && data.stageId) ? data.stageId : (p2Data.stageId || 'Japan');

        this.p1 = new Fighter(this.game, p1Data, this.game.width * 0.25, this.game.height * 0.9, 1);
        this.p2 = new Fighter(this.game, p2Data, this.game.width * 0.75, this.game.height * 0.9, -1);

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
                    this.game.stateManager.switchState('Menu');
                }
            }
            return;
        }

        if (this.inputCooldown > 0) this.inputCooldown--;

        // ─── FIGHT INTRO ("ROUND 1 — FIGHT!" banner) ───
        if (this.matchPhase === 'FIGHT_INTRO') {
            this.introTimer += dt;
            if (this.introTimer >= 1.8) {
                this.matchPhase = 'FIGHTING';
            }
            return;
        }

        // Keep gravity running for airborne KO characters during POST_MATCH and VICTORY
        if (this.matchPhase === 'POST_MATCH' || this.matchPhase === 'VICTORY') {
            const floorY = this.game.height * 0.9;
            for (const f of [this.p1, this.p2]) {
                if (f.state === 'KO' && f.y < floorY) {
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
                                this.game.stateManager.switchState('Combat', this.combatData);
                            } else {
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
                            this.game.stateManager.switchState('Combat', this.combatData);
                        } else if (this.postMatchIndex === 1) {
                            this.game.stateManager.switchState('CharSelect');
                        } else {
                            this.game.stateManager.switchState('Menu');
                        }
                    }
                }
            }
            return;
        }

        // ─── VICTORY (Arcade complete) ───
        if (this.matchPhase === 'VICTORY') {
            if (this.inputCooldown <= 0 && !this._transitioning && (p1.lJust || p1.hJust || p1.sJust)) {
                this._transitioning = true;
                this.game.stateManager.switchState('Story', {
                    ...STORY_BIRTHDAY,
                    nextState: 'Menu',
                    nextData: null,
                });
            }
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
                winnerFighter.state = 'WIN';
                playFighterSound(this.game.audioManager, winnerFighter.data.id, 'win');
            }
            return;
        }

        // ─── FIGHTING ───
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.winner = (this.p1.hp >= this.p2.hp) ? 'p1' : 'p2';
            this.matchPhase = 'KO_FREEZE';
            this.koFreezeTimer = 0;
            this._koKnockbackApplied = false;
            return;
        }

        // --- P1 Input & Special Move Processing ---
        const p1InputCopy = { ...p1, sJust: false, s: false };
        const isP1Special = p1.sJust || ((p1.lJust || p1.hJust) && this.game.inputManager.hasQCF(this.p1.facing));

        if (isP1Special && this.tryExecuteSpecial(this.p1, 'p1')) {
            this.game.inputManager.clearMotionHistory();
            p1InputCopy.lJust = false;
            p1InputCopy.hJust = false;
        }

        // --- P2 AI Input & Special Move Processing ---
        const p2Input = AIController.computeInput(this, dt);
        if (p2Input.sJust) {
            p2Input.sJust = false;
            this.tryExecuteSpecial(this.p2, 'p2');
        }

        this.p1.update(dt, p1InputCopy);
        this.p2.update(dt, p2Input);

        // --- Boundaries & Pushbox Separation ---
        this.enforceBoundaries(this.p1);
        this.enforceBoundaries(this.p2);

        if (this.p1.state !== 'KO' && this.p2.state !== 'KO' && this.p1.isGrounded && this.p2.isGrounded) {
            const minDistance = 110;
            const dx = this.p2.x - this.p1.x;
            const dist = Math.abs(dx);

            if (dist < minDistance) {
                const overlap = (minDistance - dist) / 2;
                if (dx >= 0) {
                    this.p1.x -= overlap;
                    this.p2.x += overlap;
                } else {
                    this.p1.x += overlap;
                    this.p2.x -= overlap;
                }
            }
        }

        this.enforceBoundaries(this.p1);
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
                if (this.p1.state !== 'ATTACK') {
                    this.p1.facing = (dist > 0) ? -1 : 1;
                }
                if (this.p2.state !== 'ATTACK') {
                    this.p2.facing = (dist > 0) ? 1 : -1;
                }
            }
        }

        // --- Check K.O. ---
        if (this.p1.state === 'KO') {
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
    }

    /**
     * Unified Special Attack execution for both P1 and P2 (Projectiles & Dash Specials).
     * Properly consumes 100 Special Energy.
     */
    tryExecuteSpecial(fighter, ownerKey) {
        if (fighter.state !== 'IDLE' && fighter.state !== 'WALK') return false;
        if (fighter.specialEnergy < 100) return false;
        if (this.projectiles.some(p => p.owner === ownerKey && p.alive)) return false;

        if (fighter.data.specialType === 'SPECIAL_DASH') {
            if (!fighter.executeAttack('SPECIAL_DASH')) return false;
            playCombatSound(this.game.audioManager, 'special', fighter.data.id);
            this.triggerShake(5, 0.5);
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
        proj.damage = Math.round(proj.damage * ((fighter.power || 100) / 100));
        this.projectiles.push(proj);

        playCombatSound(this.game.audioManager, 'special', fighter.data.id);
        this.triggerShake(2, 0.08);
        return true;
    }

    checkCombatCollisions() {
        this._resolveMeleeHit(this.p1, this.p2);
        this._resolveMeleeHit(this.p2, this.p1);
    }

    _resolveMeleeHit(attacker, defender) {
        if (!attacker.activeHitbox || defender.state === 'KO') return;

        // Grounded reeling defenders cannot be chain-hit by non-lifting normal attacks
        const reelingGrounded = defender.state === 'HIT' && defender.isGrounded &&
            attacker.currentAttack && !attacker.currentAttack.lift &&
            attacker.currentAttack.type !== 'SPECIAL' && attacker.currentAttack.type !== 'SPECIAL_DASH';
        if (reelingGrounded) return;

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
        const impactY = defender.y - 150;
        if (result === 'BLOCKED') {
            this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
            playCombatSound(this.game.audioManager, 'block', defender.data.id);
        } else {
            this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
            playCombatSound(this.game.audioManager, 'hit', defender.data.id);
            if (attacker.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
            if (defender.hp <= 0 && !this._koAnnounced) {
                this._koAnnounced = true;
                playCombatSound(this.game.audioManager, 'ko', defender.data.id);
            }
        }
    }

    checkProjectileCollisions() {
        for (const proj of this.projectiles) {
            if (!proj.alive) continue;
            const pRect = proj.getHitRect();
            const defender = proj.owner === 'p1' ? this.p2 : this.p1;
            if (!defender || defender.state === 'KO') continue;

            const hurtR = defender.hurtbox.getWorldRect(defender.x, defender.y, defender.facing);
            if (Hitbox.checkCollision(pRect, hurtR)) {
                const result = defender.takeDamage(proj.getAttackDef(), proj.facing);
                if (!result || result === 'IMMUNE') continue;

                proj.alive = false;
                if (result === 'BLOCKED') {
                    this.spawnSparks(proj.x, proj.y, '#00ccff', '#ffffff', 8);
                    playCombatSound(this.game.audioManager, 'block', defender.data.id);
                } else {
                    const hitColor = proj.owner === 'p1' ? '#ffaa00' : '#ff4400';
                    this.spawnSparks(proj.x, proj.y, hitColor, '#ffffff', 8);
                    playCombatSound(this.game.audioManager, 'hit', defender.data.id);
                    this.triggerShake(2, 0.08);
                    if (defender.hp <= 0 && !this._koAnnounced) {
                        this._koAnnounced = true;
                        playCombatSound(this.game.audioManager, 'ko', defender.data.id);
                    }
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

        // Story Mode Midpoint Check
        if (nextIdx === 7 && this.combatData && this.combatData.storyMode) {
            this._transitioning = true;
            const nextOpponent = ROSTER[7];
            preloadFighterSprites(this.game.assetManager, nextOpponent);
            preloadStageAssets(this.game.assetManager, nextOpponent.stageId);
            this.game.stateManager.switchState('Story', {
                ...STORY_REFLEXION,
                nextState: 'VersusIntro',
                nextData: {
                    p1: this.p1.data,
                    p2: { ...nextOpponent, rosterIndex: 7 },
                    stageId: nextOpponent.stageId,
                    arcadeMode: true,
                    storyMode: true,
                    arcadeIndex: 7,
                    arcadeWins: this.arcadeWins + 1,
                }
            });
            return;
        }

        if (nextIdx >= ROSTER.length) {
            // Beat the game!
            try { localStorage.setItem('lotl_story_complete', 'true'); } catch (e) { }

            const newlyUnlocked = unlockFighter(this.p1.data.id);
            if (newlyUnlocked) {
                console.log(`%c[UNLOCK] You unlocked ${newlyUnlocked.name}!`, 'color: #00ff00; font-size: 16px; font-weight: bold;');
            }

            if (this.combatData && this.combatData.storyMode) {
                this._transitioning = true;
                this.game.stateManager.switchState('Story', {
                    ...STORY_EPILOGUE,
                    unlockedFighter: newlyUnlocked,
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
                });
            } else {
                this._newlyUnlocked = newlyUnlocked;
                this.matchPhase = 'VICTORY';
                this.inputCooldown = 60;
                this.game.audioManager.stopBGM();
            }
            return;
        }

        this._transitioning = true;
        this.startArcadeFight(nextIdx, this.arcadeWins + 1);
    }

    startArcadeFight(nextIdx, wins) {
        const player1 = this.combatData ? this.combatData.p1 : ROSTER[0];
        const opponent = ROSTER[nextIdx];
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);

        this.game.stateManager.switchState('VersusIntro', {
            p1: player1,
            p2: { ...opponent, rosterIndex: nextIdx },
            stageId: stageId,
            arcadeMode: true,
            storyMode: this.combatData ? this.combatData.storyMode : false,
            arcadeIndex: nextIdx,
            arcadeWins: wins,
        });
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
