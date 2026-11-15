/**
 * CinematicFinisher.js — Mortal Kombat Style "FINISH HIM!" & Individual Widescreen Film-Sequence Finishers
 * Every single one of the 23 fighters has a custom-tailored cinematic finisher sequence
 * with 21:9 cinema letterbox bars, multi-angle camera cuts, X-Ray / Impact freeze frames,
 * and bespoke visual effects (Katana Slashes, Bifrost Hammer, Solar Supernova, Shadow Clones, Sky Suplex, etc.).
 */

export const FINISHER_MOVES = {
    Keano: {
        title: 'SOLAR ECLIPSE OBLITERATION',
        subtitle: 'LICHT-DRACHEN SUPERNOVA',
        color1: '#00ffff',
        color2: '#ffd700',
        bgTint: '#021028',
        style: 'SOLAR_NOVA'
    },
    SupremeKeano: {
        title: 'COSMIC GOD JUDGMENT',
        subtitle: 'URKNALL DES LICHTKRISTALLS',
        color1: '#ffd700',
        color2: '#00ffff',
        bgTint: '#1a1200',
        style: 'SOLAR_NOVA'
    },
    HyperKeano: {
        title: 'HYPERION OVERDRIVE CANNON',
        subtitle: 'MILLIONEN-VOLT LICHTSTRAHL',
        color1: '#00e5ff',
        color2: '#ffffff',
        bgTint: '#001824',
        style: 'ORBITAL_BEAM'
    },
    Hattori: {
        title: 'THOUSAND BLADE SHOGUN',
        subtitle: 'ZANTETSUKEN SCHATTENSCHNITT',
        color1: '#ff0044',
        color2: '#ffffff',
        bgTint: '#140008',
        style: 'KATANA_SLASH'
    },
    Raheel: {
        title: 'SEVEN CHAKRA NIRVANA',
        subtitle: 'KOSMISCHES LOTUS-GERICHT',
        color1: '#cc44ff',
        color2: '#ffd700',
        bgTint: '#160028',
        style: 'CHAKRA_LOTUS'
    },
    Pablo: {
        title: 'AMAZON HURRICANE VORTEX',
        subtitle: '1000-KICK CAPOEIRAZYKLON',
        color1: '#00ff66',
        color2: '#ffee00',
        bgTint: '#001a0c',
        style: 'TORNADO_KICKS'
    },
    Tzubaza: {
        title: 'EMPEROR DRAGON ASCENSION',
        subtitle: 'FEUERDRACHEN-HIMMELFAHRT',
        color1: '#ff4400',
        color2: '#ffd700',
        bgTint: '#200600',
        style: 'DRAGON_RUSH'
    },
    AlCapone: {
        title: 'CHICAGO VENDETTA BARRAGE',
        subtitle: 'MAFIA TOMMY-GUN & DYNAMIT',
        color1: '#ffaa00',
        color2: '#ff2200',
        bgTint: '#180c04',
        style: 'BULLET_BARRAGE'
    },
    Gargamel: {
        title: 'DARK ALCHEMY ANNIHILATION',
        subtitle: 'VERBOTENER TRANSMUTATIONS-ZIRKEL',
        color1: '#aa00ff',
        color2: '#00ffcc',
        bgTint: '#120022',
        style: 'ALCHEMY_VOID'
    },
    GargamelHoodie: {
        title: 'SHADOW LAB OBLIVION',
        subtitle: 'DUNKLE MATERIE IMPLOSION',
        color1: '#9922ff',
        color2: '#ff0066',
        bgTint: '#10001e',
        style: 'ALCHEMY_VOID'
    },
    Marley: {
        title: 'ZION LION CONQUEROR',
        subtitle: 'RASTA-DONNER & LÖWENBRÜLLEN',
        color1: '#00ff66',
        color2: '#ffcc00',
        bgTint: '#061a04',
        style: 'TORNADO_KICKS'
    },
    Kowalski: {
        title: 'WARSAW ORBITAL STRIKE',
        subtitle: 'CYBER-GAUNTLET PLASMA-KANONE',
        color1: '#ff6600',
        color2: '#00ffff',
        bgTint: '#1c0800',
        style: 'ORBITAL_BEAM'
    },
    Paco: {
        title: 'AZTEC SKYBOMB SUPLEX',
        subtitle: 'STRATOSPHÄREN LUCHA-SLAM',
        color1: '#00ccff',
        color2: '#ffd700',
        bgTint: '#001428',
        style: 'SKY_SUPLEX'
    },
    Juan: {
        title: 'CORRIDA DE FUEGO MORTAL',
        subtitle: 'FLAMMENDER STIER-TODESSTOSS',
        color1: '#ff1133',
        color2: '#ffcc00',
        bgTint: '#220006',
        style: 'KATANA_SLASH'
    },
    Lee: {
        title: 'EIGHT GATES DRAGON FURY',
        subtitle: '100-FÄUSTE DRACHEN-EXPLOSION',
        color1: '#ff3300',
        color2: '#ffff00',
        bgTint: '#200400',
        style: 'DRAGON_RUSH'
    },
    JJDark: {
        title: 'PHANTOM ABYSS EXECUTION',
        subtitle: 'SCHATTEN-KLON HINRICHTUNG',
        color1: '#bb33ff',
        color2: '#ff0055',
        bgTint: '#0e001c',
        style: 'SHADOW_CLONES'
    },
    JayX: {
        title: 'NEON ECLIPSE ASSASSINATION',
        subtitle: 'CYBER-PHANTOM BLITZSCHLAG',
        color1: '#d444ff',
        color2: '#00ffff',
        bgTint: '#120024',
        style: 'SHADOW_CLONES'
    },
    Putin: {
        title: 'SIBERIAN METEOR CRUSHER',
        subtitle: 'ERDBEBEN TITANEN-BRECHER',
        color1: '#ff0033',
        color2: '#ffaa00',
        bgTint: '#200004',
        style: 'SKY_SUPLEX'
    },
    VikingoRaw: {
        title: 'VALHALLA BERSERKER WRATH',
        subtitle: 'ODINS BLUTIGER DONNER-STURM',
        color1: '#ff4400',
        color2: '#00ccff',
        bgTint: '#1c0600',
        style: 'THUNDER_HAMMER'
    },
    Vikingo: {
        title: 'RAGNARÖK MJÖLNIR CATACLYSM',
        subtitle: 'GÖTTERDÄMMERUNG HAMMERSCHLAG',
        color1: '#00ccff',
        color2: '#ffd700',
        bgTint: '#021226',
        style: 'THUNDER_HAMMER'
    },
    Simba: {
        title: 'GALAXY KING MAULING',
        subtitle: 'STERNENLÖWEN-KRALLENSTURM',
        color1: '#ffaa00',
        color2: '#ff2266',
        bgTint: '#1a0a00',
        style: 'KATANA_SLASH'
    },
    Emely: {
        title: 'STARLIGHT PRISM FINALE',
        subtitle: 'HIMMLISCHE KRISTALL-SUPERNOVA',
        color1: '#ff66cc',
        color2: '#00ffff',
        bgTint: '#1c0018',
        style: 'SOLAR_NOVA'
    },
    HyperEmely: {
        title: 'SAKURA EMPRESS OBLITERATION',
        subtitle: 'GOLDENER PHÖNIX-BLÜTENSTURM',
        color1: '#ff99cc',
        color2: '#ffd700',
        bgTint: '#26001a',
        style: 'SOLAR_NOVA'
    },
    Cayle: {
        title: 'NIGHTFALL PHANTOM REAPER',
        subtitle: 'LAUTLOSER SCHATTEN-STURM',
        color1: '#7744ff',
        color2: '#00ffcc',
        bgTint: '#08001a',
        style: 'SHADOW_CLONES'
    },
    CayleMinogue: {
        title: 'MINOGUE DIAMOND ZERO SHATTER',
        subtitle: 'PARISER DIAMANT-KRISTALL-EXEKUTION',
        color1: '#44bbff',
        color2: '#ffffff',
        bgTint: '#020b24',
        style: 'SHADOW_CLONES'
    }
};

