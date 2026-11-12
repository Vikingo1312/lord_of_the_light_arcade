import Hitbox from './Hitbox.js';

export default class Fighter {
    constructor(game, data, x, y, facing) {
        this.game = game;
        this.data = data; // Keep name, HP, etc.

        // Physics Transform
        this.x = x;       // Center X
        this.y = y;       // Bottom (Feet) Y
        this.vx = 0;
        this.vy = 0;
        this.facing = facing; // 1 = Right, -1 = Left

        // Stats (Street Fighter II balance)
        this.baseMaxHP = this.data.hp || 400;
        this.hp = this.baseMaxHP;
        this.maxHP = this.baseMaxHP;
        this.speed = this.data.speed || 500; // Movement speed
        this.power = this.data.power || 100; // Attack power multiplier (100 = 1.0x)
        this.jumpImpulse = -1450; // Massively increased jump height to allow clearing the opponent

        // Deterministic Physics Constants
        this.gravity = 3500;  // Extremely heavy Street Fighter style drop

        // Special Energy Meter
        this.specialEnergy = 100; // Starts with 1 free shot
        this.maxSpecialEnergy = 100;

        // State Machine
        this.state = 'IDLE'; // IDLE, WALK, JUMP, ATTACK, HIT, KO
        this.stateTimer = 0;
        this.isGrounded = true;

        // Current Frame Data for attacks
        this.currentAttack = null;
        this.hitStop = 0;
        this.hitImmunity = 0;

        // Blocking
        this.isBlocking = false;
        this.blockStun = 0;

        // Base Hurtbox (The body)
        this.hurtbox = new Hitbox(-75, 0, 150, 300);

        // Characters with massive physical bodies or wide visual auras need a 
        // wider body hitbox, otherwise punches pass right through their visuals.
        if (this.data && this.data.largeAura) {
            this.hurtbox = new Hitbox(-100, 0, 200, 320);
        }

        // Active Hitbox (The fist/foot)
        this.activeHitbox = null;

        // VFX: Ghost Trail Array
        this.ghosts = [];

        // Reusable offscreen canvas for hit-flash effect (prevents 60fps DOM allocation leak)
        this._flashCanvas = null;
        this._flashCtx = null;
    }

    update(dt, inputQueue) {
        // 1. Process Hitstop 
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return; // Skip reading inputs and physics during frozen impact frames
        }

