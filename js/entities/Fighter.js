import Hitbox from './Hitbox.js';

export default class Fighter {
    constructor(game, data, x, y, facing) {
        this.game = game;
        this.data = data; // Keep name, HP, etc.

        // Physics Transform
        this.x = x;       // Center X
        this.y = y;       // Bottom (Feet) Y
        this.groundY = y; // Floor baseline Y
        this.vx = 0;
        this.vy = 0;
        this.facing = facing; // 1 = Right, -1 = Left

        // Stats (Street Fighter II balance)
        this.baseMaxHP = this.data.hp || 400;
        this.hp = this.baseMaxHP;
        this.maxHP = this.baseMaxHP;
        this.speed = this.data.speed || 500; // Movement speed
        this.power = this.data.power || 100; // Attack power multiplier (100 = 1.0x)
        this.jumpImpulse = -1680; // High Street Fighter jump to cleanly clear fireballs & Super Projectiles

        // Deterministic Physics Constants
        this.gravity = 3350;  // Crisp Street Fighter jump arc

        // Special Energy Meter
        this.specialEnergy = 100; // Starts with 1 free shot
        this.maxSpecialEnergy = 100;

        // State Machine
        this.state = 'IDLE'; // IDLE, WALK, JUMP, ATTACK, HIT, KO
        this.stateTimer = 0;
        this.isGrounded = true;
        this.hasWallJumped = false;
        this.justWallJumped = 0;

        // Current Frame Data for attacks
        this.currentAttack = null;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        this.specialMoveCooldown = 0;
        this.hitStop = 0;
        this.hitImmunity = 0;

        // Blocking
        this.isBlocking = false;
        this.blockStun = 0;

        // Base Hurtbox (Calibrated Street Fighter anatomical torso/front-leg bounds for 400px sprite)
        this.baseHurtboxHeight = (this.data && this.data.largeAura) ? 330 : 315;
        this.baseHurtboxWidth = (this.data && this.data.largeAura) ? 154 : 134;
        this.hurtbox = new Hitbox(-this.baseHurtboxWidth / 2, 0, this.baseHurtboxWidth, this.baseHurtboxHeight);

        // Active Hitbox (The fist/foot)
        this.activeHitbox = null;

        // VFX: Ghost Trail Array
        this.ghosts = [];
        this._ghostSpawnAccum = 0;

        // Continuous animation clock, combo chain & 130ms Street Fighter input buffer
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

        // Check if holding back (blocking stance — works standing or crouching!)
        const holdingBack = (this.facing === 1 && inputQueue.left) || (this.facing === -1 && inputQueue.right);
        const holdingFwd = (this.facing === 1 && inputQueue.right) || (this.facing === -1 && inputQueue.left);
        const oppAttackingNear = Boolean(this.opponent && this.opponent.state === 'ATTACK' && Math.abs(this.opponent.x - this.x) < 340);
        this.isBlocking = (holdingBack || this.blockStun > 0) && this.isGrounded && this.state !== 'ATTACK' && this.state !== 'DASH' && this.state !== 'HIT' && this.state !== 'KO';
        this.isActivelyGuarding = Boolean(this.isBlocking && (this.blockStun > 0 || inputQueue.opponentThreat || oppAttackingNear || inputQueue.down));

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

        // Check for Dash trigger (double-tap Left/Right or Shift/Dash button)
        const tryTriggerDash = () => {
            if (this.dashCooldown > 0 || !this.isGrounded) return false;
            if (inputQueue.dashLeftJust) {
                this.executeDash(-1);
                return true;
            }
            if (inputQueue.dashRightJust) {
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

        // Trigger next step in the 3-step visual combo (Punch -> Kick -> Special Finisher)
        const triggerLightCombo = () => {
            consumeBuffer();
            if (this.comboChainTimer > 0 && this.comboChainStep === 1) {
                this.comboChainStep = 2;
                this.comboChainTimer = 0.75;
                this.executeAttack('COMBO_KICK');
            } else if (this.comboChainTimer > 0 && this.comboChainStep === 2) {
                this.comboChainStep = 0;
                this.comboChainTimer = 0;
                this.executeAttack('COMBO_FINISHER');
            } else {
                this.comboChainStep = 1;
                this.comboChainTimer = 0.75;
                this.executeAttack('LIGHT');
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
                    consumeBuffer();
                    this.executeAttack('HEAVY');
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
                    consumeBuffer();
                    this.executeAttack('HEAVY');
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
                // Allow aerial attacks & airborne Hurricane Kick!
                if (bufferedCmd === 'HURRICANE_KICK') {
                    if (this.executeAttack('HURRICANE_KICK')) consumeBuffer();
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

                // ─── STREET FIGHTER HIT-CONFIRM COMBO CANCEL (Must actually HIT to chain/cancel; whiffing or getting blocked plays full recovery!) ───
                const atkType = this.currentAttack.type;
                const canChainNow = (this.attackHasHit || this.attackHitCount > 0) && !this.attackWasBlocked;
                if (canChainNow && this.isGrounded) {
                    if (bufferedCmd && atkType !== bufferedCmd) {
                        if (this.executeAttack(bufferedCmd)) {
                            consumeBuffer();
                            break;
                        }
                    }
                    if (atkType === 'LIGHT' && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 2;
                        this.comboChainTimer = 0.65;
                        this.executeAttack(holdingFwd ? 'COMMAND_PUNCH' : 'COMBO_KICK');
                        break;
                    }
                    if ((atkType === 'COMBO_KICK' || atkType === 'COMMAND_PUNCH') && hasL) {
                        consumeBuffer();
                        this.comboChainStep = 0;
                        this.comboChainTimer = 0;
                        this.executeAttack('COMBO_FINISHER');
                        break;
                    }
                    if ((atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT' || atkType === 'COMBO_KICK' || atkType === 'COMMAND_PUNCH') && hasH) {
                        consumeBuffer();
                        this.executeAttack(inputQueue.down ? 'SWEEP' : (holdingFwd ? 'AXE_KICK' : 'HEAVY'));
                        break;
                    }
                    if ((atkType === 'LIGHT' || atkType === 'CROUCH_LIGHT' || atkType === 'COMBO_KICK' || atkType === 'COMMAND_PUNCH' || atkType === 'AXE_KICK' || atkType === 'HEAVY' || atkType === 'SWEEP') && hasS) {
                        if (this.executeAttack('SPECIAL')) {
                            consumeBuffer();
                            break;
                        }
                    }
                }

                if (this.currentAttack.type === 'SPECIAL_DASH') {
                    // Lock velocity during startup and active window
                    if (this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        this.vx = this.facing * 1800; // Keep flying forward
                        this.vy = 0;                   // Ignore gravity
                        // Spawn ghost trail
                        this.ghosts.push({ x: this.x, y: this.y, age: 0.6, facing: this.facing, timer: this.stateTimer });
                    } else {
                        this.vx *= 0.9; // Brake hard on recovery
                    }
                } else if (this.currentAttack.type === 'HURRICANE_KICK') {
                    if (this.stateTimer <= this.currentAttack.startup + this.currentAttack.active) {
                        this.vx = this.facing * 680;
                        this.vy = Math.min(this.vy, 80); // Hover horizontally across the stage like Tatsumaki!
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

                // Validate Frame Data phase (supports multi-hit moves like HURRICANE_KICK!)
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
                    this.activeHitbox = null;
                    this.currentAttack = null;
                    this.attackHasHit = false;
                    this.attackWasBlocked = false;
                    this.attackHitCount = 0;
                }
                break;

            case 'HIT':
                // In hitstun
                this.activeHitbox = null;
                if (this.stateTimer > 0.38) { // 380ms hitstun baseline
                    this.state = 'IDLE';
                    this.hitImmunity = 0.25; // 250ms invulnerability after recovering (prevents chain-stun)
                }
                // Decelerate pushback rapidly
                this.vx *= 0.8;
                break;

            case 'KO':
                this.vx *= 0.9; // Slide on ground
                break;
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
                this.landingTimer = 0.14;
                if (this.state === 'JUMP' || this.state === 'DASH') {
                    this.state = inputQueue.down ? 'CROUCH' : 'IDLE'; // Landed!
                    this.vx = 0;
                }
            }
        }
    }

    executeDash(dir) {
        this.state = 'DASH';
        this.stateTimer = 0;
        this.dashCooldown = 0.35;
        this._ghostSpawnAccum = 0.035; // Spawn first ghost immediately
        const isForward = (dir === this.facing);
        if (isForward) {
            this.vx = dir * 1350;
        } else {
            // Evasive back-hop with brief invulnerability
            this.vx = dir * 1050;
            this.vy = -340;
            this.isGrounded = false;
            this.hitImmunity = Math.max(this.hitImmunity, 0.16);
        }
    }

    executeJump(inputQueue) {
        this.state = 'JUMP';
        this.stateTimer = 0;
        this.isGrounded = false;
        this.hasWallJumped = false;
        this.vy = this.jumpImpulse;

        // Commit to horizontal velocity based on input AT THE MOMENT of jump
        // Give airborne movement slightly more speed so they can cross over
        if (inputQueue.left) this.vx = -this.speed * 1.15;
        else if (inputQueue.right) this.vx = this.speed * 1.15;
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

    executeProjectileCast() {
        if (this.specialEnergy < 100) return false;
        this.specialEnergy = 0;
        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        this.activeHitbox = null;
        this.currentAttack = {
            startup: 0.08, active: 0.18, recovery: 0.24,
            damage: 0, pushback: 0, hitstop: 0,
            box: null,
            type: 'SPECIAL'
        };
        return true;
    }

    executeAttack(type) {
        // Energy-gated super/projectile specials require 100 energy; physical specials (DRAGON_UPPERCUT, HURRICANE_KICK) require specialMoveCooldown <= 0
        if (type === 'SPECIAL' || type === 'SPECIAL_DASH') {
            if (this.specialEnergy < 100) return false;
            this.specialEnergy = 0;
        } else if (type === 'DRAGON_UPPERCUT' || type === 'HURRICANE_KICK') {
            if (this.specialMoveCooldown > 0) return false;
            this.specialMoveCooldown = 0.72;
        }

        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false;
        this.attackWasBlocked = false;
        this.attackHitCount = 0;
        this.multiHitCooldown = 0;
        const pwrMul = this.power / 100;
        const isAerial = !this.isGrounded;

        // Play authentic martial-arts swing whoosh SFX
        const isHeavySwing = (type !== 'LIGHT' && type !== 'CROUCH_LIGHT');
        this.game?.audioManager?.playWhooshSound?.(isHeavySwing);

        if (type === 'LIGHT') {
            if (this.isGrounded) this.vx = this.facing * 185;
            this.currentAttack = {
                startup: 0.045, active: 0.13, recovery: 0.20,
                damage: Math.round(16 * pwrMul), pushback: 185, hitstop: 0.07,
                isOverhead: isAerial,
                // Calibrated Street Fighter Jab hitbox matched to visual extended fist (reaches 180px from center)
                box: isAerial ? new Hitbox(14, -20, 152, 145) : new Hitbox(18, 125, 162, 110),
                type: 'LIGHT'
            };
        } else if (type === 'COMMAND_PUNCH') {
            // → + L: Spinning Overhead Backfist (breaks crouching block!)
            if (this.isGrounded) this.vx = this.facing * 310;
            this.currentAttack = {
                startup: 0.075, active: 0.15, recovery: 0.25,
                damage: Math.round(26 * pwrMul), pushback: 265, hitstop: 0.11,
                isOverhead: true,
                box: new Hitbox(20, 105, 174, 125),
                type: 'COMMAND_PUNCH'
            };
        } else if (type === 'COMBO_KICK') {
            if (this.isGrounded) this.vx = this.facing * 240;
            this.currentAttack = {
                startup: 0.055, active: 0.15, recovery: 0.22,
                damage: Math.round(25 * pwrMul), pushback: 230, hitstop: 0.10,
                box: new Hitbox(20, 100, 178, 115),
                type: 'COMBO_KICK'
            };
        } else if (type === 'COMBO_FINISHER') {
            if (this.isGrounded) this.vx = this.facing * 330;
            this.currentAttack = {
                startup: 0.065, active: 0.17, recovery: 0.30,
                damage: Math.round(38 * pwrMul), pushback: 420, hitstop: 0.14,
                lift: -240,
                box: new Hitbox(22, 80, 188, 150),
                type: 'COMBO_FINISHER'
            };
        } else if (type === 'CROUCH_LIGHT') {
            if (this.isGrounded) this.vx = this.facing * 165;
            this.currentAttack = {
                startup: 0.045, active: 0.13, recovery: 0.19,
                damage: Math.round(15 * pwrMul), pushback: 170, hitstop: 0.07,
                isLow: true,
                box: new Hitbox(18, 15, 166, 95),
                type: 'CROUCH_LIGHT'
            };
        } else if (type === 'HEAVY') {
            if (this.isGrounded) this.vx = this.facing * 280;
            this.currentAttack = {
                startup: 0.085, active: 0.16, recovery: 0.28,
                damage: Math.round(36 * pwrMul), pushback: 380, hitstop: 0.14,
                lift: isAerial ? -120 : -160,
                isOverhead: isAerial,
                box: isAerial ? new Hitbox(14, -30, 164, 160) : new Hitbox(22, 100, 184, 130),
                type: 'HEAVY'
            };
        } else if (type === 'AXE_KICK') {
            // → + H: Step Axe Kick (heavy overhead chop kick!)
            if (this.isGrounded) this.vx = this.facing * 360;
            this.currentAttack = {
                startup: 0.09, active: 0.17, recovery: 0.28,
                damage: Math.round(42 * pwrMul), pushback: 390, hitstop: 0.15,
                lift: -210,
                isOverhead: true,
                box: new Hitbox(22, 65, 186, 175),
                type: 'AXE_KICK'
            };
        } else if (type === 'SWEEP') {
            if (this.isGrounded) this.vx = this.facing * 410;
            this.currentAttack = {
                startup: 0.075, active: 0.16, recovery: 0.30,
                damage: Math.round(32 * pwrMul), pushback: 320, hitstop: 0.14,
                lift: -280,
                isLow: true,
                box: new Hitbox(22, 0, 190, 92),
                type: 'SWEEP'
            };
        } else if (type === 'DRAGON_UPPERCUT') {
            // → ↓ ↘ + L or ↑ + S: Rising Shoryuken Dragon Uppercut (invulnerable anti-air launcher!)
            this.hitImmunity = Math.max(this.hitImmunity, 0.22);
            this.isGrounded = false;
            this.vy = -960;
            this.vx = this.facing * 310;
            this.currentAttack = {
                startup: 0.045, active: 0.24, recovery: 0.32,
                damage: Math.round(46 * pwrMul), pushback: 360, hitstop: 0.16,
                lift: -540,
                isSpecialMove: true,
                box: new Hitbox(14, 50, 166, 260),
                type: 'DRAGON_UPPERCUT'
            };
        } else if (type === 'HURRICANE_KICK') {
            // ↓ ↙ ← + H or ↓ + S: Tatsumaki Spinning Cyclone Kick (3-hit airborne spin!)
            this.isGrounded = false;
            this.vy = -260;
            this.vx = this.facing * 640;
            this.currentAttack = {
                startup: 0.06, active: 0.38, recovery: 0.28,
                damage: Math.round(18 * pwrMul), pushback: 240, hitstop: 0.08,
                lift: -190,
                maxHits: 3,
                isSpecialMove: true,
                box: new Hitbox(-25, 70, 215, 130),
                type: 'HURRICANE_KICK'
            };
        } else if (type === 'THROW') {
            // L + H at close range: Unblockable Martial Arts Grapple Slam!
            this.vx = this.facing * 140;
            this.currentAttack = {
                startup: 0.04, active: 0.12, recovery: 0.26,
                damage: Math.round(42 * pwrMul), pushback: 620, hitstop: 0.16,
                lift: -380,
                unblockable: true,
                box: new Hitbox(10, 65, 148, 185),
                type: 'THROW'
            };
        } else if (type === 'SPECIAL') {
            if (this.isGrounded) this.vx = this.facing * 260;
            this.currentAttack = {
                startup: 0.075, active: 0.18, recovery: 0.26,
                damage: Math.round(48 * pwrMul), pushback: 280, hitstop: 0.13,
                lift: -160,
                isSpecialMove: true,
                box: new Hitbox(35, 75, 165, 155),
                type: 'SPECIAL'
            };
        } else if (type === 'SPECIAL_DASH') {
            this.currentAttack = {
                startup: 0.14, active: 0.32, recovery: 0.34,
                damage: Math.round(62 * pwrMul), pushback: 650, hitstop: 0.2,
                lift: -220,
                isSpecialMove: true,
                box: new Hitbox(10, 65, 175, 175),
                type: 'SPECIAL_DASH'
            };
            this.isGrounded = false;
            this.y -= 80;
            this.vy = 0;
            this.vx = this.facing * 1800;
        }
        return true;
    }

    takeDamage(attackDef, attackerFacing) {
        if (this.state === 'KO' || this.hp <= 0) {
            this.hp = 0;
            this.state = 'KO';
            return 'IMMUNE';
        }

        // Chain-hit protection: can't be re-hit during immunity frames
        if (this.hitImmunity > 0) return 'IMMUNE';

        // Street Fighter "Guts" scaling: 15% damage reduction when below 25% HP for nail-biting comebacks
        const gutsMul = (this.hp / this.maxHP < 0.25) ? 0.85 : 1.0;
        const scaledDamage = Math.max(1, Math.round(attackDef.damage * gutsMul));
        const isSpecialOrProj = Boolean(attackDef.isSpecialMove || attackDef.type === 'SPECIAL' || attackDef.type === 'SPECIAL_DASH' || attackDef.type === 'PROJECTILE' || attackDef.type === 'DRAGON_UPPERCUT' || attackDef.type === 'HURRICANE_KICK' || attackDef.type === 'COMBO_FINISHER');
        const isHeavyOrCommand = Boolean(isSpecialOrProj || (attackDef.damage || 0) >= 24 || attackDef.type === 'AXE_KICK' || attackDef.type === 'COMMAND_PUNCH');

        // ─── BLOCK CHECK (SF2 rules: Throws are unblockable; Overhead attacks break Crouching block!) ───
        const overheadBroken = Boolean(attackDef.isOverhead && this.state === 'CROUCH');
        const canBlockThis = this.isBlocking && !attackDef.unblockable && !overheadBroken;

        if (canBlockThis) {
            const chipRatio = isSpecialOrProj ? 0.20 : 0.10;
            const chipDmg = Math.max(1, Math.floor(scaledDamage * chipRatio));
            if (isSpecialOrProj || (isHeavyOrCommand && this.hp <= 6)) {
                this.hp = Math.max(0, this.hp - chipDmg);
            } else {
                // Only light normal pokes leave 1 HP on block
                this.hp = Math.max(1, this.hp - chipDmg);
            }
            this.blockStun = 0.14;
            this.hitStop = Math.max(0.055, (attackDef.hitstop || 0.08) * 0.65);
            this.vx = attackerFacing * attackDef.pushback * 0.45;
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
        this.hp = Math.max(0, this.hp - scaledDamage);
        this.stateTimer = 0;

        if (this.hp <= 0) {
            this.hp = 0;
            this.blockStun = 0;
            this.hitStop = 0;
            this.activeHitbox = null;
            this.currentAttack = null;
            this.state = 'KO';
            this.vy = -700;
            this.isGrounded = false;
            this.vx = attackerFacing * attackDef.pushback * 2.5;
        } else {
            this.state = 'HIT';
            this.vx = attackerFacing * attackDef.pushback;
            if (attackDef.lift && (this.isGrounded || attackDef.type === 'DRAGON_UPPERCUT' || attackDef.type === 'HURRICANE_KICK')) {
                this.vy = attackDef.lift;
                this.isGrounded = false;
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
        const pfx = this.data.spritePrefix;

        if (pfx && (suffix === '_dive_kick.png' || suffix === '_low_kick.png' || suffix === '_hook_punch.png')) {
            const customKey = `${id}_${pfx}${suffix.replace('.png', '')}`;
            if (imgs[customKey]) return imgs[customKey];
        }

        const exactKey = `${id}${suffix}`;
        if (imgs[exactKey]) return imgs[exactKey];
        const fallbackKey = `${exactKey}_fallback`;
        if (imgs[fallbackKey]) return imgs[fallbackKey];
        return null;
    }

    draw(ctx) {
        ctx.save();

        // Authentic Street Fighter Hit-Jitter during hitStop when taking damage or blocking!
        let jitterX = 0;
        if (this.hitStop > 0 && (this.state === 'HIT' || this.blockStun > 0)) {
            jitterX = Math.sin(this.animTime * 125) * 7;
        }
        ctx.translate(this.x + jitterX, this.y);

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
            } else if (this.state === 'HIT') suffix = '_hit.png';
            else if (this.state === 'KO') suffix = '_ko.png';
            else if (this.state === 'WIN') suffix = '_win.png';
            spriteImage = this._getSprite(suffix);
        } else {
            // ─── UNIFIED 24-SPRITE STREET FIGHTER ANIMATION STATE MACHINE (ALL CHARACTERS) ───
            const walkCycleIdx = Math.floor(this.animTime * 7.5) % 4;

            if ((this.isActivelyGuarding || this.blockStun > 0) && this.state !== 'KO' && this.state !== 'HIT') {
                suffix = (this.state === 'CROUCH') ? '_crouch.png' : '_block.png';
            } else if (this.state === 'IDLE') {
                // Keep IDLE on _right.png with smooth continuous sine breathing (100% zero frame-pop jitter!)
                suffix = '_right.png';
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
                suffix = isForwardDash ? '_hook_punch.png' : '_jump.png';
            } else if (this.state === 'JUMP') {
                // Straight jump uses _jump.png; diagonal forward/backward jump performs a 360° Salto!
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
                    // Rising Shoryuken Dragon Uppercut: Windup -> Uppercut -> Skyward Dragon Fist -> Special
                    if (phase < startup) suffix = '_windup_punch.png';
                    else if (phase < startup + active * 0.42) suffix = '_uppercut.png';
                    else if (phase < retractStart) suffix = '_dragon_uppercut.png';
                    else suffix = '_jump.png';
                } else if (atkType === 'HURRICANE_KICK') {
                    // Spinning Tatsumaki Cyclone Kick: alternates _hurricane_kick, _spin_kick, and _dive_kick rapidly!
                    const spinStep = Math.floor(phase * 18) % 3;
                    if (phase < startup) suffix = '_jump.png';
                    else if (spinStep === 0) suffix = '_hurricane_kick.png';
                    else if (spinStep === 1) suffix = '_spin_kick.png';
                    else suffix = '_dive_kick.png';
                } else if (atkType === 'COMMAND_PUNCH') {
                    // → + L Overhead Backfist: Windup -> Backfist -> Hook Follow-through
                    if (phase < startup) suffix = '_windup_punch.png';
                    else if (phase < startup + active * 0.72) suffix = '_backfist.png';
                    else if (phase < retractStart) suffix = '_hook_punch.png';
                    else suffix = '_mid_punch.png';
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
                } else if (!this.isGrounded && atkType !== 'SPECIAL' && atkType !== 'SPECIAL_DASH') {
                    // Aerial Salto-Kick / Hurricane Flip Kick!
                    if (phase < startup) suffix = '_jump.png';
                    else if (phase < startup + active * 0.55) suffix = '_spin_kick.png';
                    else if (phase < retractStart) suffix = '_dive_kick.png';
                    else suffix = '_jump.png';
                } else if (atkType === 'LIGHT') {
                    if (phase < startup) suffix = '_windup_punch.png';
                    else if (phase < midPoint) suffix = '_mid_punch.png';
                    else if (phase < retractStart) suffix = '_punch.png';
                    else suffix = '_mid_punch.png';
                } else if (atkType === 'COMBO_KICK') {
                    // 2nd hit of combo: Chamber -> Mid Punch -> Heavy Hook Cross -> Guard
                    if (phase < startup) suffix = '_windup_punch.png';
                    else if (phase < midPoint) suffix = '_mid_punch.png';
                    else if (phase < retractStart) suffix = '_hook_punch.png';
                    else suffix = '_mid_punch.png';
                } else if (atkType === 'COMBO_FINISHER') {
                    // 3rd hit launcher: Chamber -> Spin Kick -> Rising Uppercut -> Special Burst
                    if (phase < startup) suffix = '_windup_kick.png';
                    else if (phase < startup + active * 0.38) suffix = '_spin_kick.png';
                    else if (phase < startup + active * 0.78) suffix = '_uppercut.png';
                    else if (phase < retractStart) suffix = '_special.png';
                    else suffix = '_right.png';
                } else if (atkType === 'CROUCH_LIGHT' || atkType === 'SWEEP') {
                    if (phase < startup) suffix = '_crouch.png';
                    else if (phase < midPoint) suffix = '_mid_kick.png';
                    else if (phase < retractStart) suffix = '_low_kick.png';
                    else suffix = '_crouch.png';
                } else if (atkType === 'HEAVY') {
                    if (phase < startup) suffix = '_windup_kick.png';
                    else if (phase < midPoint) suffix = '_mid_kick.png';
                    else if (phase < startup + active * 0.72) suffix = '_kick.png';
                    else if (phase < retractStart) suffix = '_spin_kick.png';
                    else suffix = '_mid_kick.png';
                } else if (atkType === 'SPECIAL') {
                    if (phase < startup * 0.75) suffix = '_windup_punch.png';
                    else suffix = '_special.png';
                } else if (atkType === 'SPECIAL_DASH') {
                    suffix = '_dive_kick.png';
                } else {
                    suffix = '_punch.png';
                }
            } else if (this.state === 'HIT') {
                suffix = '_hit.png';
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
                if (!this._loggedMissingSprite) {
                    console.error(`[Fighter] SCENE ERROR: Missing sprite for ${this.data.id} in state ${this.state} (Tried: ${suffix} & Fallbacks)`);
                    this._loggedMissingSprite = true;
                }
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

            // Lock scale to reference _right.png height for all stance/walk/crouch/block frames to eliminate scale jitter!
            const refIdleImg = this._getSprite('_right.png');
            const isStanceDerived = (suffix === '_right.png' || suffix === '_idle_2.png' || suffix === '_walk.png' || suffix === '_walk_1.png' || suffix === '_walk_2.png' || suffix === '_crouch.png' || suffix === '_block.png' || suffix === '_jump.png' || suffix === '_windup_punch.png' || suffix === '_windup_kick.png');
            const refH = (isStanceDerived && refIdleImg && refIdleImg.naturalHeight) ? refIdleImg.naturalHeight : spriteImage.naturalHeight;
            const scale = 400 / refH;
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
                    if (!g.isDashGhost) {
                        ctx.translate(0, -drawH / 2);
                        ctx.rotate(g.timer * 25.0 * g.facing);
                        ctx.translate(0, drawH / 2);
                    }

                    ctx.globalAlpha = g.age * (g.isDashGhost ? 0.50 : 0.68);
                    ctx.globalCompositeOperation = 'screen';
                    ctx.shadowColor = '#00e5ff';
                    ctx.shadowBlur = 18;
                    ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
                    ctx.restore();
                }
                ctx.restore();
            }

            // ─── SMOOTH BREATHING & 3-PHASE STREET FIGHTER SUB-FRAMING ───
            let poseScaleX = 1.0;
            let poseScaleY = 1.0;
            if (this.landingTimer > 0 && this.state === 'IDLE') {
                const landAmt = this.landingTimer / 0.14;
                poseScaleX = 1.0 + landAmt * 0.04;
                poseScaleY = 1.0 - landAmt * 0.05;
            } else if (this.state === 'IDLE') {
                // Silky continuous breathing anchored at feet (0,0) — zero jitter!
                const breath = Math.sin(this.animTime * 2.8);
                poseScaleX = 1.0 - breath * 0.004;
                poseScaleY = 1.0 + breath * 0.008;
            } else if (this.state === 'ATTACK' && this.currentAttack) {
                const p = this.stateTimer;
                const st = this.currentAttack.startup || 0.05;
                const act = this.currentAttack.active || 0.15;
                if (p < st) {
                    poseScaleX = 0.98;
                    poseScaleY = 0.99;
                } else if (p < st + act * 0.65) {
                    poseScaleX = 1.03;
                    poseScaleY = 0.99;
                }
            }

            // ─── 360° SALTO ON FORWARD/BACKWARD JUMP + AERIAL SALTO-KICK + SPECIAL DASH ───
            let isRolling = false;
            let currentRotation = 0;
            if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'SPECIAL_DASH') {
                isRolling = true;
                const spinSpeed = 25.0;
                currentRotation = this.stateTimer * spinSpeed * this.facing;
            } else if (!this.isGrounded && Math.abs(this.vx) >= 25 && (this.state === 'JUMP' || (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type !== 'SPECIAL' && this.currentAttack.type !== 'DRAGON_UPPERCUT' && this.currentAttack.type !== 'HURRICANE_KICK'))) {
                // Forward jump = front salto (+1), Backward jump = back salto (-1)
                isRolling = true;
                const saltoDir = (this.vx * this.facing >= 0) ? 1 : -1;
                const saltoSpeed = (this.state === 'ATTACK') ? 14.5 : 10.8;
                currentRotation = (this.jumpTime || 0) * saltoSpeed * saltoDir;
            }

            ctx.save();
            if (isRolling) {
                ctx.translate(0, -drawH * 0.52);
                ctx.rotate(currentRotation);
                ctx.translate(0, drawH * 0.52);
            } else if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'HURRICANE_KICK') {
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
        if (type === 'LIGHT' || type === 'CROUCH_LIGHT') {
            const cy = type === 'CROUCH_LIGHT' ? -drawH * 0.22 : (this.y < this.groundY ? -drawH * 0.45 : -drawH * 0.64);
            const cx = drawW * 0.34 + progress * 28;
            ctx.strokeStyle = '#00e5ff';
            ctx.shadowColor = '#00e5ff';
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
            ctx.strokeStyle = '#00ffcc';
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 20;
            ctx.lineWidth = 15 * (1 - progress * 0.3);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 118, 65, 0.18, -1.1 + progress * 0.3, 0.65 + progress * 0.35);
            ctx.stroke();
        } else if (type === 'COMBO_KICK' || type === 'SWEEP') {
            const isSweep = type === 'SWEEP';
            const cx = drawW * 0.18;
            const cy = isSweep ? -drawH * 0.16 : -drawH * 0.48;
            const rx = isSweep ? 115 : 105;
            const ry = isSweep ? 32 : 78;
            const startAng = isSweep ? -0.35 : -0.85 + progress * 0.35;
            const endAng = isSweep ? 0.55 + progress * 0.35 : 0.45 + progress * 0.45;

            ctx.strokeStyle = '#ff8800';
            ctx.shadowColor = '#ff5500';
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
        } else if (type === 'SPECIAL' || type === 'SPECIAL_DASH') {
            const cx = type === 'SPECIAL_DASH' ? 0 : drawW * 0.38;
            const cy = -drawH * 0.54;
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

        ctx.restore();
    }
}

