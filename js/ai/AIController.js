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

        // ─── AI PACIFICATION (Cooldown Timer) ───
        if (typeof p2.aiWaitTimer === 'undefined') p2.aiWaitTimer = 0;
        if (p2.aiWaitTimer > 0) {
            p2.aiWaitTimer -= dt;
            if (Math.random() < 0.2) {
                if (p1.x > p2.x) ai.left = true;
                else ai.right = true;
            }
            return ai;
        }

        const applyCooldown = () => {
            if (ai.lJust || ai.hJust || ai.sJust || ai.up) {
                if (difficultySetting === 'EASY') p2.aiWaitTimer = 1.2 + Math.random();
                else if (difficultySetting === 'NORMAL') p2.aiWaitTimer = 0.5 + Math.random() * 0.5;
                else p2.aiWaitTimer = 0.1;
            } else if (Math.random() < 0.02) {
                if (difficultySetting === 'EASY') p2.aiWaitTimer = 0.6;
                else if (difficultySetting === 'NORMAL') p2.aiWaitTimer = 0.3;
            }
            return ai;
        };

        const dist = Math.abs(p1.x - p2.x);
        const p2HpPct = p2.hp / p2.maxHP;

        // Difficulty scales with roster position (0=easy, 14=hardest boss)
        const rosterIdx = combat.combatData?.p2?.rosterIndex || 0;
        let diff = Math.min(1.5, 0.1 + (rosterIdx / 14) * 1.4);

        if (difficultySetting === 'EASY') diff *= 0.3;
        else if (difficultySetting === 'HARD') diff *= 1.4;

        // ─── JUMP FREQUENCY ───
        const jumpChance = dist > 250 ? 0.04 * diff : 0.015 * diff;
        if (Math.random() < jumpChance && p2.isGrounded) {
            ai.up = true;
            if (dist <= 250) ai.hJust = true;
        }

        // ─── PERFECT BLOCK CHECK ───
        const seesAttack = p1.state === 'ATTACK' && dist < 250;
        if (seesAttack) {
            if (Math.random() < diff * 0.4) {
                if (p1.x > p2.x) ai.left = true;
                else ai.right = true;
            } else {
                ai.left = false;
                ai.right = false;
            }
            return applyCooldown();
        }

        // ─── LOW HP: Play defensively ───
        if (p2HpPct < 0.25 && Math.random() < 0.3) {
            if (dist < 200) {
                if (p1.x > p2.x) ai.left = true;
                else ai.right = true;
            }
            if (dist < 150 && Math.random() < diff * 0.15) {
                if (p2.specialEnergy >= 100) ai.sJust = true;
                else ai.hJust = true;
            }
            return applyCooldown();
        }

        // ─── APPROACH ZONE (far away) ───
        if (dist > 300) {
            if (p1.x > p2.x) ai.right = true;
            else ai.left = true;

            if (Math.random() < 0.015 * diff && p2.isGrounded) ai.up = true;

            // Fire projectile / special from far range
            if (Math.random() < diff * 0.008 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                if (p2.specialEnergy >= 100) {
                    ai.sJust = true;
                }
            }

            // ─── STRIKE ZONE (close) ───
        } else if (dist <= 180) {
            if (p2.state === 'IDLE' || p2.state === 'WALK') {
                const rand = Math.random();
                const attackChance = Math.min(0.9, diff * 0.4);

                if (rand < attackChance) {
                    const mixup = Math.random();
                    if (mixup < 0.2) {
                        if (p2.specialEnergy >= 100) ai.sJust = true;
                        else ai.hJust = true;
                    } else if (mixup < 0.6) {
                        ai.hJust = true;
                    } else {
                        ai.lJust = true;
                    }
                } else {
                    const retreatThreshold = Math.max(0.4, 0.9 - (1.0 - diff) * 0.4);
                    if (rand > retreatThreshold) {
                        if (Math.random() > diff) {
                            if (p1.x > p2.x) ai.right = true;
                            else ai.left = true;
                        } else {
                            if (p1.x > p2.x) ai.left = true;
                            else ai.right = true;
                        }
                    }
                }
            }
            if (Math.random() < diff * 0.05 && p2.isGrounded) {
                ai.up = true;
                ai.hJust = true;
            }

            // ─── FOOTSIES ZONE (mid-range) ───
        } else {
            const advanceChance = Math.min(0.85, 0.30 + diff * 0.4);
            if (Math.random() < advanceChance) {
                if (p1.x > p2.x) ai.right = true;
                else ai.left = true;
            } else {
                if (p1.x > p2.x) ai.left = true;
                else ai.right = true;
            }

            if (Math.random() < diff * 0.08 && (p2.state === 'IDLE' || p2.state === 'WALK')) {
                if (p1.x > p2.x) ai.right = true;
                else ai.left = true;
                if (Math.random() > 0.5) ai.hJust = true;
                else ai.lJust = true;
            }
        }

        return applyCooldown();
    }
}
