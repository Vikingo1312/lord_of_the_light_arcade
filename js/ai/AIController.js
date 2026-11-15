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
        const styleId = (p2.data && p2.data.styleId) || 'LIGHT_DRAGON';

        // Progressive stage index: Stage 1 (Hattori, rosterIdx=1) -> progress = 0.0
        // Stage 14 (Dark Vikingo, rosterIdx=14) -> progress = 1.0
        const rosterIdx = Math.max(1, Math.min(14, combat.combatData?.p2?.rosterIndex ?? 6));
        let progress = (rosterIdx - 1) / 13; // 0.0 to 1.0 across the 14 stages

        // Calibrated to genuine Street Fighter II: Champion Edition / Alpha 3 Arcade challenge on NORMAL!
        if (difficultySetting === 'EASY') progress = Math.max(0.18, progress * 0.48);
        else if (difficultySetting === 'NORMAL') progress = Math.min(0.92, 0.48 + progress * 0.44);
        else if (difficultySetting === 'HARD') progress = Math.min(1.0, 0.72 + progress * 0.28);

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
            p2._p1MashCount = Math.max(0, p2._p1MashCount - 1.55 * dt);
        }

        // Give P1 brief wake-up respect when P1 has wake-up immunity
        if (p1.hitImmunity > 0.16) {
            p2.aiWaitTimer = Math.max(p2.aiWaitTimer, 0.24);
            if (dist < 160 && styleId !== 'TITAN_GRAPPLER') ai[dirAwayFromP1] = true;
            return ai;
        }

        // Helper for executing a Street Fighter Whiff / Guard Reversal Punish tailored to p2's Fight Style
        const triggerPunishAttack = () => {
            p2.aiBlockTimer = 0;
            ai[dirAwayFromP1] = false;
            ai.down = false;
            const r = Math.random();
            const throwRange = styleId === 'TITAN_GRAPPLER' ? 210 : 152;
            if (dist <= throwRange && p1.isGrounded && p2.isGrounded && (styleId === 'TITAN_GRAPPLER' ? r < 0.55 : r < 0.28)) {
                ai.commandMove = 'THROW';
            } else if (p2.specialMoveCooldown <= 0 && r < 0.58) {
                ai.commandMove = (styleId === 'CAPOEIRA_TRICKSTER' || dist > 165) ? 'HURRICANE_KICK' : 'DRAGON_UPPERCUT';
            } else if (r < 0.80) {
                if (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.5) {
                    ai.down = true;
                    ai.hJust = true; // Low Sweep punish
                } else {
                    ai[dirToP1] = true;
                    ai.hJust = true; // Overhead Axe Kick punish
                }
            } else {
                ai.lJust = true; // Fast 3-hit combo starter
            }
            p2.aiWaitTimer = Math.max(0.22, 0.42 - progress * 0.16);
            return ai;
        };

        // ─── 0. ARCHETYPE-SPECIFIC & STREET FIGHTER HIT-CONFIRM COMBO CHAINING ───
        const p2AtkType = p2.currentAttack ? p2.currentAttack.type : '';
        const p2HitConfirmed = p2.state === 'ATTACK' && (p2.attackHasHit || p2.attackHitCount > 0) && !p2.attackWasBlocked;

        if (p2HitConfirmed && p2.isGrounded && dist <= 230) {
            const styleChainProb = 0.52 + progress * 0.40;
            if (Math.random() < styleChainProb) {
                // 1) SHADOW_ASSASSIN Signature: HEAVY/SWEEP -> P (Phantom Shadow Blitz) -> K (Execution Axe Kick)
                if (styleId === 'SHADOW_ASSASSIN' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP')) {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.16;
                    return ai;
                }
                if (styleId === 'SHADOW_ASSASSIN' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.42;
                    return ai;
                }
                // 2) CAPOEIRA_TRICKSTER Signature: K -> K -> K (Triple Capoeira Helicopter)
                if (styleId === 'CAPOEIRA_TRICKSTER' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP' || p2AtkType === 'COMBO_KICK')) {
                    ai.hJust = true;
                    p2.aiWaitTimer = p2AtkType === 'COMBO_KICK' ? 0.44 : 0.16;
                    return ai;
                }
                // 3) TITAN_GRAPPLER Signature: LIGHT / COMBO_KICK -> P+K Unblockable Titan Combo Slam!
                if (styleId === 'TITAN_GRAPPLER' && (p2AtkType === 'LIGHT' || p2AtkType === 'COMBO_KICK') && dist <= 215) {
                    ai.l = true;
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.46;
                    return ai;
                }
                // 4) VALHALLA_BERSERKER Signature: COMMAND_PUNCH -> L -> H
                if (styleId === 'VALHALLA_BERSERKER' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.16;
                    return ai;
                }
                // 5) MASTER_STRIKER Signature: 4-Hit Blade Rush (HEAVY -> H)
                if (styleId === 'MASTER_STRIKER' && p2AtkType === 'HEAVY' && p2.comboChainStep >= 1) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.42;
                    return ai;
                }
            }
        }

        if (p2.comboChainStep > 0 && p2.comboChainTimer > 0.04 && dist <= 215) {
            const canCancel = p2.state === 'IDLE' || p2.state === 'WALK' || p2HitConfirmed;
            if (canCancel) {
                const chainProb = p2.comboChainStep === 1 ? (0.58 + progress * 0.36) : (0.50 + progress * 0.42);
                if (Math.random() < chainProb) {
                    if (p2.comboChainStep === 2 && p2.specialEnergy >= 100 && Math.random() < (0.48 + progress * 0.30)) {
                        ai.sJust = true; // Hit-confirm Super Arts cancel!
                    } else if (p2.comboChainStep === 2 && p2.specialMoveCooldown <= 0 && Math.random() < 0.48) {
                        if (styleId === 'LIGHT_DRAGON') {
                            ai.up = true;
                            ai.lJust = true; // Solar Dragon Uppercut Launcher!
                        } else {
                            ai.commandMove = Math.random() < 0.55 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                        }
                    } else {
                        ai.lJust = true; // Chain next step in 3-hit combo
                    }
                    p2.aiWaitTimer = p2.comboChainStep === 2 ? Math.max(0.32, 0.55 - progress * 0.20) : 0.14;
                    return ai;
                } else {
                    p2.aiWaitTimer = 0.32;
                }
            }
        }

        // ─── 1. SUSTAINED BLOCKING & STREET FIGHTER GUARD REVERSAL ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;

            if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
                const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);
                if (p1.stateTimer < activeEnd) {
                    // Keep holding guard until P1's active frames finish!
                    p2.aiBlockTimer = Math.max(p2.aiBlockTimer, 0.08);
                    if (p1.currentAttack.isOverhead) {
                        ai.down = false;
                    } else if (p1.currentAttack.isLow || p1.currentAttack.type === 'SWEEP' || p1.currentAttack.type === 'CROUCH_LIGHT') {
                        ai.down = true;
                    }
                    return ai;
                } else if (p2.blockStun <= 0 && dist <= 215 && Math.random() < (0.42 + progress * 0.45)) {
                    // P1 is now in recovery frames after getting blocked — Street Fighter Guard Reversal Punish!
                    return triggerPunishAttack();
                }
            }
            return ai;
        }

        // ─── 2. REACT TO INCOMING PROJECTILES ───
        const incomingProj = combat.projectiles.find(
            proj => proj.owner === 'p1' && proj.alive &&
                Math.abs(proj.x - p2.x) < 460 &&
                ((proj.facing === 1 && proj.x < p2.x) || (proj.facing === -1 && proj.x > p2.x))
        );
        if (incomingProj && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            const reactChance = 0.48 + progress * 0.44;
            if (Math.random() < reactChance) {
                if (styleId === 'SHADOW_ASSASSIN' && dist < 340 && p2.dashCooldown <= 0 && Math.random() < 0.65) {
                    // Shadow Assassins phase-dash right through projectiles!
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    return ai;
                } else if (Math.random() < 0.58 + progress * 0.25) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.24;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.26;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 2B. STREET FIGHTER SHORYUKEN ANTI-AIR REACTION (When P1 jumps in!) ───
        if (!p1.isGrounded && dist < 235 && p1.y < p2.y - 55 && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            if (Math.random() < (0.26 + progress * 0.52) * dt * 12) {
                if (p2.specialMoveCooldown <= 0 && Math.random() < 0.65) {
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    p2.aiWaitTimer = 0.36;
                    return ai;
                } else if (Math.random() < 0.65) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.32;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.24;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (Smart Guarding, Super-Armor Counter, or Whiff Punish!) ───
        if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
            const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);

            if (isNewP1Swing) {
                // Berserkers & Grapplers occasionally use Super-Armor to power right through P1's light pokes!
                if ((styleId === 'VALHALLA_BERSERKER' || styleId === 'TITAN_GRAPPLER') &&
                    !p1.currentAttack.unblockable && p1.currentAttack.damage <= 26 &&
                    Math.random() < (0.28 + progress * 0.28)) {
                    ai[dirToP1] = true;
                    ai.hJust = true; // Armored AXE_KICK / HEAVY counter-crush!
                    p2.aiWaitTimer = 0.34;
                    return ai;
                }

                const mashBonus = Math.min(0.28, Math.max(0, p2._p1MashCount - 1.2) * 0.12);
                const blockProb = Math.min(0.84, 0.42 + progress * 0.36 + mashBonus);
                const roll = Math.random();

                if (roll < blockProb) {
                    p2.aiBlockTimer = 0.18 + progress * 0.12;
                    ai[dirAwayFromP1] = true;
                    if (!p1.currentAttack.isOverhead && (p1.currentAttack.isLow || p1.currentAttack.type === 'SWEEP' || p1.currentAttack.type === 'CROUCH_LIGHT')) {
                        ai.down = true;
                    }
                    return ai;
                }
            } else if (p1.stateTimer >= activeEnd + 0.04 && p2.blockStun <= 0 &&
                       (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') &&
                       dist <= 215 && Math.random() < (0.38 + progress * 0.46)) {
                // Whiff punish P1 when P1 misses or is stuck in recovery frames!
                return triggerPunishAttack();
            }
        }

        // ─── 4. ACTION COOLDOWN / PACING (Active Street Fighter Footsies) ───
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (dist > 195) {
                ai[dirToP1] = true;
            } else if (dist < 130 && styleId !== 'TITAN_GRAPPLER' && Math.random() < 0.42) {
                ai[dirAwayFromP1] = true; // Micro-shimmy footsies
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.commandMove) {
                const minWait = Math.max(0.18, 0.46 - progress * 0.26);
                const randWait = Math.max(0.10, 0.24 - progress * 0.12);
                p2.aiWaitTimer = minWait + Math.random() * randWait;
            }
            return ai;
        };

        // ─── 5. AIRBORNE SALTO-KICK / DIVE-KICK ATTACKS ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 245) {
            if (Math.random() < (0.28 + progress * 0.42)) {
                if (styleId === 'CAPOEIRA_TRICKSTER' && p2.specialMoveCooldown <= 0 && Math.random() < 0.45) {
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (Math.random() < 0.72) {
                    ai.hJust = true; // Aerial Dive-Kick / Salto Heavy Kick
                } else {
                    ai.lJust = true;
                }
            }
            return ai;
        }

        // ─── 6. APPROACH ZONE (far away: dist > 265) ───
        if (dist > 265) {
            ai[dirToP1] = true;

            // Aggressive Forward Dash to close gap (Shadow Assassins & Capoeira dash frequently!)
            const dashFreq = (styleId === 'SHADOW_ASSASSIN' || styleId === 'CAPOEIRA_TRICKSTER')
                ? (0.045 + progress * 0.065)
                : (0.025 + progress * 0.045);
            if (p2.isGrounded && p2.dashCooldown <= 0 && Math.random() < dashFreq) {
                if (dirToP1 === 'right') ai.dashRightJust = true;
                else ai.dashLeftJust = true;
                return ai;
            }

            // Fire projectile / dash special from range when Super Energy is full
            if (p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                const zoningFreq = (styleId === 'LIGHT_DRAGON' || styleId === 'MASTER_STRIKER')
                    ? (0.042 + progress * 0.065)
                    : (0.028 + progress * 0.050);
                if (Math.random() < zoningFreq) {
                    ai.sJust = true;
                    return applyCooldown();
                }
            }

            // Jump-in Salto / Dive-Kick approach
            const jumpFreq = (styleId === 'SHADOW_ASSASSIN' || styleId === 'CAPOEIRA_TRICKSTER')
                ? (0.024 + progress * 0.038)
                : (0.014 + progress * 0.026);
            if (Math.random() < jumpFreq && p2.isGrounded) {
                ai[dirToP1] = true;
                ai.up = true;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close quarters: dist <= 195) ───
        const strikeRange = styleId === 'MASTER_STRIKER' ? 220 : (styleId === 'TITAN_GRAPPLER' ? 210 : 192);
        if (dist <= strikeRange) {
            if (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') {
                // If P1 is turtle-blocking at close range, immediately punish with Unblockable Throw or Overhead!
                const grabRange = styleId === 'TITAN_GRAPPLER' ? 215 : 155;
                if (p1.isBlocking && dist <= grabRange && Math.random() < (0.55 + progress * 0.38)) {
                    if (p1.isGrounded && (styleId === 'TITAN_GRAPPLER' || Math.random() < 0.62)) {
                        ai.commandMove = 'THROW';
                    } else {
                        ai[dirToP1] = true;
                        if (Math.random() < 0.45) ai.lJust = true; // COMMAND_PUNCH overhead
                        else ai.hJust = true; // AXE_KICK overhead
                    }
                    return applyCooldown();
                }

                // TITAN_GRAPPLER command throw mixup even when P1 isn't blocking!
                if (styleId === 'TITAN_GRAPPLER' && dist <= 210 && p1.isGrounded && Math.random() < (0.28 + progress * 0.25)) {
                    ai.commandMove = 'THROW';
                    return applyCooldown();
                }

                const attackChance = 0.68 + progress * 0.28;
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    const superThreshold = 0.12 + progress * 0.16;
                    const physSpecialThreshold = superThreshold + (0.14 + progress * 0.16);
                    const sweepThreshold = physSpecialThreshold + (styleId === 'CAPOEIRA_TRICKSTER' ? 0.26 : 0.16);
                    const commandThreshold = sweepThreshold + ((styleId === 'VALHALLA_BERSERKER' || styleId === 'SHADOW_ASSASSIN') ? 0.26 : 0.18);
                    const heavyThreshold = commandThreshold + 0.18;

                    if (mixup < superThreshold && p2.specialEnergy >= 100) {
                        ai.sJust = true;
                    } else if (mixup < physSpecialThreshold && p2.specialMoveCooldown <= 0) {
                        ai.commandMove = (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.48) ? 'HURRICANE_KICK' : 'DRAGON_UPPERCUT';
                    } else if (mixup < sweepThreshold) {
                        // Street Fighter Low Sweep mixup!
                        ai.down = true;
                        ai.hJust = true;
                    } else if (mixup < commandThreshold) {
                        // Overhead Command Backfist or Axe Kick!
                        ai[dirToP1] = true;
                        if (styleId === 'VALHALLA_BERSERKER' || Math.random() < 0.5) ai.lJust = true;
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
                    p2.aiWaitTimer = Math.max(0.06, 0.16 - progress * 0.10);
                }
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: strikeRange < dist <= 265) ───
        ai[dirToP1] = true;

        if (p2.state === 'IDLE' || p2.state === 'WALK') {
            const roll = Math.random();
            if (roll < (0.028 + progress * 0.045) && p2.specialEnergy >= 100) {
                ai.sJust = true;
                return applyCooldown();
            } else if (roll < (0.085 + progress * 0.14)) {
                if (styleId === 'SHADOW_ASSASSIN' && p2.dashCooldown <= 0 && Math.random() < 0.48) {
                    // Phantom Shadow Cross-Up Dash!
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    return ai;
                } else if (p2.specialMoveCooldown <= 0 && (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.38)) {
                    // Gap-closing Hurricane Kick!
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (Math.random() < 0.32 && p2.isGrounded) {
                    // Forward Jump-in Salto / Dive-Kick Attack!
                    ai[dirToP1] = true;
                    ai.up = true;
                    ai.hJust = true;
                } else if (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.42) {
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

