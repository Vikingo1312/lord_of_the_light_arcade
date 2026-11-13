import { ROSTER } from '../data.js';
import { playAnnouncer } from '../core/AssetPreloader.js';

/**
 * CombatHUD — Renders health/special bars, timers, and match overlays
 * (Fight Intro, KO, Post-Match menu, Victory screen, Pause menu).
 */
export default class CombatHUD {
    static drawHUD(ctx, combat) {
        const game = combat.game;
        const cx = game.width / 2;

        // Timer
        ctx.fillStyle = '#fdbf00';
        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(combat.timer).toString(), cx, 120);

        // Names
        ctx.fillStyle = 'white';
        ctx.font = '30px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(combat.p1.data.name.toUpperCase(), 100, 70);
        ctx.textAlign = 'right';
        ctx.fillText(combat.p2.data.name.toUpperCase(), game.width - 100, 70);

        // Health Bars
        const barW = 600, barH = 40, barY = 90;
        const p1X = 100;
        const p2X = game.width - 100 - barW;

        // Backgrounds (red)
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(p1X, barY, barW, barH);
        ctx.fillRect(p2X, barY, barW, barH);

        // P1 Health (green → yellow → red)
        const p1Pct = Math.max(0, combat.p1.hp / combat.p1.maxHP);
        ctx.fillStyle = p1Pct > 0.5 ? '#00ff00' : (p1Pct > 0.25 ? '#ffff00' : '#ff4400');
        ctx.fillRect(p1X, barY, barW * p1Pct, barH);

        // P2 Health
        const p2Pct = Math.max(0, combat.p2.hp / combat.p2.maxHP);
        ctx.fillStyle = p2Pct > 0.5 ? '#00ff00' : (p2Pct > 0.25 ? '#ffff00' : '#ff4400');
        const p2W = barW * p2Pct;
        ctx.fillRect(p2X + (barW - p2W), barY, p2W, barH);

        // Bar outlines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p1X, barY, barW, barH);
        ctx.strokeRect(p2X, barY, barW, barH);

        // Menu Pause Button
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(game.width - 150, 10, 140, 50);
        ctx.strokeStyle = '#888';
        ctx.strokeRect(game.width - 150, 10, 140, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('MENU', game.width - 80, 42);

        // ─── SPECIAL ENERGY METERS ───
        const spH = 15;
        const spY = barY + barH + 10;

        // Background (dark blue)
        ctx.fillStyle = '#001133';
        ctx.fillRect(p1X, spY, barW, spH);
        ctx.fillRect(p2X, spY, barW, spH);

        const flashOn = Math.floor((combat.time || 0) * 10) % 2 === 0;

        // P1 Special (Cyan)
        const p1SpPct = Math.max(0, combat.p1.specialEnergy / combat.p1.maxSpecialEnergy);
        const p1SpReady = p1SpPct >= 1.0;
        ctx.fillStyle = p1SpReady ? (flashOn ? '#ffffff' : '#00ffff') : '#0088cc';
        ctx.fillRect(p1X, spY, barW * p1SpPct, spH);

        // P2 Special (Cyan)
        const p2SpPct = Math.max(0, combat.p2.specialEnergy / combat.p2.maxSpecialEnergy);
        const p2SpReady = p2SpPct >= 1.0;
        ctx.fillStyle = p2SpReady ? (flashOn ? '#ffffff' : '#00ffff') : '#0088cc';
        const p2SpW = barW * p2SpPct;
        ctx.fillRect(p2X + (barW - p2SpW), spY, p2SpW, spH);

        // Special outlines
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p1X, spY, barW, spH);
        ctx.strokeRect(p2X, spY, barW, spH);

        // ─── CO-OP PARTNER (ALLY) HEALTH & SPECIAL BARS ───
        if (combat.coopMode && combat.ally) {
            const allyY = spY + 34;
            const allyBarW = 460;
            const allyBarH = 24;
            ctx.fillStyle = '#bb66ff';
            ctx.font = 'bold 16px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillText(`P2 TEAM: ${combat.ally.data.name.toUpperCase()}`, p1X, allyY - 6);

            ctx.fillStyle = '#550022';
            ctx.fillRect(p1X, allyY, allyBarW, allyBarH);

            const allyPct = Math.max(0, combat.ally.hp / combat.ally.maxHP);
            ctx.fillStyle = allyPct > 0.5 ? '#bb55ff' : (allyPct > 0.25 ? '#ffaa00' : '#ff3355');
            ctx.fillRect(p1X, allyY, allyBarW * allyPct, allyBarH);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(p1X, allyY, allyBarW, allyBarH);

            // Ally Special bar
            const allySpY = allyY + allyBarH + 5;
            const allySpH = 10;
            const allySpPct = Math.max(0, combat.ally.specialEnergy / combat.ally.maxSpecialEnergy);
            ctx.fillStyle = '#110033';
            ctx.fillRect(p1X, allySpY, allyBarW, allySpH);
            ctx.fillStyle = allySpPct >= 1.0 ? (flashOn ? '#ffffff' : '#ff66ff') : '#9933ff';
            ctx.fillRect(p1X, allySpY, allyBarW * allySpPct, allySpH);
            ctx.strokeStyle = '#bb66ff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p1X, allySpY, allyBarW, allySpH);
        }

