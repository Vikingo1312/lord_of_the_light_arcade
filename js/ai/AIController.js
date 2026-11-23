/**
 * AIController — Handles CPU opponent decision-making, style-authentic footwork,
 * and full 15-move Street Fighter attack variety during combat.
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

        // Progressive stage index: Ladder modes use 1..14; Versus 1v1 uses balanced mid-tier 6..11
        const isLadder = Boolean(combat.storyMode || combat.arcadeMode || combat.survivalMode);
        const rawStage = isLadder
            ? (combat.arcadeIndex || 1)
            : Math.max(6, Math.min(11, (combat.combatData?.p2?.rosterIndex ?? 6) + 1));
        const rosterIdx = Math.max(1, Math.min(14, rawStage));
        const stageProgress = (rosterIdx - 1) / 13; // 0.0 to 1.0 across the 14 arenas

        // Smooth 14-Stage Arcade Progression Curve (easy & welcoming in Stages 1-4, gradually ramping toward Stages 12-14):
        // - EASY: 0.02 (Arena 1) -> 0.32 (Arena 14)
        // - NORMAL: 0.05 (Arena 1) -> 0.12 (Arena 3) -> 0.34 (Arena 7) -> 0.78 (Arena 14)
        // - HARD: 0.35 (Arena 1) -> 0.88 (Arena 14)
        const curvedStage = Math.pow(stageProgress, 1.45);
        let progress = curvedStage;
        if (difficultySetting === 'EASY') progress = 0.02 + curvedStage * 0.30;
        else if (difficultySetting === 'NORMAL') progress = 0.05 + curvedStage * 0.73;
        else if (difficultySetting === 'HARD') progress = 0.35 + curvedStage * 0.53;

        // Initialize AI state trackers on p2
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (typeof p2.aiBlockTimer === 'undefined') p2.aiBlockTimer = 0;
        if (typeof p2.aiMoveTimer === 'undefined') p2.aiMoveTimer = 0;
        if (typeof p2.aiMoveMode === 'undefined') p2.aiMoveMode = 'WEAVE_IN';
        if (typeof p2._lastSeenP1Attack === 'undefined') p2._lastSeenP1Attack = null;
        if (typeof p2._lastAIMove === 'undefined') p2._lastAIMove = '';

        const isNewP1Swing = (p1.state === 'ATTACK' && p1.currentAttack && p2._lastSeenP1Attack !== p1.currentAttack);
        if (isNewP1Swing) {
            p2._lastSeenP1Attack = p1.currentAttack;
        } else if (p1.state !== 'ATTACK') {
            p2._lastSeenP1Attack = null;
        }

        // Give P1 wake-up respect when P1 has wake-up immunity or is getting up
        if (p1.hitImmunity > 0.08 || p1.isKnockedDown) {
            p2.aiWaitTimer = Math.max(p2.aiWaitTimer, 0.42);
            if (dist < 195 && styleId !== 'TITAN_GRAPPLER') ai[dirAwayFromP1] = true;
            return ai;
        }

        // Helper to record move variety & apply balanced cooldown between attacks
        const applyCooldown = (moveTag = '') => {
            if (moveTag) p2._lastAIMove = moveTag;
            if (ai.lJust || ai.hJust || ai.sJust || ai.commandMove) {
                if (difficultySetting === 'EASY') {
                    p2.aiWaitTimer = 1.15 + Math.random() * 0.55;
                } else if (rosterIdx <= 2) {
                    // Arena 1-2: 1.05s to 1.55s — relaxed warm-up pace with big openings for the player!
                    p2.aiWaitTimer = 1.05 + Math.random() * 0.50;
                } else if (rosterIdx <= 5) {
                    // Arena 3-5: 0.78s to 1.18s
                    p2.aiWaitTimer = 0.78 + Math.random() * 0.40;
                } else if (rosterIdx <= 9) {
                    // Arena 6-9: 0.55s to 0.88s
                    p2.aiWaitTimer = 0.55 + Math.random() * 0.33;
                } else {
                    // Arena 10-14: Smooth ramp from 0.42s down to 0.28s
                    const minWait = Math.max(0.28, 0.54 - progress * 0.26);
                    const randWait = Math.max(0.18, 0.32 - progress * 0.14);
                    p2.aiWaitTimer = minWait + Math.random() * randWait;
                }
            }
            return ai;
        };

        // Helper for executing a Whiff / Guard Reversal Punish tailored to p2's Fight Style
        const triggerPunishAttack = () => {
            p2.aiBlockTimer = 0;
            ai[dirAwayFromP1] = false;
            ai.down = false;
            const r = Math.random();
            const throwRange = styleId === 'TITAN_GRAPPLER' ? 210 : 165;
            if (dist <= throwRange && p1.isGrounded && p2.isGrounded && (styleId === 'TITAN_GRAPPLER' ? r < 0.38 : r < 0.18)) {
                ai.commandMove = 'THROW';
                return applyCooldown('THROW');
            }
            if (p2.specialMoveCooldown <= 0 && r < 0.46) {
                if (dist > 175 && r < 0.24) {
                    ai.commandMove = 'FLYING_TORPEDO';
                    return applyCooldown('FLYING_TORPEDO');
                }
                ai.commandMove = (styleId === 'CAPOEIRA_TRICKSTER' || dist > 155) ? 'HURRICANE_KICK' : 'DRAGON_UPPERCUT';
                return applyCooldown(ai.commandMove);
            }
            if (r < 0.76) {
                if (styleId === 'CAPOEIRA_TRICKSTER' || Math.random() < 0.48) {
                    ai.down = true;
                    ai.hJust = true; // Low Sweep
                    return applyCooldown('SWEEP');
                }
                ai[dirToP1] = true;
                ai.hJust = true; // Overhead Axe Kick
                return applyCooldown('AXE_KICK');
            }
            ai[dirToP1] = true;
            ai.lJust = true; // Command Punch
            return applyCooldown('COMMAND_PUNCH');
        };

        // ─── 0. ARCHETYPE-SPECIFIC & STREET FIGHTER HIT-CONFIRM COMBO CHAINING (Only from Stage 4+!) ───
        const p2AtkType = p2.currentAttack ? p2.currentAttack.type : '';
        const p2HitConfirmed = p2.state === 'ATTACK' && (p2.attackHasHit || p2.attackHitCount > 0) && !p2.attackWasBlocked;

        if (rosterIdx >= 4 && p2.aiWaitTimer <= 0 && p2HitConfirmed && p2.isGrounded && dist <= 235) {
            const styleChainProb = difficultySetting === 'EASY' ? 0.08 : (0.10 + progress * 0.35);
            if (Math.random() < styleChainProb) {
                if (styleId === 'SHADOW_ASSASSIN' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP')) {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.55;
                    return ai;
                }
                if (styleId === 'SHADOW_ASSASSIN' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.68;
                    return ai;
                }
                if (styleId === 'CAPOEIRA_TRICKSTER' && (p2AtkType === 'HEAVY' || p2AtkType === 'SWEEP' || p2AtkType === 'COMBO_KICK')) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.65;
                    return ai;
                }
                if (rosterIdx >= 6 && styleId === 'TITAN_GRAPPLER' && (p2AtkType === 'LIGHT' || p2AtkType === 'COMBO_KICK') && dist <= 210) {
                    ai.l = true;
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.75;
                    return ai;
                }
                if (styleId === 'VALHALLA_BERSERKER' && p2AtkType === 'COMMAND_PUNCH') {
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.58;
                    return ai;
                }
                if (styleId === 'MASTER_STRIKER' && p2AtkType === 'HEAVY' && p2.comboChainStep >= 1) {
                    ai.hJust = true;
                    p2.aiWaitTimer = 0.68;
                    return ai;
                }
            }
        }

        if (rosterIdx >= 3 && p2.aiWaitTimer <= 0 && p2.comboChainStep > 0 && p2.comboChainTimer > 0.04 && dist <= 220) {
            const canCancel = p2.state === 'IDLE' || p2.state === 'WALK' || p2HitConfirmed;
            if (canCancel) {
                const chainProb = p2.comboChainStep === 1 ? (0.12 + progress * 0.35) : (0.08 + progress * 0.28);
                if (Math.random() < chainProb) {
                    if (rosterIdx >= 6 && p2.comboChainStep === 2 && p2.specialEnergy >= 100 && Math.random() < (0.12 + progress * 0.25)) {
                        ai.sJust = true;
                    } else if (rosterIdx >= 5 && p2.comboChainStep === 2 && p2.specialMoveCooldown <= 0 && Math.random() < (0.15 + progress * 0.25)) {
                        if (styleId === 'LIGHT_DRAGON') {
                            ai.up = true;
                            ai.lJust = true;
                        } else {
                            ai.commandMove = Math.random() < 0.52 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
                        }
                    } else {
                        ai.lJust = true;
                    }
                    p2.aiWaitTimer = p2.comboChainStep === 2 ? Math.max(0.58, 0.95 - progress * 0.35) : 0.42;
                    return ai;
                } else {
                    p2.aiWaitTimer = 0.62;
                }
            }
        }

        // ─── 1. SUSTAINED BLOCKING (No cheating high/low auto-switch so player Sweeps & Overheads break guard!) ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;

            if (rosterIdx >= 4 && p1.state === 'ATTACK' && p1.currentAttack && dist < 245) {
                const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);
                if (p1.stateTimer >= activeEnd && p2.blockStun <= 0 && dist <= 210 && Math.random() < (0.06 + progress * 0.24)) {
                    return triggerPunishAttack();
                }
            }
            return ai;
        }

        // ─── 2. REACT TO INCOMING PROJECTILES ───
        const incomingProj = combat.projectiles.find(
            proj => proj.owner === 'p1' && proj.alive &&
                Math.abs(proj.x - p2.x) < 440 &&
                ((proj.facing === 1 && proj.x < p2.x) || (proj.facing === -1 && proj.x > p2.x))
        );
        if (incomingProj && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            const reactChance = (0.08 + progress * 0.38) * dt * 6;
            if (Math.random() < reactChance) {
                if (rosterIdx >= 4 && styleId === 'SHADOW_ASSASSIN' && dist < 360 && p2.dashCooldown <= 0 && Math.random() < 0.38) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.45;
                    return ai;
                } else if (Math.random() < 0.48) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.50;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 2B. ANTI-AIR REACTION (Rising Dragon Uppercut or Guard against Jump-Ins!) ───
        if (rosterIdx >= 3 && !p1.isGrounded && dist < 225 && p1.y < p2.y - 60 && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            if (Math.random() < (0.06 + progress * 0.28) * dt * 6) {
                if (rosterIdx >= 5 && p2.specialMoveCooldown <= 0 && Math.random() < (0.22 + progress * 0.25)) {
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    return applyCooldown('DRAGON_UPPERCUT');
                } else {
                    p2.aiBlockTimer = 0.22;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE & LUNGING SPECIAL ATTACKS (Balanced Guard & Whiff Punish) ───
        const p1AtkT = p1.currentAttack ? p1.currentAttack.type : '';
        const isLungingSpecial = (p1AtkT === 'FLYING_TORPEDO' || p1AtkT === 'DRAGON_RUSH_COMBO' || p1AtkT === 'HURRICANE_KICK' || p1AtkT === 'SPECIAL_DASH');
        const threatRange = isLungingSpecial ? 480 : 265;
        if (p1.state === 'ATTACK' && p1.currentAttack && dist < threatRange) {
            const activeEnd = (p1.currentAttack.startup || 0.05) + (p1.currentAttack.active || 0.15);

            if (isNewP1Swing || (isLungingSpecial && p1.stateTimer < activeEnd && p2.aiBlockTimer <= 0 && !p2._reactedToLunge)) {
                p2._reactedToLunge = true;
                // EASY: 8% - 24%; NORMAL: 10% (Arena 1) -> 52% (Arena 14); HARD: 35% -> 72%
                const blockProb = difficultySetting === 'EASY'
                    ? (0.08 + progress * 0.20)
                    : (difficultySetting === 'HARD' ? (0.35 + progress * 0.38) : (0.10 + progress * 0.42));
                const roll = Math.random();

                if (roll < blockProb) {
                    p2.aiBlockTimer = (isLungingSpecial ? 0.28 : 0.18) + progress * 0.10;
                    ai[dirAwayFromP1] = true;
                    if (!isLungingSpecial && Math.random() < 0.24) {
                        ai.down = true;
                    }
                    return ai;
                } else if (rosterIdx >= 4 && styleId === 'SHADOW_ASSASSIN' && p2.dashCooldown <= 0 && roll < blockProb + 0.08) {
                    // Shadow Assassin evasive back-hop!
                    if (dirAwayFromP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.38;
                    return ai;
                }
            } else if (rosterIdx >= 4 && p2.aiWaitTimer <= 0 && p1.stateTimer >= activeEnd + 0.08 && p2.blockStun <= 0 &&
                       (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') &&
                       dist <= 220 && Math.random() < (0.10 + progress * 0.26) * dt * 8) {
                return triggerPunishAttack();
            }
        } else if (p1.state !== 'ATTACK') {
            p2._reactedToLunge = false;
        }

        // ─── 4. ACTIVE STYLE-BASED FOOTWORK DURING COOLDOWN (Never stand frozen like a statue!) ───
        p2.aiMoveTimer -= dt;
        if (p2.aiMoveTimer <= 0) {
            p2.aiMoveTimer = 0.22 + Math.random() * 0.26;
            const mr = Math.random();
            if (dist > 280) {
                p2.aiMoveMode = 'WEAVE_IN';
            } else if (styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'SHADOW_ASSASSIN') {
                p2.aiMoveMode = mr < 0.52 ? 'WEAVE_IN' : (mr < 0.85 ? 'WEAVE_OUT' : 'CROUCH_BAIT');
            } else if (styleId === 'VALHALLA_BERSERKER' || styleId === 'TITAN_GRAPPLER' || styleId === 'KNEIPEN_TERRORIST') {
                p2.aiMoveMode = mr < 0.72 ? 'WEAVE_IN' : (mr < 0.88 ? 'CROUCH_BAIT' : 'WEAVE_OUT');
            } else {
                // LIGHT_DRAGON & MASTER_STRIKER: Classic Street Fighter footsies weave!
                p2.aiMoveMode = mr < 0.58 ? 'WEAVE_IN' : (mr < 0.86 ? 'WEAVE_OUT' : 'CROUCH_BAIT');
            }
        }

        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (dist > 240 || p2.aiMoveMode === 'WEAVE_IN') {
                ai[dirToP1] = true;
            } else if (p2.aiMoveMode === 'WEAVE_OUT' && dist > 110) {
                ai[dirAwayFromP1] = true;
            } else if (p2.aiMoveMode === 'CROUCH_BAIT') {
                ai.down = true;
            }
            return ai;
        }

        // ─── 5. AIRBORNE SALTO-KICK / DIVE-KICK / AIR HURRICANE ATTACKS ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 255) {
            if (Math.random() < (0.28 + progress * 0.42) * dt * 8) {
                if ((styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'LIGHT_DRAGON' || styleId === 'SHADOW_ASSASSIN') && p2.specialMoveCooldown <= 0 && Math.random() < 0.35) {
                    ai.commandMove = 'HURRICANE_KICK';
                } else if (Math.random() < 0.65) {
                    ai.hJust = true;
                } else {
                    ai.lJust = true;
                }
                p2.aiWaitTimer = 0.42;
            }
            return ai;
        }

        // Helper to pick a varied move (penalizing repeating `p2._lastAIMove` twice in a row!)
        const pickWeightedMove = (candidates) => {
            let total = 0;
            const adjusted = candidates.map(c => {
                const w = (c.tag === p2._lastAIMove) ? c.weight * 0.22 : c.weight;
                total += w;
                return { ...c, w };
            });
            let roll = Math.random() * total;
            for (const c of adjusted) {
                roll -= c.w;
                if (roll <= 0) return c.tag;
            }
            return adjusted[adjusted.length - 1].tag;
        };

        const triggerChosenMove = (tag) => {
            switch (tag) {
                case 'SUPER_SPECIAL':
                    ai.sJust = true;
                    break;
                case 'FLYING_TORPEDO':
                    ai.commandMove = 'FLYING_TORPEDO';
                    break;
                case 'DRAGON_RUSH_COMBO':
                    ai.commandMove = 'DRAGON_RUSH_COMBO';
                    break;
                case 'DRAGON_UPPERCUT':
                    ai.commandMove = 'DRAGON_UPPERCUT';
                    break;
                case 'HURRICANE_KICK':
                    ai.commandMove = 'HURRICANE_KICK';
                    break;
                case 'THROW':
                    ai.commandMove = 'THROW';
                    break;
                case 'AXE_KICK':
                    ai[dirToP1] = true;
                    ai.hJust = true;
                    break;
                case 'COMMAND_PUNCH':
                    ai[dirToP1] = true;
                    ai.lJust = true;
                    break;
                case 'SWEEP':
                    ai.down = true;
                    ai.hJust = true;
                    break;
                case 'CROUCH_LIGHT':
                    ai.down = true;
                    ai.lJust = true;
                    break;
                case 'HEAVY':
                    ai.hJust = true;
                    break;
                case 'LIGHT':
                default:
                    ai.lJust = true;
                    break;
            }
            return applyCooldown(tag);
        };

        // ─── 6. APPROACH ZONE (far away: dist > 265 — dynamic dashes, signature flights, jump-ins & fireballs!) ───
        if (dist > 265) {
            ai[dirToP1] = true;

            // 1. Forward Dash approach (only from Stage 4+, higher frequency in later arenas!)
            if (rosterIdx >= 4 && p2.isGrounded && p2.dashCooldown <= 0) {
                const dashRatePerSec = (styleId === 'SHADOW_ASSASSIN' || styleId === 'CAPOEIRA_TRICKSTER')
                    ? (0.25 + progress * 0.75)
                    : (0.15 + progress * 0.45);
                if (Math.random() < dashRatePerSec * dt) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                }
            }

            // 2. Full-Screen Signature Moves (`FLYING_TORPEDO` or `DRAGON_RUSH_COMBO`) — rare in early stages!
            if (rosterIdx >= 3 && p2.specialMoveCooldown <= 0 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                const sigRatePerSec = 0.06 + progress * 0.42;
                if (Math.random() < sigRatePerSec * dt) {
                    const useRush = Math.random() < (styleId === 'LIGHT_DRAGON' || styleId === 'MASTER_STRIKER' ? 0.48 : 0.35);
                    return triggerChosenMove(useRush ? 'DRAGON_RUSH_COMBO' : 'FLYING_TORPEDO');
                }
            }

            // 3. Fire projectile / Super from range when Super Energy is full!
            if (rosterIdx >= 3 && p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                const zoningRatePerSec = (styleId === 'LIGHT_DRAGON' || styleId === 'SONIC_STRIKER' || styleId === 'MASTER_STRIKER')
                    ? (0.20 + progress * 0.65)
                    : (0.12 + progress * 0.45);
                if (Math.random() < zoningRatePerSec * dt) {
                    return triggerChosenMove('SUPER_SPECIAL');
                }
            }

            // 4. Acrobatic Jump-In approach
            const jumpRatePerSec = (styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'SHADOW_ASSASSIN')
                ? (0.15 + progress * 0.45)
                : (0.10 + progress * 0.35);
            if (Math.random() < jumpRatePerSec * dt && p2.isGrounded) {
                ai[dirToP1] = true;
                ai.up = true;
                p2.aiWaitTimer = 0.45;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close quarters: dist <= 200 — full 12-move martial arts variety!) ───
        const strikeRange = styleId === 'MASTER_STRIKER' ? 215 : (styleId === 'TITAN_GRAPPLER' ? 210 : 195);
        if (dist <= strikeRange) {
            if (p2.state === 'IDLE' || p2.state === 'WALK' || p2.state === 'CROUCH') {
                const grabRange = styleId === 'TITAN_GRAPPLER' ? 210 : 165;
                const canThrow = dist <= grabRange && p1.isGrounded && p2.isGrounded && (rosterIdx >= 4 || styleId === 'TITAN_GRAPPLER');
                const canPhysSpecial = p2.specialMoveCooldown <= 0 && (rosterIdx >= 3 || Math.random() < 0.35);
                const canSuper = p2.specialEnergy >= 100 && rosterIdx >= 3;

                const candidates = [
                    { tag: 'LIGHT', weight: 28 },
                    { tag: 'HEAVY', weight: styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'VALHALLA_BERSERKER' ? 20 : 16 },
                    { tag: 'COMMAND_PUNCH', weight: styleId === 'MASTER_STRIKER' || styleId === 'SONIC_STRIKER' || styleId === 'SHADOW_ASSASSIN' || styleId === 'KNEIPEN_TERRORIST' ? 14 : 10 },
                    { tag: 'AXE_KICK', weight: styleId === 'VALHALLA_BERSERKER' || styleId === 'SONIC_STRIKER' || styleId === 'KNEIPEN_TERRORIST' ? 14 : 10 },
                    { tag: 'SWEEP', weight: styleId === 'CAPOEIRA_TRICKSTER' || styleId === 'SONIC_STRIKER' ? 14 : 10 },
                    { tag: 'CROUCH_LIGHT', weight: 12 }
                ];

                if (canThrow) {
                    candidates.push({
                        tag: 'THROW',
                        weight: styleId === 'TITAN_GRAPPLER' ? (8 + progress * 12) : (3 + progress * 7)
                    });
                }
                if (canPhysSpecial) {
                    candidates.push({
                        tag: 'DRAGON_UPPERCUT',
                        weight: (styleId === 'LIGHT_DRAGON' || styleId === 'SONIC_STRIKER') ? (5 + progress * 11) : (3 + progress * 8)
                    });
                    candidates.push({
                        tag: 'HURRICANE_KICK',
                        weight: styleId === 'CAPOEIRA_TRICKSTER' ? (6 + progress * 10) : (3 + progress * 8)
                    });
                    candidates.push({
                        tag: 'FLYING_TORPEDO',
                        weight: 2 + progress * 8
                    });
                    candidates.push({
                        tag: 'DRAGON_RUSH_COMBO',
                        weight: 2 + progress * 7
                    });
                }
                if (canSuper) {
                    candidates.push({
                        tag: 'SUPER_SPECIAL',
                        weight: 6 + progress * 14
                    });
                }

                const chosen = pickWeightedMove(candidates);
                return triggerChosenMove(chosen);
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: strikeRange < dist <= 265 — active spacing, dashes, sweeps & signature specials!) ───
        if (p2.aiMoveMode === 'WEAVE_OUT' && dist < 235) {
            ai[dirAwayFromP1] = true;
        } else {
            ai[dirToP1] = true;
        }

        if (p2.state === 'IDLE' || p2.state === 'WALK') {
            const footsiesRatePerSec = 0.45 + progress * 1.35;
            if (Math.random() < footsiesRatePerSec * dt) {
                if (rosterIdx >= 5 && styleId === 'SHADOW_ASSASSIN' && p2.dashCooldown <= 0 && Math.random() < 0.30) {
                    if (dirToP1 === 'right') ai.dashRightJust = true;
                    else ai.dashLeftJust = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                }

                const midCandidates = [
                    { tag: 'LIGHT', weight: 20 },
                    { tag: 'HEAVY', weight: 18 },
                    { tag: 'AXE_KICK', weight: 14 },
                    { tag: 'SWEEP', weight: styleId === 'CAPOEIRA_TRICKSTER' ? 18 : 12 },
                    { tag: 'COMMAND_PUNCH', weight: styleId === 'MASTER_STRIKER' || styleId === 'SHADOW_ASSASSIN' ? 18 : 12 }
                ];
                if (rosterIdx >= 4 && p2.specialMoveCooldown <= 0) {
                    midCandidates.push({ tag: 'HURRICANE_KICK', weight: 8 + progress * 8 });
                    midCandidates.push({ tag: 'FLYING_TORPEDO', weight: 6 + progress * 8 });
                    midCandidates.push({ tag: 'DRAGON_RUSH_COMBO', weight: 5 + progress * 7 });
                }
                if (rosterIdx >= 4 && p2.specialEnergy >= 100) {
                    midCandidates.push({ tag: 'SUPER_SPECIAL', weight: 10 + progress * 10 });
                }

                return triggerChosenMove(pickWeightedMove(midCandidates));
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
            lJust: false, hJust: false, sJust: false,
            commandMove: null
        };
        const ally = combat.ally;
        const p2 = combat.p2;
        if (!ally || !p2 || ally.state === 'KO' || p2.state === 'KO') return ai;

        if (typeof ally.aiWaitTimer === 'undefined') ally.aiWaitTimer = 0;
        if (ally.aiWaitTimer > 0) {
            ally.aiWaitTimer -= dt;
            if (Math.abs(p2.x - ally.x) > 220) {
                ai[p2.x > ally.x ? 'right' : 'left'] = true;
            }
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
            if (dist > 300 && ally.specialMoveCooldown <= 0 && Math.random() < 0.04) {
                ai.commandMove = Math.random() < 0.5 ? 'FLYING_TORPEDO' : 'HURRICANE_KICK';
                ally.aiWaitTimer = 0.45;
            } else if (dist > 340 && ally.specialEnergy >= 100 && Math.random() < 0.04) {
                ai.sJust = true;
                ally.aiWaitTimer = 0.45;
            }
            return ai;
        }

        if (ally.state === 'IDLE' || ally.state === 'WALK') {
            const r = Math.random();
            if (r < 0.14 && ally.specialEnergy >= 100) ai.sJust = true;
            else if (r < 0.28 && ally.specialMoveCooldown <= 0) ai.commandMove = Math.random() < 0.5 ? 'DRAGON_UPPERCUT' : 'HURRICANE_KICK';
            else if (r < 0.46) { ai.down = true; ai.hJust = true; }
            else if (r < 0.66) { ai[dirToEnemy] = true; ai.hJust = true; }
            else if (r < 0.82) ai.hJust = true;
            else ai.lJust = true;
            ally.aiWaitTimer = 0.32 + Math.random() * 0.25;
        }
        return ai;
    }
}

