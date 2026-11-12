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

        // Difficulty scales with roster position (Stage 1 starts at 0.75, Boss reaches 1.5)
        const rosterIdx = combat.combatData?.p2?.rosterIndex ?? 1;
        let diff = Math.min(1.5, 0.70 + (rosterIdx / 14) * 0.80);

        if (difficultySetting === 'EASY') diff *= 0.65;
        else if (difficultySetting === 'HARD') diff *= 1.35;

        // Initialize AI state timers on p2
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (typeof p2.aiBlockTimer === 'undefined') p2.aiBlockTimer = 0;
        if (typeof p2._lastSeenP1Attack === 'undefined') p2._lastSeenP1Attack = null;

        // ─── 1. SUSTAINED BLOCKING (commit to holding back for the entire enemy attack) ───
        if (p2.aiBlockTimer > 0) {
            p2.aiBlockTimer -= dt;
            ai[dirAwayFromP1] = true;
            // Counter-attack immediately when P1 enters recovery frames in close range!
            if (p1.state === 'ATTACK' && p1.currentAttack &&
                p1.stateTimer >= (p1.currentAttack.startup + p1.currentAttack.active) &&
                dist <= 210) {
                p2.aiBlockTimer = 0;
                ai[dirAwayFromP1] = false;
                ai.hJust = true;
                return ai;
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
            if (Math.random() < Math.min(0.85, 0.45 * diff)) {
                // Jump forward over the projectile and kick!
                ai[dirToP1] = true;
                ai.up = true;
                if (dist < 320) ai.hJust = true;
                p2.aiWaitTimer = 0.15;
                return ai;
            } else {
                // Commit to blocking the projectile
                p2.aiBlockTimer = 0.40;
                ai[dirAwayFromP1] = true;
                return ai;
            }
        }

        // ─── 3. REACT TO P1 MELEE ATTACK (One decision per P1 attack, not per frame!) ───
        if (p1.state === 'ATTACK' && dist < 260) {
            // Check if P1 is in recovery (whiff punish window!)
            const inRecovery = p1.currentAttack &&
                p1.stateTimer >= (p1.currentAttack.startup + p1.currentAttack.active);

            if (inRecovery && dist <= 210 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                ai[dirToP1] = true;
                if (p2.specialEnergy >= 100 && Math.random() < 0.45) ai.sJust = true;
                else ai.hJust = true;
                p2.aiWaitTimer = 0.15;
                return ai;
            }

            if (p2._lastSeenP1Attack !== p1.currentAttack) {
                p2._lastSeenP1Attack = p1.currentAttack;
                const blockProb = Math.min(0.82, 0.42 * diff);
                const roll = Math.random();
                if (roll < blockProb) {
                    // Hold block for the duration of P1's attack
                    p2.aiBlockTimer = 0.32;
                    ai[dirAwayFromP1] = true;
                    return ai;
                } else if (roll < blockProb + 0.22 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                    // Counter-poke with fast light attack or jump kick!
                    if (Math.random() < 0.65) {
                        ai.lJust = true;
                    } else if (p2.isGrounded) {
                        ai[dirToP1] = true;
                        ai.up = true;
                        ai.hJust = true;
                    }
                    p2.aiWaitTimer = 0.15;
                    return ai;
                }
            }
        } else {
            p2._lastSeenP1Attack = null;
        }

        // ─── 4. BRIEF ACTION COOLDOWN (keeps pacing natural without freezing AI) ───
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            // Keep moving or guarding during brief cooldown instead of standing dead still
            if (dist > 210) {
                ai[dirToP1] = true;
            } else if (p1.state === 'ATTACK') {
                ai[dirAwayFromP1] = true;
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust) {
                if (difficultySetting === 'EASY') p2.aiWaitTimer = 0.45 + Math.random() * 0.25;
                else if (difficultySetting === 'NORMAL') p2.aiWaitTimer = 0.12 + Math.random() * 0.16;
                else p2.aiWaitTimer = 0.05 + Math.random() * 0.08;
            }
            return ai;
        };

        // ─── 5. AIRBORNE ATTACKS (If AI is jumping near P1, throw jump kicks!) ───
        if (!p2.isGrounded && p2.state === 'JUMP' && dist < 260) {
            if (Math.random() < 0.18 * diff) {
                ai.hJust = true;
            }
            return ai;
        }

        // ─── 6. APPROACH ZONE (far away: dist > 300) ───
        if (dist > 300) {
            ai[dirToP1] = true;

            // Fire projectile / dash special from range when meter is full
            if (p2.specialEnergy >= 100 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                if (Math.random() < 0.035 * diff) {
                    ai.sJust = true;
                    return applyCooldown();
                }
            }

            // Aggressive jump-in approach
            if (Math.random() < 0.025 * diff && p2.isGrounded) {
                ai.up = true;
            }
            return ai;
        }

        // ─── 7. STRIKE ZONE (close range: dist <= 195) ───
        if (dist <= 195) {
            if (p2.state === 'IDLE' || p2.state === 'WALK') {
                const attackChance = Math.min(0.95, 0.58 * diff);
                if (Math.random() < attackChance) {
                    const mixup = Math.random();
                    if (mixup < 0.25 && p2.specialEnergy >= 100) {
                        ai.sJust = true;
                    } else if (mixup < 0.65) {
                        ai.hJust = true; // Heavy attack (35 dmg + launcher)
                    } else {
                        ai.lJust = true; // Fast Light jab (15 dmg)
                    }
                    return applyCooldown();
                } else {
                    // Keep walking into P1 to pressure or jump-kick crossup
                    if (Math.random() < 0.12 * diff && p2.isGrounded) {
                        ai[dirToP1] = true;
                        ai.up = true;
                        ai.hJust = true;
                    } else {
                        ai[dirToP1] = true;
                    }
                }
            }
            return applyCooldown();
        }

        // ─── 8. FOOTSIES ZONE (mid-range: 195 < dist <= 300) ───
        // Relentlessly close the gap and poke!
        ai[dirToP1] = true;

        if (p2.state === 'IDLE' || p2.state === 'WALK') {
            const roll = Math.random();
            if (roll < 0.035 * diff && p2.specialEnergy >= 100) {
                ai.sJust = true;
                return applyCooldown();
            } else if (roll < 0.09 * diff) {
                // Advancing poke or jump-in heavy kick
                if (Math.random() < 0.35 && p2.isGrounded) {
                    ai.up = true;
                    ai.hJust = true;
                } else if (Math.random() < 0.6) {
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