        // ─── ONLINE ROOM STATUS BADGE ───
        if (game.networkManager && game.networkManager.active) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px "Press Start 2P"';
            const isConn = game.networkManager.status === 'connected';
            ctx.fillStyle = isConn ? '#00ff88' : '#ffcc00';
            const modeTag = combat.coopMode ? 'KOOP' : '1V1';
            ctx.fillText(
                `${isConn ? '🟢' : '🟡'} ${modeTag} CODE ${game.networkManager.roomCode}`,
                cx,
                152
            );
            ctx.restore();
        }

        // ─── DYNAMIC ARCADE COMBO COUNTERS ───
        const comboY = (combat.coopMode && combat.ally) ? 280 : 235;
        if (combat.p1ComboCount >= 2 && combat.p1ComboTimer > 0) {
            const pop = 1 + Math.min(0.28, (combat.p1ComboTimer - 1.0) * 0.6);
            const scale = Math.max(1.0, pop);
            ctx.save();
            ctx.translate(180, comboY);
            ctx.scale(scale, scale);
            ctx.textAlign = 'left';
            ctx.font = 'bold 42px "Press Start 2P"';
            ctx.fillStyle = combat.p1ComboCount >= 3 ? '#ffdd00' : '#00eeff';
            ctx.shadowColor = combat.p1ComboCount >= 3 ? '#ff4400' : '#0088ff';
            ctx.shadowBlur = 18;
            ctx.fillText(`${combat.p1ComboCount} HIT`, 0, 0);
            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(combat.p1ComboCount >= 3 ? 'SUPER COMBO!' : 'COMBO!', 0, 32);
            ctx.restore();
        }

        if (combat.p2ComboCount >= 2 && combat.p2ComboTimer > 0) {
            const pop = 1 + Math.min(0.28, (combat.p2ComboTimer - 1.0) * 0.6);
            const scale = Math.max(1.0, pop);
            ctx.save();
            ctx.translate(game.width - 180, 235);
            ctx.scale(scale, scale);
            ctx.textAlign = 'right';
            ctx.font = 'bold 42px "Press Start 2P"';
            ctx.fillStyle = combat.p2ComboCount >= 3 ? '#ffdd00' : '#ff3366';
            ctx.shadowColor = '#ff0044';
            ctx.shadowBlur = 18;
            ctx.fillText(`${combat.p2ComboCount} HIT`, 0, 0);
            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(combat.p2ComboCount >= 3 ? 'SUPER COMBO!' : 'COMBO!', 0, 32);
            ctx.restore();
        }
    }

    static drawFightIntro(ctx, combat) {
        const cx = combat.game.width / 2;
        const cy = combat.game.height / 2;
        ctx.textAlign = 'center';

        if (combat.introTimer < 1.0) {
            const t = combat.introTimer;
            const scale = Math.min(1, t * 4);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.font = 'bold 100px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 20;
            ctx.fillText('ROUND 1', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        } else {
            const t = combat.introTimer - 1.0;
            const flash = Math.max(0, 1 - t * 3);
            if (flash > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.4})`;
                ctx.fillRect(0, 0, combat.game.width, combat.game.height);
            }
            const bounce = 1 + Math.sin(t * 12) * 0.05;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(bounce, bounce);
            ctx.font = 'bold 180px "Press Start 2P"';
            ctx.fillStyle = '#ff3300';
            ctx.shadowColor = '#fdbf00';
            ctx.shadowBlur = 30;
            ctx.fillText('FIGHT!', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    static drawKO(ctx, combat) {
        const cx = combat.game.width / 2;
        const cy = combat.game.height / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, combat.game.width, combat.game.height);

        const pulse = 1 + Math.sin(combat.koFreezeTimer * 6) * 0.03;

        if (combat.koFreezeTimer < 1.5) {
            ctx.save();
            ctx.translate(cx, cy - 40);
            ctx.scale(pulse, pulse);
            ctx.font = 'bold 180px "Press Start 2P"';
            ctx.fillStyle = '#ff0000';
            ctx.strokeStyle = '#fdbf00';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 20;
            ctx.strokeText('K.O.', 0, 0);
            ctx.fillText('K.O.', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        if (combat.koFreezeTimer >= 3.0) {
            const winnerFighter = combat.winner === 'p1' ? combat.p1 : combat.p2;
            if (winnerFighter.hp >= winnerFighter.maxHP) {
                ctx.font = 'bold 60px "Press Start 2P"';
                ctx.fillStyle = '#fdbf00';
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 15;
                ctx.fillText('PERFECT', cx, cy + 60);
                ctx.shadowBlur = 0;
                if (!combat._perfectAnnounced) {
                    combat._perfectAnnounced = true;
                    playAnnouncer(combat.game.audioManager, 'perfect');
                }
            } else {
                const isCoopWin = combat.winner === 'p1' && combat.coopMode && combat.ally;
                const winnerText = isCoopWin
                    ? `${combat.p1.data.name.toUpperCase()} & ${combat.ally.data.name.toUpperCase()} WIN!`
                    : `${(combat.winner === 'p1' ? combat.p1.data.name : combat.p2.data.name).toUpperCase()} WINS!`;
                ctx.font = isCoopWin ? 'bold 42px "Press Start 2P"' : 'bold 60px "Press Start 2P"';
                ctx.fillStyle = '#fdbf00';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 10;
                ctx.fillText(winnerText, cx, cy + 60);
                ctx.shadowBlur = 0;
            }
        }
    }

    static drawPostMatch(ctx, combat) {
        const cx = combat.game.width / 2;
        const startY = combat.game.height * 0.65;

        if (combat.autoAdvanceTimer !== undefined) {
            const maxTime = combat.autoAdvanceMax || 3.0;
            const pct = Math.max(0, Math.min(1, combat.autoAdvanceTimer / maxTime));
            const barW = 400;
            const barH = 12;

            ctx.font = '14px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillStyle = pct < 0.3 ? '#ff0000' : '#00ffff';
            if (pct < 0.3 && Math.floor(Date.now() / 200) % 2 === 0) ctx.fillStyle = '#ffaa00';
            ctx.fillText(combat.arcadeMode && combat.winner === 'p1' ? 'NEXT BATTLE STARTING IN...' : 'AUTO-ADVANCE IN...', cx, startY - 25);

            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(cx - barW / 2, startY - 10, barW, barH);
            ctx.strokeStyle = '#444';
            ctx.strokeRect(cx - barW / 2 - 2, startY - 12, barW + 4, barH + 4);

            ctx.fillStyle = pct < 0.3 ? '#ff0055' : '#00ffff';
            ctx.fillRect(cx - barW / 2, startY - 10, barW * pct, barH);
        }

        if (combat.arcadeMode) {
            if (combat.winner === 'p1') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(cx - 200, startY + 20, 400, 80);
                ctx.font = 'bold 20px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fdbf00';
                ctx.fillText(`FIGHT ${combat.arcadeIndex} / ${ROSTER.length - 1} CLEAR!`, cx, startY + 68);
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(cx - 300, startY + 20, 600, 150);
                const lossOpts = ['CONTINUE?', 'GIVE UP'];
                ctx.font = 'bold 32px "Press Start 2P"';
                ctx.textAlign = 'center';
                for (let i = 0; i < lossOpts.length; i++) {
                    const y = startY + 75 + i * 60;
                    ctx.fillStyle = i === combat.postMatchIndex ? '#ff0055' : '#666';
                    ctx.fillText(i === combat.postMatchIndex ? `> ${lossOpts[i]} <` : lossOpts[i], cx, y);
                }
            }
        } else {
            const options = ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'];
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(cx - 300, startY - 40, 600, options.length * 65 + 30);
            ctx.font = 'bold 32px "Press Start 2P"';
            ctx.textAlign = 'center';
            for (let i = 0; i < options.length; i++) {
                const y = startY + i * 65;
                ctx.fillStyle = i === combat.postMatchIndex ? '#00ffff' : '#888888';
                ctx.fillText(i === combat.postMatchIndex ? `> ${options[i]} <` : options[i], cx, y);
            }
        }
    }

    static drawVictory(ctx, combat) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, combat.game.width, combat.game.height);

        const cx = combat.game.width / 2;
        const cy = combat.game.height / 2;
        ctx.textAlign = 'center';

        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.shadowColor = '#fdbf00';
        ctx.shadowBlur = 30;
        ctx.fillText('CHAMPION', cx, cy - 60);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('YOU CONQUERED ALL 14 WARRIORS!', cx, cy + 10);

        ctx.font = '24px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`WINS: ${combat.arcadeWins + 1}`, cx, cy + 60);

        if (combat._newlyUnlocked) {
            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.fillText('BLOODLINE UNLOCKED:', cx, cy + 110);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(combat._newlyUnlocked.name.toUpperCase(), cx, cy + 140);
            ctx.shadowBlur = 0;

            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('PRESS ATTACK TO VIEW CREDITS', cx, cy + 200);
        } else {
            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#888';
            ctx.fillText('PRESS ATTACK TO VIEW CREDITS', cx, cy + 140);
        }
    }

    static drawPause(ctx, combat) {
        const w = combat.game.width;
        const h = combat.game.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold 80px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', cx, cy - 80);

        const options = ['RESUME FIGHT', 'QUIT TO MENU'];
        ctx.font = 'bold 36px "Press Start 2P"';
        for (let i = 0; i < options.length; i++) {
            const y = cy + 40 + (i * 80);
            ctx.fillStyle = combat.pauseSelection === i ? '#ff0055' : '#888';
            ctx.fillText(combat.pauseSelection === i ? `> ${options[i]} <` : options[i], cx, y);
        }
    }
}
