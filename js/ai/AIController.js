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

        // Progressive stage index: Stage 1 (Arena 1) -> stageProgress = 0.0, Stage 14 (Arena 14) -> stageProgress = 1.0
        const rawStage = (combat.storyMode || combat.arcadeMode || combat.survivalMode)
            ? (combat.arcadeIndex || 1)
            : (combat.combatData?.p2?.rosterIndex ?? 4);
        const rosterIdx = Math.max(1, Math.min(14, rawStage));
        const stageProgress = (rosterIdx - 1) / 13; // 0.0 to 1.0 across the 14 arenas

        // Balanced progression:
        // - EASY: 0.00 -> 0.16 (genuinely easy & welcoming)
        // - NORMAL: 0.05 (Arena 1) -> 0.53 (Arena 14) — steady, fair ramp where player always has a real chance!
        // - HARD: 0.45 -> 0.85
        let progress = stageProgress;
        if (difficultySetting === 'EASY') progress = stageProgress * 0.16;
        else if (difficultySetting === 'NORMAL') progress = 0.05 + stageProgress * 0.48;
        else if (difficultySetting === 'HARD') progress = 0.45 + stageProgress * 0.40;

        // Initialize AI state trackers on p2
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (typeof p2.aiBlockTimer === 'undefined') p2.aiBlockTimer = 0;
        if (typeof p2._lastSeenP1Attack === 'undefined') p2._lastSeenP1Attack = null;

        const isNewP1Swing = (p1.state === 'ATTACK' && p1.currentAttack && p2._lastSeenP1Attack !== p1.currentAttack);
        if (isNewP1Swing) {
            p2._lastSeenP1Attack = p1.currentAttack;
        } else if (p1.state !== 'ATTACK') {
            p2._lastSeenP1Attack = null;
        }

        // Give P1 wake-up respect when P1 has wake-up immunity
        if (p1.hitImmunity > 0.12) {
            p2.aiWaitTimer = Math.max(p2.aiWaitTimer, 0.35);
            if (dist < 160 && styleId !== 'TITAN_GRAPPLER') ai[dirAwayFromP1] = true;
            return ai;
        }

        // Helper for executing a Whiff / Guard Reversal Punish tailored to p2's Fight Style
        const triggerPunishAttack = () => {
            p2.aiBlockTimer = 0;
            ai[dirAwayFromP1] = false;
            ai.down = false;
            const r = Math.random();
            const throwRange = styleId === 'TITAN_GRAPPLER' ? 195 : 145;
            if (difficultySetting !== 'EASY' && dist <= throwRange && p1.isGrounded && p2.isGrounded && (styleId === 'TITAN_GRAPPLER' ? r < 0.35 : r < 0.16)) {
                ai.commandMove = 'THROW';
            } else if (difficultySetting !== 'EASY' && p2.specialMoveCooldown <= 0 && r < 0.38) {
                ai.commandMove = (styleId === 'CAPOEIRA_TRICKSTER' || dist > 165) ? 'HURRICANE_KICK' : 'DRAGON_UPPERCUT';
            } else if (r < 0.68) {
                if (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.5) {
                    ai.down = true;
                    ai.hJust = true; // Low Sweep
                } else {
                    ai[dirToP1] = true;
                    ai.hJust = true; // Overhead Axe Kick
                }
            } else {
                ai.lJust = true;
            }
            p2.aiWaitTimer = difficultySetting === 'EASY' ? 0.85 : Math.max(0.32, 0.62 - progress * 0.28);
            return ai;
        };

        // ─── 0. ARCHETYPE-SPECIFIC & STREET FIGHTER HIT-CONFIRM COMBO CHAINING ───
        const p2AtkType = p2.currentAttack ? p2.currentAttack.type : '';
        const p2HitConfirmed = p2.state === 'ATTACK' && (p2.attackHasHit || p2.attackHitCount > 0) && !p2.attackWasBlocked;

        if (p2HitConfirmed && p2.isGrounded && dist <= 230) {
            const styleChainProb = difficultySetting === 'EASY' ? 0.12 : (0.18 + progress * 0.42);
            if (Math.random() < styleChainProb) {
                if (styleId === 'SHADOW_ASSASSIN' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP')) {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.26;
                    return ai;
                }
                if (styleId === 'SHADOW_ASSASSIN' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.52;
                    return ai;
                }
                if (styleId === 'CAPOEIRA_TRICKSTER' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP' || p2AtkType === 'COMBO_KICK')) {
                    ai.hJust = true;
                    p2.aiWaitTimer = p2AtkType === 'COMBO_KICK' ? 0.55 : 0.24;
                    return ai;
                }
                if (difficultySetting !== 'EASY' && styleId === 'TITAN_GRAPPLER' && (p2AtkType === 'LIGHT' || p2AtkType === 'COMBO_KICK') && dist <= 200) {
                    ai.l = true;
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.58;
                    return ai;
                }
                if (styleId === 'VALHALLA_BERSERKER' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.26;
                    return ai;
                }
                if (styleId === 'MASTER_STRIKER' && p2AtkType === 'HEAVY' && p2.comboChainStep >= 1) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.52;
                    return ai;
                }
            }
        }

        if (p2.comboChainStep > 0 && p2.comboChainTimer > 0.04 && dist <= 215) {
            const canCancel = p2.state === 'IDLE' || p2.state === 'WALK' || p2HitConfirmed;
            if (canCancel) {
                const chainProb = difficultySetting === 'EASY'
                    ? 0.15
                    : (p2.comboChainStep === 1 ? (0.24 + progress * 0.42) : (0.18 + progress * 0.38));
                if (Math.random() < chainProb) {
                    if (difficultySetting !== 'EASY' && p2.comboChainStep === 2 && p2.specialEnergy >= 100 && Math.random() < (0.22 + progress * 0.35)) {
                        ai.sJust = true;
                    } else if (difficultySetting !== 'EASY' && p2.comboChainStep === 2 && p2.specialMoveCooldown <= 0 && Math.random() < (0.20 + progress * 0.30)) {
                        if (styleId === 'LIGHT_DRAGON') {
                            ai.up = true;
                            ai.lJust = true;
                        } else {
                            ai.commandMove = Math.random() < 0.55 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                        }
                    } else {
                        ai.lJust = true;
                    }
                    p2.aiWaitTimer = p2.comboChainStep === 2 ? Math.max(0.42, 0.72 - progress * 0.28) : 0.22;
                    return ai;
                } else {
                    p2.aiWaitTimer = 0.45;
                }
            }
        }

        // ─── 1. SUSTAINED BLOCKING (No cheating high/low auto-switch so player Sweeps & Overheads break guard!) ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;

            if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
                const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);
                if (p1.stateTimer >= activeEnd && p2.blockStun <= 0 && dist <= 205 && difficultySetting !== 'EASY' && Math.random() < (0.08 + progress * 0.28)) {
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
            const reactChance = difficultySetting === 'EASY' ? 0.12 : (0.22 + progress * 0.42);
            if (Math.random() < reactChance) {
                if (styleId === 'SHADOW_ASSASSIN' && dist < 340 && p2.dashCooldown <= 0 && Math.random() < 0.45) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    return ai;
                } else if (Math.random() < 0.55) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 2B. ANTI-AIR REACTION (Only on higher stages, never unfair) ───
        if (difficultySetting !== 'EASY' && !p1.isGrounded && dist < 220 && p1.y < p2.y - 65 && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            if (Math.random() < (0.06 + progress * 0.28) * dt * 10) {
                if (p2.specialMoveCooldown <= 0 && Math.random() < 0.45) {
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    p2.aiWaitTimer = 0.48;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (Fair, balanced guard probability!) ───
        if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
            const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);

            if (isNewP1Swing) {
                // EASY: 6% - 13% block chance; NORMAL: 10% (Arena 1) -> 30% (Arena 14); HARD: 28% -> 46%
                const blockProb = difficultySetting === 'EASY'
                    ? (0.06 + progress * 0.42)
                    : (0.08 + progress * 0.42);
                const roll = Math.random();

                if (roll < blockProb) {
                    p2.aiBlockTimer = 0.16 + progress * 0.10;
                    ai[dirAwayFromP1] = true;
                    // Only crouch-block 25% of the time so player Low Sweeps (↓+K) reliably break CPU's standing guard!
                    if (Math.random() < 0.25) {
                        ai.down = true;
                    }
                    return ai;
                }
            } else if (difficultySetting !== 'EASY' && p1.stateTimer >= activeEnd + 0.08 && p2.blockStun <= 0 &&
                       (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') &&
                       dist <= 200 && Math.random() < (0.08 + progress * 0.26)) {
                return triggerPunishAttack();
            }
        }

        // ─── 4. ACTION COOLDOWN / PACING (Gives the player breathing room to attack!) ───
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (dist > 215) {
                ai[dirToP1] = true;
            } else if (dist < 130 && styleId !== 'TITAN_GRAPPLER' && Math.random() < 0.35) {
                ai[dirAwayFromP1] = true;
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.commandMove) {
                if (difficultySetting === 'EASY') {
                    p2.aiWaitTimer = 0.78 + Math.random() * 0.48;
                } else {
                    const minWait = Math.max(0.28, 0.58 - progress * 0.34);
                    const randWait = Math.max(0.16, 0.32 - progress * 0.16);
                    p2.aiWaitTimer = minWait + Math.random() * randWait;
                }
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
                // Only rarely attempt a throw on high stages (never on EASY, and never spam-throw a blocking player!)
                const grabRange = styleId === 'TITAN_GRAPPLER' ? 195 : 145;
                if (difficultySetting !== 'EASY' && dist <= grabRange && p1.isGrounded && Math.random() < (styleId === 'TITAN_GRAPPLER' ? (0.06 + progress * 0.14) : (0.02 + progress * 0.08))) {
                    ai.commandMove = 'THROW';
                    return applyCooldown();
                }

                const attackChance = difficultySetting === 'EASY' ? 0.35 : (0.45 + progress * 0.35);
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    const superThreshold = difficultySetting === 'EASY' ? 0.04 : (0.08 + progress * 0.14);
                    const physSpecialThreshold = superThreshold + (difficultySetting === 'EASY' ? 0.05 : (0.08 + progress * 0.14));
                    const sweepThreshold = physSpecialThreshold + (styleId === 'CAPOEIRA_TRICKSTER' ? 0.18 : 0.12);
                    const commandThreshold = sweepThreshold + 0.14;
                    const heavyThreshold = commandThreshold + 0.22;

                    if (mixup < superThreshold && p2.specialEnergy >= 100) {
                        ai.sJust = true;
                    } else if (mixup < physSpecialThreshold && p2.specialMoveCooldown <= 0) {
                        ai.commandMove = (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.48) ? 'HURRICANE_KICK' : 'DRAGON_UPPERCUT';
                    } else if (mixup < sweepThreshold) {
                        ai.down = true;
                        ai.hJust = true;
                    } else if (mixup < commandThreshold) {
                        ai[dirToP1] = true;
                        if (styleId === 'VALHALLA_BERSERKER' || Math.random() < 0.5) ai.lJust = true;
                        else ai.hJust = true;
                    } else if (mixup < heavyThreshold) {
                        ai.hJust = true;
                    } else {
                        ai.lJust = true;
                    }
                    return applyCooldown();
                } else {
                    p2.aiWaitTimer = difficultySetting === 'EASY' ? 0.45 : Math.max(0.18, 0.36 - progress * 0.18);
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