        // Age ghosts
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            this.ghosts[i].age -= dt * 2.5; // Fade out quickly
            if (this.ghosts[i].age <= 0) this.ghosts.splice(i, 1);
        }

        this.stateTimer += dt;

        // Check if holding back (blocking stance)
        const holdingBack = (this.facing === 1 && inputQueue.left) || (this.facing === -1 && inputQueue.right);
        this.isBlocking = holdingBack && this.isGrounded && this.state !== 'ATTACK' && this.state !== 'HIT' && this.state !== 'KO';

        // Hit-immunity countdown (prevents chain-stun after recovering from HIT)
        if (this.hitImmunity > 0) this.hitImmunity -= dt;

        // Blockstun countdown
        if (this.blockStun > 0) {
            this.blockStun -= dt;
            this.vx = 0;
            if (this.blockStun <= 0) {
                this.blockStun = 0;
                this.state = 'IDLE';
            }

            // Inline physics during blockstun
            if (!this.isGrounded) {
                this.vy += this.gravity * dt;
                this.y += this.vy * dt;
            }
            this.x += this.vx * dt;
            const floorY = this.game.height * 0.9;
            if (this.y > floorY) { this.y = floorY; this.vy = 0; this.isGrounded = true; }
            return;
        }

        // 2. State Machine Logic
        switch (this.state) {
            case 'IDLE':
                this.vx = 0;
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (inputQueue.lJust) {
                    this.executeAttack('LIGHT');
                } else if (inputQueue.hJust) {
                    this.executeAttack('HEAVY');
                } else if (inputQueue.sJust) {
                    this.executeAttack('SPECIAL');
                } else if (inputQueue.left) {
                    this.vx = -this.speed;
                    this.state = 'WALK';
                } else if (inputQueue.right) {
                    this.vx = this.speed;
                    this.state = 'WALK';
                }
                break;

            case 'WALK':
                // Transition out of walk
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (inputQueue.lJust) {
                    this.executeAttack('LIGHT');
                } else if (inputQueue.hJust) {
                    this.executeAttack('HEAVY');
                } else if (inputQueue.sJust) {
                    this.executeAttack('SPECIAL');
                } else if (!inputQueue.left && !inputQueue.right) {
                    this.vx = 0;
                    this.state = 'IDLE';
                } else {
                    // Maintain walking
                    this.vx = inputQueue.left ? -this.speed : (inputQueue.right ? this.speed : 0);
                }
                break;

            case 'JUMP':
                // Cannot change direction mid-air (Street fighter rules)
                // Just apply gravity (handled below in physics)
                // BUT we DO allow attacks!
                if (inputQueue.lJust) {
                    this.executeAttack('LIGHT');
                } else if (inputQueue.hJust) {
                    this.executeAttack('HEAVY');
                } else if (inputQueue.sJust) {
                    this.executeAttack('SPECIAL');
                }
                break;

            case 'ATTACK':
                if (!this.currentAttack) {
                    this.state = this.isGrounded ? 'IDLE' : 'JUMP';
                    break;
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
                } else if (this.isGrounded) {
                    this.vx = 0; // Standard ground attack freeze
                }

                // Validate Frame Data phase
                if (!this.attackHasHit && this.stateTimer >= this.currentAttack.startup && this.stateTimer < (this.currentAttack.startup + this.currentAttack.active)) {
                    // ACTIVE FRAMES: Spawn Hitbox (only if this attack hasn't already connected)
                    this.activeHitbox = this.currentAttack.box;
                } else {
                    // STARTUP or RECOVERY or already hit
                    this.activeHitbox = null;
                }

                // End of attack
                if (this.stateTimer >= (this.currentAttack.startup + this.currentAttack.active + this.currentAttack.recovery)) {
                    if (this.isGrounded) {
                        this.state = 'IDLE';
                    } else {
                        this.state = 'JUMP'; // Return to falling state
                    }
                    this.activeHitbox = null;
                    this.currentAttack = null;
                    this.attackHasHit = false;
                }
                break;

            case 'HIT':
                // In hitstun
                this.activeHitbox = null;
                if (this.stateTimer > 0.4) { // 400ms hitstun baseline
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
        if (this.y > floorY) {
            this.y = floorY;
            this.vy = 0;
            if (!this.isGrounded) {
                this.isGrounded = true;
                if (this.state === 'JUMP') {
                    this.state = 'IDLE'; // Landed!
                    this.vx = 0;
                }
            }
        }
    }

    executeJump(inputQueue) {
        this.state = 'JUMP';
        this.stateTimer = 0;
        this.isGrounded = false;
        this.vy = this.jumpImpulse;

        // Commit to horizontal velocity based on input AT THE MOMENT of jump
        // Give airborne movement slightly more speed so they can cross over
        if (inputQueue.left) this.vx = -this.speed * 1.1;
        else if (inputQueue.right) this.vx = this.speed * 1.1;
        else this.vx = 0;
    }

    executeProjectileCast() {
        if (this.specialEnergy < 100) return false;
        this.specialEnergy = 0;
        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false;
        this.activeHitbox = null;
        this.currentAttack = {
            startup: 0.10, active: 0.05, recovery: 0.30,
            damage: 0, pushback: 0, hitstop: 0,
            box: null,
            type: 'SPECIAL'
        };
        return true;
    }

    executeAttack(type) {
        // Special attacks require and consume energy
        if (type === 'SPECIAL' || type === 'SPECIAL_DASH') {
            if (this.specialEnergy < 100) return false; // Not enough energy
            this.specialEnergy = 0; // Drain the meter fully
        }

        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false; // Reset per-attack hit flag
        const pwrMul = this.power / 100;

        if (type === 'LIGHT') {
            this.currentAttack = {
                startup: 0.05, active: 0.15, recovery: 0.20,
                damage: Math.round(15 * pwrMul), pushback: 180, hitstop: 0.08,
                box: new Hitbox(0, 200, 180, 60),
                type: 'LIGHT'
            };
        } else if (type === 'HEAVY') {
            this.currentAttack = {
                startup: 0.15, active: 0.15, recovery: 0.35,
                damage: Math.round(35 * pwrMul), pushback: 400, hitstop: 0.15,
                lift: -150,
                box: new Hitbox(20, 150, 200, 80),
                type: 'HEAVY'
            };
        } else if (type === 'SPECIAL') {
            this.currentAttack = {
                startup: 0.10, active: 0.15, recovery: 0.22,
                damage: Math.round(45 * pwrMul), pushback: 250, hitstop: 0.12,
                lift: -80,
                box: new Hitbox(10, 80, 180, 80),
                type: 'SPECIAL'
            };
        } else if (type === 'SPECIAL_DASH') {
            this.currentAttack = {
                startup: 0.15, active: 0.35, recovery: 0.35, // 350ms flight time
                damage: Math.round(55 * pwrMul), pushback: 650, hitstop: 0.2,
                lift: -200, // Launch opponent high
                box: new Hitbox(0, 150, 200, 150),
                type: 'SPECIAL_DASH'
            };
            this.isGrounded = false;
            this.y -= 80; // Hop slightly off the ground to fly across
            this.vy = 0;
            this.vx = this.facing * 1800;
        }
        return true;
    }

    takeDamage(attackDef, attackerFacing) {
        if (this.state === 'KO') return 'IMMUNE';

        // Chain-hit protection: can't be re-hit during immunity frames
        if (this.hitImmunity > 0) return 'IMMUNE';

        // ─── BLOCK CHECK (SF2: hold back = auto-block) ───
        if (this.isBlocking) {
            // Chip damage (25% of normal)
            const chipDmg = Math.floor(attackDef.damage * 0.25);
            this.hp -= chipDmg;
            this.blockStun = 0.3; // Recovery time
            this.vx = attackerFacing * attackDef.pushback * 0.5;
            this.state = 'IDLE'; // Stay standing

            if (this.hp <= 0) {
                this.hp = 0;
                this.state = 'KO';
                this.vy = -600;
                this.isGrounded = false;
                this.vx = attackerFacing * attackDef.pushback * 2;
            }
            return 'BLOCKED';
        }

        // ─── FULL HIT ───
        this.hp -= attackDef.damage;
        this.stateTimer = 0;

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'KO';
            this.vy = -700;
            this.isGrounded = false;
            this.vx = attackerFacing * attackDef.pushback * 2.5;
        } else {
            this.state = 'HIT';
            this.vx = attackerFacing * attackDef.pushback;
            // Heavy/Special attacks give slight lift for dramatic knockback
            if (attackDef.lift && this.isGrounded) {
                this.vy = attackDef.lift;
                this.isGrounded = false;
            }
            this.hitStop = attackDef.hitstop;
        }
        return 'HIT';
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 1. Determine which sprite to draw
        let spriteImage = null;
        let exactKey = '';

        // Map State to Image Key suffix
        let suffix = '_front.png';

        // BYPASS: Skip automatic facing logic only if explicitly disabled in settings
        if (this.game && this.game.settings && this.game.settings.autoFacingEnabled === false) {
            if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP') {
                suffix = '_right.png';
            } else if (this.state === 'ATTACK') {
                if (this.currentAttack && this.currentAttack.type === 'SPECIAL') suffix = '_special.png';
                else if (this.currentAttack && this.currentAttack.type === 'HEAVY') suffix = '_kick.png';
                else suffix = '_punch.png';
            } else if (this.state === 'HIT') suffix = '_hit.png';
            else if (this.state === 'KO') suffix = '_ko.png';
            else if (this.state === 'WIN') suffix = '_win.png';

            exactKey = `${this.data.id}${suffix}`;
            const fallbackKey = `${this.data.id}${suffix}_fallback`;
            spriteImage = this.game.assetManager.images[exactKey] || this.game.assetManager.images[fallbackKey];

        } else {
            // ─── NEW GENERIC ANIMATION SYSTEM ───
            if (this.data.animations) {
                let animKey = this.state.toLowerCase();
                if (this.state === 'ATTACK' && this.currentAttack) {
                    animKey = `attack_${this.currentAttack.type.toLowerCase()}`;
                }

                const anim = this.data.animations[animKey];
                if (anim && anim.frames && anim.frames.length > 0) {
                    let currentFrameName = '';

                    if (anim.durations) {
                        let elapsed = 0;
                        let frameIndex = anim.frames.length - 1;
                        for (let i = 0; i < anim.durations.length; i++) {
                            elapsed += anim.durations[i];
                            if (this.stateTimer < elapsed) {
                                frameIndex = i;
                                break;
                            }
                        }
                        currentFrameName = anim.frames[frameIndex];
                    } else {
                        const fps = anim.frameRate || 10;
                        const frameIndex = Math.floor(this.stateTimer * fps) % anim.frames.length;
                        currentFrameName = anim.frames[frameIndex];
                    }

                    exactKey = `${this.data.id}_${currentFrameName}.png`;
                    spriteImage = this.game.assetManager.images[exactKey];
                    suffix = '__CUSTOM__';
                }
            }

            // ─── LEGACY CHARACTERS WITH HARDCODED MULTI-FRAME ANIMATIONS (e.g. Supreme Keano) ───
            if (this.data.multiFrameAnim && suffix !== '__CUSTOM__') {
                const imgs = this.game.assetManager.images;

                if (this.state === 'IDLE' || this.state === 'WALK') {
                    const breathFrame = Math.floor(this.stateTimer / 0.6) % 2;
                    suffix = breathFrame === 0 ? '_right.png' : '_left.png';
                } else if (this.state === 'JUMP') {
                    if (this.currentAttack) {
                        const diveImg = imgs[`${this.data.id}_${this.data.spritePrefix}_dive_kick`];
                        if (diveImg) {
                            suffix = '__CUSTOM__';
                            spriteImage = diveImg;
                        } else {
                            suffix = '_kick.png';
                        }
                    } else {
                        suffix = '_right.png';
                    }
                } else if (this.state === 'ATTACK') {
                    const phase = this.stateTimer;
                    const startup = this.currentAttack ? this.currentAttack.startup : 0.05;
                    const active = this.currentAttack ? this.currentAttack.active : 0.15;
                    const totalActive = startup + active;

                    if (this.currentAttack && this.currentAttack.type === 'LIGHT') {
                        if (phase < startup) {
                            const hookImg = imgs[`${this.data.id}_${this.data.spritePrefix}_hook_punch`];
                            if (hookImg) { suffix = '__CUSTOM__'; spriteImage = hookImg; }
                            else suffix = '_right.png';
                        } else if (phase < totalActive) {
                            suffix = '_punch.png';
                        } else {
                            suffix = '_right.png';
                        }
                    } else if (this.currentAttack && this.currentAttack.type === 'HEAVY') {
                        if (phase < startup) {
                            const lowImg = imgs[`${this.data.id}_${this.data.spritePrefix}_low_kick`];
                            if (lowImg) { suffix = '__CUSTOM__'; spriteImage = lowImg; }
                            else suffix = '_right.png';
                        } else if (phase < totalActive) {
                            suffix = '_kick.png';
                        } else {
                            suffix = '_right.png';
                        }
                    } else if (this.currentAttack && this.currentAttack.type === 'SPECIAL') {
                        suffix = '_special.png';
                    } else if (this.currentAttack && this.currentAttack.type === 'SPECIAL_DASH') {
                        suffix = '_kick.png';
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

                if (suffix !== '__CUSTOM__') {
                    exactKey = `${this.data.id}${suffix}`;
                    const fallbackKey = `${this.data.id}${suffix}_fallback`;
                    spriteImage = imgs[exactKey] || imgs[fallbackKey];
                }

            } else if (suffix !== '__CUSTOM__') {
                // ─── STANDARD CHARACTERS: Single image per state ───
                if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP') {
                    suffix = '_right.png';
                } else if (this.state === 'ATTACK') {
                    if (this.currentAttack && this.currentAttack.type === 'SPECIAL') suffix = '_special.png';
                    else if (this.currentAttack && this.currentAttack.type === 'HEAVY') suffix = '_kick.png';
                    else suffix = '_punch.png';
                } else if (this.state === 'HIT') {
                    suffix = '_hit.png';
                } else if (this.state === 'KO') {
                    suffix = '_ko.png';
                } else if (this.state === 'WIN') {
                    suffix = '_win.png';
                }
                exactKey = `${this.data.id}${suffix}`;
                const fallbackKey = `${this.data.id}${suffix}_fallback`;
                spriteImage = this.game.assetManager.images[exactKey] || this.game.assetManager.images[fallbackKey];
            }

            // Fallbacks if specific sprite is missing
            if (!spriteImage && this.state === 'ATTACK') {
                const punchKey = `${this.data.id}_punch.png`;
                const punchFallback = `${this.data.id}_punch.png_fallback`;
                spriteImage = this.game.assetManager.images[punchKey] || this.game.assetManager.images[punchFallback];
            }
            if (!spriteImage && (this.state === 'ATTACK' || this.state === 'HIT' || this.state === 'KO' || this.state === 'WIN')) {
                const idleKey = `${this.data.id}_right.png`;
                spriteImage = this.game.assetManager.images[idleKey] || this.game.assetManager.images[`${this.data.id}_right.png_fallback`];
            }

            if (!spriteImage) {
                if (!this._loggedMissingSprite) {
                    console.error(`[Fighter] SCENE ERROR: Missing sprite for ${this.data.id} in state ${this.state} (Tried: ${exactKey} & Fallbacks)`);
                    this._loggedMissingSprite = true;
                }
                ctx.restore();
                return;
            }

            // --- SAFETY: Prevent Ghost Trading Cards on K.O. ---
            if ((this.state === 'KO' || this.state === 'HIT') && spriteImage && spriteImage.naturalHeight > spriteImage.naturalWidth * 1.05) {
                const hitExact = `${this.data.id}_hit.png`;
                const hitImg = this.game.assetManager.images[hitExact] || this.game.assetManager.images[`${this.data.id}_hit.png_fallback`];

                if (hitImg && hitImg.naturalHeight <= hitImg.naturalWidth * 1.05) {
                    spriteImage = hitImg;
                } else {
                    const idleImg = this.game.assetManager.images[`${this.data.id}_right.png`] || this.game.assetManager.images[`${this.data.id}_right.png_fallback`];
                    if (idleImg && idleImg.naturalHeight <= idleImg.naturalWidth * 1.05) {
                        spriteImage = idleImg;
                    } else {
                        ctx.restore();
                        return;
                    }
                }
            }

            // 2. Draw Sprite if loaded
            if (!spriteImage.naturalHeight || !spriteImage.naturalWidth) {
                ctx.restore();
                return;
            }

            // Sprites are massive, we scale them down to roughly 400px tall
            const scale = 400 / spriteImage.naturalHeight;
            const drawW = spriteImage.naturalWidth * scale;
            const drawH = spriteImage.naturalHeight * scale;

            // All sprites natively face RIGHT.
            // P1 (facing=1) is drawn normally (+1).
            // P2 (facing=-1) is mirrored horizontally (-1).
            const drawFacing = this.facing;
            ctx.scale(drawFacing, 1);

            // ─── DRAW GHOST TRAIL (PSYCHO CRUSHER) ───
            if (this.ghosts && this.ghosts.length > 0) {
                ctx.save();
                ctx.scale(drawFacing, 1); // Undo local facing before reverting to world bounds
                ctx.translate(-this.x, -this.y);
                for (const g of this.ghosts) {
                    ctx.save();
                    ctx.translate(g.x, g.y);
                    ctx.scale(g.facing, 1);
                    ctx.translate(0, -drawH / 2);
                    ctx.rotate(g.timer * 25.0 * g.facing);
                    ctx.translate(0, drawH / 2);

                    ctx.globalAlpha = g.age * 0.7;
                    ctx.globalCompositeOperation = 'screen';
                    ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
                    ctx.restore();
                }
                ctx.restore();
            }

            // ─── SIMULATE STREET FIGHTER JUMP ROLL OR SPECIAL DASH SPIN ───
            let isRolling = false;
            let currentRotation = 0;
            if (this.state === 'JUMP' && Math.abs(this.vx) > 10) {
                isRolling = true;
                const flipSpeed = 8.0;
                const dir = (this.vx * this.facing > 0) ? 1 : -1;
                currentRotation = this.stateTimer * flipSpeed * dir;
            } else if (this.state === 'ATTACK' && this.currentAttack && this.currentAttack.type === 'SPECIAL_DASH') {
                isRolling = true;
                const spinSpeed = 25.0;
                currentRotation = this.stateTimer * spinSpeed * this.facing;
            }

            if (isRolling) {
                ctx.translate(0, -drawH / 2);
                ctx.rotate(currentRotation);
                ctx.translate(0, drawH / 2);
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

            // ─── UN-ROTATE THE CONTEXT ───
            if (isRolling) {
                ctx.translate(0, -drawH / 2);
                ctx.rotate(-currentRotation);
                ctx.translate(0, drawH / 2);
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
}

