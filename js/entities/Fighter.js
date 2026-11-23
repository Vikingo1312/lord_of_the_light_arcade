import Hitbox from './Hitbox.js?v=2.75';
import { getFighterStyle } from '../data.js?v=2.75';

export default class Fighter {
    constructor(game, data, x, y, facing) {
        this.game = game;
        this.data = data; // Keep name, HP, etc.
        this.styleInfo = getFighterStyle(this.data);

        // Physics Transform
        this.x = x;       // Center X
        this.y = y;       // Bottom (Feet) Y
        this.groundY = y; // Floor baseline Y
        this.vx = 0;
        this.vy = 0;
        this.facing = facing; // 1 = Right, -1 = Left

        // Stats (Balanced Street Fighter II Turbo competitive parity: tight HP, Speed & Power bands so every fighter matchup is fair!)
        const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
        const styleSpeedBonus = styleId === 'SHADOW_ASSASSIN' ? 1.07
            : (styleId === 'CAPOEIRA_TRICKSTER' ? 1.05
            : (styleId === 'MASTER_STRIKER' ? 1.03
            : (styleId === 'TITAN_GRAPPLER' ? 0.94 : 1.0)));
        const clampedBaseHP = Math.max(305, Math.min(335, this.data.hp || 315));
        this.baseMaxHP = Math.round(clampedBaseHP * 1.45);
        this.hp = this.baseMaxHP;
        this.maxHP = this.baseMaxHP;
        const clampedSpeed = Math.max(485, Math.min(545, this.data.speed || 515));
        this.speed = Math.round(clampedSpeed * styleSpeedBonus);
        this.power = Math.max(96, Math.min(106, this.data.power || 100)); // Tight competitive power band (0.96x .. 1.06x)
        this.jumpImpulse = styleId === 'TITAN_GRAPPLER' ? -1560 : (styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'SHADOW_ASSASSIN' ? -1720 : -1680);

        // Deterministic Physics Constants
        this.gravity = styleId === 'TITAN_GRAPPLER' ? 3550 : 3350;  // Crisp Street Fighter jump arc

        // Special Energy Meter (Start at 50% so 100% Super Arts must be earned in combat!)
        this.specialEnergy = 50;
        this.maxSpecialEnergy = 100;

        // State Machine
        this.state = 'IDLE'; // IDLE, WALK, JUMP, ATTACK, HIT, KO, DIZZY
        this.stateTimer = 0;
        this.isGrounded = true;
        this.hasWallJumped = false;
        this.justWallJumped = 0;

        // Current Frame Data for attacks
        this.currentAttack = null;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.lastHitConnected = false;
        this.consecutiveHitsTaken = 0;
        this.pendingStyleCallout = null;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        this.specialMoveCooldown = 0;
        this.hitStop = 0;
        this.hitImmunity = 0;
        this.hitStunDuration = 0.34;
        this.isKnockedDown = false;
        this.stunMeter = 0;
        this.maxStunMeter = 100;
        this.stunDecayTimer = 0;
        this.midFightDizzyTimer = 0;

        // Blocking
        this.isBlocking = false;
        this.blockStun = 0;

        // Base Hurtbox (Normalized Street Fighter torso bounds, scaled by heightScale e.g. 0.89 for 1.60m Annikina)
        this.baseHurtboxHeight = Math.round(315 * (this.data?.heightScale || 1.0));
        this.baseHurtboxWidth = 136;
        this.hurtbox = new Hitbox(-this.baseHurtboxWidth / 2, 0, this.baseHurtboxWidth, this.baseHurtboxHeight);

        // Active Hitbox (The fist/foot)
        this.activeHitbox = null;

        // VFX: Ghost Trail Array
        this.ghosts = [];
        this._ghostSpawnAccum = 0;

        // Continuous animation clock, combo chain & 180ms Street Fighter input buffer
        this.animTime = 0;
        this.jumpTime = 0;
        this.landingTimer = 0;
        this.dashCooldown = 0;
        this.comboChainStep = 0;
        this.comboChainTimer = 0;
        this.isActivelyGuarding = false;
        this._inputBuffer = { l: 0, h: 0, s: 0, commandMove: null, cmdTimer: 0 };

        // Reusable offscreen canvas for hit-flash effect (prevents 60fps DOM allocation leak)
        this._flashCanvas = null;
        this._flashCtx = null;
    }

    update(dt, inputQueue) {
        this.animTime += dt;
        if (this.hp <= 0 && this.state !== 'KO') {
            this.hp = 0;
            this.blockStun = 0;
            this.hitStop = 0;
            this.activeHitbox = null;
            this.currentAttack = null;
            this.state = 'KO';
        }
        if (!this.isGrounded) {
            this.jumpTime = (this.jumpTime || 0) + dt;
        } else {
            this.jumpTime = 0;
        }
        if (this.landingTimer > 0) this.landingTimer = Math.max(0, this.landingTimer - dt);
        if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        if (this.multiHitCooldown > 0) this.multiHitCooldown = Math.max(0, this.multiHitCooldown - dt);
        if (this.specialMoveCooldown > 0) this.specialMoveCooldown = Math.max(0, this.specialMoveCooldown - dt);
        if (this.comboChainTimer > 0) {
            this.comboChainTimer -= dt;
            if (this.comboChainTimer <= 0) this.comboChainStep = 0;
        }

        // Capture fresh button presses into 180ms Street Fighter Input Buffer (paused during hitstop & blockstun so reversals never drop!)
        if (!this._inputBuffer) {
            this._inputBuffer = { l: 0, h: 0, s: 0, commandMove: null, cmdTimer: 0 };
        }
        const freezeDecay = (this.hitStop > 0 || this.blockStun > 0) ? 0 : dt;
        if (inputQueue.lJust) this._inputBuffer.l = 0.18;
        else if (this._inputBuffer.l > 0) this._inputBuffer.l = Math.max(0, this._inputBuffer.l - freezeDecay);

        if (inputQueue.hJust) this._inputBuffer.h = 0.18;
        else if (this._inputBuffer.h > 0) this._inputBuffer.h = Math.max(0, this._inputBuffer.h - freezeDecay);

        if (inputQueue.sJust) this._inputBuffer.s = 0.18;
        else if (this._inputBuffer.s > 0) this._inputBuffer.s = Math.max(0, this._inputBuffer.s - freezeDecay);

        if (inputQueue.commandMove) {
            this._inputBuffer.commandMove = inputQueue.commandMove;
            this._inputBuffer.cmdTimer = 0.18;
        } else if (this._inputBuffer.cmdTimer > 0) {
            this._inputBuffer.cmdTimer = Math.max(0, this._inputBuffer.cmdTimer - freezeDecay);
            if (this._inputBuffer.cmdTimer <= 0) this._inputBuffer.commandMove = null;
        }

        const hasL = Boolean(inputQueue.lJust || this._inputBuffer.l > 0);
        const hasH = Boolean(inputQueue.hJust || this._inputBuffer.h > 0);
        const hasS = Boolean(inputQueue.sJust || this._inputBuffer.s > 0);
        const bufferedCmd = inputQueue.commandMove || (this._inputBuffer.cmdTimer > 0 ? this._inputBuffer.commandMove : null);
        const consumeBuffer = () => {
            this._inputBuffer.l = 0;
            this._inputBuffer.h = 0;
            this._inputBuffer.s = 0;
            this._inputBuffer.commandMove = null;
            this._inputBuffer.cmdTimer = 0;
        };

        // 1. Process Hitstop
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return; // Skip physics during frozen impact frames (inputs are safely buffered above!)
        }

