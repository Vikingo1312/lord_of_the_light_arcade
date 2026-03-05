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
        this.hp = 400;
        this.maxHP = 400;
        this.speed = 400;
        this.jumpImpulse = -1200;

        // Deterministic Physics Constants
        this.gravity = 3500;  // Extremely heavy Street Fighter style drop

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
        this.hurtbox = new Hitbox(-60, 0, 120, 300);

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
                } else if (inputQueue.left) {
                    this.vx = -this.speed;
                    this.state = 'WALK';
                } else if (inputQueue.right) {
                    this.vx = this.speed;
                    this.state = 'WALK';
                } else if (inputQueue.l) {
                    this.executeAttack('LIGHT');
                } else if (inputQueue.h) {
                    this.executeAttack('HEAVY');
                } else if (inputQueue.s) {
                    this.executeAttack('SPECIAL');
                }
                break;

            case 'WALK':
                // Transition out of walk
                if (inputQueue.up) {
                    this.executeJump(inputQueue);
                } else if (inputQueue.l) {
                    this.executeAttack('LIGHT');
                } else if (inputQueue.h) {
                    this.executeAttack('HEAVY');
                } else if (inputQueue.s) {
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
                // Just apply gravity
                break;

            case 'ATTACK':
                this.vx = 0; // Stop moving while punching
                // Validate Frame Data phase
                if (this.stateTimer >= this.currentAttack.startup && this.stateTimer < (this.currentAttack.startup + this.currentAttack.active)) {
                    // ACTIVE FRAMES: Spawn Hitbox
                    this.activeHitbox = this.currentAttack.box;
                } else {
                    // STARTUP or RECOVERY
                    this.activeHitbox = null;
                }

                // End of attack
                if (this.stateTimer >= (this.currentAttack.startup + this.currentAttack.active + this.currentAttack.recovery)) {
                    this.state = 'IDLE';
                    this.activeHitbox = null;
                    this.currentAttack = null;
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
        if (inputQueue.left) this.vx = -this.speed * 0.8;
        else if (inputQueue.right) this.vx = this.speed * 0.8;
        else this.vx = 0;
    }

    executeAttack(type) {
        this.state = 'ATTACK';
        this.stateTimer = 0;

        if (type === 'LIGHT') {
            this.currentAttack = {
                startup: 0.04, active: 0.08, recovery: 0.12,
                damage: 7, pushback: 120, hitstop: 0.05,
                box: new Hitbox(0, 200, 110, 45),
                type: 'LIGHT'
            };
        } else if (type === 'HEAVY') {
            this.currentAttack = {
                startup: 0.18, active: 0.12, recovery: 0.30,
                damage: 16, pushback: 320, hitstop: 0.15,
                lift: -150, // Slight upward launch
                box: new Hitbox(20, 150, 130, 65),
                type: 'HEAVY'
            };
        } else if (type === 'SPECIAL') {
            this.currentAttack = {
                startup: 0.10, active: 0.15, recovery: 0.22,
                damage: 14, pushback: 250, hitstop: 0.12,
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

        // In Combat, IDLE, WALK, and JUMP use the combat stance sprite as the base.
        // The Engine automatically mirrors the image via ctx.scale(this.facing, 1) later on.
        if (this.state === 'IDLE' || this.state === 'WALK' || this.state === 'JUMP') {
            suffix = '_right.png';
        }
        if (this.state === 'ATTACK') {
            if (this.currentAttack && this.currentAttack.damage > 10) suffix = '_kick.png'; // Heavy
            else suffix = '_punch.png'; // Light
        }
        if (this.state === 'HIT') suffix = '_hit.png';
        if (this.state === 'KO') suffix = '_ko.png';

        const spriteKey = `${this.data.id}${suffix}`;
        spriteImage = this.game.assetManager.images[spriteKey];

        // 2. Draw Sprite if loaded, else fallback to debug box
        if (spriteImage) {
            // Sprites are massive, we scale them down to roughly 400px tall
            const scale = 400 / spriteImage.naturalHeight;
            const drawW = spriteImage.naturalWidth * scale;
            const drawH = spriteImage.naturalHeight * scale;

            // Flip horizontally based on facing
            ctx.scale(this.facing, 1);

            // Draw relative to bottom-center
            if (this.state === 'HIT') {
                // Draw sprite then flash overlay
                ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-drawW / 2, -drawH, drawW, drawH);
                ctx.globalAlpha = 1;
            } else {
                ctx.drawImage(spriteImage, -drawW / 2, -drawH, drawW, drawH);
            }
            // Restore scale
            ctx.scale(this.facing, 1);

        } else {
            // Debug Fallback rendering
            if (this.state === 'HIT') {
                ctx.fillStyle = 'white';
            } else if (this.state === 'KO') {
                ctx.fillStyle = '#555';
                ctx.rotate(-Math.PI / 2 * this.facing);
            } else {
                ctx.fillStyle = this.data.color || 'gray';
            }

            const rect = this.hurtbox.getWorldRect(0, 0, this.facing);
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }

        ctx.restore();

        // 3. Debug: Draw Hitboxes strictly if active
        // SET TO TRUE TO VISUALIZE THE PHYSICAL AABB GEOMETRY OVER THE SPRITES
        const debugHitboxes = false;
        if (debugHitboxes) {
            // Draw physics hurtbox bounds over the sprite for QA
            const hurtR = this.hurtbox.getWorldRect(this.x, this.y, this.facing);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hurtR.x, hurtR.y, hurtR.width, hurtR.height);

            if (this.activeHitbox) {
                const hitR = this.activeHitbox.getWorldRect(this.x, this.y, this.facing);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.fillRect(hitR.x, hitR.y, hitR.width, hitR.height);
            }
        }
    }
}
