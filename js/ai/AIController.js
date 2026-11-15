/**
 * AIController — Handles CPU opponent decision-making during combat.
 */
export default class AIController {
    static computeInput(combat, dt) {
        const ai = {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false,
            lJust: false, hJust: false, sJust: false,
            dashLeftJust: false, dashRightJust: false,
            commandMove: null
        };

        let p1 = combat.p1;
        const p2 = combat.p2;
        if (combat.ally && combat.ally.state !== 'KO') {
            if (!p1 || p1.state === 'KO') {
                p1 = combat.ally;
            } else if (Math.abs(combat.ally.x - p2.x) < Math.abs(p1.x - p2.x)) {
                p1 = combat.ally;
            }
        }
        if (!p1 || !p2 || p2.state === 'KO' || p1.state === 'KO') {
            return ai;
        }

        const difficultySetting = combat.game.settings?.difficulty || 'NORMAL';
        const dist = Math.abs(p1.x - p2.x);
        const dirToP1 = p1.x > p2.x ? 'right' : 'left';
        const dirAwayFromP1 = p1.x > p2.x ? 'left' : 'right';

        // Progressive stage index: Stage 1 (Hattori, rosterIdx=1) -> progress = 0.0
        // Stage 14 (Dark Vikingo, rosterIdx=14) -> progress = 1.0
        const rosterIdx = Math.max(1, Math.min(14, combat.combatData?.p2?.rosterIndex ?? 1));
        let progress = (rosterIdx - 1) / 13; // 0.0 to 1.0 across the 14 stages

        if (difficultySetting === 'EASY') progress = Math.max(0.08, progress * 0.42);
        else if (difficultySetting === 'NORMAL') progress = Math.min(0.75, 0.15 + progress * 0.56);
        else if (difficultySetting === 'HARD') progress = Math.min(1.0, 0.40 + progress * 0.58);

        // Initialize AI state & anti-mash trackers on p2
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (typeof p2.aiBlockTimer === 'undefined') p2.aiBlockTimer = 0;
        if (typeof p2._lastSeenP1Attack === 'undefined') p2._lastSeenP1Attack = null;
        if (typeof p2._p1MashCount === 'undefined') p2._p1MashCount = 0;

        // Track every new attack swing by P1 (even while P2 is blocking!) to detect button-mashing
        const isNewP1Swing = (p1.state === 'ATTACK' && p1.currentAttack && p2._lastSeenP1Attack !== p1.currentAttack);
        if (isNewP1Swing) {
            p2._lastSeenP1Attack = p1.currentAttack;
            p2._p1MashCount = Math.min(5, p2._p1MashCount + 1);
        } else if (p1.state !== 'ATTACK') {
            p2._lastSeenP1Attack = null;
        }

        // Decay P1 button-mash counter smoothly over time
        if (p2._p1MashCount > 0) {
            p2._p1MashCount = Math.max(0, p2._p1MashCount - 1.65 * dt);
        }

        // Give P1 breathing room when P1 has wake-up immunity!
        if (p1.hitImmunity > 0.15) {
            p2.aiWaitTimer = Math.max(p2.aiWaitTimer, 0.38);
            if (dist < 170) ai[dirAwayFromP1] = true;
            return ai;
        }

        // Helper for executing a Street Fighter Whiff / Guard Reversal Punish
        const triggerPunishAttack = () => {
            p2.aiBlockTimer = 0;
            ai[dirAwayFromP1] = false;
            ai.down = false;
            const r = Math.random();
            if (dist <= 148 && p1.isGrounded && p2.isGrounded && r < 0.22) {
                ai.commandMove = 'THROW';
            } else if (p2.specialMoveCooldown <= 0 && r < 0.48) {
                ai.commandMove = (dist <= 155 || !p1.isGrounded) ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
            } else if (r < 0.72) {
                if (Math.random() < 0.5) {
                    ai.down = true;
                    ai.hJust = true; // Low Sweep punish
                } else {
                    ai[dirToP1] = true;
                    ai.hJust = true; // Overhead Axe Kick punish
                }
            } else {
                ai.lJust = true; // Fast 3-hit combo starter
            }
            p2.aiWaitTimer = 0.52;
            return ai;
        };

        // ─── 0. STREET FIGHTER HIT-CONFIRM COMBO CHAINING (LIGHT -> COMBO_KICK -> COMBO_FINISHER / SPECIAL) ───
        if (p2.comboChainStep > 0 && p2.comboChainTimer > 0.04 && dist <= 198) {
            const canCancel = p2.state === 'IDLE' || p2.state === 'WALK' ||
                (p2.state === 'ATTACK' && (p2.attackHasHit || p2.attackHitCount > 0) && !p2.attackWasBlocked);
            if (canCancel) {
                const chainProb = p2.comboChainStep === 1 ? (0.36 + progress * 0.42) : (0.28 + progress * 0.44);
                if (Math.random() < chainProb) {
                    if (p2.comboChainStep === 2 && p2.specialEnergy >= 100 && Math.random() < 0.38) {
                        ai.sJust = true; // Hit-confirm Super Arts cancel!
                    } else if (p2.comboChainStep === 2 && p2.specialMoveCooldown <= 0 && Math.random() < 0.35) {
                        ai.commandMove = Math.random() < 0.55 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                    } else {
                        ai.lJust = true; // Chain next step in 3-hit combo
                    }
                    // After finishing a combo chain, pause so the player gets a fair turn!
                    p2.aiWaitTimer = p2.comboChainStep === 2 ? 0.75 : 0.22;
                    return ai;
                } else {
                    p2.aiWaitTimer = 0.55;
                }
            }
        }

        // ─── 1. SUSTAINED BLOCKING & STREET FIGHTER GUARD REVERSAL ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;

            if (p1.state === 'ATTACK' && p1.currentAttack && dist < 235) {
                const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);
                if (p1.stateTimer < activeEnd) {
                    // Keep holding guard until P1's active frames finish!
                    p2.aiBlockTimer = Math.max(p2.aiBlockTimer, 0.08);
                    // Match high/low guard: crouch-block lows, stand-block overheads
                    if (p1.currentAttack.isOverhead) {
                        ai.down = false;
                    } else if (p1.currentAttack.isLow || p1.currentAttack.type === 'SWEEP' || p1.currentAttack.type === 'CROUCH_LIGHT') {
                        ai.down = true;
                    }
                    return ai;
                } else if (p2.blockStun <= 0 && dist <= 200 && Math.random() < (0.22 + progress * 0.38)) {
                    // P1 is now in recovery frames after getting blocked — occasional Guard Reversal Punish!
                    return triggerPunishAttack();
                }
            }
            return ai;
        }

        // ─── 2. REACT TO INCOMING PROJECTILES ───
        const incomingProj = combat.projectiles.find(
            proj => proj.owner === 'p1' && proj.alive &&
                Math.abs(proj.x - p2.x) < 420 &&
                ((proj.facing === 1 && proj.x < p2.x) || (proj.facing === -1 && proj.x > p2.x))
        );
        if (incomingProj && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            const reactChance = 0.28 + progress * 0.48;
            if (Math.random() < reactChance) {
                if (Math.random() < 0.48 + progress * 0.28) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.28;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 2B. STREET FIGHTER SHORYUKEN ANTI-AIR REACTION (When P1 jumps in!) ───
        if (!p1.isGrounded && dist < 225 && p1.y < p2.y - 60 && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            if (Math.random() < (0.12 + progress * 0.38) * dt * 10) {
                if (p2.specialMoveCooldown <= 0 && Math.random() < 0.45) {
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    p2.aiWaitTimer = 0.55;
                    return ai;
                } else if (Math.random() < 0.55) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.48;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.26;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (Fair Guarding without unfair 0-frame counter-interrupts!) ───
        if (p1.state === 'ATTACK' && p1.currentAttack && dist < 235) {
            const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);

            if (isNewP1Swing) {
                const mashBonus = Math.min(0.25, Math.max(0, p2._p1MashCount - 1.5) * 0.10);
                const blockProb = Math.min(0.72, 0.24 + progress * 0.36 + mashBonus);
                const roll = Math.random();

                if (roll < blockProb) {
                    p2.aiBlockTimer = 0.20 + progress * 0.12;
                    ai[dirAwayFromP1] = true;
                    if (!p1.currentAttack.isOverhead && (p1.currentAttack.isLow || p1.currentAttack.type === 'SWEEP' || p1.currentAttack.type === 'CROUCH_LIGHT')) {
                        ai.down = true;
                    }
                    return ai;
                }
            } else if (p1.stateTimer >= activeEnd + 0.06 && p2.blockStun <= 0 &&
                       (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') &&
                       dist <= 195 && Math.random() < (0.18 + progress * 0.36)) {
                // Whiff punish P1 only if P1 is genuinely stuck in late recovery frames!
                return triggerPunishAttack();
            }
        }

        // ─── 4. ACTION COOLDOWN / PACING (Rhythmic footsies instead of non-stop button mashing!) ───
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (progress > 0.35 && dist > 205) {
                ai[dirToP1] = true;
            } else if (dist < 140 && Math.random() < 0.48) {
                ai[dirAwayFromP1] = true; // Footsies micro-shimmy back to give player space
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.commandMove) {
                const minWait = Math.max(0.36, 0.88 - progress * 0.44);
                const randWait = Math.max(0.18, 0.45 - progress * 0.20);
                p2.aiWaitTimer = minWait + Math.random() * randWait;
            }
            return ai;
        };

        // ─── 5. AIRBORNE SALTO-KICK / DIVE-KICK ATTACKS ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 225) {
            if (Math.random() < (0.12 + progress * 0.26)) {
                if (Math.random() < 0.65) ai.hJust = true;
                else ai.lJust = true;
            }
            return ai;
        }

        // ─── 6. APPROACH ZONE (far away: dist > 265) ───
        if (dist > 265) {
            if (Math.random() < (0.76 + progress * 0.22)) {
                ai[dirToP1] = true;
            }

            // Aggressive Forward Dash to close gap
            if (p2.isGrounded && p2.dashCooldown <= 0 && Math.random() < (0.015 + progress * 0.035)) {
                if (dirToP1 === 'right') ai.dashRightJust = true;
                else ai.dashLeftJust = true;
                return ai;
            }

            // Fire projectile / dash special from range when Super Energy is full
            if (p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                if (Math.random() < (0.018 + progress * 0.042)) {
                    ai.sJust = true;
                    return applyCooldown();
                }
            }

            // Jump-in Salto approach
            if (Math.random() < (0.010 + progress * 0.024) && p2.isGrounded) {
                ai[dirToP1] = true;
                ai.up = true;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close quarters: dist <= 185) ───
        if (dist <= 185) {
            if (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') {
                // If P1 is turtle-blocking at close range, mix in Unblockable Throw or Overhead Backfist/Axe Kick!
                if (p1.isBlocking && dist <= 155 && Math.random() < (0.35 + progress * 0.40)) {
                    if (dist <= 145 && p1.isGrounded && Math.random() < 0.55) {
                        ai.commandMove = 'THROW';
                    } else {
                        ai[dirToP1] = true;
                        if (Math.random() < 0.5) ai.lJust = true; // COMMAND_PUNCH overhead
                        else ai.hJust = true; // AXE_KICK overhead
                    }
                    return applyCooldown();
                }

                const attackChance = 0.52 + progress * 0.42;
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    const superThreshold = 0.08 + progress * 0.16;
                    const physSpecialThreshold = superThreshold + (0.10 + progress * 0.16);
                    const sweepThreshold = physSpecialThreshold + (0.14 + progress * 0.12);
                    const commandThreshold = sweepThreshold + (0.14 + progress * 0.12);
                    const heavyThreshold = commandThreshold + 0.16;

                    if (mixup < superThreshold && p2.specialEnergy >= 100) {
                        ai.sJust = true;
                    } else if (mixup < physSpecialThreshold && p2.specialMoveCooldown <= 0) {
                        ai.commandMove = Math.random() < 0.55 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                    } else if (mixup < sweepThreshold) {
                        // Street Fighter Low Sweep mixup!
                        ai.down = true;
                        ai.hJust = true;
                    } else if (mixup < commandThreshold) {
                        // Overhead Command Backfist or Axe Kick!
                        ai[dirToP1] = true;
                        if (Math.random() < 0.5) ai.lJust = true;
                        else ai.hJust = true;
                    } else if (mixup < heavyThreshold) {
                        ai.hJust = true;
                    } else {
                        // Start a 3-hit combo with Light Jab or Crouch Low Kick!
                        if (Math.random() < 0.22) ai.down = true;
                        ai.lJust = true;
                    }
                    return applyCooldown();
                } else {
                    p2.aiWaitTimer = Math.max(0.07, 0.22 - progress * 0.14);
                }
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: 185 < dist <= 265) ───
        if (Math.random() < (0.74 + progress * 0.24)) {
            ai[dirToP1] = true;
        }

        if (p2.state === 'IDLE' || p2.state === 'WALK') {
            const roll = Math.random();
            if (roll < (0.015 + progress * 0.035) && p2.specialEnergy >= 100) {
                ai.sJust = true;
                return applyCooldown();
            } else if (roll < (0.045 + progress * 0.095)) {
                if (p2.specialMoveCooldown <= 0 && Math.random() < 0.30) {
                    // Gap-closing Hurricane Kick!
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (Math.random() < 0.28 && p2.isGrounded) {
                    // Forward Jump-in Salto Attack!
                    ai[dirToP1] = true;
                    ai.up = true;
                    ai.hJust = true;
                } else if (Math.random() < 0.38) {
                    // Sliding Low Sweep from footsies range!
                    ai.down = true;
                    ai.hJust = true;
                } else {
                    // Lunging Axe Kick or Backfist into range!
                    ai[dirToP1] = true;
                    ai.hJust = true;
                }
                return applyCooldown();
            }
        }

        return ai;
    }

    /**
     * AI Partner logic for Co-Op Mode when playing with AI Ally (or if remote player is offline).
     */
    static computeAllyInput(combat, dt) {
        const ai = {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false,
            lJust: false, hJust: false, sJust: false
        };
        const ally = combat.ally;
        const p2 = combat.p2;
        if (!ally || !p2 || ally.state === 'KO' || p2.state === 'KO') return ai;

        if (typeof ally.aiWaitTimer === 'undefined') ally.aiWaitTimer = 0;
        if (ally.aiWaitTimer > 0) {
            ally.aiWaitTimer -= dt;
            return ai;
        }

        const dist = Math.abs(p2.x - ally.x);
        const dirToEnemy = p2.x > ally.x ? 'right' : 'left';
        const dirAway = p2.x > ally.x ? 'left' : 'right';

        if (p2.state === 'ATTACK' && dist < 210 && Math.random() < 0.35) {
            ai[dirAway] = true;
            ally.aiWaitTimer = 0.22;
            return ai;
        }

        if (dist > 210) {
            ai[dirToEnemy] = true;
            if (dist > 340 && ally.specialEnergy >= 100 && Math.random() < 0.02) {
                ai.sJust = true;
                ally.aiWaitTimer = 0.45;
            }
            return ai;
        }

        if (ally.state === 'IDLE' || ally.state === 'WALK') {
            if (Math.random() < 0.48) {
                const r = Math.random();
                if (r < 0.15 && ally.specialEnergy >= 100) ai.sJust = true;
                else if (r < 0.45) ai.hJust = true;
                else ai.lJust = true;
                ally.aiWaitTimer = 0.35 + Math.random() * 0.25;
            }
        }
        return ai;
    }
}