        // Age ghosts
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            this.ghosts[i].age -= dt * 2.8; // Fade out smoothly
            if (this.ghosts[i].age <= 0) this.ghosts.splice(i, 1);
        }

        this.stateTimer += dt;

        // Dynamically adjust hurtbox when airborne (tucks feet up by 75px to jump cleanly over Super Projectiles!) or crouching
        if (!this.isGrounded) {
            const airW = Math.round(this.baseHurtboxWidth * 0.92);
            this.hurtbox.offsetX = -airW / 2;
            this.hurtbox.width = airW;
            this.hurtbox.offsetY = 75;
            this.hurtbox.height = 215;
        } else if (this.state === 'CROUCH' || (this.state === 'ATTACK' && this.currentAttack && (this.currentAttack.type === 'SWEEP' || this.currentAttack.type === 'CROUCH_LIGHT'))) {
            this.hurtbox.offsetX = -this.baseHurtboxWidth / 2;
            this.hurtbox.width = this.baseHurtboxWidth;
            this.hurtbox.offsetY = 0;
            this.hurtbox.height = 195;
        } else {
            this.hurtbox.offsetX = -this.baseHurtboxWidth / 2;
            this.hurtbox.width = this.baseHurtboxWidth;
            this.hurtbox.offsetY = 0;
            this.hurtbox.height = this.baseHurtboxHeight;
        }

        // Authentic Street Fighter II / Tekken Instant Guard System:
        // Standing Block = Holding Back (←) or Guard button (B / Shift).
        // Crouching Block = Holding Down-Back (↙) or Down + Guard button (↓+B).
        const holdingGuardBtn = Boolean(inputQueue.guard);
        const holdingBack = (this.facing === 1 && inputQueue.left) || (this.facing === -1 && inputQueue.right);
        const holdingFwd = (this.facing === 1 && inputQueue.right) || (this.facing === -1 && inputQueue.left);
        const holdingCrouchGuard = Boolean(inputQueue.down && (holdingBack || holdingGuardBtn));
        const oppDist = this.opponent ? Math.abs(this.opponent.x - this.x) : 999;
        const oppAttackingNear = Boolean(inputQueue.opponentThreat || (this.opponent && this.opponent.state === 'ATTACK' && oppDist < 480));
        const inRecoveryGuardWindow = this.state === 'ATTACK' && this.currentAttack && this.stateTimer >= (this.currentAttack.startup + this.currentAttack.active * 0.85);
        this.isBlocking = (holdingGuardBtn || holdingBack || holdingCrouchGuard || this.blockStun > 0) && this.isGrounded && !this.isKnockedDown && this.midFightDizzyTimer <= 0 && (this.state !== 'ATTACK' || inRecoveryGuardWindow) && (this.state !== 'DASH' || holdingGuardBtn || oppAttackingNear) && this.state !== 'HIT' && this.state !== 'KO';
        this.isActivelyGuarding = Boolean(this.isBlocking && (holdingGuardBtn || this.blockStun > 0 || ((holdingBack || holdingCrouchGuard) && (oppAttackingNear || oppDist < 340))));
        if (this.isActivelyGuarding && inRecoveryGuardWindow && this.state === 'ATTACK') {
            this.activeHitbox = null;
            this.currentAttack = null;
            this.state = inputQueue.down ? 'CROUCH' : 'IDLE';
            this.vx = 0;
        }

        // Decay Stun Meter when not being hit
        if (this.stunDecayTimer > 0) {
            this.stunDecayTimer = Math.max(0, this.stunDecayTimer - dt);
        } else if (this.stunMeter > 0 && this.state !== 'HIT' && this.midFightDizzyTimer <= 0) {
            this.stunMeter = Math.max(0, this.stunMeter - 22 * dt);
        }

        // Hit-immunity countdown (prevents chain-stun after recovering from HIT)
        if (this.hitImmunity > 0) this.hitImmunity -= dt;

        // Blockstun countdown
        if (this.blockStun > 0) {
            this.blockStun -= dt;
            this.vx *= Math.pow(0.02, dt);
            if (this.blockStun > 0) {
                // Inline physics while still locked in blockstun
                if (!this.isGrounded) {
                    this.vy += this.gravity * dt;
                    this.y += this.vy * dt;
                }
                this.x += this.vx * dt;
                const floorY = this.game.height * 0.9;
                if (this.y > floorY) { this.y = floorY; this.vy = 0; this.isGrounded = true; }
                return;
            }
            // Blockstun just ended on this frame — transition to IDLE/CROUCH and fall through so buffered reversals fire immediately!
            this.blockStun = 0;
            this.state = inputQueue.down ? 'CROUCH' : 'IDLE';
        }

        // Check for Dash trigger (double-tap Forward or Dash button; never back-dash when holding guard or blocking an enemy attack!)
        const tryTriggerDash = () => {
            if (this.dashCooldown > 0 || !this.isGrounded || holdingGuardBtn) return false;
            const blockBackLeft = (this.facing === 1 && (oppAttackingNear || oppDist < 360));
            const blockBackRight = (this.facing === -1 && (oppAttackingNear || oppDist < 360));
            if (inputQueue.dashLeftJust && !blockBackLeft) {
                this.executeDash(-1);
                return true;
            }
            if (inputQueue.dashRightJust && !blockBackRight) {
                this.executeDash(1);
                return true;
            }
            if (inputQueue.dashJust) {
                const dir = inputQueue.left ? -1 : (inputQueue.right ? 1 : this.facing);
                this.executeDash(dir);
                return true;
            }
            return false;
        };

        if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'CROUCH') {
            this.consecutiveHitsTaken = 0;
        }

        // Trigger next step in the 3-step Tekken / Street Fighter Dial-A-Combo (Punch -> Drehkick -> Finisher)
        const triggerLightCombo = () => {
            consumeBuffer();
            if (this.comboChainTimer > 0 && this.comboChainStep === 1) {
                this.comboChainStep = 2;
                this.comboChainTimer = 0.85;
                this.executeAttack('COMBO_KICK');
            } else if (this.comboChainTimer > 0 && this.comboChainStep === 2) {
                this.comboChainStep = 0;
                this.comboChainTimer = 0;
                this.executeAttack('COMBO_FINISHER');
            } else {
                this.comboChainStep = 1;
                this.comboChainTimer = 0.85;
                this.executeAttack('LIGHT');
            }
        };

        // Trigger next step in the 3-step Kick / Drehkick Dial-A-Combo (Kick -> 360° Drehkick -> Hurricane Drehkick)
        const triggerHeavyCombo = () => {
            consumeBuffer();
            if (this.comboChainTimer > 0 && this.comboChainStep === 1) {
                this.comboChainStep = 2;
                this.comboChainTimer = 0.85;
                this.pendingStyleCallout = '🌀 360° DREHKICK!';
                this.executeAttack('COMBO_KICK');
            } else if (this.comboChainTimer > 0 && this.comboChainStep === 2) {
                this.comboChainStep = 0;
                this.comboChainTimer = 0;
                this.specialMoveCooldown = 0;
                this.pendingStyleCallout = '🌪️ HURRICANE DREHKICK!';
                this.executeAttack(holdingFwd ? 'AXE_KICK' : 'HURRICANE_KICK');
            } else {
                this.comboChainStep = 1;
                this.comboChainTimer = 0.85;
                this.executeAttack('HEAVY');
            }
        };

        // Check for Street Fighter Command Moves & Physical Special Moves (no fireball required!)
        const tryCommandOrPhysicalSpecial = () => {
            if (bufferedCmd) {
                if (this.executeAttack(bufferedCmd)) {
                    consumeBuffer();
                    return true;
                }
            }
            if (holdingFwd && hasL && this.comboChainStep === 0) {
                if (this.executeAttack('COMMAND_PUNCH')) {
                    consumeBuffer();
                    return true;
                }
            }
            if (holdingFwd && hasH) {
                if (this.executeAttack('AXE_KICK')) {
                    consumeBuffer();
                    return true;
                }
            }
            return false;
        };

        // 2. State Machine Logic
        switch (this.state) {
            case 'IDLE':
                this.vx = 0;
                if (tryCommandOrPhysicalSpecial()) break;
                if (tryTriggerDash()) break;
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (inputQueue.down) {
                    this.state = 'CROUCH';
                    this.stateTimer = 0;
                    if (hasL) { consumeBuffer(); this.executeAttack('CROUCH_LIGHT'); }
                    else if (hasH) { consumeBuffer(); this.executeAttack('SWEEP'); }
                } else if (hasL) {
                    triggerLightCombo();
                } else if (hasH) {
                    triggerHeavyCombo();
                } else if (hasS) {
                    consumeBuffer();
                    this.executeAttack('SPECIAL');
                } else if (inputQueue.left) {
                    this.vx = -this.speed;
                    this.state = 'WALK';
                } else if (inputQueue.right) {
                    this.vx = this.speed;
                    this.state = 'WALK';
                }
                break;

            case 'CROUCH':
                this.vx = 0;
                if (bufferedCmd && this.executeAttack(bufferedCmd)) { consumeBuffer(); break; }
                if (tryTriggerDash()) break;
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (hasL) {
                    consumeBuffer();
                    this.executeAttack('CROUCH_LIGHT');
                } else if (hasH) {
                    consumeBuffer();
                    this.executeAttack('SWEEP');
                } else if (hasS) {
                    consumeBuffer();
                    this.executeAttack('SPECIAL');
                } else if (!inputQueue.down) {
                    this.state = 'IDLE';
                    this.stateTimer = 0;
                }
                break;

            case 'WALK':
                if (tryCommandOrPhysicalSpecial()) break;
                if (tryTriggerDash()) break;
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (inputQueue.down) {
                    this.vx = 0;
                    this.state = 'CROUCH';
                    this.stateTimer = 0;
                    if (hasL) { consumeBuffer(); this.executeAttack('CROUCH_LIGHT'); }
                    else if (hasH) { consumeBuffer(); this.executeAttack('SWEEP'); }
                } else if (hasL) {
                    triggerLightCombo();
                } else if (hasH) {
                    triggerHeavyCombo();
                } else if (hasS) {
                    consumeBuffer();
                    this.executeAttack('SPECIAL');
                } else if (!inputQueue.left && !inputQueue.right) {
                    this.vx = 0;
                    this.state = 'IDLE';
                } else {
                    // Maintain walking (slow down slightly if actively bracing against an incoming attack)
                    const spdMul = this.isActivelyGuarding ? 0.55 : 1.0;
                    this.vx = inputQueue.left ? -this.speed * spdMul : (inputQueue.right ? this.speed * spdMul : 0);
                }
                break;

            case 'DASH':
                // Spawn afterimage ghost trail during dash
                this._ghostSpawnAccum += dt;
                if (this._ghostSpawnAccum >= 0.035) {
                    this._ghostSpawnAccum = 0;
                    this.ghosts.push({
                        x: this.x,
                        y: this.y,
                        age: 0.45,
                        facing: this.facing,
                        timer: 0,
                        isDashGhost: true
                    });
                }

                // Allow canceling forward dash immediately into attacks or jump!
                if (tryCommandOrPhysicalSpecial()) break;
                if (inputQueue.up && this.isGrounded) {
                    this.executeJump(inputQueue);
                    break;
                } else if (hasL) {
                    triggerLightCombo();
                    break;
                } else if (hasH) {
                    consumeBuffer();
                    this.executeAttack(inputQueue.down ? 'SWEEP' : 'HEAVY');
                    break;
                } else if (hasS) {
                    consumeBuffer();
                    this.executeAttack('SPECIAL');
                    break;
                }

                this.vx *= Math.pow(0.08, dt);
                if (this.stateTimer >= 0.18 && this.isGrounded) {
                    this.vx = 0;
                    this.state = inputQueue.down ? 'CROUCH' : 'IDLE';
                }
                break;

            case 'JUMP':
                // Street Fighter Triangle Jump / Wall-Jump at Left or Right Screen Edge!
                if (!this.hasWallJumped && this.stateTimer > 0.07) {
                    const nearLeftWall = this.x <= 168;
                    const nearRightWall = this.x >= this.game.width - 168;
                    if (nearLeftWall && (inputQueue.upJust || inputQueue.rightJust || (inputQueue.up && inputQueue.right) || (this.x <= 154 && inputQueue.up && this.vy > -1100))) {
                        this.executeWallJump(1);
                        break;
                    }
                    if (nearRightWall && (inputQueue.upJust || inputQueue.leftJust || (inputQueue.up && inputQueue.left) || (this.x >= this.game.width - 154 && inputQueue.up && this.vy > -1100))) {
                        this.executeWallJump(-1);
                        break;
                    }
                }
                // Allow aerial steering in the first 120ms if player pressed Up slightly before Left/Right, plus aerial attacks & special moves!
                if (Math.abs(this.vx) < 25 && this.stateTimer < 0.14 && (inputQueue.left || inputQueue.right)) {
                    const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                    const airMul = styleId === 'SHADOW_ASSASSIN' ? 1.28 : (styleId === 'CAPOEIRA_TRICKSTER' ? 1.24 : 1.15);
                    this.vx = inputQueue.left ? -this.speed * airMul : this.speed * airMul;
                }
                if (bufferedCmd && bufferedCmd !== 'THROW') {
                    if (this.executeAttack(bufferedCmd)) consumeBuffer();
                } else if (hasL) {
                    consumeBuffer();
                    this.executeAttack('LIGHT');
                } else if (hasH) {
                    consumeBuffer();
                    this.executeAttack('HEAVY');
                } else if (hasS) {
                    consumeBuffer();
                    this.executeAttack('SPECIAL');
                }
                break;

            case 'ATTACK':
                if (!this.currentAttack) {
                    this.state = this.isGrounded ? 'IDLE' : 'JUMP';
                    break;
                }

                // ─── INDIVIDUAL FIGHT-STYLE & STREET FIGHTER / TEKKEN DIAL-A-COMBO CANCELS ───
                const atkType = this.currentAttack.type;
                const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                const pastActiveMid = this.stateTimer >= (this.currentAttack.startup || 0.05) + (this.currentAttack.active || 0.14) * 0.45;
                const canChainNow = Boolean(this.attackHasHit || this.attackHitCount > 0 || pastActiveMid);

                if (canChainNow && this.isGrounded) {
                    // 1. Universal Command Move / Physical Special Cancel (Dragon Uppercut, Hurricane Kick, Throw)
                    if (bufferedCmd && atkType !== bufferedCmd) {
                        this.specialMoveCooldown = 0;
                        if (this.executeAttack(bufferedCmd)) {
                            consumeBuffer();
                            break;
                        }
                    }

                    // 2. TITAN_GRAPPLER Signature: P -> P+K (or K during combo) chains directly into an UNBLOCKABLE COMBO THROW SLAM!
                    if (styleId === 'TITAN_GRAPPLER' && (atkType === 'LIGHT' || atkType === 'COMBO_KICK' || atkType === 'AXE_KICK') && ((hasL && hasH) || (inputQueue.l && hasH) || (inputQueue.h && hasL))) {
                        consumeBuffer();
                        this.pendingStyleCallout = '💪 TITAN COMBO SLAM!';
                        this.executeAttack('THROW');
                        break;
                    }

                    // 3. Universal & Capoeira K -> K -> K Triple Drehkick Combo (Kick -> 360° Drehkick -> Hurricane Drehkick / Axe Kick!)
                    if (hasH && (atkType === 'HEAVY' || atkType === 'SWEEP')) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.85;
                        this.pendingStyleCallout = styleId === 'CAPOEIRA_TRICKSTER' ? '🌀 CAPOEIRA SPIN!' : '🌀 360° DREHKICK!';
                        this.executeAttack('COMBO_KICK');
                        break;
                    }
                    if (hasH && atkType === 'COMBO_KICK') {
                        consumeBuffer();
                        this.comboChainStep = 0;
                        this.comboChainTimer = 0;
                        this.specialMoveCooldown = 0;
                        this.pendingStyleCallout = styleId === 'CAPOEIRA_TRICKSTER' ? '🌀 TRIPLE CAPOEIRA KICK!' : '🌪️ HURRICANE DREHKICK!';
                        this.executeAttack((styleId === 'CAPOEIRA_TRICKSTER' || holdingFwd) ? 'AXE_KICK' : 'HURRICANE_KICK');
                        break;
                    }

                    // 4. SHADOW_ASSASSIN Signature: K -> P -> K (Phantom Shadow Blitz: Heavy Kick -> Teleport Dash Punch -> Overhead Axe Kick!)
                    if (styleId === 'SHADOW_ASSASSIN' && (atkType === 'HEAVY' || atkType === 'SWEEP') && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.85;
                        this.pendingStyleCallout = '🌑 PHANTOM SHADOW BLITZ!';
                        this.executeAttack('COMMAND_PUNCH');
                        this.vx = this.facing * 620;
                        this.hitImmunity = Math.max(this.hitImmunity, 0.18);
                        break;
                    }

                    // 5. VALHALLA_BERSERKER Signature: ->+P (COMMAND_PUNCH) -> P -> K (Thunder Hammer Smash!)
                    if (styleId === 'VALHALLA_BERSERKER' && atkType === 'COMMAND_PUNCH' && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.85;
                        this.pendingStyleCallout = '⚡ THUNDER HAMMER SMASH!';
                        this.executeAttack('COMBO_KICK');
                        break;
                    }

                    // 6. Standard & Style-Enhanced P -> P -> P / P -> K -> S Chains
                    if (atkType === 'LIGHT' && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.85;
                        this.executeAttack(holdingFwd ? 'COMMAND_PUNCH' : 'COMBO_KICK');
                        break;
                    }
                    if ((atkType === 'COMBO_KICK' || atkType === 'COMMAND_PUNCH') && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 0;
                        this.comboChainTimer = 0;
                        if (styleId === 'LIGHT_DRAGON' && inputQueue.up) {
                            this.specialMoveCooldown = 0;
                            this.pendingStyleCallout = '☀️ SOLAR DRAGON RUSH!';
                            this.executeAttack('DRAGON_UPPERCUT');
                        } else {
                            this.executeAttack('COMBO_FINISHER');
                        }
                        break;
                    }
                    if ((atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT' || atkType === 'COMMAND_PUNCH') && hasH) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.85;
                        if (styleId === 'LIGHT_DRAGON' && inputQueue.up) {
                            this.specialMoveCooldown = 0;
                            this.pendingStyleCallout = '☀️ SOLAR DRAGON RUSH!';
                            this.executeAttack('DRAGON_UPPERCUT');
                        } else if (styleId === 'SHADOW_ASSASSIN' && atkType === 'COMMAND_PUNCH') {
                            this.pendingStyleCallout = '🌑 SHADOW EXECUTION!';
                            this.executeAttack('AXE_KICK');
                        } else {
                            this.executeAttack(inputQueue.down ? 'SWEEP' : (holdingFwd ? 'AXE_KICK' : 'COMBO_KICK'));
                        }
                        break;
                    }
                    if ((atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT' || atkType === 'COMBO_KICK' || atkType === 'COMMAND_PUNCH' || atkType === 'AXE_KICK' || atkType === 'HEAVY' || atkType === 'SWEEP') && hasS) {
                        this.specialMoveCooldown = 0;
                        if (inputQueue.up) {
                            if (this.executeAttack('DRAGON_UPPERCUT')) {
                                consumeBuffer();
                                break;
                            }
                        } else if (inputQueue.down) {
                            if (this.executeAttack('HURRICANE_KICK')) {
                                consumeBuffer();
                                break;
                            }
                        } else if (holdingFwd) {
                            if (this.executeAttack('FLYING_TORPEDO')) {
                                consumeBuffer();
                                break;
                            }
                        }
                        if (this.executeAttack('SPECIAL')) {
                            consumeBuffer();
                            break;
                        }
                    }
                }

                if (this.currentAttack.type === 'SPECIAL_DASH') {
                    // Lock velocity during startup and active window (stop immediately if blocked!)
                    if (!this.attackWasBlocked && this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        this.vx = this.facing * 1450; // Keep flying forward
                        this.vy = 0;                   // Ignore gravity
                        // Spawn ghost trail
                        this.ghosts.push({ x: this.x, y: this.y, age: 0.6, facing: this.facing, timer: this.stateTimer });
                    } else {
                        this.vx *= 0.85; // Brake hard on recovery or block
                    }
                } else if (this.currentAttack.type === 'FLYING_TORPEDO') {
                    // Character-Specific Horizontal Full-Screen Signature Flight (stops & bounces back when blocked!)
                    const sigArch = this._getSignatureArchetype();
                    if (!this.attackWasBlocked && this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        if (sigArch === 'BLANKA_CANNONBALL' && this.attackHasHit) {
                            // Blanka Rolling Cannonball bounces off the opponent on final hit!
                            if (!this._cannonballBounced) {
                                this._cannonballBounced = true;
                                this.vx = -this.facing * 360;
                                this.vy = -520;
                                this.isGrounded = false;
                            }
                        } else if (sigArch === 'GUILE_FLASH_KICK') {
                            // Guile Somersault Flash Kick rises in a sweeping backflip arc!
                            this.vx = this.facing * 920;
                            if (this.stateTimer < this.currentAttack.startup + this.currentAttack.active * 0.45) {
                                this.vy = -540;
                            }
                        } else {
                            this.vx = this.facing * (sigArch === 'ZANGIEF_LARIAT' ? 1050 : 1180);
                            this.vy = 0;
                        }
                        this._ghostSpawnAccum += dt;
                        if (this._ghostSpawnAccum >= 0.032) {
                            this._ghostSpawnAccum = 0;
                            this.ghosts.push({ x: this.x, y: this.y, age: 0.46, facing: this.facing, timer: 0, isDashGhost: true });
                        }
                    } else {
                        this.vx *= 0.84;
                    }
                } else if (this.currentAttack.type === 'DRAGON_RUSH_COMBO') {
                    // Full-Screen 4-Hit Rush Combo -> Finisher Shoryuken / Archetype Finisher on final 25% of active frames!
                    const activeEnd = this.currentAttack.startup + this.currentAttack.active;
                    const launchThreshold = this.currentAttack.startup + this.currentAttack.active * 0.75;
                    if (!this.attackWasBlocked && this.stateTimer <= launchThreshold) {
                        this.vx = this.facing * 880;
                    } else if (!this.attackWasBlocked && this.stateTimer <= activeEnd) {
                        if (this.isGrounded) {
                            this.isGrounded = false;
                            this.vy = -640;
                        }
                        this.vx = this.facing * 420;
                    } else {
                        this.vx *= 0.85;
                    }
                    this._ghostSpawnAccum += dt;
                    if (this._ghostSpawnAccum >= 0.035) {
                        this._ghostSpawnAccum = 0;
                        this.ghosts.push({ x: this.x, y: this.y, age: 0.42, facing: this.facing, timer: 0, isDashGhost: true });
                    }
                } else if (this.currentAttack.type === 'HURRICANE_KICK') {
                    if (!this.attackWasBlocked && this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        this.vx = this.facing * 620;
                        this.vy = Math.min(this.vy, 80); // Hover horizontally across the stage like Tatsumaki!
                    } else {
                        this.vx *= 0.85;
                    }
                    this._ghostSpawnAccum += dt;
                    if (this._ghostSpawnAccum >= 0.038) {
                        this._ghostSpawnAccum = 0;
                        this.ghosts.push({ x: this.x, y: this.y, age: 0.36, facing: this.facing, timer: 0, isDashGhost: true });
                    }
                } else {
                    if (this.isGrounded) {
                        // Smoothly decelerate forward attack lunge momentum
                        this.vx *= Math.pow(0.002, dt);
                    }
                    // Spawn Street Fighter Alpha afterimage ghosts on SPECIAL, DRAGON_UPPERCUT, AXE_KICK, COMBO_FINISHER, and HEAVY active frames
                    const atkT = this.currentAttack.type;
                    if ((atkT === 'SPECIAL' || atkT === 'DRAGON_UPPERCUT' || atkT === 'AXE_KICK' || atkT === 'COMBO_FINISHER' || atkT === 'HEAVY') &&
                        this.stateTimer >= this.currentAttack.startup &&
                        this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        this._ghostSpawnAccum += dt;
                        if (this._ghostSpawnAccum >= 0.04) {
                            this._ghostSpawnAccum = 0;
                            this.ghosts.push({
                                x: this.x,
                                y: this.y,
                                age: 0.38,
                                facing: this.facing,
                                timer: 0,
                                isDashGhost: true
                            });
                        }
                    }
                }

                // Validate Frame Data phase (supports multi-hit moves like HURRICANE_KICK and LIGHT_DRAGON DRAGON_UPPERCUT!)
                const canStillHit = !this.attackHasHit && this.multiHitCooldown <= 0;
                if (canStillHit && this.stateTimer >= this.currentAttack.startup && this.stateTimer < (this.currentAttack.startup + this.currentAttack.active)) {
                    // ACTIVE FRAMES: Spawn Hitbox
                    this.activeHitbox = this.currentAttack.box;
                } else {
                    // STARTUP or RECOVERY or already hit
                    this.activeHitbox = null;
                }

                // End of attack
                if (this.stateTimer >= (this.currentAttack.startup + this.currentAttack.active + this.currentAttack.recovery)) {
                    if (this.isGrounded) {
                        this.state = inputQueue.down ? 'CROUCH' : 'IDLE';
                        this.vx = 0;
                    } else {
                        this.state = 'JUMP'; // Return to falling state
                    }
                    this.lastHitConnected = Boolean(this.attackHasHit || this.attackHitCount > 0);
                    this.activeHitbox = null;
                    this.currentAttack = null;
                    this.attackHasHit = false;
                    this.attackWasBlocked = false;
                    this.attackHitCount = 0;
                }
                break;

            case 'HIT':
                // Tiered Street Fighter Hitstun & Hard Knockdown Wake-Up (Okizeme)
                this.activeHitbox = null;
                const reqStun = this.isKnockedDown ? Math.max(0.56, this.hitStunDuration || 0.56) : (this.hitStunDuration || 0.32);
                if (this.stateTimer > reqStun && this.isGrounded) {
                    const wasKD = this.isKnockedDown;
                    this.isKnockedDown = false;
                    this.consecutiveHitsTaken = 0;
                    if (this.stunMeter >= 100 && this.hp > 1) {
                        // Street Fighter Mid-Match Dizzy Stun! (Stars over head for 1.55s!)
                        this.stunMeter = 0;
                        this.state = 'DIZZY';
                        this.stateTimer = 0;
                        this.midFightDizzyTimer = 1.55;
                        this.pendingStyleCallout = '💫 DIZZY STUN!';
                    } else {
                        this.state = inputQueue.down ? 'CROUCH' : 'IDLE';
                        this.hitImmunity = Math.max(this.hitImmunity, wasKD ? 0.44 : 0.32);
                    }
                }
                // Decelerate pushback rapidly
                this.vx *= 0.82;
                break;

            case 'DIZZY':
                // Street Fighter Mid-Match Stun OR Mortal Kombat "FINISH HIM!" dazed standing state
                this.activeHitbox = null;
                this.vx = 0;
                if (this.midFightDizzyTimer > 0) {
                    this.midFightDizzyTimer -= dt;
                    // Rapid directional shake / button mash recovers from Dizzy slightly faster, like SF2!
                    if (inputQueue.lJust || inputQueue.hJust || inputQueue.left || inputQueue.right) {
                        this.midFightDizzyTimer -= dt * 0.35;
                    }
                    if (this.midFightDizzyTimer <= 0) {
                        this.midFightDizzyTimer = 0;
                        this.state = 'IDLE';
                        this.hitImmunity = Math.max(this.hitImmunity, 0.35);
                    }
                }
                break;

            case 'KO':
                this.vx *= 0.9; // Slide on ground
                break;
        }

        // Style Passive: MASTER_STRIKER regenerates Chi Super Energy while calm (IDLE/WALK)
        const activeStyleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
        if (activeStyleId === 'MASTER_STRIKER' && (this.state === 'IDLE' || this.state === 'WALK') && this.specialEnergy < 100) {
            this.specialEnergy = Math.min(100, this.specialEnergy + 6.5 * dt);
        }

        // 3. Apply Deterministic Physics
        // Vertical
        if (!this.isGrounded) {
            this.vy += this.gravity * dt;
            this.y += this.vy * dt;
        }

        // Horizontal
        this.x += this.vx * dt;

        // 4. Resolve Floor Collision perfectly
        const floorY = this.game.height * 0.9;
        this.groundY = floorY;
        if (this.y > floorY) {
            this.y = floorY;
            this.vy = 0;
            if (!this.isGrounded) {
                this.isGrounded = true;
                this.hasWallJumped = false;
                this.landingTimer = 0.12;
                if (this.state === 'JUMP' || this.state === 'DASH') {
                    this.state = inputQueue.down ? 'CROUCH' : 'IDLE'; // Landed!
                    this.vx = 0;
                }
            }
        }
    }

    executeDash(dir) {
        const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
        this.state = 'DASH';
        this.stateTimer = 0;
        this.dashCooldown = styleId === 'SHADOW_ASSASSIN' ? 0.24 : (styleId === 'CAPOEIRA_TRICKSTER' ? 0.28 : 0.35);
        this._ghostSpawnAccum = 0.035; // Spawn first ghost immediately
        const isForward = (dir === this.facing);
        if (isForward) {
            const boost = styleId === 'SHADOW_ASSASSIN' ? 1680
                : (styleId === 'CAPOEIRA_TRICKSTER' ? 1520
                : (styleId === 'MASTER_STRIKER' ? 1440
                : (styleId === 'TITAN_GRAPPLER' ? 1220 : 1350)));
            this.vx = dir * boost;
            if (styleId === 'SHADOW_ASSASSIN') {
                // Brief phantom shadow phase-invulnerability on forward dash!
                this.hitImmunity = Math.max(this.hitImmunity, 0.20);
            } else if (styleId === 'CAPOEIRA_TRICKSTER') {
                // Acrobatic Capoeira low hop-dash!
                this.vy = -210;
                this.isGrounded = false;
            } else if (styleId === 'TITAN_GRAPPLER' || styleId === 'VALHALLA_BERSERKER') {
                // Armored shoulder bull-charge!
                this.hitImmunity = Math.max(this.hitImmunity, 0.14);
            }
        } else {
            // Evasive back-hop with brief invulnerability
            this.vx = dir * (styleId === 'SHADOW_ASSASSIN' ? 1240 : (styleId === 'CAPOEIRA_TRICKSTER' ? 1160 : 1050));
            this.vy = styleId === 'CAPOEIRA_TRICKSTER' ? -410 : -340;
            this.isGrounded = false;
            this.hitImmunity = Math.max(this.hitImmunity, 0.16);
        }
    }

    executeJump(inputQueue) {
        const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
        this.state = 'JUMP';
        this.stateTimer = 0;
        this.isGrounded = false;
        this.hasWallJumped = false;
        this.vy = this.jumpImpulse;

        const airMul = styleId === 'SHADOW_ASSASSIN' ? 1.28 : (styleId === 'CAPOEIRA_TRICKSTER' ? 1.24 : 1.15);
        if (inputQueue.left) this.vx = -this.speed * airMul;
        else if (inputQueue.right) this.vx = this.speed * airMul;
        else this.vx = 0;
    }

    executeWallJump(wallDir) {
        this.state = 'JUMP';
        this.stateTimer = 0;
        this.isGrounded = false;
        this.hasWallJumped = true;
        this.justWallJumped = wallDir;
        this.jumpTime = 0;
        this.facing = wallDir;
        this.vy = -1580; // Extra-high Street Fighter Triangle Wall-Jump boost!
        this.vx = wallDir * this.speed * 1.45;
        this.game?.audioManager?.playWhooshSound?.(true);
        for (let g = 0; g < 3; g++) {
            this.ghosts.push({
                x: this.x - wallDir * g * 18,
                y: this.y + g * 14,
                age: 0.42 - g * 0.08,
                facing: wallDir,
                timer: 0,
                isDashGhost: true
            });
        }
    }

    /**
     * Maps each of the 25+ fighters to one of 8 iconic Street Fighter Signature Archetypes:
     * 1. DHALSIM_DRILL (Raheel, Marley, Gargamel, GargamelHoodie)
     * 2. BLANKA_CANNONBALL (Pablo, Simba, Paco)
     * 3. CHUNLI_BIRD_KICK (Emely, HyperEmely, Cayle, CayleMinogue)
     * 4. BISON_PSYCHO_CRUSHER (JJDark, JayX, Hattori)
     * 5. GUILE_FLASH_KICK (Lee, Juan, Tzubaza)
     * 6. ZANGIEF_LARIAT (Vikingo, VikingoRaw, Annikina)
     * 7. HONDA_SUMO_TORPEDO (Kowalski, Putin, AlCapone)
     * 8. RYU_DRAGON_RUSH (Keano, HyperKeano, SupremeKeano)
     */
    _getSignatureArchetype() {
        const id = (this.data && this.data.id) || 'Keano';
        if (id === 'Raheel' || id === 'Marley' || id === 'Gargamel' || id === 'GargamelHoodie') return 'DHALSIM_DRILL';
        if (id === 'Pablo' || id === 'Simba' || id === 'Paco') return 'BLANKA_CANNONBALL';
        if (id === 'Emely' || id === 'HyperEmely' || id === 'Cayle' || id === 'CayleMinogue') return 'CHUNLI_BIRD_KICK';
        if (id === 'JJDark' || id === 'JayX' || id === 'Hattori') return 'BISON_PSYCHO_CRUSHER';
        if (id === 'Dom' || id === 'Lee' || id === 'Juan' || id === 'Tzubaza') return 'GUILE_FLASH_KICK';
        if (id === 'Vikingo' || id === 'VikingoRaw' || id === 'DarkVikingo' || id === 'Annikina') return 'ZANGIEF_LARIAT';
        if (id === 'Kowalski' || id === 'Putin' || id === 'AlCapone' || id === 'AliAbi') return 'HONDA_SUMO_TORPEDO';
        return 'RYU_DRAGON_RUSH';
    }

    executeProjectileCast(consumeSuper = true) {
        if (consumeSuper) {
            if (this.specialEnergy < 100) return false;
            this.specialEnergy = 0;
        } else {
            if (this.specialMoveCooldown > 0) return false;
            this.specialMoveCooldown = 0.52;
        }
        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        this.activeHitbox = null;
        if (!this.isGrounded) {
            // Street Fighter Zanku Hadoken mid-air recoil hop when shooting diagonally downward!
            this.vy = -380;
            this.vx = -this.facing * 150;
        }
        const isSecondVariant = Boolean(this.data && this.data.special);
        this.currentAttack = {
            startup: isSecondVariant ? 0.06 : 0.08,
            active: 0.18,
            recovery: isSecondVariant ? 0.18 : 0.24,
            damage: 0, pushback: 0, hitstop: 0,
            box: null,
            type: 'SPECIAL'
        };
        return true;
    }

    executeAttack(type) {
        // Energy-gated super/projectile specials require 100 energy; physical specials (DRAGON_UPPERCUT, HURRICANE_KICK, FLYING_TORPEDO, DRAGON_RUSH_COMBO) require specialMoveCooldown <= 0
        if (type === 'SPECIAL' || type === 'SPECIAL_DASH') {
            if (this.specialEnergy < 100) return false;
            this.specialEnergy = 0;
            this.specialMoveCooldown = 0.45;
        } else if (type === 'DRAGON_UPPERCUT' || type === 'HURRICANE_KICK' || type === 'FLYING_TORPEDO' || type === 'DRAGON_RUSH_COMBO') {
            if (this.specialMoveCooldown > 0) return false;
            this.specialMoveCooldown = 0.35; // Crisp 350ms Street Fighter special move cooldown so Drehkicks & Uppercuts always fire responsively!
        }

        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        this._cannonballBounced = false;

        const styleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
        const sigArch = this._getSignatureArchetype();
        const charId = (this.data && this.data.id) || 'Keano';
        const isSecondVariant = Boolean(this.data && this.data.special);

        // Valhalla Berserker Rage Passive (+10% damage below 35% HP) & Second Variant Power Boost (+2%)
        const berserkerRage = (styleId === 'VALHALLA_BERSERKER' && this.hp < this.maxHP * 0.35) ? 1.10 : 1.0;
        const variantMul = isSecondVariant ? 1.02 : 1.0;
        const pwrMul = (this.power / 100) * berserkerRage * variantMul;

        const isAerial = !this.isGrounded;
        // Distinct Style Frame Speed & Hitbox Reach Modifiers
        const spdMul = styleId === 'SHADOW_ASSASSIN' ? 0.86
            : (styleId === 'LIGHT_DRAGON' || styleId === 'SONIC_STRIKER' || styleId === 'KNEIPEN_TERRORIST' ? 0.90
            : (styleId === 'CAPOEIRA_TRICKSTER' ? 0.90
            : (styleId === 'MASTER_STRIKER' ? 0.92 : 1.0)));
        const dhalsimStretchBonus = sigArch === 'DHALSIM_DRILL' ? 48 : 0;
        const reachBonus = (styleId === 'MASTER_STRIKER' ? 24
            : (styleId === 'SONIC_STRIKER' ? 18
            : (styleId === 'KNEIPEN_TERRORIST' ? 20
            : (styleId === 'VALHALLA_BERSERKER' ? 18
            : (styleId === 'CAPOEIRA_TRICKSTER' ? 16 : 0))))) + dhalsimStretchBonus;

        // Play authentic martial-arts swing whoosh SFX
        const isHeavySwing = (type !== 'LIGHT' && type !== 'CROUCH_LIGHT');
        this.game?.audioManager?.playWhooshSound?.(isHeavySwing);

        if (type === 'LIGHT') {
            if (this.isGrounded) this.vx = this.facing * (styleId === 'SHADOW_ASSASSIN' ? 220 : 175);
            this.currentAttack = {
                startup: 0.045 * spdMul, active: 0.13, recovery: 0.18 * spdMul,
                damage: Math.round(14 * pwrMul), pushback: 195, hitstop: 0.07,
                isOverhead: isAerial,
                box: isAerial ? new Hitbox(-16, -20, 185 + reachBonus, 150) : new Hitbox(-16, 70, 198 + reachBonus, 165),
                type: 'LIGHT'
            };
        } else if (type === 'COMMAND_PUNCH') {
            // → + L: Guile Spinning Backfist / E. Honda Hundred Hand Slap / Phantom Blitz / Master Double-Strike / Armor Hammer / Bratpfannen-Schwinger (breaks crouching block!)
            const isHondaSlap = (styleId === 'HONDA_SUMO_BRAWLER');
            const isMasterDouble = (styleId === 'MASTER_STRIKER' || styleId === 'SONIC_STRIKER' || isHondaSlap);
            if (styleId === 'SONIC_STRIKER') {
                this.pendingStyleCallout = '🥊 GUILE SPINNING BACKFIST!';
            } else if (isHondaSlap) {
                this.pendingStyleCallout = '🫲 HUNDRED HAND SLAP!';
            }
            if (this.isGrounded) this.vx = this.facing * (styleId === 'SHADOW_ASSASSIN' ? 420 : (isMasterDouble ? 340 : 280));
            this.currentAttack = {
                startup: 0.072 * spdMul, active: isHondaSlap ? 0.26 : (isMasterDouble ? 0.20 : 0.15), recovery: 0.24 * spdMul,
                damage: Math.round((isHondaSlap ? 8 : (isMasterDouble ? 12 : 23)) * pwrMul), pushback: 255, hitstop: isMasterDouble ? 0.07 : 0.11,
                maxHits: isHondaSlap ? 3 : (isMasterDouble ? 2 : 1),
                isOverhead: true,
                hasSuperArmor: (styleId === 'VALHALLA_BERSERKER' || styleId === 'TITAN_GRAPPLER' || styleId === 'KNEIPEN_TERRORIST' || isHondaSlap),
                box: new Hitbox(-16, 65, 210 + reachBonus, 165),
                type: 'COMMAND_PUNCH'
            };
        } else if (type === 'COMBO_KICK') {
            if (this.isGrounded) this.vx = this.facing * (styleId === 'CAPOEIRA_TRICKSTER' ? 310 : 230);
            this.currentAttack = {
                startup: 0.055 * spdMul, active: 0.15, recovery: 0.20 * spdMul,
                damage: Math.round(19 * pwrMul), pushback: 235, hitstop: 0.10,
                box: new Hitbox(-16, 60, 212 + reachBonus, 160),
                type: 'COMBO_KICK'
            };
        } else if (type === 'COMBO_FINISHER') {
            if (this.isGrounded) this.vx = this.facing * 290;
            this.currentAttack = {
                startup: 0.065 * spdMul, active: 0.17, recovery: 0.30,
                damage: Math.round(28 * pwrMul), pushback: 400, hitstop: 0.14,
                lift: (styleId === 'LIGHT_DRAGON' || styleId === 'SONIC_STRIKER') ? -340 : -240,
                box: new Hitbox(-16, 55, 222 + reachBonus, 175),
                type: 'COMBO_FINISHER'
            };
        } else if (type === 'CROUCH_LIGHT') {
            if (this.isGrounded) this.vx = this.facing * 155;
            this.currentAttack = {
                startup: 0.045 * spdMul, active: 0.13, recovery: 0.18 * spdMul,
                damage: Math.round(13 * pwrMul), pushback: 180, hitstop: 0.07,
                isLow: true,
                box: new Hitbox(-16, 0, 200 + reachBonus, 115),
                type: 'CROUCH_LIGHT'
            };
        } else if (type === 'HEAVY') {
            const isCapoeiraDoubleHop = (!isAerial && styleId === 'CAPOEIRA_TRICKSTER');
            if (isAerial && (styleId === 'SHADOW_ASSASSIN' || styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'KNEIPEN_TERRORIST')) {
                // Signature Aerial Dive-Kick!
                this.vx = this.facing * 640;
                this.vy = Math.max(this.vy, 740);
            } else if (isCapoeiraDoubleHop) {
                // Capoeira Trickster: Acrobatic airborne 2-hit Meia-Lua Double Spin-Kick!
                this.isGrounded = false;
                this.vy = -310;
                this.vx = this.facing * 350;
            } else if (this.isGrounded) {
                this.vx = this.facing * 255;
            }
            this.currentAttack = {
                startup: 0.082 * spdMul, active: isCapoeiraDoubleHop ? 0.22 : 0.16, recovery: 0.28,
                damage: Math.round((isCapoeiraDoubleHop ? 14 : 27) * pwrMul),
                pushback: 380,
                hitstop: isCapoeiraDoubleHop ? 0.09 : 0.13,
                maxHits: isCapoeiraDoubleHop ? 2 : 1,
                lift: isAerial ? -140 : -160,
                isOverhead: isAerial,
                hasSuperArmor: (styleId === 'VALHALLA_BERSERKER' || styleId === 'TITAN_GRAPPLER' || styleId === 'KNEIPEN_TERRORIST'),
                box: isAerial ? new Hitbox(-16, -35, 202 + reachBonus, 175) : new Hitbox(-16, 65, 218 + reachBonus, 165),
                type: 'HEAVY'
            };
        } else if (type === 'AXE_KICK') {
            // → + H: Guile Reverse Spin Kick / Step Axe Kick / Bratpfannen-Schelle von oben!
            if (styleId === 'SONIC_STRIKER') {
                this.pendingStyleCallout = '🦵 GUILE REVERSE SPIN KICK!';
            }
            if (this.isGrounded) this.vx = this.facing * 310;
            this.currentAttack = {
                startup: 0.088 * spdMul, active: 0.17, recovery: 0.28,
                damage: Math.round(29 * pwrMul), pushback: 380, hitstop: 0.14,
                lift: -210,
                isOverhead: true,
                hasSuperArmor: (styleId === 'VALHALLA_BERSERKER' || styleId === 'TITAN_GRAPPLER' || styleId === 'KNEIPEN_TERRORIST'),
                box: new Hitbox(-16, 50, 220 + reachBonus, 190),
                type: 'AXE_KICK'
            };
        } else if (type === 'SWEEP') {
            // Capoeira Tricksters & Guile Sonic Strikers (2-part Double Sweep!)
            const isGuileDoubleSweep = (styleId === 'SONIC_STRIKER');
            if (isGuileDoubleSweep) {
                this.pendingStyleCallout = '🌀 GUILE DOUBLE SWEEP!';
            }
            if (this.isGrounded) this.vx = this.facing * (styleId === 'CAPOEIRA_TRICKSTER' || isGuileDoubleSweep ? 420 : 350);
            this.currentAttack = {
                startup: 0.072 * spdMul, active: isGuileDoubleSweep ? 0.22 : 0.16, recovery: 0.30,
                damage: Math.round((isGuileDoubleSweep ? 13 : 25) * pwrMul), pushback: 310, hitstop: isGuileDoubleSweep ? 0.09 : 0.13,
                maxHits: isGuileDoubleSweep ? 2 : 1,
                lift: -280,
                isLow: true,
                box: new Hitbox(-16, 0, 222 + reachBonus, 105),
                type: 'SWEEP'
            };
        } else if (type === 'DRAGON_UPPERCUT') {
            // → ↓ ↘ + L or ↑ + S or ↓ ↑ + K: Rising Shoryuken OR Guile's 360° Backflip SOMERSAULT FLASH KICK OR E. Honda's SUMO BUTT SPLASH!
            const isGuileFlash = (sigArch === 'GUILE_FLASH_KICK' || styleId === 'SONIC_STRIKER');
            const isHondaSplash = (styleId === 'HONDA_SUMO_BRAWLER');
            const isDragon = (styleId === 'LIGHT_DRAGON' || isGuileFlash || isHondaSplash);
            if (isGuileFlash) {
                this.pendingStyleCallout = '🌙 SOMERSAULT FLASH KICK!';
            } else if (isHondaSplash) {
                this.pendingStyleCallout = '💥 SUMO ARSCHBOMBE SPLASH!';
            }
            this.hitImmunity = Math.max(this.hitImmunity, 0.18);
            this.isGrounded = false;
            this.vy = isDragon ? -1040 : -940;
            this.vx = this.facing * (isHondaSplash ? 360 : (isDragon ? 320 : 280));
            this.currentAttack = {
                startup: 0.048, active: 0.24, recovery: 0.36,
                damage: Math.round((isDragon ? 16 : 32) * pwrMul), pushback: 350, hitstop: 0.13,
                lift: -520,
                maxHits: isDragon ? 2 : 1,
                isSpecialMove: true,
                box: new Hitbox(-16, 35, 198 + reachBonus, 270),
                type: 'DRAGON_UPPERCUT'
            };
        } else if (type === 'HURRICANE_KICK') {
            // ↓ ↙ ← + H or ↓ + S: Tatsumaki Spinning Cyclone Kick OR E. Honda Sumo Butt Splash (Hyakkan Otoshi)!
            const isCapoeira = (styleId === 'CAPOEIRA_TRICKSTER');
            const isHondaSplash = (styleId === 'HONDA_SUMO_BRAWLER');
            if (isHondaSplash) {
                this.pendingStyleCallout = '💥 SUMO ARSCHBOMBE SPLASH!';
            }
            this.isGrounded = false;
            this.vy = isHondaSplash ? -800 : -250;
            this.vx = this.facing * (isCapoeira ? 640 : (isHondaSplash ? 480 : 580));
            this.currentAttack = {
                startup: 0.06, active: isCapoeira ? 0.40 : 0.35, recovery: 0.34,
                damage: Math.round((isHondaSplash ? 16 : (isCapoeira ? 9 : 11)) * pwrMul), pushback: 260, hitstop: 0.09,
                lift: isHondaSplash ? -380 : -190,
                maxHits: isCapoeira ? 4 : (isHondaSplash ? 2 : 3),
                hasSuperArmor: false,
                isSpecialMove: true,
                box: new Hitbox(-30, 50, 228 + reachBonus, 170),
                type: 'HURRICANE_KICK'
            };
        } else if (type === 'FLYING_TORPEDO') {
            // ← → + P or → + S (or S for Ali Abi): Character-Specific Full-Screen Signature Flight (8 Street Fighter Archetypes!)
            this.isGrounded = false;
            this.y -= 35;
            this.vy = sigArch === 'GUILE_FLASH_KICK' ? -560 : 0;
            this.vx = this.facing * 1160;
            this.hitImmunity = Math.max(this.hitImmunity, 0.16);

            if (sigArch === 'DHALSIM_DRILL') {
                this.pendingStyleCallout = (charId === 'Gargamel' || charId === 'GargamelHoodie') ? '🧪 ALCHEMY SCREW DRILL!' : '🌀 YOGA CORKSCREW DRILL!';
            } else if (sigArch === 'BLANKA_CANNONBALL') {
                this.pendingStyleCallout = '⚡ ROLLING CANNONBALL!';
            } else if (sigArch === 'CHUNLI_BIRD_KICK') {
                this.pendingStyleCallout = (charId === 'Cayle' || charId === 'CayleMinogue') ? '❄️ FROST HELICOPTER KICK!' : '🌸 SPINNING BIRD KICK!';
            } else if (sigArch === 'BISON_PSYCHO_CRUSHER') {
                this.pendingStyleCallout = '🟣 PSYCHO SHADOW CRUSHER!';
            } else if (sigArch === 'GUILE_FLASH_KICK') {
                this.pendingStyleCallout = '🌙 SOMERSAULT FLASH KICK!';
            } else if (sigArch === 'ZANGIEF_LARIAT') {
                this.pendingStyleCallout = charId === 'Annikina' ? '🌪️ IRON FLAME LARIAT!' : '⚡ MJÖLNIR TORNADO LARIAT!';
            } else if (sigArch === 'HONDA_SUMO_TORPEDO') {
                this.pendingStyleCallout = charId === 'AliAbi' ? '🚀 SUMO DÖNER-SPIESS TORPEDO!' : '🚀 TITAN TORPEDO HEADBUTT!';
            } else {
                this.pendingStyleCallout = charId === 'Dom' ? '🥊 MATRIX KICKBOX RUSH!' : '☀️ SOLAR DRAGON RUSH!';
            }

            const isFourHitBird = (sigArch === 'CHUNLI_BIRD_KICK');
            this.currentAttack = {
                startup: 0.06, active: 0.36, recovery: 0.34,
                damage: Math.round((isFourHitBird ? 9 : 11) * pwrMul), pushback: 380, hitstop: 0.08,
                lift: sigArch === 'GUILE_FLASH_KICK' ? -520 : -240,
                maxHits: isFourHitBird ? 4 : 3,
                hasSuperArmor: false,
                isSpecialMove: true,
                box: new Hitbox(-24, 35, 224 + reachBonus, 180),
                type: 'FLYING_TORPEDO'
            };
        } else if (type === 'DRAGON_RUSH_COMBO') {
            // ↓ ↘ → + K or J+L / K+L: Full-Screen 4-Hit Street Fighter Signature Combo Rush!
            this.vx = this.facing * 980;
            this.hitImmunity = Math.max(this.hitImmunity, 0.14);
            if (sigArch === 'DHALSIM_DRILL') {
                this.pendingStyleCallout = (charId === 'Gargamel' || charId === 'GargamelHoodie') ? '🧪 ALCHEMY SCREW DRILL!' : '🌀 YOGA CORKSCREW DRILL!';
            } else if (sigArch === 'BLANKA_CANNONBALL') {
                this.pendingStyleCallout = '⚡ ELECTRIC THUNDER RUSH!';
            } else if (sigArch === 'CHUNLI_BIRD_KICK') {
                this.pendingStyleCallout = (charId === 'Cayle' || charId === 'CayleMinogue') ? '❄️ FROST LIGHTNING LEGS!' : '🌸 LIGHTNING LEGS RUSH!';
            } else if (sigArch === 'BISON_PSYCHO_CRUSHER') {
                this.pendingStyleCallout = '🟣 PSYCHO SHADOW CRUSHER!';
            } else if (sigArch === 'GUILE_FLASH_KICK') {
                this.pendingStyleCallout = '🌙 SOMERSAULT FLASH KICK!';
            } else if (sigArch === 'ZANGIEF_LARIAT') {
                this.pendingStyleCallout = charId === 'Annikina' ? '🌪️ IRON FLAME LARIAT!' : '⚡ MJÖLNIR TORNADO LARIAT!';
            } else if (sigArch === 'HONDA_SUMO_TORPEDO') {
                this.pendingStyleCallout = charId === 'AliAbi' ? '🫲 1000-OHRFEIGEN-SCHELLEN-STURM!' : '🚀 HUNDRED HAND TORPEDO!';
            } else {
                this.pendingStyleCallout = charId === 'Dom' ? '🟢 CYBER BOXING COMBINATION!' : '☀️ SOLAR DRAGON RUSH!';
            }
            this.currentAttack = {
                startup: 0.055, active: 0.42, recovery: 0.34,
                damage: Math.round(9 * pwrMul), pushback: 350, hitstop: 0.08,
                lift: -400,
                maxHits: 4,
                hasSuperArmor: false,
                isSpecialMove: true,
                box: new Hitbox(-20, 35, 224 + reachBonus, 200),
                type: 'DRAGON_RUSH_COMBO'
            };
        } else if (type === 'THROW') {
            // L + H at close range: Unblockable Martial Arts Grapple Slam!
            const isGrappler = (styleId === 'TITAN_GRAPPLER');
            this.vx = this.facing * (isGrappler ? 175 : 120);
            this.currentAttack = {
                startup: 0.045, active: 0.13, recovery: 0.28,
                damage: Math.round((isGrappler ? 38 : 32) * pwrMul), pushback: 600, hitstop: 0.16,
                lift: isGrappler ? -440 : -390,
                unblockable: true,
                box: new Hitbox(-14, 45, isGrappler ? 176 : 146, 210),
                type: 'THROW'
            };
        } else if (type === 'SPECIAL') {
            if (this.isGrounded) this.vx = this.facing * 240;
            this.currentAttack = {
                startup: 0.07, active: 0.18, recovery: 0.26,
                damage: Math.round(38 * pwrMul), pushback: 280, hitstop: 0.13,
                lift: -160,
                isSpecialMove: true,
                box: new Hitbox(-16, 55, 215 + reachBonus, 175),
                type: 'SPECIAL'
            };
        } else if (type === 'SPECIAL_DASH') {
            this.currentAttack = {
                startup: 0.10, active: 0.32, recovery: 0.34,
                damage: Math.round(48 * pwrMul), pushback: 580, hitstop: 0.18,
                lift: -230,
                hasSuperArmor: true,
                isSpecialMove: true,
                box: new Hitbox(-20, 45, 218 + reachBonus, 195),
                type: 'SPECIAL_DASH'
            };
            this.isGrounded = false;
            this.y -= 70;
            this.vy = 0;
            this.vx = this.facing * 1450;
        }
        return true;
    }

    takeDamage(attackDef, attackerFacing) {
        if (this.state === 'KO' || (this.hp <= 0 && this.state !== 'DIZZY')) {
            this.hp = 0;
            this.state = 'KO';
            return 'IMMUNE';
        }

        // Chain-hit & Knockdown protection:
        // 1. Cannot be re-hit during hitImmunity frames
        // 2. Authentic Street Fighter II Knockdown & Air-Reset Rule: Once knocked down (isKnockedDown) or knocked airborne in HIT state (unless it's the remaining multi-hits of the exact same attackDef), the defender is invulnerable until they land and wake up!
        if (this.hitImmunity > 0 && this.state !== 'DIZZY') return 'IMMUNE';
        if (this.state === 'HIT' && this.isKnockedDown) return 'IMMUNE';
        if (this.state === 'HIT' && !this.isGrounded && this._lastHitAttackRef && this._lastHitAttackRef !== attackDef) {
            return 'IMMUNE';
        }
        this._lastHitAttackRef = attackDef;

        // Street Fighter "Guts" scaling + Combo Proration (anti-button-mash damage scaling!)
        const gutsMul = (this.hp / this.maxHP < 0.25) ? 0.82 : 1.0;
        const proration = Math.max(0.48, 1.0 - (this.consecutiveHitsTaken || 0) * 0.15);
        const scaledDamage = Math.max(1, Math.round(attackDef.damage * gutsMul * proration));
        const isSpecialOrProj = Boolean(attackDef.isSpecialMove || attackDef.type === 'SPECIAL' || attackDef.type === 'SPECIAL_DASH' || attackDef.type === 'PROJECTILE' || attackDef.type === 'DRAGON_UPPERCUT' || attackDef.type === 'HURRICANE_KICK' || attackDef.type === 'FLYING_TORPEDO' || attackDef.type === 'DRAGON_RUSH_COMBO' || attackDef.type === 'COMBO_FINISHER');
        const isHeavyOrCommand = Boolean(isSpecialOrProj || (attackDef.damage || 0) >= 24 || attackDef.type === 'AXE_KICK' || attackDef.type === 'COMMAND_PUNCH');

        // ─── VALHALLA BERSERKER SUPER-ARMOR CHECK ───
        // If this fighter is mid-swing in a Super-Armor Berserker attack and hit by a non-special normal poke, absorb the hit without flinching!
        if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.hasSuperArmor && !isSpecialOrProj && !attackDef.unblockable) {
            const armorDmg = Math.max(1, Math.round(scaledDamage * 0.5));
            if (this.hp > armorDmg + 1) {
                this.hp -= armorDmg;
                this.hitStop = 0.05;
                this.pendingStyleCallout = (this.data && this.data.styleId === 'KNEIPEN_TERRORIST') ? '🔥 IRON FLAME ARMOR!' : '⚡ VALHALLA SUPER ARMOR!';
                return 'HIT';
            }
        }

        // ─── BLOCK CHECK (SF2 rules: Throws are unblockable; Overhead breaks Crouching block; Low Sweep breaks Standing block!) ───
        const overheadBroken = Boolean(attackDef.isOverhead && this.state === 'CROUCH');
        const lowBroken = Boolean(attackDef.isLow && this.state !== 'CROUCH');
        const canBlockThis = this.isBlocking && !attackDef.unblockable && !overheadBroken && !lowBroken && this.state !== 'DIZZY';
        if (this.isBlocking && (overheadBroken || lowBroken)) {
            this.pendingStyleCallout = overheadBroken ? '⚡ OVERHEAD BREAK!' : '⚡ LOW GUARD BREAK!';
        }

        if (canBlockThis) {
            this.consecutiveHitsTaken = 0;
            const chipRatio = isSpecialOrProj ? 0.20 : 0.10;
            const chipDmg = Math.max(1, Math.floor(scaledDamage * chipRatio));
            if (isSpecialOrProj || (isHeavyOrCommand && this.hp <= 6)) {
                this.hp = Math.max(0, this.hp - chipDmg);
            } else {
                // Only light normal pokes leave 1 HP on block
                this.hp = Math.max(1, this.hp - chipDmg);
            }
            // Tiered Street Fighter Blockstun: Light = 110ms, Heavy/Command = 175ms, Special/Proj = 200ms
            this.blockStun = isSpecialOrProj ? 0.20 : (isHeavyOrCommand ? 0.175 : 0.11);
            this.hitStop = Math.max(0.055, (attackDef.hitstop || 0.08) * 0.65);
            this.vx = attackerFacing * attackDef.pushback * 0.55;
            if (this.state !== 'CROUCH') this.state = 'IDLE';

            if (this.hp <= 0) {
                this.hp = 0;
                this.blockStun = 0;
                this.hitStop = 0;
                this.activeHitbox = null;
                this.currentAttack = null;
                this.state = 'KO';
                this.vy = -600;
                this.isGrounded = false;
                this.vx = attackerFacing * attackDef.pushback * 2;
            }
            return 'BLOCKED';
        }

        // ─── FULL HIT ───
        // If hit while in Mid-Match Dizzy Stun, clear the stun immediately so they don't get re-dizzy-looped!
        if (this.midFightDizzyTimer > 0) {
            this.midFightDizzyTimer = 0;
            this.stunMeter = 0;
        } else {
            // Accumulate Street Fighter Stun Meter on unblocked hits (Sweeps/Specials/Heavy add more stun)
            const stunGain = isSpecialOrProj ? 22 : (isHeavyOrCommand ? 26 : 12);
            this.stunMeter = Math.min(100, (this.stunMeter || 0) + stunGain * proration);
            this.stunDecayTimer = 2.2;
        }

        this.hp = Math.max(0, this.hp - scaledDamage);
        this.stateTimer = 0;
        this.consecutiveHitsTaken = (this.consecutiveHitsTaken || 0) + 1;

        if (this.hp <= 0) {
            this.hp = 0;
            this.blockStun = 0;
            this.hitStop = 0;
            this.isKnockedDown = false;
            this.midFightDizzyTimer = 0;
            this.activeHitbox = null;
            this.currentAttack = null;
            this.state = 'KO';
            this.vy = -700;
            this.isGrounded = false;
            this.vx = attackerFacing * attackDef.pushback * 2.5;
        } else {
            this.state = 'HIT';
            // Determine Tiered Hitstun & Hard Knockdown (Sweep, Throw, Dragon Uppercut, Combo Finisher, or 5th combo hit)
            const causesKnockdown = Boolean(
                attackDef.type === 'SWEEP' ||
                attackDef.type === 'THROW' ||
                attackDef.type === 'DRAGON_UPPERCUT' ||
                attackDef.type === 'SPECIAL_DASH' ||
                attackDef.type === 'COMBO_FINISHER' ||
                this.consecutiveHitsTaken >= 5
            );
            this.isKnockedDown = causesKnockdown;
            this.hitStunDuration = causesKnockdown ? 0.52 : (isSpecialOrProj ? 0.34 : (isHeavyOrCommand ? 0.30 : 0.22));

            // Authentic Street Fighter II 5-Hit Combo Limit & Knockdown Immunity:
            // Allows full 3-to-4-button combos (including multi-hit Drehkicks/Uppercuts) to connect completely, then knocks back cleanly with wake-up immunity!
            if (causesKnockdown || this.consecutiveHitsTaken >= 5) {
                this.vx = attackerFacing * Math.max(440, (attackDef.pushback || 220) * 1.55);
                this.vy = -340;
                this.isGrounded = false;
                this.hitImmunity = 0.65;
                this.consecutiveHitsTaken = 0;
            } else {
                this.vx = attackerFacing * attackDef.pushback;
                if (attackDef.lift && (this.isGrounded || attackDef.type === 'DRAGON_UPPERCUT' || attackDef.type === 'HURRICANE_KICK' || attackDef.type === 'FLYING_TORPEDO' || attackDef.type === 'DRAGON_RUSH_COMBO')) {
                    this.vy = attackDef.lift;
                    this.isGrounded = false;
                }
            }
            this.hitStop = attackDef.hitstop;
        }
        return 'HIT';
    }

    /**
     * Resolve a sprite suffix (`_idle_2.png`, `_walk_1.png`, `_crouch.png`, etc.)
     * with clean fallbacks so every character supports the 21-sprite Street Fighter system.
     */
    _getSprite(suffix) {
        const imgs = this.game.assetManager.images;
        const id = this.data.id;

        const exactKey = `${id}${suffix}`;
        if (imgs[exactKey]) return imgs[exactKey];
        const fallbackKey = `${exactKey}_fallback`;
        if (imgs[fallbackKey]) return imgs[fallbackKey];
        return null;
    }

    draw(ctx) {
        ctx.save();

        // Authentic Street Fighter Hit-Jitter during hitStop when taking damage or blocking, or wobble during DIZZY ("FINISH HIM!")
        let jitterX = 0;
        if (this.state === 'DIZZY') {
            jitterX = Math.sin(this.animTime * 9.5) * 11;
        } else if (this.hitStop > 0 && (this.state === 'HIT' || this.blockStun > 0)) {
            jitterX = Math.sin(this.animTime * 125) * 7;
        }
        ctx.translate(this.x + jitterX, this.y);

        // ─── FIGHT STYLE GROUND RING (Visual indicator of each fighter's martial arts style) ───
        if (this.state !== 'KO' && this.styleInfo) {
            ctx.save();
            const pulse = 0.75 + Math.sin(this.animTime * 5) * 0.22;
            ctx.globalAlpha = (this.state === 'ATTACK' ? 0.58 : 0.30) * pulse;
            ctx.strokeStyle = this.styleInfo.color || '#00e5ff';
            ctx.shadowColor = this.styleInfo.color || '#00e5ff';
            ctx.shadowBlur = 14;
            ctx.lineWidth = this.state === 'ATTACK' ? 4 : 2.5;
            ctx.beginPath();
            ctx.ellipse(0, -6, 68, 15, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 1. Determine which sprite to draw
        let spriteImage = null;
        let exactKey = '';
        let suffix = '_right.png';

        if (this.game && this.game.settings && this.game.settings.autoFacingEnabled === false) {
            if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP' || this.state === 'CROUCH' || this.state === 'DASH') {
                suffix = '_right.png';
            } else if (this.state === 'ATTACK') {
                if (this.currentAttack && (this.currentAttack.type === 'SPECIAL' || this.currentAttack.type === 'COMBO_FINISHER')) suffix = '_special.png';
                else if (this.currentAttack && (this.currentAttack.type === 'HEAVY' || this.currentAttack.type === 'SWEEP' || this.currentAttack.type === 'COMBO_KICK')) suffix = '_kick.png';
                else suffix = '_punch.png';
            } else if (this.state === 'HIT' || this.state === 'DIZZY') suffix = '_hit.png';
            else if (this.state === 'KO') suffix = '_ko.png';
            else if (this.state === 'WIN') suffix = '_win.png';
            spriteImage = this._getSprite(suffix);
        } else {
            // ─── UNIFIED 24-SPRITE STREET FIGHTER ANIMATION STATE MACHINE (WITH DISTINCT FIGHTING STYLE STANCES & WALK CADENCES) ───
            const drawStyleId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
            const walkFreq = drawStyleId === 'SHADOW_ASSASSIN' ? 10.5
                : (drawStyleId === 'MASTER_STRIKER' ? 9.2
                : (drawStyleId === 'CAPOEIRA_TRICKSTER' ? 8.8
                : (drawStyleId === 'LIGHT_DRAGON' ? 8.2
                : (drawStyleId === 'TITAN_GRAPPLER' ? 5.6 : 7.2))));
            const walkCycleIdx = Math.floor(this.animTime * walkFreq) % 4;

            if ((this.isActivelyGuarding || this.blockStun > 0) && this.state !== 'KO' && this.state !== 'HIT' && this.state !== 'DIZZY') {
                suffix = (this.state === 'CROUCH') ? '_crouch.png' : '_block.png';
            } else if (this.state === 'DIZZY') {
                suffix = '_hit.png';
            } else if (this.state === 'IDLE') {
                if (drawStyleId === 'CAPOEIRA_TRICKSTER') {
                    // Capoeira Ginga rhythmic footwork dance in IDLE!
                    const gingaStep = Math.floor(this.animTime * 3.6) % 4;
                    suffix = (gingaStep === 1) ? '_walk_1.png' : ((gingaStep === 3) ? '_walk_2.png' : '_right.png');
                } else {
                    suffix = '_right.png';
                }
            } else if (this.state === 'WALK') {
                // 4-step alternating leg stride cycle locked to reference foot/torso baseline
                if (walkCycleIdx === 0) suffix = '_walk_1.png';
                else if (walkCycleIdx === 1) suffix = '_right.png';
                else if (walkCycleIdx === 2) suffix = '_walk_2.png';
                else suffix = '_right.png';
            } else if (this.state === 'CROUCH') {
                suffix = '_crouch.png';
            } else if (this.state === 'DASH') {
                const isForwardDash = (this.vx * this.facing >= 0);
                if (isForwardDash) {
                    suffix = drawStyleId === 'SHADOW_ASSASSIN' ? '_backfist.png'
                        : (drawStyleId === 'CAPOEIRA_TRICKSTER' ? '_spin_kick.png' : '_hook_punch.png');
                } else {
                    suffix = '_jump.png';
                }
            } else if (this.state === 'JUMP') {
                // Straight jump uses _jump.png; diagonal forward/backward jump uses _jump.png
                if (Math.abs(this.vx) >= 25) {
                    suffix = '_jump.png';
                } else if (Math.abs(this.vy) < 520) {
                    suffix = '_dive_kick.png';
                } else {
                    suffix = '_jump.png';
                }
            } else if (this.state === 'ATTACK') {
                const phase = this.stateTimer;
                const startup = this.currentAttack ? this.currentAttack.startup : 0.05;
                const active = this.currentAttack ? this.currentAttack.active : 0.15;
                const recovery = this.currentAttack ? this.currentAttack.recovery : 0.18;
                const midPoint = startup + active * 0.28;
                const retractStart = startup + active + recovery * 0.55;
                const atkType = this.currentAttack ? this.currentAttack.type : 'LIGHT';

                if (atkType === 'DRAGON_UPPERCUT') {
                    // Rising Shoryuken Dragon Uppercut OR Guile Somersault Flash Kick OR E. Honda Sumo Butt Splash!
                    const sigArch = this._getSignatureArchetype();
                    if (drawStyleId === 'HONDA_SUMO_BRAWLER') {
                        if (phase < startup) suffix = '_crouch.png';
                        else suffix = '_dragon_uppercut.png';
                    } else if (sigArch === 'GUILE_FLASH_KICK') {
                        if (phase < startup) suffix = '_crouch.png';
                        else if (phase < startup + active * 0.52) suffix = '_axe_kick.png';
                        else if (phase < retractStart) suffix = '_spin_kick.png';
                        else suffix = '_jump.png';
                    } else {
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < startup + active * 0.42) suffix = '_uppercut.png';
                        else if (phase < retractStart) suffix = '_dragon_uppercut.png';
                        else suffix = '_jump.png';
                    }
                } else if (atkType === 'FLYING_TORPEDO') {
                    // Character-Specific Street Fighter Signature Flight Pose!
                    const sigArch = this._getSignatureArchetype();
                    if (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi') {
                        // Authentic E. Honda Horizontal Flying Headbutt Torpedo (Super Zutsuki)!
                        suffix = '_hurricane_kick.png';
                    } else if (sigArch === 'CHUNLI_BIRD_KICK') {
                        suffix = (Math.floor(phase * 22) % 2 === 0) ? '_spin_kick.png' : '_hurricane_kick.png';
                    } else if (sigArch === 'ZANGIEF_LARIAT') {
                        suffix = (Math.floor(phase * 20) % 2 === 0) ? '_hook_punch.png' : '_backfist.png';
                    } else if (sigArch === 'GUILE_FLASH_KICK') {
                        suffix = (phase < startup + active * 0.5) ? '_axe_kick.png' : '_spin_kick.png';
                    } else if (sigArch === 'BLANKA_CANNONBALL') {
                        suffix = '_jump.png';
                    } else if (phase < startup + active * 0.55) {
                        suffix = '_dive_kick.png';
                    } else if (phase < retractStart) {
                        suffix = '_special.png';
                    } else {
                        suffix = '_jump.png';
                    }
                } else if (atkType === 'DRAGON_RUSH_COMBO') {
                    if (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi') {
                        // E. Honda Hundred Hand Slap Rush (Hyakuretsu Harite): ultra-fast alternating open-palm slaps!
                        const slapFrame = Math.floor(phase * 26) % 3;
                        suffix = slapFrame === 0 ? '_special.png' : (slapFrame === 1 ? '_punch.png' : '_hook_punch.png');
                    } else {
                        // Full-screen 4-pose Street Fighter Rush: _hurricane_kick -> _punch -> _hook_punch -> _dragon_uppercut!
                        const activeProgress = Math.max(0, Math.min(0.999, (phase - startup) / Math.max(0.01, active)));
                        const rushStep = Math.floor(activeProgress * 4);
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (rushStep === 0) suffix = '_hurricane_kick.png';
                        else if (rushStep === 1) suffix = '_punch.png';
                        else if (rushStep === 2) suffix = '_hook_punch.png';
                        else suffix = '_dragon_uppercut.png';
                    }
                } else if (atkType === 'HURRICANE_KICK') {
                    if (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi') {
                        // E. Honda Sumo Butt Splash (Hyakkan Otoshi)!
                        suffix = '_dragon_uppercut.png';
                    } else {
                        // Spinning Tatsumaki Cyclone Kick: alternates _hurricane_kick, _spin_kick, and _dive_kick rapidly!
                        const spinStep = Math.floor(phase * 18) % 3;
                        if (phase < startup) suffix = '_jump.png';
                        else if (spinStep === 0) suffix = '_hurricane_kick.png';
                        else if (spinStep === 1) suffix = '_spin_kick.png';
                        else suffix = '_dive_kick.png';
                    }
                } else if (atkType === 'COMMAND_PUNCH') {
                    if (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi') {
                        // E. Honda Hundred Hand Slap (Hyakuretsu Harite)!
                        const slapFrame = Math.floor(phase * 26) % 3;
                        suffix = slapFrame === 0 ? '_special.png' : (slapFrame === 1 ? '_punch.png' : '_hook_punch.png');
                    } else {
                        // → + L Overhead Backfist: Windup -> Backfist -> Hook Follow-through
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < startup + active * 0.72) suffix = '_backfist.png';
                        else if (phase < retractStart) suffix = '_hook_punch.png';
                        else suffix = '_mid_punch.png';
                    }
                } else if (atkType === 'AXE_KICK') {
                    // → + H Step Axe Kick: Windup Kick -> High Axe Kick -> Downward Kick Chop
                    if (phase < startup) suffix = '_windup_kick.png';
                    else if (phase < startup + active * 0.68) suffix = '_axe_kick.png';
                    else if (phase < retractStart) suffix = '_kick.png';
                    else suffix = '_mid_kick.png';
                } else if (atkType === 'THROW') {
                    // Close-range Grapple Slam
                    if (phase < startup) suffix = '_windup_punch.png';
                    else if (phase < startup + active * 0.60) suffix = '_backfist.png';
                    else suffix = '_hook_punch.png';
                } else if (!this.isGrounded && atkType !== 'SPECIAL' && atkType !== 'SPECIAL_DASH' && atkType !== 'FLYING_TORPEDO' && atkType !== 'DRAGON_RUSH_COMBO') {
                    // Aerial Salto-Kick / Hurricane Flip Kick!
                    if (phase < startup) suffix = '_jump.png';
                    else if (phase < startup + active * 0.55) suffix = '_spin_kick.png';
                    else if (phase < retractStart) suffix = '_dive_kick.png';
                    else suffix = '_jump.png';
                } else if (atkType === 'LIGHT') {
                    const stId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                    if (stId === 'HONDA_SUMO_BRAWLER') {
                        // E. Honda Open-Palm Sumo Harite Slap!
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < retractStart) suffix = '_punch.png';
                        else suffix = '_special.png';
                    } else if (stId === 'CAPOEIRA_TRICKSTER') {
                        // Capoeira Trickster: Handstand Spin Kick on Light!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < retractStart) suffix = '_spin_kick.png';
                        else suffix = '_mid_kick.png';
                    } else if (stId === 'SHADOW_ASSASSIN') {
                        // Shadow Assassin: Lightning Ninja Backfist Slash!
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < retractStart) suffix = '_backfist.png';
                        else suffix = '_mid_punch.png';
                    } else if (stId === 'KNEIPEN_TERRORIST') {
                        // Kneipenterrorist 1st Hit: Bratpfannen Forehand Smash!
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < retractStart) suffix = '_punch.png';
                        else suffix = '_hook_punch.png';
                    } else if (stId === 'TITAN_GRAPPLER' || stId === 'VALHALLA_BERSERKER') {
                        // Heavy Brawler / Berserker: Crushing Hook Smash!
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < retractStart) suffix = '_hook_punch.png';
                        else suffix = '_punch.png';
                    } else {
                        if (phase < startup) suffix = '_windup_punch.png';
                        else if (phase < midPoint) suffix = '_mid_punch.png';
                        else if (phase < retractStart) suffix = '_punch.png';
                        else suffix = '_mid_punch.png';
                    }
                } else if (atkType === 'COMBO_KICK') {
                    const stId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                    if (stId === 'HONDA_SUMO_BRAWLER') {
                        // E. Honda 2nd Hit: Rapid Double Palm Slap!
                        const slapIdx = Math.floor(phase * 24) % 2;
                        suffix = slapIdx === 0 ? '_special.png' : '_punch.png';
                    } else if (stId === 'CAPOEIRA_TRICKSTER') {
                        // Capoeira 2nd Hit: Low Cartwheel Sweep -> 360° Drehkick!
                        if (phase < startup) suffix = '_crouch.png';
                        else if (phase < midPoint) suffix = '_low_kick.png';
                        else if (phase < retractStart) suffix = '_spin_kick.png';
                        else suffix = '_hurricane_kick.png';
                    } else {
                        // Authentic 360° Street Fighter / Tekken Roundhouse Drehkick (_spin_kick -> _hurricane_kick) for all fighters!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < midPoint) suffix = '_spin_kick.png';
                        else if (phase < retractStart) suffix = '_hurricane_kick.png';
                        else suffix = '_mid_kick.png';
                    }
                } else if (atkType === 'COMBO_FINISHER') {
                    const stId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                    if (stId === 'HONDA_SUMO_BRAWLER') {
                        // E. Honda 3rd Hit Finisher: Hundred Hand Slap Barrage!
                        const slapFrame = Math.floor(phase * 26) % 3;
                        suffix = slapFrame === 0 ? '_special.png' : (slapFrame === 1 ? '_punch.png' : '_hook_punch.png');
                    } else if (stId === 'CAPOEIRA_TRICKSTER') {
                        if (phase < startup) suffix = '_spin_kick.png';
                        else if (phase < retractStart) suffix = '_hurricane_kick.png';
                        else suffix = '_axe_kick.png';
                    } else if (stId === 'KNEIPEN_TERRORIST') {
                        // Kneipenterrorist 3rd Hit: Blazing Bratpfannen Uppercut -> Homerun Batter Finish!
                        if (phase < startup) suffix = '_uppercut.png';
                        else if (phase < startup + active * 0.50) suffix = '_dragon_uppercut.png';
                        else if (phase < retractStart) suffix = '_special.png';
                        else suffix = '_right.png';
                    } else if (stId === 'SHADOW_ASSASSIN') {
                        if (phase < startup) suffix = '_backfist.png';
                        else if (phase < retractStart) suffix = '_dive_kick.png';
                        else suffix = '_special.png';
                    } else {
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < startup + active * 0.38) suffix = '_spin_kick.png';
                        else if (phase < startup + active * 0.78) suffix = '_dragon_uppercut.png';
                        else if (phase < retractStart) suffix = '_special.png';
                        else suffix = '_right.png';
                    }
                } else if (atkType === 'CROUCH_LIGHT' || atkType === 'SWEEP') {
                    if (phase < startup) suffix = '_crouch.png';
                    else if (phase < midPoint) suffix = '_mid_kick.png';
                    else if (phase < retractStart) suffix = '_low_kick.png';
                    else suffix = '_crouch.png';
                } else if (atkType === 'HEAVY') {
                    const stId = (this.data && this.data.styleId) || 'LIGHT_DRAGON';
                    if (stId === 'CAPOEIRA_TRICKSTER') {
                        // Capoeira Heavy: Flying Acrobat Dive-Axe Kick!
                        if (phase < startup) suffix = '_jump.png';
                        else if (phase < startup + active * 0.55) suffix = '_dive_kick.png';
                        else if (phase < retractStart) suffix = '_axe_kick.png';
                        else suffix = '_spin_kick.png';
                    } else if (stId === 'KNEIPEN_TERRORIST') {
                        // Kneipenterrorist Heavy: High-Top Sneaker Front Stomp -> Spinning Roundhouse!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < startup + active * 0.50) suffix = '_kick.png';
                        else if (phase < retractStart) suffix = '_spin_kick.png';
                        else suffix = '_axe_kick.png';
                    } else if (stId === 'SHADOW_ASSASSIN') {
                        // Shadow Assassin Heavy: Spinning Hurricane Crescent Kick!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < startup + active * 0.55) suffix = '_spin_kick.png';
                        else if (phase < retractStart) suffix = '_hurricane_kick.png';
                        else suffix = '_mid_kick.png';
                    } else if (stId === 'VALHALLA_BERSERKER') {
                        // Valhalla Berserker Heavy: Overhead Cleaver Axe Smash!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < retractStart) suffix = '_axe_kick.png';
                        else suffix = '_kick.png';
                    } else if (stId === 'TITAN_GRAPPLER') {
                        // Titan Grappler Heavy: Crushing Boot / Dropkick Impact!
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < startup + active * 0.60) suffix = '_dive_kick.png';
                        else if (phase < retractStart) suffix = '_kick.png';
                        else suffix = '_mid_kick.png';
                    } else {
                        if (phase < startup) suffix = '_windup_kick.png';
                        else if (phase < midPoint) suffix = '_mid_kick.png';
                        else if (phase < startup + active * 0.72) suffix = '_kick.png';
                        else if (phase < retractStart) suffix = '_spin_kick.png';
                        else suffix = '_mid_kick.png';
                    }
                } else if (atkType === 'SPECIAL') {
                    if (phase < startup * 0.75) suffix = '_windup_punch.png';
                    else suffix = '_special.png';
                } else if (atkType === 'SPECIAL_DASH') {
                    suffix = (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi') ? '_hurricane_kick.png' : '_dive_kick.png';
                } else {
                    suffix = '_punch.png';
                }
            } else if (this.state === 'HIT') {
                if (this.isKnockedDown && this.isGrounded && this.stateTimer >= 0.08) {
                    const reqStun = Math.max(0.56, this.hitStunDuration || 0.56);
                    suffix = (this.stateTimer >= reqStun - 0.14) ? '_crouch.png' : '_ko.png';
                } else {
                    suffix = '_hit.png';
                }
            } else if (this.state === 'KO') {
                suffix = '_ko.png';
            } else if (this.state === 'WIN') {
                suffix = '_win.png';
            }

            spriteImage = this._getSprite(suffix);

            // Clean fallbacks if an optional frame hasn't finished loading yet
            if (!spriteImage) {
                if (suffix === '_idle_2.png' || suffix === '_walk.png' || suffix === '_walk_1.png' || suffix === '_walk_2.png' || suffix === '_crouch.png' || suffix === '_block.png' || suffix === '_jump.png' || suffix === '_windup_punch.png' || suffix === '_windup_kick.png') {
                    spriteImage = this._getSprite('_right.png');
                } else if (suffix === '_mid_punch.png' || suffix === '_hook_punch.png' || suffix === '_uppercut.png' || suffix === '_backfist.png' || suffix === '_dragon_uppercut.png') {
                    spriteImage = this._getSprite('_punch.png') || this._getSprite('_right.png');
                } else if (suffix === '_mid_kick.png' || suffix === '_spin_kick.png' || suffix === '_low_kick.png' || suffix === '_dive_kick.png' || suffix === '_axe_kick.png' || suffix === '_hurricane_kick.png') {
                    spriteImage = this._getSprite('_kick.png') || this._getSprite('_right.png');
                }
            }
            if (!spriteImage && this.state === 'ATTACK') {
                spriteImage = this._getSprite('_kick.png') || this._getSprite('_punch.png');
            }
            if (!spriteImage) {
                spriteImage = this._getSprite('_right.png');
            }

            if (!spriteImage) {
                // Emergency visual fallback while sprites finish streaming over mobile network so a fighter is NEVER invisible!
                const drawFacing = this.facing || 1;
                ctx.scale(drawFacing, 1);
                ctx.fillStyle = this.color === 'red' ? 'rgba(255, 40, 80, 0.85)' : (this.color === 'purple' ? 'rgba(180, 80, 255, 0.85)' : 'rgba(0, 220, 255, 0.85)');
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, -320, 42, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillRect(-48, -270, 96, 160);
                ctx.strokeRect(-48, -270, 96, 160);
                ctx.fillRect(-44, -110, 36, 110);
                ctx.fillRect(8, -110, 36, 110);
                ctx.scale(drawFacing, 1);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 18px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText((this.data && this.data.name) || 'FIGHTER', 0, -380);
                ctx.restore();
                return;
            }

            // --- SAFETY: Prevent Ghost Trading Cards on K.O. ---
            if ((this.state === 'KO' || this.state === 'HIT') && spriteImage && spriteImage.naturalHeight > spriteImage.naturalWidth * 1.05) {
                const hitImg = this._getSprite('_hit.png');
                if (hitImg && hitImg.naturalHeight <= hitImg.naturalWidth * 1.05) {
                    spriteImage = hitImg;
                } else {
                    const idleImg = this._getSprite('_right.png');
                    if (idleImg && idleImg.naturalHeight <= idleImg.naturalWidth * 1.05) {
                        spriteImage = idleImg;
                    } else {
                        ctx.restore();
                        return;
                    }
                }
            }

            if (!spriteImage.naturalHeight || !spriteImage.naturalWidth) {
                ctx.restore();
                return;
            }

            // Lock scale to reference _right.png height (640px) for Annikina & stance-derived frames
            const refIdleImg = this._getSprite('_right.png');
            const isStanceDerived = (this.data?.id === 'Annikina' || suffix === '_right.png' || suffix === '_idle_2.png' || suffix === '_walk.png' || suffix === '_walk_1.png' || suffix === '_walk_2.png' || suffix === '_crouch.png' || suffix === '_block.png' || suffix === '_jump.png' || suffix === '_windup_punch.png' || suffix === '_windup_kick.png');
            const refH = (isStanceDerived && refIdleImg && refIdleImg.naturalHeight) ? refIdleImg.naturalHeight : spriteImage.naturalHeight;
            const targetHeight = 400 * (this.data?.heightScale || 1.0);
            const scale = targetHeight / refH;
            const drawW = spriteImage.naturalWidth * scale;
            const drawH = spriteImage.naturalHeight * scale;

            const drawFacing = this.facing;
            ctx.scale(drawFacing, 1);

            // ─── DRAW GHOST TRAIL (STREET FIGHTER ALPHA AFTERIMAGES) ───
            if (this.ghosts && this.ghosts.length > 0) {
                ctx.save();
                ctx.scale(drawFacing, 1);
                ctx.translate(-(this.x + jitterX), -this.y);
                for (const g of this.ghosts) {
                    ctx.save();
                    ctx.translate(g.x, g.y);
                    ctx.scale(g.facing, 1);
                    if (!g.isDashGhost && this.data?.id !== 'AliAbi' && this.data?.styleId !== 'HONDA_SUMO_BRAWLER') {
                        ctx.translate(0, -drawH / 2);
                        ctx.rotate(g.timer * 25.0 * g.facing);
                        ctx.translate(0, drawH / 2);
                    }

                    ctx.globalAlpha = g.age * (g.isDashGhost ? 0.50 : 0.68);
                    ctx.globalCompositeOperation = 'screen';
                    ctx.shadowColor = (this.styleInfo && this.styleInfo.color) || '#00e5ff';
                    ctx.shadowBlur = 18;
                    ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
                    ctx.restore();
                }
                ctx.restore();
            }

            // ─── DISTINCT FIGHTING STYLE STANCE MOVEMENTS, FOOTWORK & DHALSIM LIMB STRETCH ───
            let poseScaleX = 1.0;
            let poseScaleY = 1.0;
            let stanceOffsetX = 0;
            let stanceOffsetY = 0;
            let stanceLeanRad = 0;
            const sigArch = this._getSignatureArchetype();
            if (this.landingTimer > 0 && this.state === 'IDLE') {
                const landAmt = this.landingTimer / 0.14;
                poseScaleX = 1.0 + landAmt * 0.04;
                poseScaleY = 1.0 - landAmt * 0.05;
            } else if (this.state === 'IDLE') {
                if (drawStyleId === 'CAPOEIRA_TRICKSTER') {
                    // Brazilian Capoeira Ginga: rhythmic side-to-side sway and knee bounce!
                    stanceOffsetX = Math.sin(this.animTime * 4.2) * 8;
                    stanceOffsetY = -Math.abs(Math.cos(this.animTime * 4.2)) * 5;
                    stanceLeanRad = Math.sin(this.animTime * 4.2) * 0.032;
                } else if (drawStyleId === 'LIGHT_DRAGON') {
                    // Boxer / Karate Shoto bounce on the balls of the feet!
                    stanceOffsetY = -Math.abs(Math.sin(this.animTime * 5.2)) * 5.5;
                    stanceOffsetX = Math.cos(this.animTime * 2.6) * 3;
                } else if (drawStyleId === 'SHADOW_ASSASSIN') {
                    // Shinobi Predator forward-leaning poise!
                    const breath = Math.sin(this.animTime * 3.2);
                    poseScaleY = 0.985 + breath * 0.008;
                    stanceLeanRad = 0.042;
                } else if (drawStyleId === 'TITAN_GRAPPLER') {
                    // Heavyweight Juggernaut deep chest breathing!
                    const breath = Math.sin(this.animTime * 2.2);
                    poseScaleX = 1.0 + breath * 0.014;
                    poseScaleY = 1.0 + breath * 0.012;
                } else if (drawStyleId === 'VALHALLA_BERSERKER') {
                    // Valhalla Berserker aggressive war-ready breathing!
                    const breath = Math.sin(this.animTime * 3.8);
                    poseScaleX = 1.0 + breath * 0.010;
                    poseScaleY = 1.0 + breath * 0.010;
                    stanceLeanRad = 0.024;
                } else if (drawStyleId === 'KNEIPEN_TERRORIST') {
                    // Street-Brawler swagger sway!
                    stanceOffsetX = Math.sin(this.animTime * 3.6) * 5;
                    stanceOffsetY = -Math.abs(Math.sin(this.animTime * 3.6)) * 3.5;
                } else {
                    // Master Striker calm precision breathing!
                    const breath = Math.sin(this.animTime * 2.8);
                    poseScaleX = 1.0 - breath * 0.004;
                    poseScaleY = 1.0 + breath * 0.008;
                }
            } else if (this.state === 'WALK') {
                if (drawStyleId === 'SHADOW_ASSASSIN') {
                    stanceLeanRad = 0.065; // Ninja sprint lean!
                } else if (drawStyleId === 'TITAN_GRAPPLER') {
                    stanceOffsetY = -Math.abs(Math.sin(this.animTime * walkFreq * Math.PI)) * 6; // Heavy stomp!
                }
            } else if (this.state === 'ATTACK' && this.currentAttack) {
                const p = this.stateTimer;
                const st = this.currentAttack.startup || 0.05;
                const act = this.currentAttack.active || 0.15;
                const atkT = this.currentAttack.type;
                if (sigArch === 'DHALSIM_DRILL' && (atkT === 'HEAVY' || atkT === 'COMMAND_PUNCH' || atkT === 'AXE_KICK' || atkT === 'COMBO_FINISHER') && p >= st && p <= st + act) {
                    // Dhalsim Yoga Stretch-Limb extension on heavy/command pokes!
                    poseScaleX = 1.28;
                    poseScaleY = 0.94;
                } else if (p < st) {
                    poseScaleX = 0.98;
                    poseScaleY = 0.99;
                } else if (p < st + act * 0.65) {
                    poseScaleX = 1.03;
                    poseScaleY = 0.99;
                }
            }

            // ─── 360° SALTO ON FORWARD/BACKWARD JUMP (FOR ALL FIGHTERS!) + SPECIAL DASH + BLANKA CANNONBALL / GUILE SOMERSAULT ───
            const isHondaBrawler = (drawStyleId === 'HONDA_SUMO_BRAWLER' || this.data?.id === 'AliAbi');
            let isRolling = false;
            let currentRotation = 0;
            if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'SPECIAL_DASH' && !isHondaBrawler) {
                isRolling = true;
                const spinSpeed = 25.0;
                currentRotation = this.stateTimer * spinSpeed * this.facing;
            } else if (this.state === 'ATTACK' && this.currentAttack && (this.currentAttack.type === 'FLYING_TORPEDO' || this.currentAttack.type === 'DRAGON_RUSH_COMBO') && sigArch === 'BLANKA_CANNONBALL') {
                // Blanka Rolling Cannonball: fast 360°-spinning cannonball across the stage!
                isRolling = true;
                currentRotation = this.stateTimer * 32.0 * this.facing;
            } else if (this.state === 'ATTACK' && this.currentAttack && (this.currentAttack.type === 'FLYING_TORPEDO' || this.currentAttack.type === 'DRAGON_RUSH_COMBO' || this.currentAttack.type === 'DRAGON_UPPERCUT') && sigArch === 'GUILE_FLASH_KICK') {
                // Guile Somersault Flash Kick: high backflip somersault!
                isRolling = true;
                currentRotation = -this.stateTimer * 18.0 * this.facing;
            } else if (!this.isGrounded && (Math.abs(this.vx) >= 25 || (this.state === 'DASH' && this.vy < -150)) && (this.state === 'JUMP' || this.state === 'DASH' || (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type !== 'SPECIAL' && this.currentAttack.type !== 'SPECIAL_DASH' && this.currentAttack.type !== 'DRAGON_UPPERCUT' && this.currentAttack.type !== 'HURRICANE_KICK' && this.currentAttack.type !== 'FLYING_TORPEDO' && this.currentAttack.type !== 'DRAGON_RUSH_COMBO'))) {
                // Every fighter performs a crisp 360° Forward/Backward Salto on diagonal jumps & back-flip dashes!
                isRolling = true;
                const saltoDir = (this.vx * this.facing >= 0) ? 1 : -1;
                const saltoSpeed = (this.state === 'ATTACK') ? 14.5 : (this.state === 'DASH' ? 16.0 : 11.2);
                currentRotation = (this.jumpTime || this.stateTimer || 0) * saltoSpeed * saltoDir;
            }

            ctx.save();
            if (stanceOffsetX !== 0 || stanceOffsetY !== 0) {
                ctx.translate(stanceOffsetX, stanceOffsetY);
            }
            if (stanceLeanRad !== 0) {
                ctx.rotate(stanceLeanRad);
            }
            if (isRolling) {
                ctx.translate(0, -drawH * 0.52);
                ctx.rotate(currentRotation);
                ctx.translate(0, drawH * 0.52);
            } else if (this.state === 'ATTACK' && this.currentAttack && (this.currentAttack.type === 'FLYING_TORPEDO' || (this.currentAttack.type === 'SPECIAL_DASH' && isHondaBrawler))) {
                if (isHondaBrawler) {
                    // Authentic E. Honda Flying Headbutt / Döner-Spieß Horizontal Torpedo:
                    // _hurricane_kick.png is already drawn horizontally flying head-first! Add horizontal spit-rotation pulse!
                    const spitScaleY = 0.94 + Math.sin(this.stateTimer * 38) * 0.08;
                    ctx.translate(0, -drawH * 0.52);
                    ctx.scale(1.04, spitScaleY);
                    ctx.translate(0, drawH * 0.52);
                } else if (sigArch === 'CHUNLI_BIRD_KICK') {
                    // Chun-Li Upside-Down Spinning Bird Kick helicopter spin!
                    const spinFlip = Math.cos(this.stateTimer * 36) >= 0 ? 1 : -1;
                    ctx.translate(0, -drawH * 0.52);
                    ctx.scale(spinFlip, -1);
                    ctx.translate(0, drawH * 0.52);
                } else if (sigArch === 'ZANGIEF_LARIAT') {
                    // Zangief / Thor 360° Double Lariat cyclone spin!
                    const spinFlip = Math.cos(this.stateTimer * 38) >= 0 ? 1 : -1;
                    ctx.scale(spinFlip, 1);
                } else if (sigArch === 'BISON_PSYCHO_CRUSHER') {
                    // M. Bison Psycho Crusher horizontal corkscrew tilt!
                    ctx.translate(0, -drawH * 0.52);
                    ctx.rotate(this.facing * 1.35);
                    ctx.translate(0, drawH * 0.52);
                } else if (sigArch === 'HONDA_SUMO_TORPEDO' || sigArch === 'DHALSIM_DRILL') {
                    // E. Honda Sumo Headbutt / Dhalsim Yoga Drill horizontal torpedo flight!
                    ctx.translate(0, -drawH * 0.52);
                    ctx.rotate(this.facing * 1.25);
                    ctx.translate(0, drawH * 0.52);
                } else {
                    ctx.translate(0, -drawH * 0.52);
                    ctx.rotate(this.facing * 0.22);
                    ctx.translate(0, drawH * 0.52);
                }
            } else if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'HURRICANE_KICK' && !isHondaBrawler) {
                // Horizontal cyclone spin wobble for Tatsumaki Hurricane Kick!
                const spinFlip = Math.cos(this.stateTimer * 32) >= 0 ? 1 : -1;
                ctx.scale(spinFlip, 1);
            } else if (poseScaleX !== 1.0 || poseScaleY !== 1.0) {
                ctx.scale(poseScaleX, poseScaleY);
            }

            // Draw relative to bottom-center (0,0 is now the character's feet)
            if (this.state === 'HIT' && this.game.settings.hitFlashEnabled) {
                const cw = Math.max(1, Math.ceil(drawW));
                const ch = Math.max(1, Math.ceil(drawH));
                if (!this._flashCanvas) {
                    this._flashCanvas = document.createElement('canvas');
                    this._flashCtx = this._flashCanvas.getContext('2d');
                }
                if (this._flashCanvas.width !== cw || this._flashCanvas.height !== ch) {
                    this._flashCanvas.width = cw;
                    this._flashCanvas.height = ch;
                }
                const offCtx = this._flashCtx;
                offCtx.globalCompositeOperation = 'source-over';
                offCtx.globalAlpha = 1.0;
                offCtx.clearRect(0, 0, cw, ch);
                offCtx.drawImage(spriteImage, 0, 0, drawW, drawH);
                offCtx.globalCompositeOperation = 'source-atop';
                offCtx.globalAlpha = 0.45;
                offCtx.fillStyle = '#ffffff';
                offCtx.fillRect(0, 0, cw, ch);
                ctx.drawImage(this._flashCanvas, -drawW / 2, -drawH, drawW, drawH);
            } else {
                ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
            }
            ctx.restore();

            // ─── DYNAMIC STREET FIGHTER SLASH ARCS & LIMB AURA VFX LAYER ───
            this._drawStreetFighterSlashVFX(ctx, drawW, drawH);

            // ─── MORTAL KOMBAT "FINISH HIM!" DIZZY STARS HALO ───
            if (this.state === 'DIZZY') {
                ctx.save();
                for (let s = 0; s < 4; s++) {
                    const ang = this.animTime * 4.8 + (s * Math.PI) / 2;
                    const sx = Math.cos(ang) * 58;
                    const sy = -drawH + 22 + Math.sin(ang) * 14;
                    ctx.fillStyle = s % 2 === 0 ? '#ffd700' : '#ff3300';
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            // ─── NEON ENERGY BLOCK SHIELD ───
            if ((this.isActivelyGuarding || this.blockStun > 0) && this.state !== 'KO') {
                ctx.save();
                const isAbsorbing = this.blockStun > 0;
                const shieldH = (this.state === 'CROUCH') ? drawH * 0.55 : drawH * 0.78;
                const shieldY = -shieldH * 0.58;
                const pulse = 0.85 + Math.sin(this.animTime * 18) * 0.15;
                ctx.globalAlpha = (isAbsorbing ? 0.85 : 0.42) * pulse;
                ctx.strokeStyle = isAbsorbing ? '#ffffff' : '#00eeff';
                ctx.fillStyle = isAbsorbing ? 'rgba(0, 255, 255, 0.35)' : 'rgba(0, 212, 255, 0.14)';
                ctx.shadowColor = '#00eeff';
                ctx.shadowBlur = isAbsorbing ? 28 : 16;
                ctx.lineWidth = isAbsorbing ? 6 : 3.5;

                ctx.beginPath();
                ctx.ellipse(55, shieldY, 42, shieldH * 0.52, 0, -Math.PI * 0.42, Math.PI * 0.42);
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            }

            ctx.scale(this.facing, 1); // Reverse the scale here so hitboxes draw correctly
        }

        // 3. Debug: Draw Hitboxes strictly if active
        const debugHitboxes = false;
        if (debugHitboxes) {
            const hw = this.hurtbox.width;
            const hh = this.hurtbox.height;
            const hx = this.facing === 1 ? this.hurtbox.offsetX : -(this.hurtbox.offsetX + hw);
            const hy = -this.hurtbox.offsetY - hh;

            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hx, hy, hw, hh);

            if (this.activeHitbox) {
                const aw = this.activeHitbox.width;
                const ah = this.activeHitbox.height;
                const ax = this.facing === 1 ? this.activeHitbox.offsetX : -(this.activeHitbox.offsetX + aw);
                const ay = -this.activeHitbox.offsetY - ah;

                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.fillRect(ax, ay, aw, ah);
            }
        }

        ctx.restore();
    }

    _drawStreetFighterSlashVFX(ctx, drawW, drawH) {
        if (this.state !== 'ATTACK' || !this.currentAttack) return;

        const atk = this.currentAttack;
        const st = atk.startup || 0.05;
        const act = atk.active || 0.15;
        const t = this.stateTimer;

        // Render only from late startup through active frames
        const startT = st * 0.65;
        const endT = st + act * 1.15;
        if (t < startT || t > endT) return;

        const progress = Math.max(0, Math.min(1, (t - startT) / Math.max(0.01, endT - startT)));
        const alpha = Math.sin(progress * Math.PI) * 0.92;
        if (alpha <= 0.05) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha;

        const type = atk.type;
        const styleColor = (this.styleInfo && this.styleInfo.color) || '#00e5ff';
        const sigArch = this._getSignatureArchetype();
        const charId = (this.data && this.data.id) || 'Keano';
        if (type === 'LIGHT' || type === 'CROUCH_LIGHT') {
            const cy = type === 'CROUCH_LIGHT' ? -drawH * 0.22 : (this.y < this.groundY ? -drawH * 0.45 : -drawH * 0.64);
            const cx = drawW * 0.34 + progress * 28;
            ctx.strokeStyle = styleColor;
            ctx.shadowColor = styleColor;
            ctx.shadowBlur = 14;
            ctx.lineWidth = 8 * (1 - progress * 0.4);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - 55, cy + 6);
            ctx.quadraticCurveTo(cx - 10, cy - 8, cx + 32, cy);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(cx - 35, cy + 3);
            ctx.lineTo(cx + 28, cy);
            ctx.stroke();
        } else if (type === 'COMMAND_PUNCH' || type === 'THROW') {
            const cx = drawW * 0.28;
            const cy = -drawH * 0.62;
            if (charId === 'AliAbi' && type === 'COMMAND_PUNCH') {
                // E. Honda Hundred Hand Slap: 5 rapid-fire open-palm slap arcs fanning forward!
                for (let h = 0; h < 5; h++) {
                    const hy = cy - 44 + h * 22 + Math.sin(this.stateTimer * 40 + h) * 8;
                    const hx = cx + 10 + ((h % 2) * 24);
                    ctx.strokeStyle = h % 2 === 0 ? '#ffd700' : '#ffffff';
                    ctx.shadowColor = '#ff6600';
                    ctx.shadowBlur = 18;
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.ellipse(hx, hy, 78, 22, (h - 2) * 0.12, -0.9, 0.9);
                    ctx.stroke();
                }
            } else {
                ctx.strokeStyle = styleColor;
                ctx.shadowColor = styleColor;
                ctx.shadowBlur = 20;
                ctx.lineWidth = 15 * (1 - progress * 0.3);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.ellipse(cx, cy, 118, 65, 0.18, -1.1 + progress * 0.3, 0.65 + progress * 0.35);
                ctx.stroke();
            }
        } else if (type === 'COMBO_KICK' || type === 'SWEEP') {
            const isSweep = type === 'SWEEP';
            const cx = drawW * 0.18;
            const cy = isSweep ? -drawH * 0.16 : -drawH * 0.48;
            const rx = isSweep ? 115 : 105;
            const ry = isSweep ? 32 : 78;
            const startAng = isSweep ? -0.35 : -0.85 + progress * 0.35;
            const endAng = isSweep ? 0.55 + progress * 0.35 : 0.45 + progress * 0.45;

            ctx.strokeStyle = styleColor;
            ctx.shadowColor = styleColor;
            ctx.shadowBlur = 18;
            ctx.lineWidth = 14 * (1 - progress * 0.35);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, isSweep ? 0.08 : -0.15, startAng, endAng);
            ctx.stroke();

            ctx.strokeStyle = '#fff3b0';
            ctx.lineWidth = 5 * (1 - progress * 0.35);
            ctx.beginPath();
            ctx.ellipse(cx + 4, cy, rx * 0.96, ry * 0.94, isSweep ? 0.08 : -0.15, startAng + 0.1, endAng);
            ctx.stroke();
        } else if (type === 'DRAGON_UPPERCUT') {
            if (sigArch === 'GUILE_FLASH_KICK') {
                // Guile Somersault Flash Kick: giant 180px emerald/gold crescent sonic blade wave!
                const cy = -drawH * 0.56;
                ctx.strokeStyle = charId === 'Dom' ? '#00ff88' : '#ffd700';
                ctx.shadowColor = charId === 'Dom' ? '#00ffff' : '#ff5500';
                ctx.shadowBlur = 32;
                ctx.lineWidth = 24 * (1 - progress * 0.25);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(drawW * 0.20, cy, 180, -Math.PI * 0.68, Math.PI * 0.38);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 9;
                ctx.beginPath();
                ctx.arc(drawW * 0.24, cy, 168, -Math.PI * 0.62, Math.PI * 0.32);
                ctx.stroke();
            } else {
                // Vertical fiery Shoryuken dragon pillar arc!
                const cx = drawW * 0.26;
                const cy = -drawH * 0.62;
                ctx.strokeStyle = '#ff3300';
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur = 28;
                ctx.lineWidth = 22 * (1 - progress * 0.25);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.ellipse(cx, cy, 92, 165, -0.18, -1.45, 0.75);
                ctx.stroke();

                ctx.strokeStyle = '#ffee55';
                ctx.lineWidth = 10 * (1 - progress * 0.25);
                ctx.beginPath();
                ctx.ellipse(cx + 6, cy, 85, 155, -0.18, -1.35, 0.65);
                ctx.stroke();
            }
        } else if (type === 'FLYING_TORPEDO') {
            // 8 Distinct Street Fighter Signature VFX for FLYING_TORPEDO!
            const cy = -drawH * 0.54;
            if (sigArch === 'DHALSIM_DRILL') {
                // Dhalsim Yoga Corkscrew Drill: 4 rapid spinning corkscrew rings narrowing toward the drill tip!
                for (let r = 0; r < 4; r++) {
                    const rx = -drawW * 0.25 + r * (drawW * 0.22);
                    const radY = 78 - r * 14;
                    const rot = this.stateTimer * 34 + r * 1.4;
                    ctx.strokeStyle = r % 2 === 0 ? '#00ff88' : '#ffd700';
                    ctx.shadowColor = '#00ff88';
                    ctx.shadowBlur = 20;
                    ctx.lineWidth = 8 - r;
                    ctx.beginPath();
                    ctx.ellipse(rx, cy, 24, radY, 0, rot, rot + Math.PI * 1.45);
                    ctx.stroke();
                }
            } else if (sigArch === 'BLANKA_CANNONBALL') {
                // Blanka Rolling Cannonball: crackling electric/solar sphere & lightning arcs!
                ctx.strokeStyle = '#ffee00';
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 28;
                ctx.lineWidth = 9;
                ctx.beginPath();
                ctx.arc(0, cy, 96, 0, Math.PI * 2);
                ctx.stroke();
                for (let b = 0; b < 6; b++) {
                    const a = this.stateTimer * 25 + (b * Math.PI) / 3;
                    ctx.strokeStyle = b % 2 === 0 ? '#00ffff' : '#ffffff';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * 55, cy + Math.sin(a) * 55);
                    ctx.lineTo(Math.cos(a + 0.25) * 122, cy + Math.sin(a + 0.25) * 122);
                    ctx.stroke();
                }
            } else if (sigArch === 'CHUNLI_BIRD_KICK') {
                // Chun-Li Upside-Down Spinning Bird Kick: wide pink/ice helicopter rotor blades!
                const isFrost = (charId === 'Cayle' || charId === 'CayleMinogue');
                for (let ring = 0; ring < 2; ring++) {
                    const rot = this.stateTimer * 30 + ring * Math.PI;
                    ctx.strokeStyle = ring === 0 ? (isFrost ? '#00ffff' : '#ff66cc') : '#ffffff';
                    ctx.shadowColor = isFrost ? '#00ccff' : '#ff33aa';
                    ctx.shadowBlur = 26;
                    ctx.lineWidth = ring === 0 ? 15 : 7;
                    ctx.beginPath();
                    ctx.ellipse(0, cy - 18, 175, 28, 0, rot, rot + Math.PI * 1.4);
                    ctx.stroke();
                }
            } else if (sigArch === 'BISON_PSYCHO_CRUSHER') {
                // M. Bison Psycho Crusher: rotating purple/crimson flame screw vortex enveloping the whole body!
                const noseX = drawW * 0.56;
                const grad = ctx.createLinearGradient(-drawW * 0.6, cy, noseX, cy);
                grad.addColorStop(0, 'rgba(180, 0, 255, 0)');
                grad.addColorStop(0.5, '#cc00ff');
                grad.addColorStop(1, '#00ffff');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(noseX + 30, cy);
                ctx.lineTo(-drawW * 0.58, cy - 105);
                ctx.lineTo(-drawW * 0.35, cy);
                ctx.lineTo(-drawW * 0.58, cy + 105);
                ctx.closePath();
                ctx.fill();
                for (let s = 0; s < 3; s++) {
                    const sx = -drawW * 0.2 + s * (drawW * 0.26);
                    const rot = this.stateTimer * 36 + s * 2.0;
                    ctx.strokeStyle = s % 2 === 0 ? '#ff00aa' : '#ffffff';
                    ctx.shadowColor = '#cc00ff';
                    ctx.shadowBlur = 24;
                    ctx.lineWidth = 8;
                    ctx.beginPath();
                    ctx.ellipse(sx, cy, 32, 88 - s * 14, 0, rot, rot + Math.PI * 1.35);
                    ctx.stroke();
                }
            } else if (sigArch === 'GUILE_FLASH_KICK') {
                // Guile Somersault Flash Kick: giant 180px golden/crimson crescent sonic boom blade wave!
                ctx.strokeStyle = '#ffd700';
                ctx.shadowColor = '#ff5500';
                ctx.shadowBlur = 32;
                ctx.lineWidth = 24 * (1 - progress * 0.25);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(drawW * 0.20, cy, 180, -Math.PI * 0.68, Math.PI * 0.38);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 9;
                ctx.beginPath();
                ctx.arc(drawW * 0.24, cy, 168, -Math.PI * 0.62, Math.PI * 0.32);
                ctx.stroke();
            } else if (sigArch === 'ZANGIEF_LARIAT') {
                // Zangief / Thor Spinning Double Lariat: roaring tornado of Bifröst lightning (Vikingo) or cast-iron fire rings (Annikina)!
                const isAnni = (charId === 'Annikina');
                for (let ring = 0; ring < 3; ring++) {
                    const ry = -drawH * (0.28 + ring * 0.22);
                    const rot = this.stateTimer * 32 + ring * 2.1;
                    ctx.strokeStyle = isAnni ? (ring % 2 === 0 ? '#ff5500' : '#ffd700') : (ring % 2 === 0 ? '#00e5ff' : '#ffd700');
                    ctx.shadowColor = isAnni ? '#ff2200' : '#00ffff';
                    ctx.shadowBlur = 26;
                    ctx.lineWidth = 14 - ring * 2;
                    ctx.beginPath();
                    ctx.ellipse(0, ry, 155 + ring * 12, 34, 0, rot, rot + Math.PI * 1.45);
                    ctx.stroke();
                }
            } else {
                // E. Honda Sumo Torpedo / Döner-Spieß Rotating Flame Torpedo shockwave nose-cone!
                const isAli = (charId === 'AliAbi');
                const noseX = drawW * (isAli ? 0.56 : 0.52);
                const grad = ctx.createLinearGradient(-drawW * 0.58, cy, noseX, cy);
                grad.addColorStop(0, 'rgba(255, 120, 0, 0)');
                grad.addColorStop(0.55, isAli ? '#ff7700' : styleColor);
                grad.addColorStop(1, isAli ? '#ffd700' : '#ffffff');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(noseX + 28, cy);
                ctx.lineTo(-drawW * 0.54, cy - 98);
                ctx.lineTo(-drawW * 0.32, cy);
                ctx.lineTo(-drawW * 0.54, cy + 98);
                ctx.closePath();
                ctx.fill();

                if (isAli) {
                    // 4 Rotating Golden Döner-Spieß Fire Rings wrapping around Ali Abi's horizontal E. Honda torpedo body!
                    for (let r = 0; r < 4; r++) {
                        const rx = -drawW * 0.28 + r * (drawW * 0.22);
                        const radY = 86 - r * 12;
                        const rot = this.stateTimer * 36 + r * 1.5;
                        ctx.strokeStyle = r % 2 === 0 ? '#ffd700' : '#ff4400';
                        ctx.shadowColor = '#ff6600';
                        ctx.shadowBlur = 24;
                        ctx.lineWidth = 10 - r;
                        ctx.beginPath();
                        ctx.ellipse(rx, cy, 28, radY, 0, rot, rot + Math.PI * 1.45);
                        ctx.stroke();
                    }
                } else {
                    ctx.strokeStyle = '#ffd700';
                    ctx.shadowColor = styleColor;
                    ctx.shadowBlur = 26;
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.ellipse(drawW * 0.22, cy, 38, 86, 0, -Math.PI * 0.65, Math.PI * 0.65);
                    ctx.stroke();
                }
            }
        } else if (type === 'DRAGON_RUSH_COMBO') {
            const cy = -drawH * 0.54;
            const cx = drawW * 0.28;
            if (charId === 'AliAbi') {
                // E. Honda Hundred Hand Slap Rush: 6 blazing open-palm slap shockwaves!
                for (let h = 0; h < 6; h++) {
                    const hy = cy - 55 + h * 22 + Math.sin(this.stateTimer * 44 + h) * 10;
                    const hx = cx + 15 + ((h % 2) * 28);
                    ctx.strokeStyle = h % 2 === 0 ? '#ffd700' : '#ff5500';
                    ctx.shadowColor = '#ffaa00';
                    ctx.shadowBlur = 20;
                    ctx.lineWidth = 11;
                    ctx.beginPath();
                    ctx.ellipse(hx, hy, 88, 24, (h - 2.5) * 0.12, -1.0, 1.0);
                    ctx.stroke();
                }
            } else {
                // Blazing 4-hit Full-Screen Rush Combo aura + rising dragon uppercut / flash kick finisher pillar!
                ctx.strokeStyle = progress > 0.72 ? '#ff3300' : styleColor;
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 26;
                ctx.lineWidth = 18;
                ctx.beginPath();
                if (progress > 0.72) {
                    ctx.ellipse(cx, -drawH * 0.62, 96, 170, -0.18, -1.45, 0.75);
                } else {
                    const rot = this.stateTimer * 28;
                    ctx.ellipse(cx, cy, 138, 64, 0, rot, rot + Math.PI * 1.35);
                }
                ctx.stroke();
            }
        } else if (type === 'HURRICANE_KICK') {
            // Dual horizontal cyclone vortex rings around spinning legs!
            for (let ring = 0; ring < 2; ring++) {
                const cy = -drawH * (0.42 + ring * 0.16);
                const rot = this.stateTimer * 22 + ring * Math.PI;
                ctx.strokeStyle = ring === 0 ? '#00e5ff' : '#ffffff';
                ctx.shadowColor = '#00ccff';
                ctx.shadowBlur = 22;
                ctx.lineWidth = ring === 0 ? 14 : 7;
                ctx.beginPath();
                ctx.ellipse(0, cy, 145, 36, 0, rot, rot + Math.PI * 1.35);
                ctx.stroke();
            }
        } else if (type === 'AXE_KICK' || type === 'COMBO_FINISHER' || type === 'HEAVY') {
            const isUpper = type === 'HEAVY' && this.y >= this.groundY && Math.abs(this.vx) < 160;
            const cx = drawW * (isUpper ? 0.24 : 0.28);
            const cy = isUpper ? -drawH * 0.58 : -drawH * 0.55;
            const rx = isUpper ? 82 : 126;
            const ry = type === 'AXE_KICK' ? 142 : (isUpper ? 128 : 85);
            const startAng = isUpper ? 0.65 - progress * 0.3 : -0.95 + progress * 0.25;
            const endAng = isUpper ? -1.15 - progress * 0.25 : 0.65 + progress * 0.35;

            ctx.strokeStyle = '#ff2a00';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 24;
            ctx.lineWidth = 18 * (1 - progress * 0.3);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, isUpper ? -0.2 : 0.05, Math.min(startAng, endAng), Math.max(startAng, endAng));
            ctx.stroke();

            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 9 * (1 - progress * 0.3);
            ctx.beginPath();
            ctx.ellipse(cx + 5, cy, rx * 0.95, ry * 0.95, isUpper ? -0.2 : 0.05, Math.min(startAng, endAng) + 0.08, Math.max(startAng, endAng));
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.ellipse(cx + 8, cy, rx * 0.9, ry * 0.9, isUpper ? -0.2 : 0.05, Math.min(startAng, endAng) + 0.15, Math.max(startAng, endAng));
            ctx.stroke();
        } else if (type === 'SPECIAL_DASH') {
            const cx = 0;
            const cy = -drawH * 0.54;
            if (charId === 'AliAbi') {
                // Super E. Honda / Döner-Spieß Torpedo Vortex!
                for (let r = 0; r < 5; r++) {
                    const rx = -drawW * 0.32 + r * (drawW * 0.20);
                    const radY = 95 - r * 11;
                    const rot = this.stateTimer * 42 + r * 1.4;
                    ctx.strokeStyle = r % 2 === 0 ? '#ffd700' : '#ff3300';
                    ctx.shadowColor = '#ff8800';
                    ctx.shadowBlur = 28;
                    ctx.lineWidth = 12 - r;
                    ctx.beginPath();
                    ctx.ellipse(rx, cy, 32, radY, 0, rot, rot + Math.PI * 1.5);
                    ctx.stroke();
                }
            } else {
                const r = 42 + progress * 36;
                const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.4, '#00e5ff');
                grad.addColorStop(0.8, 'rgba(0, 140, 255, 0.45)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

