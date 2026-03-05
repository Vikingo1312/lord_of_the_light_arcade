import Fighter from '../entities/Fighter.js';
import Projectile from '../entities/Projectile.js';
import Hitbox from '../entities/Hitbox.js';
import StageObjectManager from '../entities/StageObjects.js';
import { STAGES, ROSTER } from '../data.js';
import { STORY_REFLEXION, STORY_EPILOGUE, STORY_OUTRO } from '../story_data.js';

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
        this.particles = [];
        this.projectiles = [];
        this._transitioning = false;

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
    }

    playStageMusic() {
        const stage = STAGES[this.stageId];
        if (stage && stage.music) {
            // Valhalla uses main_soundtrack.mp3 but without a filter.
            // Other stages use their respective tracks. We'll disable the low-pass filter
            // for all standard combat scenarios.
            const useFilter = false;
            const volume = 0.4;
            const path = `assets/audio/music/${stage.music}`;

            this.game.audioManager.playBGM(path, true, useFilter, volume);
        }
    }

    exit() {
        // If this is the Boss fight (Valhalla), DO NOT stop the music!
        // It needs to persist smoothly into the Epilogue and Outro story sequences.
        if (this.stageId !== 'Valhalla') {
            this.game.audioManager.stopBGM();
        }
    }

    update(dt) {
        if (this.inputCooldown > 0) this.inputCooldown--;
        const p1 = this.game.inputManager.p1;

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
            if (this.inputCooldown <= 0 && !this._transitioning) {
                if (this.arcadeMode) {
                    if (this.winner === 'p1') {
                        if (p1.lJust || p1.hJust || p1.sJust) {
                            const nextIdx = this.arcadeIndex + 1;
                            if (nextIdx >= ROSTER.length) {
                                // BEAT THE GAME! → Save completion + Epilogue
                                try { localStorage.setItem('lotl_story_complete', 'true'); } catch (e) { }
                                this._transitioning = true;
                                this.game.stateManager.switchState('Story', {
                                    ...STORY_EPILOGUE,
                                    nextState: 'Story',
                                    nextData: {
                                        ...STORY_OUTRO,
                                        nextState: 'Menu',
                                        nextData: null,
                                    },
                                });
                                return;
                            }
                            // After fight 7 → Reflexion, then continue
                            if (this.arcadeIndex === 7) {
                                this._transitioning = true;
                                this.startArcadeFightViaStory(nextIdx, this.arcadeWins + 1, STORY_REFLEXION);
                            } else {
                                this._transitioning = true;
                                this.startArcadeFight(nextIdx, this.arcadeWins + 1);
                            }
                        }
                    } else {
                        // Player lost — Continue or Quit
                        if (p1.up || p1.down) {
                            this.postMatchIndex = this.postMatchIndex === 0 ? 1 : 0;
                            this.inputCooldown = 10;
                        } else if (p1.lJust || p1.hJust || p1.sJust) {
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
                    } else if (p1.down) {
                        this.postMatchIndex = Math.min(2, this.postMatchIndex + 1);
                        this.inputCooldown = 10;
                    } else if (p1.l || p1.h || p1.s) {
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
                this.game.stateManager.switchState('Menu');
            }
            return;
        }

        // ─── KO FREEZE (SF2 slow-motion knockback) ───
        if (this.matchPhase === 'KO_FREEZE') {
            this.koFreezeTimer += dt;

            // Only shake for the first 0.4 seconds of the KO, then stop shaking
            if (this.koFreezeTimer < 0.4) {
                this.triggerShake(5, 0.1);
            } else {
                this.shakeTimer = 0;
            }

            // Slow-motion physics for the KO'd fighter (0.25x speed)
            const slowDt = dt * 0.25;
            const loser = this.winner === 'p1' ? this.p2 : this.p1;

            // Apply massive knockback velocity if they just got KO'd
            if (this.koFreezeTimer < 0.1) {
                const knockbackDirection = loser === this.p2 ? 1 : -1;
                loser.vx = 800 * knockbackDirection;
                loser.vy = -600; // Launch them up
            }

            loser.vy += loser.gravity * slowDt;
            loser.y += loser.vy * slowDt;
            loser.x += loser.vx * slowDt;

            // Less friction in the air so they fly further
            if (loser.vy < 0) {
                loser.vx *= 0.99;
            } else {
                loser.vx *= 0.95; // Ground friction
            }

            const floorY = this.game.height * 0.9;
            if (loser.y > floorY) { loser.y = floorY; loser.vy = 0; }

            if (this.koFreezeTimer >= 3.0) { // Keep them on the ground slightly longer before post-match
                this.matchPhase = 'POST_MATCH';
                this.inputCooldown = 60;
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

        // QCF + Attack = Hadouken (P1)
        if (this.p1.state === 'IDLE' && (p1.lJust || p1.hJust) &&
            this.game.inputManager.hasQCF(this.p1.facing)) {
            this.projectiles.push(new Projectile(
                this.p1.x + this.p1.facing * 80,
                this.p1.y - 150,
                this.p1.facing,
                'p1'
            ));
            this.game.inputManager.clearMotionHistory();
            this.playCombatSound('special', this.p1.data.id);
            this.triggerShake(2, 0.08);
            this.p1.state = 'ATTACK';
            this.p1.stateTimer = 0;
            this.p1.currentAttack = { startup: 0.1, active: 0.05, recovery: 0.3, damage: 0, pushback: 0, hitstop: 0, box: null, type: 'SPECIAL' };
        }

        const p2Input = this.processAI(dt);
        this.p1.update(dt, p1);
        this.p2.update(dt, p2Input);
        this.checkCombatCollisions();
        this.enforceBoundaries(this.p1);
        this.enforceBoundaries(this.p2);

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

        // Auto-facing
        if (this.p1.isGrounded && this.p2.isGrounded && this.p1.state !== 'ATTACK' && this.p2.state !== 'ATTACK') {
            if (this.p1.x > this.p2.x) {
                this.p1.facing = -1;
                this.p2.facing = 1;
            } else {
                this.p1.facing = 1;
                this.p2.facing = -1;
            }
        }

        // Check K.O.
        if (this.p1.state === 'KO') {
            this.winner = 'p2';
            this.matchPhase = 'KO_FREEZE';
            this.koFreezeTimer = 0;
        } else if (this.p2.state === 'KO') {
            this.winner = 'p1';
            this.matchPhase = 'KO_FREEZE';
            this.koFreezeTimer = 0;
        }
    }

    checkCombatCollisions() {
        // Check P1 hitting P2
        if (this.p1.activeHitbox && this.p2.state !== 'KO') {
            const hitR = this.p1.activeHitbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);
            const hurtR = this.p2.hurtbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing);

            if (Hitbox.checkCollision(hitR, hurtR)) {
                const result = this.p2.takeDamage(this.p1.currentAttack, this.p1.facing);
                this.p1.hitStop = this.p1.currentAttack.hitstop;
                this.p1.activeHitbox = null;

                // Visual feedback
                const impactX = (this.p1.x + this.p2.x) / 2;
                const impactY = this.p2.y - 150;
                if (result === 'BLOCKED') {
                    this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
                    this.playCombatSound('block', this.p1.data.id);
                } else {
                    this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
                    this.playCombatSound('hit', this.p1.data.id);
                    if (this.p1.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
                    if (this.p2.state === 'KO') this.playCombatSound('ko', this.p2.data.id);
                }
            }
        }

        // Check P2 hitting P1
        if (this.p2.activeHitbox && this.p1.state !== 'KO') {
            const hitR = this.p2.activeHitbox.getWorldRect(this.p2.x, this.p2.y, this.p2.facing);
            const hurtR = this.p1.hurtbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);

            if (Hitbox.checkCollision(hitR, hurtR)) {
                const result = this.p1.takeDamage(this.p2.currentAttack, this.p2.facing);
                this.p2.hitStop = this.p2.currentAttack.hitstop;
                this.p2.activeHitbox = null;

                const impactX = (this.p1.x + this.p2.x) / 2;
                const impactY = this.p1.y - 150;
                if (result === 'BLOCKED') {
                    this.spawnSparks(impactX, impactY, '#00ccff', '#ffffff', 6);
                    this.playCombatSound('block', this.p2.data.id);
                } else {
                    this.spawnSparks(impactX, impactY, '#ffaa00', '#ff4400', 10);
                    this.playCombatSound('hit', this.p2.data.id);
                    if (this.p2.currentAttack.damage >= 12) this.triggerShake(3, 0.12);
                    if (this.p1.state === 'KO') this.playCombatSound('ko', this.p1.data.id);
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
                if (pRect.x < hurtR.x + hurtR.w && pRect.x + pRect.w > hurtR.x &&
                    pRect.y < hurtR.y + hurtR.h && pRect.y + pRect.h > hurtR.y) {
                    const result = this.p2.takeDamage(proj.getAttackDef(), proj.facing);
                    proj.alive = false;
                    this.spawnSparks(proj.x, proj.y, result === 'BLOCKED' ? '#00ccff' : '#ffaa00', '#fff', 8);
                    if (result !== 'BLOCKED') this.triggerShake(2, 0.08);
                }
            }

            // P2's projectile hits P1
            if (proj.owner === 'p2' && this.p1.state !== 'KO') {
                const hurtR = this.p1.hurtbox.getWorldRect(this.p1.x, this.p1.y, this.p1.facing);
                if (pRect.x < hurtR.x + hurtR.w && pRect.x + pRect.w > hurtR.x &&
                    pRect.y < hurtR.y + hurtR.h && pRect.y + pRect.h > hurtR.y) {
                    const result = this.p1.takeDamage(proj.getAttackDef(), proj.facing);
                    proj.alive = false;
                    this.spawnSparks(proj.x, proj.y, result === 'BLOCKED' ? '#00ccff' : '#ff4400', '#fff', 8);
                    if (result !== 'BLOCKED') this.triggerShake(2, 0.08);
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
        const keano = ROSTER[0];
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
            p1: keano,
            p2: { ...opponent, rosterIndex: nextIdx },
            stageId: stageId,
            arcadeMode: true,
            arcadeIndex: nextIdx,
            arcadeWins: wins,
        });
    }

    async startArcadeFightViaStory(nextIdx, wins, storyData) {
        const keano = ROSTER[0];
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
            p1: keano,
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
        const suffixes = ['_right', '_left', '_front', '_punch', '_kick', '_hit', '_ko', '_special', '_win'];
        for (const suf of suffixes) {
            const key = `${char.id}${suf}.png`;
            if (!this.game.assetManager.images[key]) {
                this.game.assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${suf}.png`);
            }
        }
    }

    // ─── REAL AUDIO SYSTEM ───

    /** Play an announcer sound (round_1, fight, ko, perfect, win, game_over, etc.) */
    playAnnouncer(type) {
        try {
            const a = new Audio(`assets/audio/announcer_${type}.mp3`);
            a.volume = (this.game.settings && this.game.settings.voiceVolume) || 0.9;
            a.play().catch(() => { });
        } catch (e) { }
    }

    /** Play a fighter-specific sound (hit, ko, special, win, intro, taunt, super) */
    playFighterSound(fighterId, type) {
        try {
            const AUDIO_MAP = {
                'Keano': 'keano', 'Hattori': 'hattori', 'Raheel': 'raheel',
                'Pablo': 'pablo', 'Tzubaza': 'tzubaza', 'AlCapone': 'capone',
                'Gargamel': 'gargamel', 'Marley': 'marley', 'Kowalski': 'kowalski',
                'Paco': 'paco', 'Juan': 'juan', 'Lee': 'lee',
                'JJDark': 'jayden', 'Putin': 'putin', 'VikingoRaw': 'vikingo',
            };
            const prefix = AUDIO_MAP[fighterId] || fighterId.toLowerCase();
            const a = new Audio(`assets/audio/${prefix}_${type}.mp3`);
            a.volume = (this.game.settings && this.game.settings.sfxVolume) || 0.5;
            a.play().catch(() => { });
        } catch (e) { }
    }

    /** Called during combat collisions — plays hit/block/ko sounds */
    playCombatSound(type, charId) {
        if (type === 'hit') this.playFighterSound(charId, 'hit');
        else if (type === 'ko') {
            this.playFighterSound(charId, 'ko');
            this.playAnnouncer('ko');
        }
    }

    enforceBoundaries(f) {
        if (f.x < 60) f.x = 60;
        if (f.x > this.game.width - 60) f.x = this.game.width - 60;
    }

    processAI(dt) {
        const ai = { up: false, down: false, left: false, right: false, l: false, h: false, s: false };

        if (!this.p1 || !this.p2 || this.p2.state === 'KO' || this.p1.state === 'KO') {
            return ai;
        }

        const dist = Math.abs(this.p1.x - this.p2.x);
        const p2HpPct = this.p2.hp / this.p2.maxHP;
        const p1HpPct = this.p1.hp / this.p1.maxHP;

        // Difficulty scales with roster position (0=easy, 14=hardest boss)
        const rosterIdx = this.combatData?.p2?.rosterIndex || 0;
        const diff = Math.min(1.0, 0.3 + (rosterIdx / 14) * 0.7);
        // diff: 0.3 (Hattori) → 1.0 (Dark Vikingo)

        // ─── DEFENSIVE: Block when P1 is attacking nearby ───
        if (this.p1.state === 'ATTACK' && dist < 250 && Math.random() < diff * 0.6) {
            // Retreat away from P1
            if (this.p1.x > this.p2.x) ai.left = true;
            else ai.right = true;
            return ai;
        }

        // ─── LOW HP: Play defensively ───
        if (p2HpPct < 0.25 && Math.random() < 0.3) {
            // Desperate retreat + occasional lunge
            if (dist < 200) {
                if (this.p1.x > this.p2.x) ai.left = true;
                else ai.right = true;
            }
            if (dist < 150 && Math.random() < diff * 0.12) {
                ai.s = true; // Desperate special
            }
            return ai;
        }

        // ─── APPROACH ZONE (far away) ───
        if (dist > 300) {
            if (this.p1.x > this.p2.x) ai.right = true;
            else ai.left = true;

            // Jump-in approach
            if (Math.random() < 0.01 * diff && this.p2.isGrounded) ai.up = true;

            // AI fires projectile from far range (harder opponents do this more)
            if (Math.random() < diff * 0.004 && this.p2.state === 'IDLE') {
                this.projectiles.push(new Projectile(
                    this.p2.x + this.p2.facing * 80,
                    this.p2.y - 150,
                    this.p2.facing,
                    'p2'
                ));
                this.p2.state = 'ATTACK';
                this.p2.stateTimer = 0;
                this.p2.currentAttack = { startup: 0.1, active: 0.05, recovery: 0.3, damage: 0, pushback: 0, hitstop: 0, box: null };
            }

            // ─── STRIKE ZONE (close) ───
        } else if (dist <= 180) {
            if (this.p2.state === 'IDLE') {
                const rand = Math.random();
                const attackChance = diff * 0.08; // 2.4% for easy, 8% for boss

                if (rand < attackChance * 0.3) {
                    ai.h = true; // Heavy punch
                } else if (rand < attackChance * 0.6) {
                    ai.l = true; // Light punch
                } else if (rand < attackChance) {
                    ai.s = true; // Special/kick
                }
            }
            // Jump attack (boss does this more)
            if (Math.random() < diff * 0.008 && this.p2.isGrounded) {
                ai.up = true;
                ai.l = true;
            }

            // ─── FOOTSIES ZONE (mid-range) ───
        } else {
            if (Math.random() < 0.04 + diff * 0.04) {
                if (this.p1.x > this.p2.x) ai.right = true;
                else ai.left = true;
            }
            // Dash-in kick at mid range
            if (Math.random() < diff * 0.02 && this.p2.state === 'IDLE') {
                if (this.p1.x > this.p2.x) ai.right = true;
                else ai.left = true;
                ai.l = true;
            }
        }

        return ai;
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

        // 2. Draw Fighters
        if (this.p1.state === 'ATTACK') {
            this.p2.draw(ctx);
            this.p1.draw(ctx);
        } else {
            this.p1.draw(ctx);
            this.p2.draw(ctx);
        }

        // 2.2 Draw Stage Objects (in foreground, overlapping feet)
        this.stageObjects.draw(ctx);

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

        // 3. HUD
        this.drawHUD(ctx);

        ctx.restore();

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

        // PERFECT if winner has full HP
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

    drawPostMatch(ctx) {
        const cx = this.game.width / 2;
        const startY = this.game.height * 0.68;

        if (this.arcadeMode) {
            // Arcade progress bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(cx - 400, startY - 40, 800, 160);

            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#888';
            ctx.fillText(`FIGHT ${this.arcadeIndex} / ${ROSTER.length - 1}`, cx, startY - 5);

            if (this.winner === 'p1') {
                ctx.font = 'bold 36px "Press Start 2P"';
                ctx.fillStyle = '#00ff00';
                ctx.fillText('> NEXT FIGHT <', cx, startY + 55);
                ctx.font = '18px "Press Start 2P"';
                ctx.fillStyle = '#888';
                ctx.fillText('PRESS ATTACK TO CONTINUE', cx, startY + 95);
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
            ctx.fillRect(cx - 400, startY - 40, 800, options.length * 65 + 30);
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

        ctx.font = '18px "Press Start 2P"';
        ctx.fillStyle = '#888';
        ctx.fillText('PRESS ATTACK TO RETURN', cx, cy + 120);
    }
}
