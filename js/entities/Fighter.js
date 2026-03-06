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

        // Blocking
        this.isBlocking = false;
        this.blockStun = 0;

        // Base Hurtbox (The body)
        // Made slightly wider to make it easier for hits to connect
        this.hurtbox = new Hitbox(-75, 0, 150, 300);

        // Characters with massive physical bodies or wide visual auras need a 
        // wider body hitbox, otherwise punches pass right through their visuals.
        const largeAuraFighters = [
            'Tzubaza', 'Kowalski', 'Putin', 'VikingoRaw', 'Vikingo',
            'SupremeKeano', 'HyperKeano', 'JayX', 'GargamelHoodie', 'Simba', 'JJDark'
        ];
        if (this.data && largeAuraFighters.includes(this.data.id)) {
            this.hurtbox = new Hitbox(-100, 0, 200, 320);
        }

        // Active Hitbox (The fist/foot)
        this.activeHitbox = null;
    }

    update(dt, inputQueue) {
        // 1. Process Hitstop 
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return; // Skip reading inputs and physics during frozen impact frames
        }

        this.stateTimer += dt;
        const prevY = this.y;

        // Check if holding back (blocking stance)
        const holdingBack = (this.facing === 1 && inputQueue.left) || (this.facing === -1 && inputQueue.right);
        this.isBlocking = holdingBack && this.isGrounded && this.state !== 'ATTACK' && this.state !== 'HIT' && this.state !== 'KO';

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
                // Only stop moving if grounded (allows jump kicks)
                if (this.isGrounded) this.vx = 0;

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
        if (inputQueue.left) this.vx = -this.speed * 0.9;
        else if (inputQueue.right) this.vx = this.speed * 0.9;
        else this.vx = 0;
    }

    executeAttack(type) {
        // Special attacks require and consume energy
        if (type === 'SPECIAL') {
            if (this.specialEnergy < 100) return; // Not enough energy
            this.specialEnergy = 0; // Drain the meter fully
        }

        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.attackHasHit = false; // Reset per-attack hit flag

        if (type === 'LIGHT') {
            this.currentAttack = {
                startup: 0.05, active: 0.15, recovery: 0.20, // Faster startup, more active frames
                damage: 15, pushback: 180, hitstop: 0.08,    // slightly more hitstop for impact
                box: new Hitbox(0, 200, 180, 60),            // Wider box to catch opponents consistently
                type: 'LIGHT'
            };
        } else if (type === 'HEAVY') {
            this.currentAttack = {
                startup: 0.15, active: 0.15, recovery: 0.35, // More commitment on miss
                damage: 35, pushback: 400, hitstop: 0.15,    // Massive pushback on hit
                lift: -150, // Slight upward launch
                box: new Hitbox(20, 150, 200, 80),           // Massive box
                type: 'HEAVY'
            };
        } else if (type === 'SPECIAL') {
            this.currentAttack = {
                startup: 0.10, active: 0.15, recovery: 0.22,
                damage: 45, pushback: 250, hitstop: 0.12,
                lift: -80,
                box: new Hitbox(10, 80, 180, 80),
                type: 'SPECIAL'
            };
        }
    }

    takeDamage(attackDef, attackerFacing) {
        if (this.state === 'KO') return;

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

        // Map State to Image Key suffix
        let suffix = '_front.png';
        let needsMirror = false;  // Only combat poses need mirroring

        // BYPASS: Skip automatic facing logic only if explicitly disabled in settings
        if (this.game && this.game.settings && this.game.settings.autoFacingEnabled === false) {
            if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP') {
                suffix = '_right.png'; // Always use default stance
            } else if (this.state === 'ATTACK') {
                if (this.currentAttack && this.currentAttack.type === 'SPECIAL') suffix = '_special.png';
                else if (this.currentAttack && this.currentAttack.type === 'HEAVY') suffix = '_kick.png';
                else suffix = '_punch.png';
            } else if (this.state === 'HIT') suffix = '_hit.png';
            else if (this.state === 'KO') suffix = '_ko.png';
            else if (this.state === 'WIN') suffix = '_win.png';
            needsMirror = false; // Never mirror

            const exactKey = `${this.data.id}${suffix}`;
            const fallbackKey = `${this.data.id}${suffix}_fallback`;
            spriteImage = this.game.assetManager.images[exactKey] || this.game.assetManager.images[fallbackKey];

        } else {
            // ALL States now use ctx.scale(facing) to mirror 
            // We use the ONE SOURCE OF TRUTH for every pose.
            // By convention, almost all single-pose images in the asset pack face RIGHT.
            if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP') {
                suffix = '_right.png'; // Use combat fighting stance (faces opponent)
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
            const exactKey = `${this.data.id}${suffix}`;
            const fallbackKey = `${this.data.id}${suffix}_fallback`;
            spriteImage = this.game.assetManager.images[exactKey] || this.game.assetManager.images[fallbackKey];

            // If a specific Kick or Special sprite is missing, fall back to the basic Punch sprite!
            if (!spriteImage && this.state === 'ATTACK') {
                const punchKey = `${this.data.id}_punch.png`;
                const punchFallback = `${this.data.id}_punch.png_fallback`;
                spriteImage = this.game.assetManager.images[punchKey] || this.game.assetManager.images[punchFallback];
            }
            // Ultimate fallback for missing attacking sprites: just use their idle stance so they don't turn invisible
            if (!spriteImage && this.state === 'ATTACK') {
                const idleKey = `${this.data.id}_right.png`;
                spriteImage = this.game.assetManager.images[idleKey] || this.game.assetManager.images[`${this.data.id}_right.png_fallback`];
            }

            if (!spriteImage) {
                // If Localhost is caching an old file or the python script broke headers, let's catch it here:
                if (!this._loggedMissingSprite) {
                    console.error(`[Fighter] SCENE ERROR: Missing sprite for ${this.data.id} in state ${this.state} (Tried: ${exactKey} & Fallbacks)`);
                    this._loggedMissingSprite = true;
                }
                // Draw a red debug box to explicitly show the missing asset rather than silently defaulting to front
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fillRect(this.x - 50, this.y - 120, 100, 120);
                return; // Don't crash, just draw the error box
            }

            // --- SAFETY: Prevent Ghost Trading Cards on K.O. ---
            // Many AI generated character cards are tall portraits. If the assigned ko or hit sprite 
            // is abnormally tall and narrow compared to a fighting sprite layout, it's a card.
            if ((this.state === 'KO' || this.state === 'HIT') && spriteImage && spriteImage.naturalHeight > spriteImage.naturalWidth * 1.05) {
                // If the KO sprite is a trading card, try the HIT sprite
                const hitExact = `${this.data.id}_hit.png`;
                const hitImg = this.game.assetManager.images[hitExact] || this.game.assetManager.images[`${this.data.id}_hit.png_fallback`];

                if (hitImg && hitImg.naturalHeight <= hitImg.naturalWidth * 1.05) {
                    spriteImage = hitImg;
                } else {
                    // If HIT is also a trading card or missing, default down to a simple colored box or hide
                    return; // Prevent drawing the giant trading card altogether
                }
            }

            // 2. Draw Sprite if loaded
            // Sprites are massive, we scale them down to roughly 400px tall
            const scale = 400 / spriteImage.naturalHeight;
            const drawW = spriteImage.naturalWidth * scale;
            const drawH = spriteImage.naturalHeight * scale;

            // All sprites natively face RIGHT.
            // P1 (facing=1) is drawn normally (+1).
            // P2 (facing=-1) is mirrored horizontally (-1).
            let drawFacing = this.facing;
            // Hack for base Gargamel: his main stance sprite natively faces LEFT instead of RIGHT
            if (this.data.id === 'Gargamel' && (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP' || this.state === 'WIN')) {
                drawFacing *= -1;
            }
            // Hack for Lee, Vikingo, VikingoRaw: their PUNCH sprite natively faces LEFT instead of RIGHT
            // But their KICK sprite faces RIGHT (standard), so only flip for LIGHT (punch) attacks!
            if ((this.data.id === 'Lee' || this.data.id === 'Vikingo' || this.data.id === 'VikingoRaw') &&
                (this.state === 'ATTACK' || this.state === 'SPECIAL') &&
                !(this.currentAttack && this.currentAttack.type === 'HEAVY')) {
                drawFacing *= -1;
            }
            ctx.scale(drawFacing, 1);

            // ─── BREATHING ANIMATION (REMOVED) ───
            // (Removed per user request to fix lag and rendering bugs)

            // ─── SIMULATE STREET FIGHTER JUMP ROLL (FLIP) ───
            let isRolling = false;
            if (this.state === 'JUMP' && Math.abs(this.vx) > 10) {
                isRolling = true;
                const flipSpeed = 8.0; // Radians per sec (controls rotation speed)
                // Direction of flip relative to facing
                const dir = (this.vx * this.facing > 0) ? 1 : -1;

                // Pivot around the center of the character's drawn body, not the feet
                ctx.translate(0, -drawH / 2);
                ctx.rotate(this.stateTimer * flipSpeed * dir);
                ctx.translate(0, drawH / 2);
            }

            // Draw relative to bottom-center (0,0 is now the character's feet)
            if (this.state === 'HIT' && this.game.settings.hitFlashEnabled) {
                // Use offscreen canvas to flash only visible (non-transparent) pixels
                const offCanvas = document.createElement('canvas');
                offCanvas.width = Math.ceil(drawW);
                offCanvas.height = Math.ceil(drawH);
                const offCtx = offCanvas.getContext('2d');
                offCtx.drawImage(spriteImage, 0, 0, drawW, drawH);
                // White overlay only on drawn pixels
                offCtx.globalCompositeOperation = 'source-atop';
                offCtx.globalAlpha = 0.45;
                offCtx.fillStyle = '#ffffff';
                offCtx.fillRect(0, 0, drawW, drawH);
                // Draw composited result onto main canvas
                ctx.drawImage(offCanvas, -drawW / 2, -drawH, drawW, drawH);
            } else {
                ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
            }

            // ─── UN-ROTATE THE CONTEXT ───
            if (isRolling) {
                const dir = (this.vx * this.facing > 0) ? 1 : -1;
                ctx.translate(0, -drawH / 2);
                ctx.rotate(-this.stateTimer * 8.0 * dir); // Reverse the exact rotation
                ctx.translate(0, drawH / 2);
            }

            ctx.scale(this.facing, 1); // Reverse the scale here so hitboxes draw correctly

            // Because we translated, coords must be centered at 0
            const hw = this.hurtbox.width;
            const hh = this.hurtbox.height;
            const hx = this.facing === 1 ? this.hurtbox.xOffset : -this.hurtbox.xOffset - hw;
            const hy = this.hurtbox.yOffset;
            ctx.fillRect(hx, hy, hw, hh);

            // Reverse rotation if KO to preserve hitbox draw
            if (this.state === 'KO') ctx.rotate(Math.PI / 2 * this.facing);
        }

        // 3. Debug: Draw Hitboxes strictly if active
        // SET TO TRUE TO VISUALIZE THE PHYSICAL AABB GEOMETRY OVER THE SPRITES
        const debugHitboxes = false;
        if (debugHitboxes) {
            // Draw physics hurtbox bounds over the sprite for QA
            // Translate is already active, so just draw local offsets
            const hw = this.hurtbox.width;
            const hh = this.hurtbox.height;
            const hx = this.facing === 1 ? this.hurtbox.xOffset : -this.hurtbox.xOffset - hw;
            const hy = this.hurtbox.yOffset;

            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hx, hy, hw, hh);

            if (this.activeHitbox) {
                const aw = this.activeHitbox.width;
                const ah = this.activeHitbox.height;
                const ax = this.facing === 1 ? this.activeHitbox.xOffset : -this.activeHitbox.xOffset - aw;
                const ay = this.activeHitbox.yOffset;

                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.fillRect(ax, ay, aw, ah);
            }
        }

        ctx.restore();
    }
}

