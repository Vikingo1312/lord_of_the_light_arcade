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

        // ─── 0. ARCHETYPE-SPECIFIC & STREET FIGHTER HIT-CONFIRM COMBO CHAINING (Only from Arena 4+ on NORMAL/HARD!) ───
        const p2AtkType = p2.currentAttack ? p2.currentAttack.type : '';
        const p2HitConfirmed = p2.state === 'ATTACK' && (p2.attackHasHit || p2.attackHitCount > 0) && !p2.attackWasBlocked;
        const allowCombosAndSpecials = (difficultySetting !== 'EASY' && rosterIdx >= 4);

        if (allowCombosAndSpecials && p2HitConfirmed && p2.isGrounded && dist <= 230) {
            const styleChainProb = 0.10 + progress * 0.35;
            if (Math.random() < styleChainProb) {
                if (styleId === 'SHADOW_ASSASSIN' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP')) {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                }
                if (styleId === 'SHADOW_ASSASSIN' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.65;
                    return ai;
                }
                if (styleId === 'CAPOEIRA_TRICKSTER' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP' || p2AtkType === 'COMBO_KICK')) {
                    ai.hJust = true;
                    p2.aiWaitTimer = p2AtkType === 'COMBO_KICK' ? 0.68 : 0.32;
                    return ai;
                }
                if (rosterIdx >= 7 && styleId === 'TITAN_GRAPPLER' && (p2AtkType === 'LIGHT' || p2AtkType === 'COMBO_KICK') && dist <= 200) {
                    ai.l = true;
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.72;
                    return ai;
                }
                if (styleId === 'VALHALLA_BERSERKER' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                }
                if (styleId === 'MASTER_STRIKER' && p2AtkType === 'HEAVY' && p2.comboChainStep >= 1) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.65;
                    return ai;
                }
            }
        }

        if (allowCombosAndSpecials && p2.comboChainStep > 0 && p2.comboChainTimer > 0.04 && dist <= 215) {
            const canCancel = p2.state === 'IDLE' || p2.state === 'WALK' || p2HitConfirmed;
            if (canCancel) {
                const chainProb = p2.comboChainStep === 1 ? (0.14 + progress * 0.36) : (0.10 + progress * 0.32);
                if (Math.random() < chainProb) {
                    if (rosterIdx >= 6 && p2.comboChainStep === 2 && p2.specialEnergy >= 100 && Math.random() < (0.18 + progress * 0.30)) {
                        ai.sJust = true;
                    } else if (rosterIdx >= 5 && p2.comboChainStep === 2 && p2.specialMoveCooldown <= 0 && Math.random() < (0.16 + progress * 0.28)) {
                        if (styleId === 'LIGHT_DRAGON') {
                            ai.up = true;
                            ai.lJust = true;
                        } else {
                            ai.commandMove = Math.random() < 0.55 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                        }
                    } else {
                        ai.lJust = true;
                    }
                    p2.aiWaitTimer = p2.comboChainStep === 2 ? Math.max(0.55, 0.95 - progress * 0.35) : 0.28;
                    return ai;
                } else {
                    p2.aiWaitTimer = 0.65;
                }
            }
        }

        // ─── 1. SUSTAINED BLOCKING (No cheating high/low auto-switch so player Sweeps & Overheads break guard!) ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;

            if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
                const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);
                if (rosterIdx >= 5 && p1.stateTimer >= activeEnd && p2.blockStun <= 0 && dist <= 205 && difficultySetting !== 'EASY' && Math.random() < (0.05 + progress * 0.22)) {
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
            const reactChance = (difficultySetting === 'EASY' ? 0.06 : (rosterIdx <= 2 ? 0.08 : (0.16 + progress * 0.36))) * dt * 8;
            if (Math.random() < reactChance) {
                if (rosterIdx >= 4 && styleId === 'SHADOW_ASSASSIN' && dist < 340 && p2.dashCooldown <= 0 && Math.random() < 0.40) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.55;
                    return ai;
                } else if (Math.random() < 0.55) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.55;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 2B. ANTI-AIR REACTION (Only on higher stages 5+) ───
        if (difficultySetting !== 'EASY' && rosterIdx >= 5 && !p1.isGrounded && dist < 220 && p1.y < p2.y - 65 && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            if (Math.random() < (0.04 + progress * 0.22) * dt * 8) {
                if (p2.specialMoveCooldown <= 0 && Math.random() < 0.40) {
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    p2.aiWaitTimer = 0.65;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (Low, fair guard probability in early stages!) ───
        if (p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
            const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);

            if (isNewP1Swing) {
                // EASY: 3% - 8%; NORMAL Level 1: 4% -> Level 14: 26%
                const blockProb = difficultySetting === 'EASY'
                    ? (0.03 + progress * 0.25)
                    : (rosterIdx <= 2 ? 0.04 : (0.06 + progress * 0.36));
                const roll = Math.random();

                if (roll < blockProb) {
                    p2.aiBlockTimer = 0.15 + progress * 0.08;
                    ai[dirAwayFromP1] = true;
                    if (Math.random() < 0.22) {
                        ai.down = true;
                    }
                    return ai;
                }
            } else if (difficultySetting !== 'EASY' && rosterIdx >= 5 && p1.stateTimer >= activeEnd + 0.10 && p2.blockStun <= 0 &&
                       (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') &&
                       dist <= 200 && Math.random() < (0.05 + progress * 0.18) * dt * 10) {
                return triggerPunishAttack();
            }
        }

        // ─── 4. ACTION COOLDOWN / PACING (Gives the player plenty of breathing room in Level 1-5!) ───
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (dist > 225) {
                ai[dirToP1] = true;
            } else if (dist < 130 && styleId !== 'TITAN_GRAPPLER' && Math.random() < 0.30) {
                ai[dirAwayFromP1] = true;
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.commandMove) {
                if (difficultySetting === 'EASY') {
                    p2.aiWaitTimer = 1.35 + Math.random() * 0.65;
                } else if (rosterIdx <= 2) {
                    // Level 1-2: 1.15s to 1.75s pause between CPU swings so Level 1 is genuinely easy & fun!
                    p2.aiWaitTimer = 1.15 + Math.random() * 0.60;
                } else if (rosterIdx <= 5) {
                    // Level 3-5: 0.80s to 1.25s pause
                    p2.aiWaitTimer = 0.80 + Math.random() * 0.45;
                } else {
                    // Level 6-14: Smooth ramp from 0.68s down to 0.38s
                    const minWait = Math.max(0.38, 0.78 - progress * 0.40);
                    const randWait = Math.max(0.20, 0.38 - progress * 0.18);
                    p2.aiWaitTimer = minWait + Math.random() * randWait;
                }
            }
            return ai;
        };

        // ─── 5. AIRBORNE SALTO-KICK / DIVE-KICK ATTACKS ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 245) {
            if (Math.random() < (0.18 + progress * 0.35) * dt * 8) {
                if (allowCombosAndSpecials && styleId === 'CAPOEIRA_TRICKSTER' && p2.specialMoveCooldown <= 0 && Math.random() < 0.35) {
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (Math.random() < 0.65) {
                    ai.hJust = true;
                } else {
                    ai.lJust = true;
                }
                p2.aiWaitTimer = 0.55;
            }
            return ai;
        }

        // ─── 6. APPROACH ZONE (far away: dist > 265 — probabilities properly scaled by dt!) ───
        if (dist > 265) {
            ai[dirToP1] = true;

            // Forward Dash only from Arena 4+ on NORMAL/HARD (never in Level 1-3!)
            if (allowCombosAndSpecials && p2.isGrounded && p2.dashCooldown <= 0) {
                const dashRatePerSec = (styleId === 'SHADOW_ASSASSIN' || styleId === 'CAPOEIRA_TRICKSTER')
                    ? (0.35 + progress * 0.65)
                    : (0.18 + progress * 0.45);
                if (Math.random() < dashRatePerSec * dt) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.45;
                    return ai;
                }
            }

            // Fire projectile / dash special from range when Super Energy is full (scaled by dt!)
            if (rosterIdx >= 3 && p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                const zoningRatePerSec = (styleId === 'LIGHT_DRAGON' || styleId === 'MASTER_STRIKER')
                    ? (0.45 + progress * 0.65)
                    : (0.25 + progress * 0.50);
                if (Math.random() < zoningRatePerSec * dt) {
                    ai.sJust = true;
                    return applyCooldown();
                }
            }

            // Occasional Jump-in approach (scaled by dt!)
            const jumpRatePerSec = rosterIdx <= 2 ? 0.12 : (0.22 + progress * 0.45);
            if (Math.random() < jumpRatePerSec * dt && p2.isGrounded) {
                ai[dirToP1] = true;
                ai.up = true;
                p2.aiWaitTimer = 0.55;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close quarters: dist <= 195) ───
        const strikeRange = styleId === 'MASTER_STRIKER' ? 210 : (styleId === 'TITAN_GRAPPLER' ? 205 : 188);
        if (dist <= strikeRange) {
            if (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') {
                // Only rarely attempt a throw on high stages (Arena 6+ on NORMAL/HARD)
                const grabRange = styleId === 'TITAN_GRAPPLER' ? 190 : 140;
                if (difficultySetting !== 'EASY' && rosterIdx >= 6 && dist <= grabRange && p1.isGrounded && Math.random() < (styleId === 'TITAN_GRAPPLER' ? (0.04 + progress * 0.10) : (0.015 + progress * 0.05))) {
                    ai.commandMove = 'THROW';
                    return applyCooldown();
                }

                const attackChance = difficultySetting === 'EASY' ? 0.25 : (rosterIdx <= 2 ? 0.30 : (0.38 + progress * 0.34));
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    // In Level 1-2 (and EASY), CPU uses basic punches and kicks instead of spamming special moves or sweeps!
                    if (difficultySetting === 'EASY' || rosterIdx <= 2) {
                        if (mixup < 0.35) ai.hJust = true;
                        else ai.lJust = true;
                        return applyCooldown();
                    }

                    const superThreshold = 0.06 + progress * 0.12;
                    const physSpecialThreshold = superThreshold + (rosterIdx >= 5 ? (0.06 + progress * 0.12) : 0);
                    const sweepThreshold = physSpecialThreshold + (styleId === 'CAPOEIRA_TRICKSTER' ? 0.14 : 0.10);
                    const commandThreshold = sweepThreshold + 0.12;
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
                    p2.aiWaitTimer = (difficultySetting === 'EASY' || rosterIdx <= 2) ? 0.65 : Math.max(0.25, 0.48 - progress * 0.22);
                }
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: strikeRange < dist <= 265 — probabilities scaled by dt!) ───
        ai[dirToP1] = true;

        if (allowCombosAndSpecials && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            const footsiesRatePerSec = 0.45 + progress * 0.85;
            if (Math.random() < footsiesRatePerSec * dt) {
                if (p2.specialEnergy >= 100 && Math.random() < 0.22) {
                    ai.sJust = true;
                    return applyCooldown();
                } else if (styleId === 'SHADOW_ASSASSIN' && p2.dashCooldown <= 0 && Math.random() < 0.35) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.50;
                    return ai;
                } else if (rosterIdx >= 6 && p2.specialMoveCooldown <= 0 && (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.28)) {
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.38) {
                    ai.down = true;
                    ai.hJust = true;
                } else {
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

