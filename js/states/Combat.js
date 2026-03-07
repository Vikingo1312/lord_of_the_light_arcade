import Fighter from '../entities/Fighter.js';
import Projectile from '../entities/Projectile.js';
import Hitbox from '../entities/Hitbox.js';
import StageObjectManager from '../entities/StageObjects.js';
import { STAGES, ROSTER, unlockFighter } from '../data.js';
import { STORY_REFLEXION, STORY_EPILOGUE, STORY_OUTRO, STORY_BIRTHDAY } from '../story_data.js';

export default class CombatState {
    constructor(game) {
        this.game = game;
        this.p1 = null;
        this.p2 = null;
        this.stageId = 'Cosmic';
        this.bgMusic = null;

        // Match flow
        this.matchPhase = 'FIGHT_INTRO';
        this.timer = 99;
        this.introTimer = 0;
        this.koFreezeTimer = 0;
        this.winner = null;
        this.postMatchIndex = 0;
        this.inputCooldown = 0;
        this.combatData = null;

        // Screen Shake
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        // Hit Spark Particles
        this.particles = [];

        // Stage destructible objects
        this.stageObjects = new StageObjectManager(game);
    }

    enter(data) {
        console.log("Entering Combat State");
        this.combatData = data;

        // Arcade Mode tracking
        this.arcadeMode = (data && data.arcadeMode) || false;
        this.arcadeIndex = (data && data.arcadeIndex) || 1; // Start from ROSTER[1] (Hattori)
        this.arcadeWins = (data && data.arcadeWins) || 0;

        const p1Data = (data && data.p1) ? { id: data.p1.id, color: 'blue', name: data.p1.name } : { id: 'Keano', color: 'blue', name: 'Keano Romeo' };
        const p2Data = (data && data.p2) ? { id: data.p2.id, color: 'red', name: data.p2.name } : { id: 'Putin', color: 'red', name: 'Putin' };
        this.stageId = (data && data.stageId) ? data.stageId : 'Cosmic';

        this.p1 = new Fighter(this.game, p1Data, this.game.width * 0.25, this.game.height * 0.9, 1);
        this.p2 = new Fighter(this.game, p2Data, this.game.width * 0.75, this.game.height * 0.9, -1);

        this.matchPhase = 'FIGHT_INTRO';
        this.timer = (this.game.settings && this.game.settings.timer) || 99;
        this.introTimer = 0;
        this.koFreezeTimer = 0;
        this.winner = null;
        this.postMatchIndex = 0;
        this.inputCooldown = 45;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeIntensity = 0;
        this.particles = [];
        this.projectiles = [];
        this._transitioning = false;

        // Pause State
        this.paused = false;
        this.pauseSelection = 0; // 0 = Resume, 1 = Quit

        // Preload sprites (fire-and-forget, Fighter.draw has fallback rendering)
        if (data && data.p1) this.preloadFighterSprites(data.p1);
        if (data && data.p2) this.preloadFighterSprites(data.p2);
        this.game.assetManager.loadAll();

        // Initialize stage destructibles
        this.stageObjects.init(this.stageId);

        this.playStageMusic();

        // Announcer: "ROUND 1!"
        this.playAnnouncer('round_1');
        // Delayed "FIGHT!" after 1s
        this._fightAnnouncerTimeout = setTimeout(() => this.playAnnouncer('fight'), 1000);
        this._koAnnounced = false;

        // Add pause click listener
        this.game.canvas.addEventListener('mousedown', this._onMouseClick);
    }

    playStageMusic() {
        const stage = STAGES[this.stageId];
        // Combat always plays clean music. The muffled/low-pass effect is ONLY meant 
        // for narrative sequences (Prologue/Epilogue), not the actual fight.
        const useFilter = false;
        const volume = 0.4;
        const path = `assets/audio/music/${stage.music}`;

        // Kill any leftover audio from previous state before starting fresh
        this.game.audioManager.stopBGM();
        this.game.audioManager.playBGM(path, true, useFilter, volume);
    }

    exit() {
        // Only persist boss music if they won the FINAL stage of the Arcade/Story ladder
        // so that it flows seamlessly into the Epilogue and Outro sequences.
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

        // If already paused
        if (this.paused) {
            this.paused = false;
            return;
        }

        // Check top right corner for Menu button (approx x > width - 200, y < 80)
        if (x > this.game.width - 200 && y < 80) {
            this.paused = true;
            this.pauseSelection = 0;
        }
    };

