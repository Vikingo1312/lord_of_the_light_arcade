/**
 * AIController — Handles CPU opponent decision-making during combat.
 */
export default class AIController {
    static computeInput(combat, dt) {
        const ai = {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false,
            lJust: false, hJust: false, sJust: false
        };

        const p1 = combat.p1;
        const p2 = combat.p2;
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

        if (difficultySetting === 'EASY') progress *= 0.55;
        else if (difficultySetting === 'HARD') progress = Math.min(1.15, progress * 1.25 + 0.15);

        // Initialize AI state timers on p2
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (typeof p2.aiBlockTimer === 'undefined') p2.aiBlockTimer = 0;
        if (typeof p2._lastSeenP1Attack === 'undefined') p2._lastSeenP1Attack = null;

        // ─── 1. SUSTAINED BLOCKING ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;
            // Only late-game fighters (Stage 10+) know how to instant block-counter
            if (progress > 0.68 && p1.state === 'ATTACK' && p1.currentAttack &&
                p1.stateTimer >= (p1.currentAttack.startup + p1.currentAttack.active) &&
                dist <= 200 && Math.random() < (progress - 0.5) * 0.5) {
                p2.aiBlockTimer = 0;
                ai[dirAwayFromP1] = false;
                ai.lJust = true;
                return ai;
            }
            return ai;
        }

        // ─── 2. REACT TO INCOMING PROJECTILES ───
        const incomingProj = combat.projectiles.find(
            proj => proj.owner === 'p1' && proj.alive &&
                Math.abs(proj.x - p2.x) < 380 &&
                ((proj.facing === 1 && proj.x < p2.x) || (proj.facing === -1 && proj.x > p2.x))
        );
        if (incomingProj && p2.isGrounded && (p2.state === 'IDLE' || p2.state === 'WALK')) {
            // Early stages rarely react to projectiles (10% on Stage 1 -> 60% on Stage 14)
            const reactChance = 0.10 + progress * 0.50;
            if (Math.random() < reactChance) {
                if (Math.random() < 0.35 + progress * 0.35) {
                    ai[dirToP1] = true;
                    ai.up = true;
                    p2.aiWaitTimer = 0.35;
                    return ai;
                } else {
                    p2.aiBlockTimer = 0.35;
                    ai[dirAwayFromP1] = true;
                    return ai;
                }
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (One decision per P1 attack, not per frame!) ───
        if (p1.state === 'ATTACK' && dist < 240) {
            if (p2._lastSeenP1Attack !== p1.currentAttack) {
                p2._lastSeenP1Attack = p1.currentAttack;
                // Stage 1 blocks only 8% of attacks; Stage 7 blocks ~29%; Stage 14 blocks ~52%
                const blockProb = 0.08 + progress * 0.44;
                const roll = Math.random();
                if (roll < blockProb) {
                    p2.aiBlockTimer = 0.25 + progress * 0.12;
                    ai[dirAwayFromP1] = true;
                    return ai;
                } else if (progress > 0.45 && roll < blockProb + (progress * 0.16) && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                    // Mid-to-late stages occasionally counter-poke with a fast jab
                    ai.lJust = true;
                    p2.aiWaitTimer = 0.45;
                    return ai;
                }
            }
        } else {
            p2._lastSeenP1Attack = null;
        }

        // ─── 4. ACTION COOLDOWN / BREATHING ROOM FOR PLAYER ───
        // Early stages pause significantly between attacks so the player can land combos!
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            // On early stages, AI stands still or backs off slightly during wait timer (leaving an opening)
            if (progress > 0.65 && dist > 230) {
                ai[dirToP1] = true;
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust) {
                // Stage 1 waits 0.90s - 1.30s after every attack; Stage 7 waits ~0.55s; Stage 14 waits ~0.24s - 0.38s
                const minWait = Math.max(0.20, 0.90 - progress * 0.66);
                const randWait = Math.max(0.14, 0.40 - progress * 0.26);
                p2.aiWaitTimer = minWait + Math.random() * randWait;
            }
            return ai;
        };

        // ─── 5. AIRBORNE ATTACKS ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 240) {
            if (Math.random() < (0.04 + progress * 0.14)) {
                ai.hJust = true;
            }
            return ai;
        }

        // ─── 6. APPROACH ZONE (far away: dist > 300) ───
        if (dist > 300) {
            // Early stages walk in at a relaxed pace (not holding forward 100% of frames)
            if (Math.random() < (0.55 + progress * 0.45)) {
                ai[dirToP1] = true;
            }

            // Fire projectile / dash special from range when meter is full (scales with stage)
            if (p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                if (Math.random() < (0.006 + progress * 0.025)) {
                    ai.sJust = true;
                    return applyCooldown();
                }
            }

            // Jump-in approach (rare on early stages)
            if (Math.random() < (0.004 + progress * 0.018) && p2.isGrounded) {
                ai[dirToP1] = true;
                ai.up = true;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close range: dist <= 195) ───
        if (dist <= 195) {
            if (p2.state === 'IDLE' || p2.state === 'WALK') {
                // Stage 1 attacks 28% of checks when ready; Stage 14 attacks 75% of checks
                const attackChance = 0.28 + progress * 0.47;
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    // Early opponents mostly use Light attacks; later opponents mix in Heavy & Specials
                    const specialThreshold = 0.05 + progress * 0.20;
                    const heavyThreshold = specialThreshold + (0.20 + progress * 0.28);

                    if (mixup < specialThreshold && p2.specialEnergy >= 100) {
                        ai.sJust = true;
                    } else if (mixup < heavyThreshold) {
                        ai.hJust = true;
                    } else {
                        ai.lJust = true;
                    }
                    return applyCooldown();
                } else {
                    // Pause briefly so player has first-strike advantage on early stages!
                    p2.aiWaitTimer = Math.max(0.12, 0.45 - progress * 0.30);
                }
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: 195 < dist <= 300) ───
        if (Math.random() < (0.50 + progress * 0.48)) {
            ai[dirToP1] = true;
        }

        if (p2.state === 'IDLE' || p2.state === 'WALK') {
            const roll = Math.random();
            if (roll < (0.005 + progress * 0.022) && p2.specialEnergy >= 100) {
                ai.sJust = true;
                return applyCooldown();
            } else if (roll < (0.015 + progress * 0.055)) {
                if (progress > 0.35 && Math.random() < 0.30 && p2.isGrounded) {
                    ai.up = true;
                    ai.hJust = true;
                } else if (Math.random() < (0.25 + progress * 0.35)) {
                    ai.hJust = true;
                } else {
                    ai.lJust = true;
                }
                return applyCooldown();
            }
        }

        return ai;
    }
}