export function getFinisherMove(fighterOrId) {
    const id = typeof fighterOrId === 'string' ? fighterOrId : (fighterOrId?.data?.id || fighterOrId?.id || 'Keano');
    return FINISHER_MOVES[id] || FINISHER_MOVES.Keano;
}

export default class CinematicFinisher {
    /**
     * Renders the full-screen Mortal Kombat style cinematic finisher movie!
     * Duration: 3.8 seconds total:
     *   - Phase 1 (0.0s .. 1.05s): Widescreen Cut-In, Portrait Zoom, Lightning & Title Card
     *   - Phase 2 (1.05s .. 2.75s): Fighter-specific High-Speed Action Choreography + X-Ray Shockwave at 2.15s
     *   - Phase 3 (2.75s .. 3.80s): Final Obliteration Blast & "MORTAL FINISHER!" Stamp
     */
    static drawCinematicScene(ctx, game, attacker, defender, timer) {
        if (!attacker || !defender) return;
        const w = game.width;
        const h = game.height;
        const cx = w / 2;
        const cy = h / 2;
        const fin = getFinisherMove(attacker);
        const imgs = game.assetManager.images;

        ctx.save();

        // 1. Deep Cinematic Backdrop with Speed-Lines
        ctx.fillStyle = fin.bgTint || '#080014';
        ctx.fillRect(0, 0, w, h);

        // Pulsing radial energy core behind the scene
        const coreGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, w * 0.65);
        coreGrad.addColorStop(0, fin.color1 + '66');
        coreGrad.addColorStop(0.5, fin.color2 + '22');
        coreGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, 0, w, h);

        // High-speed anime / Mortal Kombat diagonal action lines
        ctx.save();
        ctx.strokeStyle = fin.color1;
        ctx.globalAlpha = 0.28;
        for (let i = 0; i < 28; i++) {
            const yOff = ((i * 53 + timer * 1800) % (h + 200)) - 100;
            ctx.lineWidth = (i % 4 === 0) ? 4 : 1.5;
            ctx.beginPath();
            ctx.moveTo(0, yOff);
            ctx.lineTo(w, yOff - 140);
            ctx.stroke();
        }
        ctx.restore();

        const atkId = attacker.data ? attacker.data.id : attacker.id;
        const defId = defender.data ? defender.data.id : defender.id;
        const atkName = (attacker.data ? attacker.data.name : attacker.name || 'FIGHTER').toUpperCase();

        // Helper to draw a sprite centered at (px, py) with given height & optional flip/rotation
        const drawCharSprite = (charId, suffix, px, py, targetH, flip = false, rot = 0, tintFlash = null) => {
            const img = imgs[`${charId}${suffix}`] || imgs[`${charId}_special.png`] || imgs[`${charId}_right.png`];
            if (!img || !(img.naturalHeight || img.height)) return;
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const scale = targetH / ih;
            const dw = iw * scale;
            const dh = ih * scale;
            ctx.save();
            ctx.translate(px, py);
            if (rot) ctx.rotate(rot);
            if (flip) ctx.scale(-1, 1);
            if (tintFlash) {
                ctx.shadowColor = tintFlash;
                ctx.shadowBlur = 35;
            }
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        };

        // ─── PHASE 1 (0.0s .. 1.05s): DRAMATIC CLOSE-UP CUT-IN & FINISHER TITLE ───
        if (timer < 1.05) {
            const p = timer / 1.05;
            const slide = 1 - Math.pow(1 - Math.min(1, timer / 0.25), 3);

            // Giant diagonal slash banner behind portrait
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-0.12);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(-w, -180, w * 2, 360);
            ctx.strokeStyle = fin.color1;
            ctx.lineWidth = 6;
            ctx.strokeRect(-w, -180, w * 2, 360);
            ctx.restore();

            // Extreme Close-Up Portrait / Stance Zoom
            const portrait = imgs[`${atkId}_front.png`] || imgs[`${atkId}_special.png`] || imgs[`${atkId}_right.png`];
            if (portrait && (portrait.naturalHeight || portrait.height)) {
                const iw = portrait.naturalWidth || portrait.width;
                const ih = portrait.naturalHeight || portrait.height;
                const scale = (680 + p * 90) / ih;
                const dw = iw * scale;
                const dh = ih * scale;
                ctx.save();
                ctx.shadowColor = fin.color1;
                ctx.shadowBlur = 40;
                ctx.drawImage(portrait, (cx - 280 * slide) - dw / 2, cy - dh * 0.42, dw, dh);
                ctx.restore();
            }

            // Finisher Title Typography
            ctx.save();
            ctx.textAlign = 'left';
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillStyle = fin.color2;
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 14;
            ctx.fillText(`⚡ ${atkName} FINISHER MOVE ⚡`, cx - 120, cy - 70);

            ctx.font = 'bold 40px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = fin.color1;
            ctx.shadowBlur = 24;
            ctx.fillText(fin.title, cx - 120, cy + 5);

            ctx.font = 'bold 20px "Press Start 2P"';
            ctx.fillStyle = fin.color1;
            ctx.fillText(fin.subtitle, cx - 120, cy + 58);
            ctx.restore();
        }
        // ─── PHASE 2 (1.05s .. 2.75s): CUSTOM FIGHTER CHOREOGRAPHY + X-RAY IMPACT ───
        else if (timer < 2.75) {
            const t2 = timer - 1.05; // 0.0 to 1.70s
            const isXRayMoment = (t2 >= 0.95 && t2 <= 1.28);

            // X-RAY / MORTAL KOMBAT BONE-SHOCKWAVE NEGATIVE FLASH!
            if (isXRayMoment) {
                ctx.fillStyle = (Math.floor(t2 * 40) % 2 === 0) ? '#ffffff' : '#12001a';
                ctx.fillRect(0, 0, w, h);
            }

            if (fin.style === 'KATANA_SLASH') {
                // High-speed samurai/blade blitz across dark screen with 9 criss-crossing razor beams
                const dashX = cx - 380 + Math.min(1, t2 / 0.55) * 760;
                drawCharSprite(defId, '_hit.png', cx + 80, cy + 60, 470, true, isXRayMoment ? 0.18 : 0, '#ff0044');
                drawCharSprite(atkId, '_dragon_uppercut.png', dashX, cy + 40, 490, false, 0, fin.color1);

                // Criss-crossing blade slash lines
                const numSlashes = Math.min(10, Math.floor(t2 * 9) + 1);
                ctx.save();
                for (let s = 0; s < numSlashes; s++) {
                    const ang = (s * 1.17) - 0.8;
                    ctx.strokeStyle = (s % 2 === 0) ? '#ffffff' : fin.color1;
                    ctx.shadowColor = fin.color1;
                    ctx.shadowBlur = 25;
                    ctx.lineWidth = isXRayMoment ? 12 : 7;
                    ctx.beginPath();
                    ctx.moveTo(cx + 80 - Math.cos(ang) * 480, cy - Math.sin(ang) * 480);
                    ctx.lineTo(cx + 80 + Math.cos(ang) * 480, cy + Math.sin(ang) * 480);
                    ctx.stroke();
                }
                ctx.restore();
            } else if (fin.style === 'SKY_SUPLEX') {
                // Launches opponent into the stratosphere and slams them head-first into a fiery crater!
                const arc = Math.sin(Math.min(1, t2 / 1.15) * Math.PI);
                const yOffset = -arc * 360;
                const slamHit = t2 >= 1.05;
                drawCharSprite(defId, slamHit ? '_ko.png' : '_hit.png', cx + 40, cy + 80 + yOffset, 460, true, slamHit ? Math.PI : t2 * 4, fin.color2);
                drawCharSprite(atkId, '_axe_kick.png', cx - 30, cy + 30 + yOffset, 490, false, 0, fin.color1);

                if (slamHit) {
                    // Ground crater explosion rings
                    ctx.save();
                    ctx.strokeStyle = fin.color2;
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.ellipse(cx + 20, cy + 230, (t2 - 1.0) * 680, (t2 - 1.0) * 140, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            } else if (fin.style === 'SHADOW_CLONES') {
                // 3 Shadow Clones surround the victim from Left, Right, and Above!
                drawCharSprite(defId, '_hit.png', cx, cy + 60, 460, true, isXRayMoment ? -0.2 : 0, '#ff0055');
                const converge = Math.min(1, t2 / 0.75);
                const dist = 420 - converge * 250;
                ctx.save();
                ctx.globalAlpha = 0.78;
                drawCharSprite(atkId, '_dive_kick.png', cx - dist, cy - 90, 440, false, 0.2, fin.color1);
                drawCharSprite(atkId, '_axe_kick.png', cx + dist, cy - 90, 440, true, -0.2, fin.color2);
                ctx.restore();
                drawCharSprite(atkId, '_special.png', cx - 95, cy + 55, 490, false, 0, fin.color1);
            } else if (fin.style === 'THUNDER_HAMMER') {
                // Giant Bifrost Lightning bolts strike from the sky as Vikingo brings the Hammer down!
                const dropY = Math.min(0, -320 + t2 * 480);
                drawCharSprite(defId, '_hit.png', cx + 140, cy + 75, 460, true, isXRayMoment ? 0.25 : 0, fin.color2);
                drawCharSprite(atkId, '_special.png', cx - 120, cy + 45 + dropY, 510, false, 0, fin.color1);

                // Jagged lightning bolts from top of screen onto defender
                ctx.save();
                ctx.strokeStyle = '#ffffff';
                ctx.shadowColor = fin.color1;
                ctx.shadowBlur = 30;
                ctx.lineWidth = 9;
                for (let b = 0; b < 3; b++) {
                    ctx.beginPath();
                    let lx = cx + 110 + (b - 1) * 55;
                    ctx.moveTo(lx, 0);
                    for (let seg = 1; seg <= 6; seg++) {
                        lx += (Math.sin(t2 * 35 + seg * 2 + b) * 42);
                        ctx.lineTo(lx, (cy + 140) * (seg / 6));
                    }
                    ctx.stroke();
                }
                ctx.restore();
            } else if (fin.style === 'BULLET_BARRAGE') {
                // Noir Muzzle-Flash Gatling Barrage + Explosions on target
                drawCharSprite(atkId, '_special.png', cx - 320, cy + 65, 490, false, 0, fin.color1);
                drawCharSprite(defId, '_hit.png', cx + 220 + Math.sin(t2 * 50) * 18, cy + 65, 460, true, 0, '#ff2200');

                ctx.save();
                for (let i = 0; i < 12; i++) {
                    const by = cy - 90 + ((i * 37 + t2 * 900) % 240);
                    ctx.strokeStyle = (i % 2 === 0) ? '#ffee55' : '#ff5500';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(cx - 140, by);
                    ctx.lineTo(cx + 260, by + (Math.random() - 0.5) * 30);
                    ctx.stroke();
                }
                ctx.restore();
            } else if (fin.style === 'TORNADO_KICKS') {
                // Spinning Emerald/Gold Hurricane Vortex lifting the enemy
                const spinFlip = Math.floor(t2 * 16) % 2 === 0;
                drawCharSprite(defId, '_hit.png', cx + 90, cy - 20 + Math.sin(t2 * 25) * 35, 450, spinFlip, t2 * 6, fin.color2);
                drawCharSprite(atkId, '_hurricane_kick.png', cx - 40, cy + 30, 490, spinFlip, 0, fin.color1);

                ctx.save();
                ctx.strokeStyle = fin.color1;
                ctx.shadowColor = fin.color2;
                ctx.shadowBlur = 20;
                ctx.lineWidth = 6;
                for (let r = 0; r < 6; r++) {
                    const ry = cy + 180 - r * 65;
                    const rw = 120 + r * 45;
                    ctx.beginPath();
                    ctx.ellipse(cx + 50, ry, rw, 26, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
            } else {
                // SOLAR_NOVA / ORBITAL_BEAM / DRAGON_RUSH / CHAKRA_LOTUS / ALCHEMY_VOID:
                // Colossal Kamehameha / Supernova Beam across the entire cinema screen!
                drawCharSprite(atkId, '_special.png', cx - 360, cy + 55, 500, false, 0, fin.color1);
                drawCharSprite(defId, '_hit.png', cx + 290 + Math.sin(t2 * 45) * 16, cy + 60, 460, true, isXRayMoment ? 0.22 : 0, fin.color2);

                const beamLen = Math.min(w, t2 * 1500);
                const beamH = 130 + Math.sin(t2 * 30) * 28;
                ctx.save();
                const beamGrad = ctx.createLinearGradient(cx - 220, cy - beamH / 2, cx - 220, cy + beamH / 2);
                beamGrad.addColorStop(0, 'rgba(255,255,255,0)');
                beamGrad.addColorStop(0.2, fin.color1);
                beamGrad.addColorStop(0.5, '#ffffff');
                beamGrad.addColorStop(0.8, fin.color2);
                beamGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = beamGrad;
                ctx.fillRect(cx - 220, cy - beamH / 2 + 10, beamLen, beamH);

                // Giant glowing orb at impact point
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = fin.color1;
                ctx.shadowBlur = 45;
                ctx.beginPath();
                ctx.arc(Math.min(cx + 290, cx - 220 + beamLen), cy + 10, beamH * 0.65, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // X-Ray Impact Callout Banner
            if (isXRayMoment) {
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = 'bold 54px "Press Start 2P"';
                ctx.fillStyle = '#ff0044';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.strokeText('CRITICAL FINISHER IMPACT!', cx, 185);
                ctx.fillText('CRITICAL FINISHER IMPACT!', cx, 185);
                ctx.restore();
            }
        }
        // ─── PHASE 3 (2.75s .. 3.80s): FINAL CLIMAX POSE & "LEGENDARY FINISH!" STAMP ───
        else {
            const t3 = timer - 2.75;
            const flashAlpha = Math.max(0, 1 - t3 * 3.2);

            // Expanding shockwave rings behind victory pose
            ctx.save();
            ctx.strokeStyle = fin.color1;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(cx, cy + 40, 120 + t3 * 520, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Loser knocked out flat on the right, Winner in heroic Win pose on the left/center
            drawCharSprite(defId, '_ko.png', cx + 280, cy + 185, 420, true, 0, null);
            drawCharSprite(atkId, '_win.png', cx - 120, cy + 55, 530, false, 0, fin.color2);

            // Mortal Kombat style "LEGENDARY FINISH!" Slam Stamp
            const stampScale = Math.max(1.0, 2.2 - t3 * 4.5);
            ctx.save();
            ctx.translate(cx, 210);
            ctx.scale(stampScale, stampScale);
            ctx.textAlign = 'center';
            ctx.font = 'bold 64px "Press Start 2P"';
            ctx.fillStyle = '#ff0033';
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 28;
            ctx.strokeText('MORTAL FINISHER!', 0, 0);
            ctx.fillText('MORTAL FINISHER!', 0, 0);

            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${atkName} · ${fin.title}`, 0, 52);
            ctx.restore();

            if (flashAlpha > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.fillRect(0, 0, w, h);
            }
        }

        // ─── 21:9 CINEMA WIDESCREEN LETTERBOX BARS (TOP & BOTTOM) ───
        const barH = 112;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, barH);
        ctx.fillRect(0, h - barH, w, barH);

        ctx.strokeStyle = fin.color1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, barH);
        ctx.lineTo(w, barH);
        ctx.moveTo(0, h - barH);
        ctx.lineTo(w, h - barH);
        ctx.stroke();

        // Cinema Header & Footer captions inside Letterbox Bars
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillStyle = fin.color2;
        ctx.fillText(`🎬 CINEMATIC FINISHER · ${fin.title}`, cx, 64);

        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${atkName}: ${fin.subtitle}`, cx, h - 48);

        ctx.restore();
    }
}