    update(dt) {
        const p1 = this.game.inputManager.p1;

        if (p1.menuJust) {
            this.paused = !this.paused;
            this.pauseSelection = 0;
            return;
        }

        if (this.paused) {
            if (p1.down && !this.game.inputManager.p1Prev.down) this.pauseSelection = 1;
            if (p1.up && !this.game.inputManager.p1Prev.up) this.pauseSelection = 0;
            if (p1.lJust || p1.hJust || p1.sJust) {
                if (this.pauseSelection === 0) {
                    this.paused = false; // Resume
                } else {
                    this.game.stateManager.switchState('Menu'); // Quit
                }
            }
            return; // Skip all combat updates while paused
        }

        if (this.inputCooldown > 0) this.inputCooldown--;

        // ─── FIGHT INTRO ("ROUND 1 — FIGHT!" banner) ───
        if (this.matchPhase === 'FIGHT_INTRO') {
            this.introTimer += dt;
            // Phase 1: "ROUND X" for 1s, Phase 2: "FIGHT!" for 0.8s
            if (this.introTimer >= 1.8) {
                this.matchPhase = 'FIGHTING';
            }
            return;
        }

        // ─── POST MATCH ───
        if (this.matchPhase === 'POST_MATCH') {
            this.postMatchTimer = (this.postMatchTimer || 0) + dt;

            // Initialize auto-advance countdown (10 seconds)
            if (this.autoAdvanceTimer === undefined) {
                this.autoAdvanceTimer = 10.0;
            }

            if (this.inputCooldown <= 0 && !this._transitioning) {
                // Decrement auto-advance timer
                this.autoAdvanceTimer -= dt;

                // If the user presses a button OR the timer hits 0, trigger the confirm action
                const confirmPressed = p1.lJust || p1.hJust || p1.sJust;
                const timeOut = this.autoAdvanceTimer <= 0;

                if (this.arcadeMode) {
                    if (this.winner === 'p1') {
                        // AUTO ADVANCE TO NEXT STAGE (No button press required)
                        if (this.postMatchTimer > 2.0) {
                            const nextIdx = this.arcadeIndex + 1;

                            // STORY MODE MIDPOINT CHECK
                            if (nextIdx === 7 && this.combatData && this.combatData.storyMode) {
                                this._transitioning = true;
                                this.game.stateManager.switchState('Story', {
                                    ...STORY_REFLEXION,
                                    nextState: 'VersusIntro',
                                    nextData: {
                                        p1: this.p1.data,
                                        p2: { ...ROSTER[7], rosterIndex: 7 },
                                        stageId: ROSTER[7].stageId,
                                        arcadeMode: true,
                                        storyMode: true,
                                        arcadeIndex: 7,
                                        arcadeWins: this.arcadeWins + 1,
                                    }
                                });
                                return;
                            }
                            if (nextIdx >= ROSTER.length) {
                                // BEAT THE GAME!
                                try { localStorage.setItem('lotl_story_complete', 'true'); } catch (e) { }

                                const newlyUnlocked = unlockFighter(this.p1.data.id);
                                if (newlyUnlocked) {
                                    console.log(`%c[UNLOCK] You unlocked ${newlyUnlocked.name}!`, 'color: #00ff00; font-size: 16px; font-weight: bold;');
                                }

                                if (this.combatData && this.combatData.storyMode) {
                                    // STORY MODE: Play full voiceover sequences ending with Credits
                                    this._transitioning = true;
                                    this.game.stateManager.switchState('Story', {
                                        ...STORY_EPILOGUE,
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
                                    // ARCADE MODE: Skip voiceovers, go straight to Victory / Stats screen
                                    this._newlyUnlocked = newlyUnlocked;
                                    this.matchPhase = 'VICTORY';
                                    this.inputCooldown = 60; // Wait 1 second before allowing exit
                                    this.game.audioManager.stopBGM(); // Stop battle music
                                }
                                return;
                            }
                            // Just continue straight to the next fight!
                            this._transitioning = true;
                            this.startArcadeFight(nextIdx, this.arcadeWins + 1);
                        }
                    } else {
                        // Player lost — Continue or Quit
                        if (p1.up || p1.down) {
                            this.postMatchIndex = this.postMatchIndex === 0 ? 1 : 0;
                            this.inputCooldown = 10;
                            this.autoAdvanceTimer = 10.0; // Reset timer on input!
                        } else if (confirmPressed || timeOut) {
                            this._transitioning = true;
                            if (this.postMatchIndex === 0) {
                                // Retry same fight
                                this.game.stateManager.switchState('Combat', this.combatData);
                            } else {
                                this.game.stateManager.switchState('Menu');
                            }
                        }
                    }
                } else {
                    // Free battle post-match
                    if (p1.up) {
                        this.postMatchIndex = Math.max(0, this.postMatchIndex - 1);
                        this.inputCooldown = 10;
                        this.autoAdvanceTimer = 10.0; // Reset timer on input!
                    } else if (p1.down) {
                        this.postMatchIndex = Math.min(2, this.postMatchIndex + 1);
                        this.inputCooldown = 10;
                        this.autoAdvanceTimer = 10.0; // Reset timer on input!
                    } else if (confirmPressed || timeOut) {
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
                // In true Arcade without story sequences, just show Birthday reward
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
            // Slow-motion: run physics at 30% speed for dramatic effect
            const slowDt = dt * 0.3;
            this.koFreezeTimer += dt; // Real-time timer for phase transition
            const loser = this.winner === 'p1' ? this.p2 : this.p1;

            if (!this._koKnockbackApplied) {
                this._koKnockbackApplied = true;
                // Wide, arcing flyback — loser sails across the screen slowly
                loser.vx = loser.facing === 1 ? -350 : 350;
                loser.vy = -450;
                // 1-second screen shake, then stop instantly
                this.triggerShake(6, 1.0);
            }

            // Physics in slow-motion
            loser.vy += loser.gravity * slowDt;
            loser.y += loser.vy * slowDt;
            loser.x += loser.vx * slowDt;
            loser.vx *= 0.995; // Very gentle air friction for long flight

            if (loser.x < 50) { loser.x = 50; loser.vx *= -0.3; }
            if (loser.x > this.game.width - 50) { loser.x = this.game.width - 50; loser.vx *= -0.3; }

            const floorY = this.game.height * 0.9;
            if (loser.y > floorY) { loser.y = floorY; loser.vy = 0; loser.vx *= 0.3; }

            // After 1 second, kill the shake (hard cut)
            if (this.koFreezeTimer >= 1.0 && this.shakeTimer > 0) {
                this.shakeTimer = 0;
                this.shakeIntensity = 0;
            }

            // After 2 seconds of slow-mo, transition to POST_MATCH
            if (this.koFreezeTimer >= 2.0) {
                this.matchPhase = 'POST_MATCH';
                this.inputCooldown = 60;
                this.shakeTimer = 0;
                this.shakeIntensity = 0;
                // Set winner to victory pose
                const winner = this.winner === 'p1' ? this.p1 : this.p2;
                winner.state = 'WIN';
                // Play winner sound
                const winnerId = this.winner === 'p1' ? this.p1.data.id : this.p2.data.id;
                this.playFighterSound(winnerId, 'win');
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
            return;
        }

        // --- Input Processing ---
        // Create a copy of the input for P1 to prevent Fighter.js from reading modified keys
        const p1InputCopy = { ...p1 };

        // ALWAYS consume the raw Special intent from the Fighter 
        // We handle Specials entirely within Combat.js now (Projectiles)
        p1InputCopy.sJust = false;
        p1InputCopy.s = false;



        // Projectile (QCF + Light/Heavy OR dedicated 'Special' button)
        const isSpecialInput = p1.sJust || ((p1.lJust || p1.hJust) && this.game.inputManager.hasQCF(this.p1.facing));

        if (isSpecialInput) {
            if (this.p1.state === 'IDLE' || this.p1.state === 'WALK') {
                // Ensure player has enough Special Energy and no active projectiles
                if (this.p1.specialEnergy >= 100 && !this.projectiles.some(p => p.owner === 'p1' && p.alive)) {

                    // Consume Energy
                    this.p1.specialEnergy -= 100;

                    const imgKey = `${this.p1.data.id}_Cutin`;
                    const img = this.game.assetManager.images[imgKey];

                    if (!img) console.error("MISSING PROJECTILE IMAGE FOR:", imgKey);

                    this.projectiles.push(new Projectile(
                        this.p1.x + this.p1.facing * 80,
                        this.p1.y - 180,
                        this.p1.facing,
                        'p1',
                        img,
                        this.game
                    ));
                    this.game.inputManager.clearMotionHistory();
                    this.playCombatSound('special', this.p1.data.id);
                    this.triggerShake(2, 0.08);
                    this.p1.state = 'ATTACK';
                    this.p1.stateTimer = 0;
                    this.p1.currentAttack = { startup: 0.1, active: 0.05, recovery: 0.3, damage: 0, pushback: 0, hitstop: 0, box: null, type: 'SPECIAL' };

                    // Since a special was successfully cast, swallow the Light/Heavy inputs from Fighter.js 
                    // so we don't accidentally do a normal attack on the same frame.
                    p1InputCopy.lJust = false;
                    p1InputCopy.hJust = false;
                }
            }
        }

        const p2Input = this.processAI(dt);
        this.p1.update(dt, p1InputCopy);
        this.p2.update(dt, p2Input);

        // --- Prevent Screen Boundaries ---
        this.enforceBoundaries(this.p1);
        this.enforceBoundaries(this.p2);

        // --- Prevent Overlapping (Pushing) ---
        // If fighters are alive, GROUNDED, and walking into each other, push them apart
        // This allows them to jump OVER each other (cross-ups)
        if (this.p1.state !== 'KO' && this.p2.state !== 'KO' && this.p1.isGrounded && this.p2.isGrounded) {
            const minDistance = 110; // Reduced from 140 to allow closer combat range
            const dx = this.p2.x - this.p1.x;
            const dist = Math.abs(dx);

            if (dist < minDistance) {
                // They are too close! Push them apart evenly
                const overlap = (minDistance - dist) / 2;
                if (dx > 0) {
                    // P2 is on the right
                    this.p1.x -= overlap;
                    this.p2.x += overlap;
                } else {
                    // P1 is on the right
                    this.p1.x += overlap;
                    this.p2.x -= overlap;
                }
            }
        }

        // Re-enforce boundaries just in case pushing knocked them off-screen
        this.enforceBoundaries(this.p1);
        this.enforceBoundaries(this.p2);

        this.checkCombatCollisions();

        // Update projectiles
        for (const proj of this.projectiles) {
            proj.update(dt);
        }
        this.checkProjectileCollisions();
        this.projectiles = this.projectiles.filter(p => p.alive && p.x > -50 && p.x < this.game.width + 50);

        // Update particles & shake
        this.updateParticles(dt);
        this.stageObjects.update(dt);
        this.stageObjects.checkCollisions(this.p1, this.p2);
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        // Auto-facing (Immer den Gegner fixieren, auch beim Springen!)
        if (!this.game.settings || this.game.settings.autoFacingEnabled !== false) {
            // We only lock facing mid-attack so the animation doesn't flip halfway through a punch. 
            // We also add a small buffer (hysteresis) so they don't glitch if they stand exactly inside each other.
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

        // Check K.O.
        if (this.matchPhase !== 'KO_FREEZE' && this.matchPhase !== 'POST_MATCH' && this.matchPhase !== 'VICTORY') {
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
    }

    checkCombatCollisions() {
        // Check P1 hitting P2
        // Invincibility check: P2 cannot be hit by a basic attack if currently REELING on the ground.
        const p2CanBeHit = this.p2.state !== 'KO' &&
            !(this.p2.state === 'HIT' && this.p2.isGrounded && this.p1.currentAttack && !this.p1.currentAttack.lift && this.p1.currentAttack.type !== 'SPECIAL');

        if (this.p1.activeHitbox && p2CanBeHit) {
            const hitR = this.p1.activeHitbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);
            const hurtR = this.p2.hurtbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing);

            if (Hitbox.checkCollision(hitR, hurtR)) {
                const result = this.p2.takeDamage(this.p1.currentAttack, this.p1.facing);
                this.p1.attackHasHit = true; // Prevent multi-hit
                this.p1.hitStop = this.p1.currentAttack.hitstop;
                this.p1.activeHitbox = null;

                // Award Special Energy (Attacker gets 15 on hit, 5 on block / Defender gets 10)
                this.p1.specialEnergy = Math.min(this.p1.maxSpecialEnergy, this.p1.specialEnergy + (result === 'BLOCKED' ? 5 : 15));
                this.p2.specialEnergy = Math.min(this.p2.maxSpecialEnergy, this.p2.specialEnergy + 10);

                // Visual feedback
                const impactX = (this.p1.x + this.p2.x) / 2;
                const impactY = this.p2.y - 150;
                if (result === 'BLOCKED') {
                    this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
                    this.playCombatSound('block', this.p2.data.id);
                } else {
                    this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
                    this.playCombatSound('hit', this.p2.data.id);
                    if (this.p1.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
                    if (this.p2.hp <= 0 && !this._koAnnounced) {
                        this._koAnnounced = true;
                        this.playCombatSound('ko', this.p2.data.id);
                    }
                }
            }
        }

        // Check P2 hitting P1
        // Invincibility check: P1 cannot be hit by a basic attack if currently REELING on the ground.
        const p1CanBeHit = this.p1.state !== 'KO' &&
            !(this.p1.state === 'HIT' && this.p1.isGrounded && this.p2.currentAttack && !this.p2.currentAttack.lift && this.p2.currentAttack.type !== 'SPECIAL');

        if (this.p2.activeHitbox && p1CanBeHit) {
            const hitR = this.p2.activeHitbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing);
            const hurtR = this.p1.hurtbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);

            if (Hitbox.checkCollision(hitR, hurtR)) {
                const result = this.p1.takeDamage(this.p2.currentAttack, this.p2.facing);
                this.p2.attackHasHit = true; // Prevent multi-hit
                this.p2.hitStop = this.p2.currentAttack.hitstop;
                this.p2.activeHitbox = null;

                // Award Special Energy (Attacker gets 15 on hit, 5 on block / Defender gets 10)
                this.p2.specialEnergy = Math.min(this.p2.maxSpecialEnergy, this.p2.specialEnergy + (result === 'BLOCKED' ? 5 : 15));
                this.p1.specialEnergy = Math.min(this.p1.maxSpecialEnergy, this.p1.specialEnergy + 10);

                const impactX = (this.p1.x + this.p2.x) / 2;
                const impactY = this.p1.y - 150;
                if (result === 'BLOCKED') {
                    this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
                    this.playCombatSound('block', this.p1.data.id);
                } else {
                    this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
                    this.playCombatSound('hit', this.p1.data.id);
                    if (this.p2.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
                    if (this.p1.hp <= 0 && !this._koAnnounced) {
                        this._koAnnounced = true;
                        this.playCombatSound('ko', this.p1.data.id);
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

    checkProjectileCollisions() {
        for (const proj of this.projectiles) {
            if (!proj.alive) continue;
            const pRect = proj.getHitRect();

            // P1's projectile hits P2
            if (proj.owner === 'p1' && this.p2.state !== 'KO') {
                const hurtR = this.p2.hurtbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing);
                if (pRect.x < hurtR.x + hurtR.width && pRect.x + pRect.width > hurtR.x &&
                    pRect.y < hurtR.y + hurtR.height && pRect.y + pRect.height > hurtR.y) {
                    const result = this.p2.takeDamage(proj.getAttackDef(), proj.facing);
                    proj.alive = false;
                    this.spawnSparks(proj.x, proj.y, result === 'BLOCKED' ? '#00ccff' : '#ffaa00', '#fff', 8);
                    if (result !== 'BLOCKED') this.triggerShake(2, 0.08);
                    if (this.p2.hp <= 0 && !this._koAnnounced) {
                        this._koAnnounced = true;
                        this.playCombatSound('ko', this.p2.data.id);
                    }
                }
            }

            // P2's projectile hits P1
            if (proj.owner === 'p2' && this.p1.state !== 'KO') {
                const hurtR = this.p1.hurtbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);
                if (pRect.x < hurtR.x + hurtR.width && pRect.x + pRect.width > hurtR.x &&
                    pRect.y < hurtR.y + hurtR.height && pRect.y + pRect.height > hurtR.y) {
                    const result = this.p1.takeDamage(proj.getAttackDef(), proj.facing);
                    proj.alive = false;
                    this.spawnSparks(proj.x, proj.y, result === 'BLOCKED' ? '#00ccff' : '#ff4400', '#fff', 8);
                    if (result !== 'BLOCKED') this.triggerShake(2, 0.08);
                    if (this.p1.hp <= 0 && !this._koAnnounced) {
                        this._koAnnounced = true;
                        this.playCombatSound('ko', this.p1.data.id);
                    }
                }
            }
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 1500 * dt; // Gravity on sparks
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    async startArcadeFight(nextIdx, wins) {
        // Carry over the selected P1 character from the previous match!
        const player1 = this.combatData ? this.combatData.p1 : ROSTER[0];
        const opponent = ROSTER[nextIdx];
        const stageId = opponent.stageId;
        const stage = STAGES[stageId];

        // Preload combat sprites (match Fighter.draw() key format: '{id}_right.png' etc.)
        this.preloadFighterSprites(opponent);
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }
        await this.game.assetManager.loadAll();

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

    async startArcadeFightViaStory(nextIdx, wins, storyData) {
        // Carry over the selected P1 character from the previous match!
        const player1 = this.combatData ? this.combatData.p1 : ROSTER[0];
        const opponent = ROSTER[nextIdx];
        const stageId = opponent.stageId;
        const stage = STAGES[stageId];

        this.preloadFighterSprites(opponent);
        const stageKey = `Stage_${stageId}`;
        if (stage && !this.game.assetManager.images[stageKey]) {
            this.game.assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
        }
        await this.game.assetManager.loadAll();

        const combatData = {
            p1: player1,
            p2: { ...opponent, rosterIndex: nextIdx },
            stageId: stageId,
            arcadeMode: true,
            arcadeIndex: nextIdx,
            arcadeWins: wins,
        };

        // Route through story → then VS screen → then fight
        this.game.stateManager.switchState('Story', {
            ...storyData,
            nextState: 'VersusIntro',
            nextData: combatData,
        });
    }

    preloadFighterSprites(char) {
        // Fallback names for the actual sprite files in the directories
        // If a character uses specific prefixes (e.g., 'pablo_right.png' instead of just '_right.png')
        const prefixMap = {
            'Keano': 'keano', 'Hattori': 'hattori', 'Raheel': 'raheel',
            'Pablo': 'pablo', 'Tzubaza': 'tzubaza', 'AlCapone': 'capone',
            'Gargamel': 'gargamel', 'Marley': 'marley', 'Kowalski': 'kowalski',
            'Paco': 'paco', 'Juan': 'juan', 'Lee': 'lee',
            'JJDark': 'jayden', 'Putin': 'putin',
            'VikingoRaw': 'vikingo_shirtless', 'Vikingo': 'vikingo_coat',
            'SupremeKeano': 'keano', 'HyperKeano': 'keano',
            'JayX': 'jay_x', 'GargamelHoodie': 'gargamel'
        };
        const pfx = prefixMap[char.id] || char.id.toLowerCase();

        // The keys MUST MATCH what Fighter.js asks for: `${this.data.id}_right.png`
        // But the SOURCE FILE might be named `${pfx}_right.png` or just `_right.png`. 
        // We will queue the source using the standardized key.
        const suffixes = ['_right', '_left', '_front', '_punch', '_kick', '_hit', '_ko', '_special', '_win'];

        for (const suf of suffixes) {
            const key = `${char.id}${suf}.png`;
            if (!this.game.assetManager.images[key]) {
                // AssetManager check both prefixed and un-prefixed versions
                this.game.assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${pfx}${suf}.png`);
                this.game.assetManager.queueImage(key + '_fallback', `assets/CHARACTERS/${char.folder}/${suf}.png`);
            }
        }

        // Preload Special Cut-in portrait
        // Manual mapping for inconsistencies in the `fx/char_projectiles` folder
        const idMap = {
            'AlCapone': 'proj_al_capone.png',
            'JJDark': 'proj_jayden.png',
            'VikingoRaw': 'proj_dark_vikingo.png',
            'Vikingo': 'proj_vikingo_coat.png',
            'SupremeKeano': 'proj_supreme_keano.png',
            'HyperKeano': 'proj_0.2.Hyper_Keano.png',
            'JayX': 'proj_jay_x.png',
            'GargamelHoodie': 'proj_gargamel.png', // Fallback to base gargamel
            'Keano': 'proj_keano.png',
            'Pablo': 'proj_pablo.png'
        };

        const projFile = idMap[char.id] || `proj_${char.id.toLowerCase()}.png`;

        const cutinKey = `${char.id}_Cutin`;
        if (!this.game.assetManager.images[cutinKey]) {
            this.game.assetManager.queueImage(cutinKey, `assets/fx/char_projectiles/${projFile}`);
        }
    }

    // ─── REAL AUDIO SYSTEM ───

    /** Play an announcer sound (round_1, fight, ko, perfect, win, game_over, etc.) */
    playAnnouncer(type) {
        const path = `assets/audio/announcer_${type}.mp3`;
        this.game.audioManager.playSFX(path, true);  // isHeavy = loud
    }

    /** Play a fighter-specific sound (hit, ko, special, win, intro, taunt, super) */
    playFighterSound(fighterId, type) {
        const AUDIO_MAP = {
            'Keano': 'keano', 'Hattori': 'hattori', 'Raheel': 'raheel',
            'Pablo': 'pablo', 'Tzubaza': 'tzubaza', 'AlCapone': 'capone',
            'Gargamel': 'gargamel', 'Marley': 'marley', 'Kowalski': 'kowalski',
            'Paco': 'paco', 'Juan': 'juan', 'Lee': 'lee',
            'JJDark': 'jayden', 'Putin': 'putin', 'VikingoRaw': 'vikingo',
            'Vikingo': 'vikingo', 'SupremeKeano': 'keano', 'HyperKeano': 'keano',
            'JayX': 'jayden', 'GargamelHoodie': 'gargamel', 'Simba': 'keano' // Fallback to Keano if Simba has no custom voice
        };
        const prefix = AUDIO_MAP[fighterId] || fighterId.toLowerCase();

        // ALL character voice files live directly in assets/audio/
        const path = `assets/audio/${prefix}_${type}.mp3`;
        this.game.audioManager.playSFX(path, false);
    }

    /** Called during combat collisions — plays hit/ko sounds */
    playCombatSound(type, charId) {
        // Voice reaction and physical impact (The voice files include the smack sound natively)
        if (type === 'hit') this.playFighterSound(charId, 'hit');
        else if (type === 'ko') {
            this.playFighterSound(charId, 'ko');
            this.playAnnouncer('ko');
        } else if (type === 'special') {
            this.playFighterSound(charId, 'special');
        }
    }

    enforceBoundaries(f) {
        if (f.x < 150) f.x = 150;
        if (f.x > this.game.width - 150) f.x = this.game.width - 150;
    }

    processAI(dt) {
        const ai = { up: false, down: false, left: false, right: false, l: false, h: false, s: false, lJust: false, hJust: false, sJust: false };

        if (!this.p1 || !this.p2 || this.p2.state === 'KO' || this.p1.state === 'KO') {
            return ai;
        }

        const difficultySetting = this.game.settings?.difficulty || 'NORMAL';

        // ─── AI PACIFICATION (Cooldown Timer) ───
        if (typeof this.p2.aiWaitTimer === 'undefined') this.p2.aiWaitTimer = 0;
        if (this.p2.aiWaitTimer > 0) {
            this.p2.aiWaitTimer -= dt;
            // While waiting, occasionally block or just stand still
            if (Math.random() < 0.2) {
                if (this.p1.x > this.p2.x) ai.left = true;
                else ai.right = true;
            }
            return ai; // Skip all attack logic
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.up) {
                if (difficultySetting === 'EASY') this.p2.aiWaitTimer = 1.2 + Math.random();
                else if (difficultySetting === 'NORMAL') this.p2.aiWaitTimer = 0.5 + Math.random() * 0.5;
                else this.p2.aiWaitTimer = 0.1;
            } else if (Math.random() < 0.02) {
                if (difficultySetting === 'EASY') this.p2.aiWaitTimer = 0.6;
                else if (difficultySetting === 'NORMAL') this.p2.aiWaitTimer = 0.3;
            }
            return ai;
        };

        const dist = Math.abs(this.p1.x - this.p2.x);
        const p2HpPct = this.p2.hp / this.p2.maxHP;
        const p1HpPct = this.p1.hp / this.p1.maxHP;

        // Difficulty scales with roster position (0=easy, 14=hardest boss)
        // Scale from 0.1 (very easy) to 1.5 (hyper aggressive)
        const rosterIdx = this.combatData?.p2?.rosterIndex || 0;
        let diff = Math.min(1.5, 0.1 + (rosterIdx / 14) * 1.4);

        // ─── GLOBAL DIFFICULTY OVERRIDE ───
        if (difficultySetting === 'EASY') diff *= 0.3;
        else if (difficultySetting === 'HARD') diff *= 1.4;

        // ─── JUMP FREQUENCY BOOST ───
        // AI jumps much more often now, especially when at a distance
        const jumpChance = dist > 250 ? 0.04 * diff : 0.015 * diff;
        if (Math.random() < jumpChance && this.p2.isGrounded) {
            ai.up = true;
            if (dist <= 250) ai.hJust = true; // Jump kick if close enough 
        }

        // ─── PERFECT BLOCK CHECK ───
        // On Easy/Normal, the AI should make mistakes and eat hits.
        // It only gets to perfectly hold BACK against an attack if it passes this check.
        const seesAttack = this.p1.state === 'ATTACK' && dist < 250;
        if (seesAttack) {
            if (Math.random() < diff * 0.4) {
                // Successful Block!
                if (this.p1.x > this.p2.x) ai.left = true;
                else ai.right = true;
            } else {
                // Failed Block! Stand still and eat the punch like a man.
                ai.left = false;
                ai.right = false;
            }
            return applyCooldown();
        }

        // ─── LOW HP: Play defensively ───
        if (p2HpPct < 0.25 && Math.random() < 0.3) {
            // Desperate retreat + occasional lunge
            if (dist < 200) {
                if (this.p1.x > this.p2.x) ai.left = true;
                else ai.right = true;
            }
            if (dist < 150 && Math.random() < diff * 0.15) {
                if (this.p2.specialEnergy >= 100) ai.sJust = true;
                else ai.hJust = true; // Fallback to heavy
            }
            return applyCooldown();
        }

        // ─── APPROACH ZONE (far away) ───
        if (dist > 300) {
            if (this.p1.x > this.p2.x) ai.right = true;
            else ai.left = true;

            // Jump-in approach (bosses do this more)
            if (Math.random() < 0.015 * diff && this.p2.isGrounded) ai.up = true;

            // AI fires projectile from far range (harder opponents do this more)
            if (Math.random() < diff * 0.005 && (this.p2.state === 'IDLE' || this.p2.state === 'WALK')) {
                if (this.p2.specialEnergy >= 100 && !this.projectiles.some(p => p.owner === 'p2')) {
                    this.p2.specialEnergy -= 100;
                    const imgKey = `${this.p2.data.id}_Cutin`;
                    const img = this.game.assetManager.images[imgKey];

                    this.projectiles.push(new Projectile(
                        this.p2.x + this.p2.facing * 80,
                        this.p2.y - 180,
                        this.p2.facing,
                        'p2',
                        img,
                        this.game
                    ));
                    this.playCombatSound('special', this.p2.data.id);
                    this.triggerShake(2, 0.08);
                    this.p2.state = 'ATTACK';
                    this.p2.stateTimer = 0;
                    this.p2.currentAttack = { startup: 0.1, active: 0.05, recovery: 0.3, damage: 0, pushback: 0, hitstop: 0, box: null, type: 'SPECIAL' };
                }
            }

            // ─── STRIKE ZONE (close) ───
        } else if (dist <= 180) {
            if (this.p2.state === 'IDLE' || this.p2.state === 'WALK') {
                const rand = Math.random();
                // Aggressive attack multiplier drops significantly on Easy
                const attackChance = Math.min(0.9, diff * 0.4);

                if (rand < attackChance) {
                    const mixup = Math.random();
                    if (mixup < 0.2) {
                        if (this.p2.specialEnergy >= 100) ai.sJust = true;
                        else ai.hJust = true; // Fallback
                    }
                    else if (mixup < 0.6) ai.hJust = true;  // 40% Heavy
                    else ai.lJust = true;                   // 40% Light
                } else {
                    // Weaving and Retreating Strategy
                    const retreatThreshold = Math.max(0.4, 0.9 - (1.0 - diff) * 0.4);
                    if (rand > retreatThreshold) {
                        // Flawed retreat!
                        // If AI holds BACK, it becomes invincible to attacks.
                        // So on Easy/Normal, we sometimes force them to walk FORWARD or stand still during footsies
                        if (Math.random() > diff) {
                            if (this.p1.x > this.p2.x) ai.right = true; // Walk towards
                            else ai.left = true;
                        } else {
                            if (this.p1.x > this.p2.x) ai.left = true; // Walk away
                            else ai.right = true;
                        }
                    }
                }
            }
            // Jump attack (close range)
            if (Math.random() < diff * 0.05 && this.p2.isGrounded) {
                ai.up = true;
                ai.hJust = true;
            }

            // ─── FOOTSIES ZONE (mid-range) ───
        } else {
            // Aggressively close the gap based on diff.
            // Easy: Might wander backwards. Hard: Runs straight at you.
            const advanceChance = Math.min(0.85, 0.30 + diff * 0.4);
            if (Math.random() < advanceChance) {
                if (this.p1.x > this.p2.x) ai.right = true;
                else ai.left = true;
            } else {
                if (this.p1.x > this.p2.x) ai.left = true;
                else ai.right = true;
            }

            // Dash-in heavy/light attack at mid range
            if (Math.random() < diff * 0.08 && (this.p2.state === 'IDLE' || this.p2.state === 'WALK')) {
                if (this.p1.x > this.p2.x) ai.right = true;
                else ai.left = true;
                if (Math.random() > 0.5) ai.hJust = true;
                else ai.lJust = true;
            }
        }

        return applyCooldown();
    }

    draw(ctx) {
        ctx.save();

        // Screen Shake offset
        if (this.shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
            const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
            ctx.translate(sx, sy);
        }

        // 1. Draw Dynamic Stage Background
        const stageKey = `Stage_${this.stageId}`;
        const bg = this.game.assetManager.images[stageKey] || this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#0a0011';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        // 2. Draw Stage Objects (BEHIND fighters)
        this.stageObjects.draw(ctx);

        // 3. Draw Fighters
        if (this.p1.state === 'ATTACK') {
            this.p2.draw(ctx);
            this.p1.draw(ctx);
        } else {
            this.p1.draw(ctx);
            this.p2.draw(ctx);
        }

        // 2.3 Draw Projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx);
        }

        // 2.5 Draw Hit Sparks
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

        // 3. HUD
        this.drawHUD(ctx);

        // 4. Overlays per match phase
        if (this.matchPhase === 'FIGHT_INTRO') {
            this.drawFightIntro(ctx);
        } else if (this.matchPhase === 'KO_FREEZE') {
            this.drawKO(ctx);
        } else if (this.matchPhase === 'POST_MATCH') {
            this.drawKO(ctx);
            this.drawPostMatch(ctx);
        } else if (this.matchPhase === 'VICTORY') {
            this.drawVictory(ctx);
        }

        // 5. Pause Screen Overlay
        if (this.paused) {
            this.drawPause(ctx);
        }
    }

    drawPause(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', cx, cy - 80);

        const options = ['RESUME FIGHT', 'QUIT TO MENU'];
        ctx.font = 'bold 36px "Press Start 2P"';
        for (let i = 0; i < options.length; i++) {
            const y = cy + 40 + (i * 80);
            ctx.fillStyle = this.pauseSelection === i ? '#ff0055' : '#888';
            ctx.fillText(this.pauseSelection === i ? `> ${options[i]} <` : options[i], cx, y);
        }
    }

    drawHUD(ctx) {
        const cx = this.game.width / 2;

        // Timer
        ctx.fillStyle = '#fdbf00';
        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(this.timer).toString(), cx, 120);

        // Names
        ctx.fillStyle = 'white';
        ctx.font = '30px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(this.p1.data.name.toUpperCase(), 100, 70);
        ctx.textAlign = 'right';
        ctx.fillText(this.p2.data.name.toUpperCase(), this.game.width - 100, 70);

        // Health Bars
        const barW = 600, barH = 40, barY = 90;
        const p1X = 100;
        const p2X = this.game.width - 100 - barW;

        // Backgrounds (red)
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(p1X, barY, barW, barH);
        ctx.fillRect(p2X, barY, barW, barH);

        // P1 Health (green → yellow → red)
        const p1Pct = Math.max(0, this.p1.hp / this.p1.maxHP);
        ctx.fillStyle = p1Pct > 0.5 ? '#00ff00' : (p1Pct > 0.25 ? '#ffff00' : '#ff4400');
        ctx.fillRect(p1X, barY, barW * p1Pct, barH);

        // P2 Health
        const p2Pct = Math.max(0, this.p2.hp / this.p2.maxHP);
        ctx.fillStyle = p2Pct > 0.5 ? '#00ff00' : (p2Pct > 0.25 ? '#ffff00' : '#ff4400');
        const p2W = barW * p2Pct;
        ctx.fillRect(p2X + (barW - p2W), barY, p2W, barH);

        // Bar outlines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p1X, barY, barW, barH);
        ctx.strokeRect(p2X, barY, barW, barH);

        // Menu Pause Button
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.game.width - 150, 10, 140, 50);
        ctx.strokeStyle = '#888';
        ctx.strokeRect(this.game.width - 150, 10, 140, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('MENU', this.game.width - 80, 42);

        // ─── SPECIAL ENERGY METERS ───
        const spH = 15;
        const spY = barY + barH + 10;

        // Background (dark blue)
        ctx.fillStyle = '#001133';
        ctx.fillRect(p1X, spY, barW, spH);
        ctx.fillRect(p2X, spY, barW, spH);

        // P1 Special (Cyan)
        const p1SpPct = Math.max(0, this.p1.specialEnergy / this.p1.maxSpecialEnergy);
        const p1SpReady = p1SpPct >= 1.0;
        ctx.fillStyle = p1SpReady ? (Math.floor(this.time * 10) % 2 === 0 ? '#ffffff' : '#00ffff') : '#0088cc';
        ctx.fillRect(p1X, spY, barW * p1SpPct, spH);

        // P2 Special (Cyan)
        const p2SpPct = Math.max(0, this.p2.specialEnergy / this.p2.maxSpecialEnergy);
        const p2SpReady = p2SpPct >= 1.0;
        ctx.fillStyle = p2SpReady ? (Math.floor(this.time * 10) % 2 === 0 ? '#ffffff' : '#00ffff') : '#0088cc';
        const p2SpW = barW * p2SpPct;
        ctx.fillRect(p2X + (barW - p2SpW), spY, p2SpW, spH);

        // Special outlines
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p1X, spY, barW, spH);
        ctx.strokeRect(p2X, spY, barW, spH);
    }

    drawFightIntro(ctx) {
        const cx = this.game.width / 2;
        const cy = this.game.height / 2;
        ctx.textAlign = 'center';

        if (this.introTimer < 1.0) {
            // Phase 1: "ROUND 1" (0-1s) with scale-in
            const t = this.introTimer;
            const scale = Math.min(1, t * 4); // Scale in from 0 to 1 in 0.25s
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.font = 'bold 100px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 20;
            ctx.fillText('ROUND 1', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        } else {
            // Phase 2: "FIGHT!" (1s-1.8s) with dramatic flash
            const t = this.introTimer - 1.0;
            const flash = Math.max(0, 1 - t * 3);
            if (flash > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.4})`;
                ctx.fillRect(0, 0, this.game.width, this.game.height);
            }
            const bounce = 1 + Math.sin(t * 12) * 0.05;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(bounce, bounce);
            ctx.font = 'bold 180px "Press Start 2P"';
            ctx.fillStyle = '#ff3300';
            ctx.shadowColor = '#fdbf00';
            ctx.shadowBlur = 30;
            ctx.fillText('FIGHT!', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    drawKO(ctx) {
        const cx = this.game.width / 2;
        const cy = this.game.height / 2;
        ctx.textAlign = 'center';

        // Dramatic dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        // K.O. text with pulse
        const pulse = 1 + Math.sin(this.koFreezeTimer * 6) * 0.03;

        // Cinematic view: hide K.O. after 1.5 seconds so we can see the slow-mo body flying
        if (this.koFreezeTimer < 1.5) {
            ctx.save();
            ctx.translate(cx, cy - 40);
            ctx.scale(pulse, pulse);
            ctx.font = 'bold 180px "Press Start 2P"';
            ctx.fillStyle = '#ff0000';
            ctx.strokeStyle = '#fdbf00';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 20;
            ctx.strokeText('K.O.', 0, 0);
            ctx.fillText('K.O.', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Delay the "PERFECT" or "WINNER" text until the very end of the sequence when the body hits the floor
        if (this.koFreezeTimer >= 3.0) {
            const winnerFighter = this.winner === 'p1' ? this.p1 : this.p2;
            if (winnerFighter.hp >= winnerFighter.maxHP) {
                ctx.font = 'bold 60px "Press Start 2P"';
                ctx.fillStyle = '#fdbf00';
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 15;
                ctx.fillText('PERFECT', cx, cy + 60);
                ctx.shadowBlur = 0;
                if (!this._perfectAnnounced) {
                    this._perfectAnnounced = true;
                    this.playAnnouncer('perfect');
                }
            } else {
                // Winner name
                const winnerName = this.winner === 'p1' ? this.p1.data.name : this.p2.data.name;
                ctx.font = 'bold 60px "Press Start 2P"';
                ctx.fillStyle = '#fdbf00';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 10;
                ctx.fillText(`${winnerName.toUpperCase()} WINS!`, cx, cy + 60);
                ctx.shadowBlur = 0;
            }
        }
    }

    drawPostMatch(ctx) {
        const cx = this.game.width / 2;
        const startY = this.game.height * 0.68;

        // Draw Countdown Warning
        if (this.autoAdvanceTimer !== undefined && (!this.arcadeMode || this.winner !== 'p1')) {
            const timeRemaining = Math.ceil(this.autoAdvanceTimer);
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.textAlign = 'center';
            if (timeRemaining <= 3 && Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.fillStyle = '#ff0000'; // Flash red
            } else {
                ctx.fillStyle = '#ffff00'; // Steady yellow
            }
            ctx.fillText(`AUTO ADVANCE: ${timeRemaining}`, cx, startY - 70);
        }

        if (this.arcadeMode) {
            // Arcade progress bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(cx - 300, startY - 40, 600, 160); // Narrower box so the winner can be seen on the sides

            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#888';
            ctx.fillText(`FIGHT ${this.arcadeIndex} / ${ROSTER.length - 1}`, cx, startY - 5);

            if (this.winner === 'p1') {
                // Auto Advance (no text)
            } else {
                const lossOpts = ['CONTINUE?', 'GIVE UP'];
                ctx.font = 'bold 32px "Press Start 2P"';
                for (let i = 0; i < lossOpts.length; i++) {
                    const y = startY + 40 + i * 55;
                    ctx.fillStyle = i === this.postMatchIndex ? '#ff0055' : '#666';
                    ctx.fillText(i === this.postMatchIndex ? `> ${lossOpts[i]} <` : lossOpts[i], cx, y);
                }
            }
        } else {
            // Free battle options
            const options = ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'];
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(cx - 300, startY - 40, 600, options.length * 65 + 30);
            ctx.font = 'bold 32px "Press Start 2P"';
            ctx.textAlign = 'center';
            for (let i = 0; i < options.length; i++) {
                const y = startY + i * 65;
                ctx.fillStyle = i === this.postMatchIndex ? '#00ffff' : '#888888';
                ctx.fillText(i === this.postMatchIndex ? `> ${options[i]} <` : options[i], cx, y);
            }
        }
    }

    drawVictory(ctx) {
        // Full screen overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        const cx = this.game.width / 2;
        const cy = this.game.height / 2;
        ctx.textAlign = 'center';

        // Title
        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.shadowColor = '#fdbf00';
        ctx.shadowBlur = 30;
        ctx.fillText('CHAMPION', cx, cy - 60);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('YOU CONQUERED ALL 14 WARRIORS!', cx, cy + 10);

        ctx.font = '24px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`WINS: ${this.arcadeWins + 1}`, cx, cy + 60);

        // Show Unlocked Character if any
        if (this._newlyUnlocked) {
            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.fillText(`BLOODLINE UNLOCKED:`, cx, cy + 110);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this._newlyUnlocked.name.toUpperCase(), cx, cy + 140);
            ctx.shadowBlur = 0;

            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('PRESS ATTACK TO VIEW CREDITS', cx, cy + 200);
        } else {
            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('PRESS ATTACK TO VIEW CREDITS', cx, cy + 140);
        }
    }
}
