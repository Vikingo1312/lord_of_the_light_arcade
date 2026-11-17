import { ROSTER, getFighterStyle } from '../data.js?v=2.42';
import { playAnnouncer } from '../core/AssetPreloader.js?v=2.42';
import { STORY_DIALOGUES } from '../story_dialogues.js?v=2.42';
import { getFinisherMove } from '../fx/CinematicFinisher.js?v=2.42';

/**
 * CombatHUD — Renders health/special bars, timers, and match overlays
 * (Fight Intro, FINISH HIM, KO, Post-Match menu, Victory screen, Pause menu).
 */
export default class CombatHUD {
    static _drawReactivePortrait(ctx, game, fighter, x, y, size, flip = false) {
        ctx.save();
        const isHit = fighter.state === 'HIT' || fighter.state === 'KO' || fighter.state === 'DIZZY';
        const jx = isHit ? (Math.random() - 0.5) * 6 : 0;
        const jy = isHit ? (Math.random() - 0.5) * 6 : 0;

        // Gold-beveled Street Fighter portrait frame
        ctx.fillStyle = isHit ? '#440011' : '#0b0c24';
        ctx.fillRect(x, y, size, size);

        const imgKey = isHit
            ? (game.assetManager.images[`${fighter.data.id}_hit.png`] ? `${fighter.data.id}_hit.png` : `${fighter.data.id}_front.png`)
            : `${fighter.data.id}_front.png`;
        const img = game.assetManager.images[imgKey] || game.assetManager.images[`${fighter.data.id}_right.png`];

        if (img && img.naturalWidth && img.naturalHeight) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x + 3, y + 3, size - 6, size - 6);
            ctx.clip();
            ctx.translate(x + size / 2 + jx, y + size / 2 + jy);
            if (flip) ctx.scale(-1, 1);
            // Zoom onto upper torso/head
            const scale = (size * 1.45) / img.naturalHeight;
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            ctx.drawImage(img, -dw / 2, -dh * 0.34, dw, dh);
            if (isHit) {
                ctx.fillStyle = 'rgba(255, 30, 30, 0.32)';
                ctx.fillRect(-size, -size, size * 2, size * 2);
            }
            ctx.restore();
        }

        ctx.strokeStyle = isHit ? '#ff3344' : '#ffd700';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x, y, size, size);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
        ctx.restore();
    }

    static drawHUD(ctx, combat) {
        const game = combat.game;
        const cx = game.width / 2;

        // ─── REACTIVE STREET FIGHTER MINI-PORTRAITS ───
        const portSize = 78;
        const portY = 64;
        CombatHUD._drawReactivePortrait(ctx, game, combat.p1, 20, portY, portSize, false);
        CombatHUD._drawReactivePortrait(ctx, game, combat.p2, game.width - 20 - portSize, portY, portSize, true);

        // ─── CENTER "KO" EMBLEM & ARCADE TIMER ───
        ctx.save();
        ctx.fillStyle = '#2a0800';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.fillRect(cx - 46, 42, 92, 30);
        ctx.strokeRect(cx - 46, 42, 92, 30);
        ctx.fillStyle = '#ff2200';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('K.O.', cx, 64);

        ctx.fillStyle = combat.timer <= 15 ? '#ff3333' : '#fdbf00';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 64px "Press Start 2P"';
        ctx.fillText(Math.ceil(combat.timer).toString().padStart(2, '0'), cx, 138);
        ctx.restore();

        // ─── FIGHTER NAMES & FIGHT STYLE BADGES ───
        const barW = 585, barH = 38, barY = 82;
        const p1X = 108;
        const p2X = game.width - 108 - barW;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.font = 'bold 26px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(combat.p1.data.name.toUpperCase(), p1X, 68);
        ctx.textAlign = 'right';
        ctx.fillText(combat.p2.data.name.toUpperCase(), p2X + barW, 68);

        // Fight Style badges above lifebar inner corners
        const p1Style = combat.p1.styleInfo || getFighterStyle(combat.p1.data.id);
        const p2Style = combat.p2.styleInfo || getFighterStyle(combat.p2.data.id);
        ctx.font = 'bold 11px "Press Start 2P"';
        ctx.textAlign = 'right';
        ctx.fillStyle = p1Style.color || '#00e5ff';
        ctx.fillText(`🥋 ${p1Style.name}`, p1X + barW, 72);
        ctx.textAlign = 'left';
        ctx.fillStyle = p2Style.color || '#ff6600';
        ctx.fillText(`🥋 ${p2Style.name}`, p2X, 72);
        ctx.restore();

        // ─── STREET FIGHTER GOLD-BEVELED LIFEBARS WITH TRAILING RED DAMAGE ───
        // Dark outer trough
        ctx.fillStyle = '#180614';
        ctx.fillRect(p1X, barY, barW, barH);
        ctx.fillRect(p2X, barY, barW, barH);

        const pad = 3;
        const innerW = barW - pad * 2;
        const innerH = barH - pad * 2;
        const innerY = barY + pad;
        const p1InnerX = p1X + pad;
        const p2InnerX = p2X + pad;

        const p1Dead = combat.p1.hp <= 0 || combat.p1.state === 'KO';
        const p2Dead = combat.p2.hp <= 0 || combat.p2.state === 'KO';

        // Trailing Red Damage Bar (only drawn while fighter is alive; snaps to 0 on KO!)
        const p1Trail = p1Dead ? 0 : (combat.p1TrailHP !== undefined ? combat.p1TrailHP : combat.p1.hp);
        const p2Trail = p2Dead ? 0 : (combat.p2TrailHP !== undefined ? combat.p2TrailHP : combat.p2.hp);
        const p1TrailPct = Math.max(0, Math.min(1, p1Trail / combat.p1.maxHP));
        const p2TrailPct = Math.max(0, Math.min(1, p2Trail / combat.p2.maxHP));

        ctx.fillStyle = '#b31237';
        if (p1TrailPct > 0) {
            const tw1 = innerW * p1TrailPct;
            ctx.fillRect(p1InnerX + (innerW - tw1), innerY, tw1, innerH);
        }
        if (p2TrailPct > 0) {
            const tw2 = innerW * p2TrailPct;
            ctx.fillRect(p2InnerX, innerY, tw2, innerH);
        }

        // Actual Health (Street Fighter drains toward the center KO badge!)
        // Alive fighters always render at least a 10px visible sliver inside the gold border so 1 HP never looks empty!
        const p1Pct = p1Dead ? 0 : Math.max(0, Math.min(1, combat.p1.hp / combat.p1.maxHP));
        if (!p1Dead && p1Pct > 0) {
            const p1Grad = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
            if (p1Pct > 0.5) {
                p1Grad.addColorStop(0, '#99ff33');
                p1Grad.addColorStop(0.5, '#00e640');
                p1Grad.addColorStop(1, '#008822');
            } else if (p1Pct > 0.25) {
                p1Grad.addColorStop(0, '#ffff66');
                p1Grad.addColorStop(0.5, '#ffcc00');
                p1Grad.addColorStop(1, '#cc7700');
            } else {
                p1Grad.addColorStop(0, '#ff8833');
                p1Grad.addColorStop(0.5, '#ff3300');
                p1Grad.addColorStop(1, '#aa0000');
            }
            ctx.fillStyle = p1Grad;
            const p1W = Math.min(innerW, Math.max(10, innerW * p1Pct));
            ctx.fillRect(p1InnerX + (innerW - p1W), innerY, p1W, innerH);
        }

        const p2Pct = p2Dead ? 0 : Math.max(0, Math.min(1, combat.p2.hp / combat.p2.maxHP));
        if (!p2Dead && p2Pct > 0) {
            const p2Grad = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
            if (p2Pct > 0.5) {
                p2Grad.addColorStop(0, '#99ff33');
                p2Grad.addColorStop(0.5, '#00e640');
                p2Grad.addColorStop(1, '#008822');
            } else if (p2Pct > 0.25) {
                p2Grad.addColorStop(0, '#ffff66');
                p2Grad.addColorStop(0.5, '#ffcc00');
                p2Grad.addColorStop(1, '#cc7700');
            } else {
                p2Grad.addColorStop(0, '#ff8833');
                p2Grad.addColorStop(0.5, '#ff3300');
                p2Grad.addColorStop(1, '#aa0000');
            }
            ctx.fillStyle = p2Grad;
            const p2W = Math.min(innerW, Math.max(10, innerW * p2Pct));
            ctx.fillRect(p2InnerX, innerY, p2W, innerH);
        }

        // Glossy top bevel highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(p1InnerX, innerY, innerW, 6);
        ctx.fillRect(p2InnerX, innerY, innerW, 6);

        // Gold Arcade Bar Borders
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(p1X, barY, barW, barH);
        ctx.strokeRect(p2X, barY, barW, barH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(p1X + 2, barY + 2, barW - 4, barH - 4);
        ctx.strokeRect(p2X + 2, barY + 2, barW - 4, barH - 4);

        // Top-Center & Top-Right MENU / PAUSE Buttons
        ctx.save();
        ctx.fillStyle = combat.paused ? 'rgba(255, 0, 85, 0.85)' : 'rgba(0, 0, 0, 0.72)';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        // Top-Center Pause button above K.O. badge
        ctx.fillRect(cx - 72, 4, 144, 32);
        ctx.strokeRect(cx - 72, 4, 144, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(combat.paused ? '▶ WEITER' : '⏸ PAUSE', cx, 26);

        // Top-Right MENU button
        ctx.fillStyle = combat.paused ? 'rgba(255, 0, 85, 0.85)' : 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(game.width - 150, 8, 130, 42);
        ctx.strokeRect(game.width - 150, 8, 130, 42);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillText('⏸ MENU', game.width - 85, 35);
        ctx.restore();

        // ─── 3-SEGMENT STREET FIGHTER SUPER COMBO METERS ───
        const spH = 16;
        const spY = barY + barH + 8;

        ctx.fillStyle = '#050b24';
        ctx.fillRect(p1X, spY, barW, spH);
        ctx.fillRect(p2X, spY, barW, spH);

        const flashOn = Math.floor((combat.time || 0) * 12) % 2 === 0;

        // P1 Special (3-segment Super Combo gauge)
        const p1SpPct = Math.max(0, Math.min(1, combat.p1.specialEnergy / combat.p1.maxSpecialEnergy));
        const p1SpReady = p1SpPct >= 1.0;
        ctx.fillStyle = p1SpReady ? (flashOn ? '#ffffff' : '#00ffff') : (p1SpPct >= 0.66 ? '#00ccff' : '#0077cc');
        ctx.fillRect(p1X, spY, barW * p1SpPct, spH);

        // P2 Special (3-segment Super Combo gauge)
        const p2SpPct = Math.max(0, Math.min(1, combat.p2.specialEnergy / combat.p2.maxSpecialEnergy));
        const p2SpReady = p2SpPct >= 1.0;
        ctx.fillStyle = p2SpReady ? (flashOn ? '#ffffff' : '#00ffff') : (p2SpPct >= 0.66 ? '#00ccff' : '#0077cc');
        const p2SpW = barW * p2SpPct;
        ctx.fillRect(p2X + (barW - p2SpW), spY, p2SpW, spH);

        // 3-Segment Dividers & Outline
        ctx.strokeStyle = p1SpReady ? '#ffd700' : '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p1X, spY, barW, spH);
        ctx.strokeStyle = p2SpReady ? '#ffd700' : '#00ffff';
        ctx.strokeRect(p2X, spY, barW, spH);

        ctx.fillStyle = '#050b24';
        for (let seg = 1; seg <= 2; seg++) {
            const sx1 = p1X + (barW * seg) / 3;
            const sx2 = p2X + (barW * seg) / 3;
            ctx.fillRect(sx1 - 2, spY, 4, spH);
            ctx.fillRect(sx2 - 2, spY, 4, spH);
        }

        if (p1SpReady) {
            ctx.fillStyle = flashOn ? '#ffd700' : '#ffffff';
            ctx.font = 'bold 12px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillText('SUPER MAX!', p1X + 8, spY + 13);
        }
        if (p2SpReady) {
            ctx.fillStyle = flashOn ? '#ffd700' : '#ffffff';
            ctx.font = 'bold 12px "Press Start 2P"';
            ctx.textAlign = 'right';
            ctx.fillText('SUPER MAX!', p2X + barW - 8, spY + 13);
        }

        // ─── CO-OP PARTNER (ALLY) HEALTH & SPECIAL BARS ───
        if (combat.coopMode && combat.ally) {
            const allyY = spY + 34;
            const allyBarW = 460;
            const allyBarH = 22;
            ctx.fillStyle = '#bb66ff';
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.textAlign = 'left';
            ctx.fillText(`P2 TEAM: ${combat.ally.data.name.toUpperCase()}`, p1X, allyY - 6);

            ctx.fillStyle = '#220018';
            ctx.fillRect(p1X, allyY, allyBarW, allyBarH);

            const allyTrail = combat.allyTrailHP !== undefined ? combat.allyTrailHP : combat.ally.hp;
            const allyTrailPct = Math.max(0, Math.min(1, allyTrail / combat.ally.maxHP));
            ctx.fillStyle = '#e6192e';
            ctx.fillRect(p1X, allyY, allyBarW * allyTrailPct, allyBarH);

            const allyPct = Math.max(0, combat.ally.hp / combat.ally.maxHP);
            ctx.fillStyle = allyPct > 0.5 ? '#bb55ff' : (allyPct > 0.25 ? '#ffaa00' : '#ff3355');
            ctx.fillRect(p1X, allyY, allyBarW * allyPct, allyBarH);
            ctx.strokeStyle = '#ffd700';
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
                164
            );
            ctx.restore();
        }

        // ─── STREET FIGHTER CALLOUT BANNERS (FIRST ATTACK! / COUNTER HIT!) ───
        if (combat.callout && combat.callout.timer > 0) {
            const c = combat.callout;
            const alpha = Math.min(1, c.timer / 0.25);
            const isP1 = c.side === 'p1';
            const slide = Math.min(1, (c.maxTimer - c.timer) / 0.12);
            const bx = isP1 ? (40 + slide * 68) : (game.width - 40 - slide * 68);
            const by = (combat.coopMode && combat.ally && isP1) ? 235 : 192;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 22px "Press Start 2P"';
            ctx.textAlign = isP1 ? 'left' : 'right';
            ctx.fillStyle = c.color;
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 12;
            ctx.fillText(c.text, bx, by);
            ctx.restore();
        }

        // ─── DYNAMIC ARCADE COMBO COUNTERS ───
        const comboY = (combat.coopMode && combat.ally) ? 290 : 245;
        if (combat.p1ComboCount >= 2 && combat.p1ComboTimer > 0) {
            const pop = 1 + Math.min(0.28, (combat.p1ComboTimer - 1.0) * 0.6);
            const scale = Math.max(1.0, pop);
            ctx.save();
            ctx.translate(108, comboY);
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
            ctx.translate(game.width - 108, 245);
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

        if (combat.matchPhase === 'FIGHTING') {
            // Subtle Arcade Command Move Legend at bottom of screen
            ctx.save();
            ctx.globalAlpha = 0.82;
            ctx.fillStyle = 'rgba(6, 10, 24, 0.78)';
            const barW = 1240;
            const barH = 30;
            ctx.fillRect(cx - barW / 2, game.height - barH - 6, barW, barH);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.42)';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(cx - barW / 2, game.height - barH - 6, barW, barH);
            ctx.textAlign = 'center';
            ctx.font = 'bold 10px "Press Start 2P"';
            ctx.fillStyle = '#bfefff';
            ctx.fillText('MOVES: [→+L / ←→+J] TORPEDO FLIGHT  [J+L / ↓↘→+K] FULLSCREEN RUSH COMBO  [↑+L] DRAGON UPPERCUT  [↓+L] HURRICANE KICK  [J+K] THROW', cx, game.height - 15);
            ctx.restore();
        }
    }

    static drawFightIntro(ctx, combat) {
        const cx = combat.game.width / 2;
        const cy = combat.game.height / 2;
        ctx.textAlign = 'center';
        const subPhase = combat.introSubPhase || 'STORY_DIALOGUE';
        const subT = combat.introSubTimer || 0;

        if (subPhase === 'STORY_DIALOGUE') {
            // Phase 1: Pre-fight Face-Off (skippable anytime with Space / J / K / Click!)
            const alpha = Math.min(1, combat.introTimer * 2.5);
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = 'bold 26px "Press Start 2P"';
            ctx.fillStyle = '#00eeff';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 14;
            ctx.fillText(combat.storyDialogue?.dimension || 'GET READY!', cx, cy - 55);
            ctx.font = 'bold 42px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.fillText(`${combat.p1.data.name.toUpperCase()}  VS  ${combat.p2.data.name.toUpperCase()}`, cx, cy + 10);
            if (combat.introTimer > 0.3) {
                ctx.font = 'bold 13px "Press Start 2P"';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillText('[SPACE / J / ENTER / KLICK ZUM ÜBERSPRINGEN ▸]', cx, cy + 52);
            }
            ctx.restore();
        } else if (subPhase === 'ROUND_CALL') {
            // Phase 2: Announcer roars "ROUND 1!" (only after Story Intro finished!)
            const scale = Math.min(1, subT * 4.5);
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
            // Phase 3: Announcer roars "FIGHT!" (only after ROUND 1 finished!)
            const flash = Math.max(0, 1 - subT * 3.5);
            if (flash > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.4})`;
                ctx.fillRect(0, 0, combat.game.width, combat.game.height);
            }
            const bounce = 1 + Math.sin(subT * 12) * 0.05;
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

    static drawFinishHim(ctx, combat) {
        const w = combat.game.width;
        const h = combat.game.height;
        const cx = w / 2;
        const cy = h * 0.34;
        const winnerFighter = combat.winner === 'p1' ? combat.p1 : combat.p2;
        const fMove = getFinisherMove(winnerFighter?.data?.id);

        ctx.save();
        // Dramatic Mortal Kombat blood-red edge vignette
        const vig = ctx.createRadialGradient(cx, h * 0.55, w * 0.25, cx, h * 0.55, w * 0.65);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(120, 0, 15, 0.55)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        const pulse = 1 + Math.sin((combat.time || 0) * 14) * 0.06;
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.textAlign = 'center';

        ctx.font = 'bold 88px "Press Start 2P"';
        ctx.fillStyle = '#ff1122';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 26;
        ctx.strokeText('FINISH HIM!', 0, 0);
        ctx.fillText('FINISH HIM!', 0, 0);

        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.fillStyle = fMove.color1 || '#ffd700';
        ctx.shadowBlur = 12;
        ctx.fillText(`🎬 ${fMove.name} — ${fMove.subtitle}`, 0, 48);

        if (combat.winner === 'p1') {
            ctx.fillStyle = 'rgba(8, 10, 26, 0.90)';
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2.5;
            ctx.fillRect(-480, 68, 960, 46);
            ctx.strokeRect(-480, 68, 960, 46);
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('DRÜCKE [S / SPEZIAL] ODER [J / K] FÜR FINISHER FILM-SEQUENZ!', 0, 98);
        }
        ctx.restore();
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
        const cy = combat.game.height / 2;
        const startY = combat.game.height * 0.65;
        const winnerFighter = combat.winner === 'p1' ? combat.p1 : combat.p2;
        const winVoicePlaying = Boolean(combat.game.audioManager?.isFighterVoicePlaying?.());

        if (winnerFighter) {
            ctx.save();
            ctx.textAlign = 'center';
            const isCoopWin = combat.winner === 'p1' && combat.coopMode && combat.ally;
            const winnerText = isCoopWin
                ? `${combat.p1.data.name.toUpperCase()} & ${combat.ally.data.name.toUpperCase()} WIN!`
                : `${winnerFighter.data.name.toUpperCase()} WINS!`;
            ctx.font = isCoopWin ? 'bold 38px "Press Start 2P"' : 'bold 48px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 12;
            ctx.fillText(winnerText, cx, cy - 55);
            ctx.restore();
        }

        if (combat.autoAdvanceTimer !== undefined) {
            const maxTime = combat.autoAdvanceMax || 3.0;
            const pct = Math.max(0, Math.min(1, combat.autoAdvanceTimer / maxTime));
            const barW = 400;
            const barH = 12;

            ctx.font = '13px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillStyle = winVoicePlaying ? '#ffd700' : (pct < 0.3 ? '#ff0000' : '#00ffff');
            if (!winVoicePlaying && pct < 0.3 && Math.floor(Date.now() / 200) % 2 === 0) ctx.fillStyle = '#ffaa00';
            const statusLabel = winVoicePlaying
                ? '🔊 SIEGES-SPRUCH LÄUFT [SPACE / J ZUM ÜBERSPRINGEN ▸]'
                : (combat.arcadeMode && combat.winner === 'p1' ? 'NEXT BATTLE STARTING IN...' : 'AUTO-ADVANCE IN...');
            ctx.fillText(statusLabel, cx, startY - 25);

            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(cx - barW / 2, startY - 10, barW, barH);
            ctx.strokeStyle = '#444';
            ctx.strokeRect(cx - barW / 2 - 2, startY - 12, barW + 4, barH + 4);

            ctx.fillStyle = winVoicePlaying ? '#ffd700' : (pct < 0.3 ? '#ff0055' : '#00ffff');
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
        const s = combat.game.settings || {};

        ctx.fillStyle = 'rgba(4, 6, 18, 0.86)';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.fillStyle = 'rgba(10, 14, 34, 0.94)';
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.fillRect(cx - 450, cy - 250, 900, 500);
        ctx.strokeRect(cx - 450, cy - 250, 900, 500);

        ctx.font = 'bold 54px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSE & SOUND-MIX', cx, cy - 175);

        const rows = [
            { label: 'WEITERSPIELEN', type: 'action' },
            { label: 'MUSIK (BGM)', type: 'slider', val: s.musicVolume ?? 0.22, max: 1.0, color: '#00e5ff' },
            { label: 'FX & HITS', type: 'slider', val: s.sfxVolume ?? 0.90, max: 1.5, color: '#ff3366' },
            { label: 'STIMMEN', type: 'slider', val: s.voiceVolume ?? 1.00, max: 1.5, color: '#ffd700' },
            { label: 'HAUPTMENÜ', type: 'action' }
        ];

        const startY = cy - 110;
        const rowStep = 68;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const y = startY + i * rowStep;
            const sel = combat.pauseSelection === i;

            if (sel) {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.16)';
                ctx.fillRect(cx - 410, y - 36, 820, 52);
                ctx.strokeStyle = '#ff0055';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 410, y - 36, 820, 52);
            }

            if (r.type === 'action') {
                ctx.textAlign = 'center';
                ctx.font = 'bold 28px "Press Start 2P"';
                ctx.fillStyle = sel ? '#00ffff' : '#aaaaaa';
                ctx.fillText(sel ? `> ${r.label} <` : r.label, cx, y);
            } else {
                ctx.textAlign = 'left';
                ctx.font = 'bold 22px "Press Start 2P"';
                ctx.fillStyle = sel ? '#ffffff' : '#bbbbbb';
                ctx.fillText(r.label, cx - 380, y - 2);

                const barX = cx - 40;
                const barW = 280;
                const barH = 22;
                const barY = y - 22;
                const ratio = Math.max(0, Math.min(1, r.val / r.max));

                ctx.fillStyle = '#141829';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = r.color;
                ctx.fillRect(barX, barY, barW * ratio, barH);
                ctx.strokeStyle = sel ? '#ffffff' : '#556688';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX, barY, barW, barH);

                ctx.textAlign = 'right';
                ctx.font = 'bold 20px "Press Start 2P"';
                ctx.fillStyle = sel ? r.color : '#cccccc';
                ctx.fillText(`${Math.round(r.val * 100)}%`, cx + 380, y - 2);
            }
        }

        ctx.textAlign = 'center';
        ctx.font = '13px "Press Start 2P"';
        ctx.fillStyle = '#88aacc';
        ctx.fillText('[↑/↓] AUSWAHL   [←/→ ODER TIPPEN] LAUTSTÄRKE   [ENTER/J] BESTÄTIGEN', cx, cy + 222);
        ctx.restore();
    }
}
