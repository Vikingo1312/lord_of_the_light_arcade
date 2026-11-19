import { ROSTER, ALL_FIGHTERS, STAGES, UNLOCK_CHAIN_GUIDE, isFighterUnlocked, getFighterStyle } from '../data.js?v=2.53';
import { STORY_PROLOGUE } from '../story_data.js?v=2.53';
import { preloadFighterSprites, preloadStageAssets } from '../core/AssetPreloader.js?v=2.53';
import { getFinisherMove } from '../fx/CinematicFinisher.js?v=2.53';

export default class MenuState {
    constructor(game) {
        this.game = game;
        this.options = ['STORY', 'ARCADE', 'VERSUS', 'TRAINING / DOJO', 'SURVIVAL', 'ONLINE & KOOP', 'OPTIONEN'];
        this.selectedIndex = 0;
        this.inputCooldown = 0;
        this.time = 0;
        this.bgMusic = null;

        // Credits system
        this.credits = 3;
        this.maxCredits = 3;
        this.coinAngle = 0;

        // Story completion flag (unlocks Arcade/Versus)
        this.storyCompleted = false;

        // Sub-menu state
        this.inOptions = false;
        this.optionsTab = 'mixer'; // 'mixer' | 'combos' | 'unlocks'
        this.optionIndex = 0;
        this.comboIndex = 0;
        this.comboCharIndex = 0;
        this.unlockGuideIndex = 0;
        this.comboPreviewTimer = 0;
        this.isTransitioning = false;
        this._draggingSlider = false;
        this._lastTapAt = 0;

        this.universalCombos = [
            {
                name: '4. TORPEDO FLIGHT (→ + S)',
                input: '→ + S (L)  oder  ← → + P (J)',
                badges: ['→', '+', 'S'],
                dmg: '3x 16 DMG · FULL-SCREEN SIGNATURE MOVE',
                desc: 'Katapultiert deinen Kämpfer horizontal über den ganzen Bildschirm (Torpedo / Psycho Crusher / Bird Kick / Lariat / Cannonball)!',
                frames: [
                    { suffix: '_windup_punch.png', dur: 0.12, x: 10, y: -15 },
                    { suffix: '_dive_kick.png', dur: 0.20, x: 64, y: -42, slash: 'cyan', hit: 'TORPEDO 1!' },
                    { suffix: '_special.png', dur: 0.22, x: 112, y: -42, slash: 'gold', hit: 'TORPEDO 2!' },
                    { suffix: '_dive_kick.png', dur: 0.22, x: 152, y: -38, slash: 'super', hit: 'CRUSHER!!' },
                    { suffix: '_right.png', dur: 0.36, x: 0, y: 0 }
                ]
            },
            {
                name: '5. FULLSCREEN 4-HIT RUSH (← + S)',
                input: '← + S (L)  oder  P + S (J + L)',
                badges: ['←', '+', 'S'],
                dmg: '4x 14 DMG · 4-HIT RUSH + LAUNCHER',
                desc: 'Stürmt über die gesamte Stage mit einer automatischen 4-Pose Street-Fighter-Kombo bis zum Shoryuken-Finisher!',
                frames: [
                    { suffix: '_hurricane_kick.png', dur: 0.16, x: 42, y: -25, slash: 'cyan', hit: 'RUSH 1!' },
                    { suffix: '_punch.png', dur: 0.16, x: 76, y: 0, slash: 'gold', hit: 'RUSH 2!' },
                    { suffix: '_hook_punch.png', dur: 0.18, x: 106, y: 0, slash: 'fire', hit: 'RUSH 3!' },
                    { suffix: '_dragon_uppercut.png', dur: 0.30, x: 132, y: -95, slash: 'super', hit: '4 HIT FINISH!!' },
                    { suffix: '_right.png', dur: 0.36, x: 0, y: 0 }
                ]
            },
            {
                name: '6. UNBLOCKBARER WURF / THROW (← + P)',
                input: '← + P (J) im Nahkampf  oder  P + K',
                badges: ['←', '+', 'P'],
                dmg: '45 DMG · BRICHT JEDE DECKUNG!',
                desc: 'Packt den Gegner im Nahkampf und schleudert ihn quer durch die Arena — kann nicht geblockt werden!',
                frames: [
                    { suffix: '_windup_punch.png', dur: 0.14, x: 18, y: 0 },
                    { suffix: '_hook_punch.png', dur: 0.26, x: 58, y: 0, slash: 'gold', hit: 'THROW SLAM!' },
                    { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
                ]
            },
            {
                name: '7. OVERHEAD BACKFIST & AXE KICK (→ + P / K)',
                input: '→ + P (J)  oder  → + K (Vorwärts + Kick)',
                badges: ['→', '+', 'K'],
                dmg: '42 DMG · BRICHT DUCK-BLOCK!',
                desc: 'Mächtiger Überkopf-Schlag oder Axt-Tritt von oben — bricht jede geduckte Deckung sofort!',
                frames: [
                    { suffix: '_windup_kick.png', dur: 0.16, x: 18, y: 0 },
                    { suffix: '_axe_kick.png', dur: 0.28, x: 62, y: -18, slash: 'fire', hit: 'OVERHEAD!' },
                    { suffix: '_kick.png', dur: 0.22, x: 70, y: 0 },
                    { suffix: '_right.png', dur: 0.42, x: 0, y: 0 }
                ]
            },
            {
                name: '8. LOW SWEEP FUSSFEGER (↓ + K)',
                input: '↓ + K  (Unten + Kick)',
                badges: ['↓', '+', 'K'],
                dmg: '32 DMG · BRICHT STEH-BLOCK!',
                desc: 'Tiefer Fußfeger am Boden — wirft stehend blockende Gegner sofort um!',
                frames: [
                    { suffix: '_crouch.png', dur: 0.16, x: 0, y: 0 },
                    { suffix: '_low_kick.png', dur: 0.34, x: 68, y: 0, slash: 'cyan', hit: 'SWEEP!' },
                    { suffix: '_crouch.png', dur: 0.20, x: 20, y: 0 },
                    { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
                ]
            },
            {
                name: '9. DRAGON UPPERCUT (↑ + P / ↑ + S)',
                input: '↑ + P (J)  oder  ↑ + S (L)',
                badges: ['↑', '+', 'P'],
                dmg: '46 DMG · UNVERWUNDBAR GEGEN SPRÜNGE',
                desc: 'Aufsteigender Drachen-Uppercut in die Luft! Perfekt als Konter gegen springende Gegner.',
                frames: [
                    { suffix: '_windup_punch.png', dur: 0.14, x: 10, y: 0 },
                    { suffix: '_uppercut.png', dur: 0.18, x: 42, y: -45, slash: 'fire', hit: 'RISING!' },
                    { suffix: '_dragon_uppercut.png', dur: 0.34, x: 68, y: -115, slash: 'super', hit: 'SHORYUKEN!' },
                    { suffix: '_jump.png', dur: 0.22, x: 50, y: -45 },
                    { suffix: '_right.png', dur: 0.35, x: 0, y: 0 }
                ]
            },
            {
                name: '10. HURRICANE KICK (← + K / ↓ + S)',
                input: '← + K  oder  ↓ + S (L)',
                badges: ['←', '+', 'K'],
                dmg: '3x 18 DMG · 3-TREFFER WIRBELKICK',
                desc: 'Fliegender Wirbelsturm-Kick quer über die Stage mit bis zu 3 Treffern hintereinander!',
                frames: [
                    { suffix: '_jump.png', dur: 0.12, x: 15, y: -35 },
                    { suffix: '_hurricane_kick.png', dur: 0.18, x: 52, y: -55, slash: 'cyan', hit: 'HIT 1!' },
                    { suffix: '_spin_kick.png', dur: 0.18, x: 88, y: -55, slash: 'gold', hit: 'HIT 2!' },
                    { suffix: '_dive_kick.png', dur: 0.20, x: 120, y: -45, slash: 'fire', hit: 'HIT 3!' },
                    { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
                ]
            }
        ];
        this.comboShowList = this.universalCombos;

        // Ensure all mixer channels exist in game.settings
        Object.assign(this.game.settings, {
            timer: this.game.settings.timer || 99,
            speed: this.game.settings.speed || 1.0,
            difficulty: this.game.settings.difficulty || 'NORMAL',
            masterVolume: this.game.settings.masterVolume ?? 1.0,
            musicVolume: this.game.settings.musicVolume ?? 0.22,
            sfxVolume: this.game.settings.sfxVolume ?? 0.90,
            voiceVolume: this.game.settings.voiceVolume ?? 1.00,
            announcerVolume: this.game.settings.announcerVolume ?? 0.95,
        });

        // Ambient Background Particles
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                speed: 0.02 + Math.random() * 0.05,
                size: 2 + Math.random() * 5,
                alpha: Math.random(),
                wobble: Math.random() * Math.PI * 2
            });
        }
        // Mobile tap & drag handlers (bound references for cleanup)
        this._onMenuTap = null;
        this._onMenuMove = null;
        this._onMenuUp = null;
    }

    enter(data) {
        console.log("Entering Main Menu");
        this.selectedIndex = 0;
        this.inputCooldown = 15;
        this.inOptions = false;
        this.optionsTab = 'mixer';
        this.comboPreviewTimer = 0;
        this._tapConfirmPending = false;
        this.isTransitioning = false;
        this._draggingSlider = false;

        // Preload Keano sprites and all fighter portraits so Combo Live-Preview & Unlock Guide are ready immediately
        if (ALL_FIGHTERS && ALL_FIGHTERS[0]) {
            preloadFighterSprites(this.game.assetManager, ALL_FIGHTERS[0]);
            for (const f of ALL_FIGHTERS) {
                const key = `${f.id}_front.png`;
                if (!this.game.assetManager.images[key]) {
                    this.game.assetManager.queueImage(key, `assets/CHARACTERS/${f.folder}/_front.png?v=2.53`);
                }
            }
            this.game.assetManager.loadAll();
        }

        // Check story completion
        try {
            this.storyCompleted = localStorage.getItem('lotl_story_complete') === 'true';
        } catch (e) { this.storyCompleted = false; }

        // Play main theme — start quiet and fade in gently to user's configured musicVolume
        this.game.audioManager.playBGM('assets/audio/music/main_soundtrack.mp3', true, false, 0.02);
        this._fadeInTimer = 0;
        this._fadeInTarget = this.game.settings.musicVolume ?? 0.22;

        // Setup direct tap & slider drag on menu for mobile & desktop
        this._setupMenuTap();
    }

    exit() {
        this._removeMenuTap();
    }

    _mapEventToCanvas(e) {
        const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
        if (typeof window.mapTouchToCanvas === 'function') {
            return window.mapTouchToCanvas(this.game.canvas, touch.clientX, touch.clientY);
        }
        const rect = this.game.canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) * (this.game.canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (this.game.canvas.height / rect.height)
        };
    }

    _getComboListForFighter(fighter) {
        const style = getFighterStyle(fighter);
        let sig1Frames, sig2Frames;

        if (style.id === 'KNEIPEN_TERRORIST') {
            sig1Frames = [
                { suffix: '_windup_punch.png', dur: 0.16, x: 18, y: 0 },
                { suffix: '_punch.png', dur: 0.22, x: 44, y: 0, slash: 'gold', hit: 'PFANNEN-HIT!' },
                { suffix: '_hook_punch.png', dur: 0.24, x: 74, y: -12, slash: 'fire', hit: 'ÜBERKOPF-SMASH!' },
                { suffix: '_axe_kick.png', dur: 0.30, x: 102, y: -22, slash: 'super', hit: 'DECKUNG GEBROCHEN!' },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_punch.png', dur: 0.18, x: 32, y: 0, slash: 'gold', hit: 'BRATPFANNE!' },
                { suffix: '_kick.png', dur: 0.22, x: 64, y: 0, slash: 'fire', hit: 'SNEAKER STOMP!' },
                { suffix: '_special.png', dur: 0.45, x: 96, y: -12, slash: 'super', hit: 'STEAK HOMERUN!!', proj: true },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
        } else if (style.id === 'TITAN_GRAPPLER') {
            sig1Frames = [
                { suffix: '_punch.png', dur: 0.22, x: 35, y: 0, slash: 'cyan', hit: 'JAB GRIP!' },
                { suffix: '_backfist.png', dur: 0.22, x: 68, y: 0, slash: 'gold', hit: 'LOCK ON!' },
                { suffix: '_hook_punch.png', dur: 0.36, x: 92, y: -22, slash: 'fire', hit: 'TITAN SLAM!!' },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_axe_kick.png', dur: 0.26, x: 52, y: -15, slash: 'gold', hit: 'ARMOR CRUSH!' },
                { suffix: '_kick.png', dur: 0.26, x: 78, y: 0, slash: 'fire', hit: 'BREAKER!' },
                { suffix: '_special.png', dur: 0.38, x: 95, y: -10, slash: 'super', hit: 'UNBLOCKABLE!' },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
        } else if (style.id === 'CAPOEIRA_TRICKSTER') {
            sig1Frames = [
                { suffix: '_low_kick.png', dur: 0.22, x: 36, y: 0, slash: 'cyan', hit: 'KICK 1!' },
                { suffix: '_spin_kick.png', dur: 0.24, x: 68, y: -18, slash: 'gold', hit: 'SPIN KICK 2!' },
                { suffix: '_axe_kick.png', dur: 0.32, x: 96, y: -28, slash: 'fire', hit: 'TRIPLE KICK!!' },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_crouch.png', dur: 0.14, x: 18, y: 0 },
                { suffix: '_low_kick.png', dur: 0.24, x: 58, y: 0, slash: 'cyan', hit: 'LOW SWEEP!' },
                { suffix: '_hurricane_kick.png', dur: 0.28, x: 92, y: -55, slash: 'gold', hit: 'TORNADO!' },
                { suffix: '_dive_kick.png', dur: 0.26, x: 118, y: -35, slash: 'fire', hit: 'VORTEX!' },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
        } else if (style.id === 'SHADOW_ASSASSIN') {
            sig1Frames = [
                { suffix: '_kick.png', dur: 0.20, x: 35, y: 0, slash: 'cyan', hit: 'SHADOW KICK!' },
                { suffix: '_dash_forward.png', dur: 0.14, x: 85, y: -8, slash: 'super', hit: 'PHANTOM WARP!' },
                { suffix: '_backfist.png', dur: 0.22, x: 112, y: 0, slash: 'gold', hit: 'BLITZ STRIKE!' },
                { suffix: '_axe_kick.png', dur: 0.30, x: 128, y: -20, slash: 'fire', hit: 'EXECUTION!!' },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_crouch.png', dur: 0.14, x: 15, y: 0 },
                { suffix: '_low_kick.png', dur: 0.22, x: 60, y: 0, slash: 'cyan', hit: 'DARK SWEEP!' },
                { suffix: '_special.png', dur: 0.42, x: 96, y: -15, slash: 'super', hit: 'ABYSS SURGE!!', proj: true },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
        } else if (style.id === 'VALHALLA_BERSERKER') {
            sig1Frames = [
                { suffix: '_backfist.png', dur: 0.24, x: 42, y: 0, slash: 'gold', hit: 'ARMOR HAMMER!' },
                { suffix: '_hook_punch.png', dur: 0.24, x: 72, y: 0, slash: 'fire', hit: 'THUNDER HOOK!' },
                { suffix: '_axe_kick.png', dur: 0.34, x: 98, y: -24, slash: 'super', hit: 'VALHALLA CRUSH!' },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_punch.png', dur: 0.20, x: 34, y: 0, slash: 'cyan', hit: 'RAGE HIT!' },
                { suffix: '_axe_kick.png', dur: 0.26, x: 68, y: -18, slash: 'gold', hit: 'SUPER ARMOR!' },
                { suffix: '_special.png', dur: 0.42, x: 96, y: -10, slash: 'fire', hit: 'ODIN SMASH!!', proj: true },
                { suffix: '_right.png', dur: 0.40, x: 0, y: 0 }
            ];
        } else if (style.id === 'MASTER_STRIKER') {
            sig1Frames = [
                { suffix: '_punch.png', dur: 0.18, x: 32, y: 0, slash: 'cyan', hit: 'QUICK JAB!' },
                { suffix: '_hook_punch.png', dur: 0.20, x: 60, y: 0, slash: 'gold', hit: 'LONG REACH!' },
                { suffix: '_spin_kick.png', dur: 0.26, x: 88, y: -12, slash: 'fire', hit: 'SPIN KICK!' },
                { suffix: '_axe_kick.png', dur: 0.30, x: 112, y: -22, slash: 'super', hit: 'BLADE FINISHER!' },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_backfist.png', dur: 0.22, x: 48, y: 0, slash: 'gold', hit: 'OVERHEAD!' },
                { suffix: '_spin_kick.png', dur: 0.24, x: 78, y: -15, slash: 'cyan', hit: 'COMBO KICK!' },
                { suffix: '_dragon_uppercut.png', dur: 0.34, x: 102, y: -95, slash: 'fire', hit: 'DRAGON SLASH!!' },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
        } else {
            // LIGHT_DRAGON default
            sig1Frames = [
                { suffix: '_punch.png', dur: 0.18, x: 28, y: 0, slash: 'cyan', hit: 'LIGHT JAB!' },
                { suffix: '_hook_punch.png', dur: 0.20, x: 56, y: 0, slash: 'gold', hit: 'SOLAR HOOK!' },
                { suffix: '_uppercut.png', dur: 0.20, x: 78, y: -45, slash: 'fire', hit: 'LAUNCHER!' },
                { suffix: '_dragon_uppercut.png', dur: 0.34, x: 98, y: -120, slash: 'super', hit: 'SOLAR DRAGON!!' },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
            sig2Frames = [
                { suffix: '_punch.png', dur: 0.18, x: 30, y: 0, slash: 'cyan', hit: 'RADIANT HIT!' },
                { suffix: '_spin_kick.png', dur: 0.22, x: 64, y: -14, slash: 'gold', hit: 'FLASH KICK!' },
                { suffix: '_special.png', dur: 0.44, x: 92, y: -12, slash: 'super', hit: 'LIGHT BEAM!!', proj: true },
                { suffix: '_right.png', dur: 0.38, x: 0, y: 0 }
            ];
        }

        const fMove = getFinisherMove(fighter?.id);

        return [
            {
                name: `1. ${style.sig1Name}`,
                input: style.sig1Input,
                badges: style.sig1Badges,
                dmg: style.sig1Dmg,
                desc: style.sig1Desc,
                isSignature: true,
                styleColor: style.color,
                frames: sig1Frames
            },
            {
                name: `2. ${style.sig2Name}`,
                input: style.sig2Input,
                badges: style.sig2Badges,
                dmg: style.sig2Dmg,
                desc: style.sig2Desc,
                isSignature: true,
                styleColor: style.color,
                frames: sig2Frames
            },
            {
                name: `3. 🎬 ${fMove.name}`,
                input: '[S / SPEZIAL] BEI "FINISH HIM!" (0 HP)',
                badges: ['FINISH', '➔', 'S'],
                dmg: `FINISHER FILM-SEQUENZ · ${fMove.subtitle}`,
                desc: `${fMove.quote} — Wenn der Gegner bei 0 HP taumelt ("FINISH HIM!"), drücke [S] oder [P/K] für die 21:9 Kino-Sequenz!`,
                isSignature: true,
                styleColor: fMove.color1 || '#ff2244',
                frames: [
                    { suffix: '_windup_punch.png', dur: 0.22, x: 18, y: 0, slash: 'gold', hit: 'FINISH HIM!' },
                    { suffix: '_dragon_uppercut.png', dur: 0.26, x: 64, y: -45, slash: 'fire', hit: 'X-RAY IMPACT!' },
                    { suffix: '_special.png', dur: 0.45, x: 105, y: -15, slash: 'super', hit: fMove.name, proj: true },
                    { suffix: '_win.png', dur: 0.55, x: 50, y: 0, hit: 'MORTAL FINISHER!!' }
                ]
            },
            ...this.universalCombos
        ];
    }

    _cycleComboPreviewChar(dir) {
        const list = ALL_FIGHTERS && ALL_FIGHTERS.length ? ALL_FIGHTERS : ROSTER;
        this.comboCharIndex = (this.comboCharIndex + dir + list.length) % list.length;
        const fighter = list[this.comboCharIndex];
        if (fighter) {
            preloadFighterSprites(this.game.assetManager, fighter);
            this.game.assetManager.loadAll();
        }
        this.comboPreviewTimer = 0;
        this.playBlip();
    }

    _handleOptionsPointer(tx, ty, isDrag = false) {
        const cx = this.game.width / 2;

        // Top-left back button or bottom back area
        if (!isDrag && ((tx >= cx - 640 && tx <= cx - 415 && ty >= 52 && ty <= 110) || ty >= this.game.height - 88)) {
            this.inOptions = false;
            this.inputCooldown = 15;
            this.playBlip();
            return;
        }

        // Top 3 Tab Switcher Buttons (y: 52..110)
        if (!isDrag && ty >= 50 && ty <= 112) {
            if (tx >= cx - 405 && tx <= cx - 70) {
                this.optionsTab = 'mixer';
                this.playConfirm();
                return;
            } else if (tx > cx - 65 && tx <= cx + 275) {
                this.optionsTab = 'combos';
                this.comboPreviewTimer = 0;
                this.playConfirm();
                return;
            } else if (tx > cx + 280 && tx <= cx + 635) {
                this.optionsTab = 'unlocks';
                this.playConfirm();
                return;
            }
        }

        if (this.optionsTab === 'unlocks') {
            if (isDrag) return;
            // Check tap on 2x6 Unlock Guide Cards
            const startY = 204;
            const rowStep = 97;
            const col0X = cx - 620;
            const col1X = cx + 10;
            const cardW = 610;
            const cardH = 90;
            for (let i = 0; i < UNLOCK_CHAIN_GUIDE.length; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const x = col === 0 ? col0X : col1X;
                const y = startY + row * rowStep;
                if (tx >= x && tx <= x + cardW && ty >= y && ty <= y + cardH) {
                    this.unlockGuideIndex = i;
                    this.playConfirm();
                    return;
                }
            }
            return;
        }

        if (this.optionsTab === 'combos') {
            if (isDrag) return;
            // Check tap on Left Combo List (10 items, x: cx - 620 .. cx - 40, y: 235 .. 875)
            const listStartY = 250;
            const listStep = 62;
            if (tx >= cx - 630 && tx <= cx - 20) {
                for (let i = 0; i < this.comboShowList.length; i++) {
                    const ry = listStartY + i * listStep;
                    if (ty >= ry - 28 && ty <= ry + 28) {
                        this.comboIndex = i;
                        this.comboPreviewTimer = 0;
                        this.playConfirm();
                        return;
                    }
                }
            }
            // Check tap on Right Preview Box Fighter Switcher (x: cx + 20 .. cx + 620, y: 225 .. 290)
            if (tx >= cx + 20 && tx <= cx + 620 && ty >= 220 && ty <= 300) {
                const dir = tx < cx + 320 ? -1 : 1;
                this._cycleComboPreviewChar(dir);
                return;
            }
            // Tapping on the stage preview replays the combo
            if (tx >= cx + 20 && tx <= cx + 620 && ty > 300 && ty < 860) {
                this.comboPreviewTimer = 0;
                this.playBlip();
                return;
            }
            return;
        }

        const startY = 186;
        const rowStep = 54;
        const barX = cx - 40;
        const barW = 360;

        for (let i = 0; i < 12; i++) {
            const rowY = startY + i * rowStep;
            if (ty >= rowY - 26 && ty <= rowY + 22 && tx >= cx - 560 && tx <= cx + 560) {
                this.optionIndex = i;
                // Rows 0..4 are volume faders
                if (i >= 0 && i <= 4) {
                    const maxVal = (i === 1) ? 1.0 : 1.5;
                    if (tx >= barX - 12 && tx <= barX + barW + 12) {
                        const ratio = Math.max(0, Math.min(1, (tx - barX) / barW));
                        const stepped = Math.round(ratio * maxVal * 20) / 20;
                        this._setSliderValue(i, stepped, !isDrag);
                        this._draggingSlider = true;
                        return;
                    } else if (!isDrag) {
                        const dir = tx < barX ? -1 : 1;
                        this.adjustOption(dir);
                        return;
                    }
                } else if (!isDrag) {
                    if (i === 8) {
                        this.optionsTab = 'combos';
                        this.comboPreviewTimer = 0;
                        this.playConfirm();
                    } else if (i === 9) {
                        this.optionsTab = 'unlocks';
                        this.playConfirm();
                    } else if (i === 10) {
                        this.game.resetAudioMixDefaults?.();
                        this._fadeInTarget = this.game.settings.musicVolume;
                        this.playConfirm();
                        this.game.audioManager?.playHitImpactSound?.(true, true);
                    } else if (i === 11) {
                        this.inOptions = false;
                        this.inputCooldown = 15;
                        this.playBlip();
                    } else {
                        const dir = tx < cx ? -1 : 1;
                        this.adjustOption(dir);
                    }
                    return;
                }
            }
        }
    }

    _setSliderValue(rowIndex, val, playPreview = true) {
        const s = this.game.settings;
        if (rowIndex === 0) {
            s.masterVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 1) {
            s.musicVolume = Math.max(0, Math.min(1.0, val));
            this._fadeInTarget = s.musicVolume;
            this._fadeInTimer = 2.0;
        } else if (rowIndex === 2) {
            s.sfxVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 3) {
            s.voiceVolume = Math.max(0, Math.min(1.5, val));
        } else if (rowIndex === 4) {
            s.announcerVolume = Math.max(0, Math.min(1.5, val));
        }
        this.game.saveSettings?.();

        if (playPreview) {
            const now = performance.now();
            if (!this._lastPreviewAt || now - this._lastPreviewAt > 220) {
                this._lastPreviewAt = now;
                if (rowIndex === 2) {
                    this.game.audioManager?.playHitImpactSound?.(true, false);
                } else if (rowIndex === 3) {
                    this.game.audioManager?.playFighterVoice?.('assets/audio/voice/keano_special.mp3', 'special');
                } else if (rowIndex === 4) {
                    this.game.audioManager?.playAnnouncerVoice?.('assets/audio/voice/announcer_fight.mp3');
                }
            }
        }
    }

    /**
     * Direct tap & slider drag support for mobile & desktop.
     */
    _setupMenuTap() {
        this._removeMenuTap();

        this._onMenuTap = (e) => {
            const now = performance.now();
            if (e.type === 'touchend') {
                this._lastTapAt = now;
            } else if (e.type === 'click' && now - this._lastTapAt < 400) {
                return;
            }

            const pt = this._mapEventToCanvas(e);
            const tx = pt.x;
            const ty = pt.y;

            // Unlock audio on any tap
            if (this.game.audioManager.unlockAudio) {
                this.game.audioManager.unlockAudio();
            }

            if (this.inOptions) {
                this._handleOptionsPointer(tx, ty, false);
                return;
            }

            // INSERT COIN: if no credits, any tap adds coins
            if (this.credits <= 0) {
                this.credits = this.maxCredits;
                this.inputCooldown = 15;
                return;
            }

            // Check if tap hits a menu item
            const menuStartY = this.game.height * 0.56;
            const itemHeight = 46;
            const hitPadding = 22;

            for (let i = 0; i < this.options.length; i++) {
                const itemY = menuStartY + (i * itemHeight);
                if (ty >= itemY - hitPadding && ty <= itemY + hitPadding) {
                    this.selectedIndex = i;
                    this._tapConfirmPending = true;
                    return;
                }
            }
        };

        this._onMenuMove = (e) => {
            if (!this.inOptions) return;
            if (e.type === 'mousemove' && e.buttons !== 1 && !this._draggingSlider) return;
            const pt = this._mapEventToCanvas(e);
            this._handleOptionsPointer(pt.x, pt.y, true);
        };

        this._onMenuUp = () => {
            this._draggingSlider = false;
        };

        this.game.canvas.addEventListener('touchend', this._onMenuTap, { passive: true });
        this.game.canvas.addEventListener('click', this._onMenuTap, { passive: true });
        this.game.canvas.addEventListener('touchmove', this._onMenuMove, { passive: true });
        this.game.canvas.addEventListener('mousemove', this._onMenuMove, { passive: true });
        window.addEventListener('mouseup', this._onMenuUp, { passive: true });
        window.addEventListener('touchend', this._onMenuUp, { passive: true });
    }

    _removeMenuTap() {
        if (this._onMenuTap) {
            this.game.canvas.removeEventListener('touchend', this._onMenuTap);
            this.game.canvas.removeEventListener('click', this._onMenuTap);
            this._onMenuTap = null;
        }
        if (this._onMenuMove) {
            this.game.canvas.removeEventListener('touchmove', this._onMenuMove);
            this.game.canvas.removeEventListener('mousemove', this._onMenuMove);
            this._onMenuMove = null;
        }
        if (this._onMenuUp) {
            window.removeEventListener('mouseup', this._onMenuUp);
            window.removeEventListener('touchend', this._onMenuUp);
            this._onMenuUp = null;
        }
    }

    update(dt) {
        if (this.isTransitioning) return;

        this.time += dt;
        this.coinAngle += dt * 3;

        // Update ambient particles
        for (const p of this.particles) {
            p.y -= p.speed * dt;
            p.wobble += dt;
            p.x += Math.sin(p.wobble) * 0.0005;
            if (p.y < 0) {
                p.y = 1;
                p.x = Math.random();
            }
        }

        // Smooth BGM fade-in over 2 seconds to user's configured musicVolume
        if (this._fadeInTimer !== undefined && this._fadeInTimer < 2.0) {
            this._fadeInTimer += dt;
            this._fadeInTarget = this.game.settings.musicVolume ?? 0.22;
            const vol = Math.min(this._fadeInTarget, (this._fadeInTimer / 2.0) * this._fadeInTarget);
            if (this.game.audioManager.gainNode && this.game.audioManager.audioCtx) {
                this.game.audioManager.gainNode.gain.setTargetAtTime(vol, this.game.audioManager.audioCtx.currentTime, 0.1);
            } else if (this.game.audioManager.bgm) {
                try { this.game.audioManager.bgm.volume = vol; } catch (e) { }
            }
        }

        const p1 = this.game.inputManager.p1;

        // Unlock hidden channels on first user interaction
        if (p1.lJust || p1.hJust || p1.sJust || p1.up || p1.down || p1.left || p1.right) {
            if (this.game.audioManager.unlockAudio) {
                this.game.audioManager.unlockAudio();
            }
        }

        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }

        if (this.inOptions) {
            this.comboPreviewTimer += dt;
            this.updateOptions(p1);
            return;
        }

        if (this.inputCooldown <= 0) {
            if (p1.up) {
                this.selectedIndex--;
                if (this.selectedIndex < 0) this.selectedIndex = this.options.length - 1;
                this.inputCooldown = 15;
                this.playBlip();
            } else if (p1.down) {
                this.selectedIndex++;
                if (this.selectedIndex > this.options.length - 1) this.selectedIndex = 0;
                this.inputCooldown = 15;
                this.playBlip();
            }
        }

        // Confirm via controller buttons OR direct tap on menu item
        const confirmPressed = (p1.h || p1.l || p1.s) && this.inputCooldown <= 0;
        const tapConfirm = this._tapConfirmPending;
        this._tapConfirmPending = false;

        if (confirmPressed || tapConfirm) {
            if (this.credits <= 0) return;

            if (this.selectedIndex === 0) {
                // STORY MODE — if story completed or special fighters unlocked, let player pick their fighter (e.g. Annikina!) for the Story run
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
                if (this.storyCompleted || isFighterUnlocked('Annikina')) {
                    this.game.audioManager.stopBGM();
                    setTimeout(() => {
                        this.game.stateManager.switchState('CharSelect', { arcadeMode: true, storyMode: true });
                    }, 400);
                } else {
                    this.startStoryMode();
                }
            } else if (this.selectedIndex === 1) {
                // ARCADE MODE (Shuffle Challenger Mode with all 26 fighters & their Arenas!) — locked until story complete
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: true, storyMode: false });
                }, 500);
            } else if (this.selectedIndex === 2) {
                // VERSUS MODE — locked until story complete
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: false });
                }, 500);
            } else if (this.selectedIndex === 3) {
                // TRAINING / DOJO — always unlocked for everyone!
                this.playConfirm();
                this.inputCooldown = 40;
                this.isTransitioning = true;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: false, trainingMode: true });
                }, 350);
            } else if (this.selectedIndex === 4) {
                // SURVIVAL MODE — locked until story complete!
                if (!this.storyCompleted) return;
                this.playConfirm();
                this.inputCooldown = 60;
                this.credits--;
                this.isTransitioning = true;
                this.game.audioManager.stopBGM();
                setTimeout(() => {
                    this.game.stateManager.switchState('CharSelect', { arcadeMode: true, storyMode: false, survivalMode: true });
                }, 400);
            } else if (this.selectedIndex === 5) {
                // ONLINE / KOOP — always available
                this.playConfirm();
                this.inputCooldown = 30;
                this.isTransitioning = true;
                setTimeout(() => {
                    this.game.stateManager.switchState('OnlineLobby');
                }, 250);
            } else if (this.selectedIndex === 6) {
                // OPTIONEN, KOMBO-SHOW & FREISCHALT-GUIDE
                this.playConfirm();
                this.inOptions = true;
                this.optionsTab = 'unlocks';
                this.optionIndex = 0;
                this.comboPreviewTimer = 0;
                this.inputCooldown = 15;
            }
        }
    }

    updateOptions(p1) {
        if (this.inputCooldown <= 0) {
            if (this.optionsTab === 'unlocks') {
                const count = UNLOCK_CHAIN_GUIDE.length;
                if (p1.up) {
                    this.unlockGuideIndex = (this.unlockGuideIndex - 2 + count) % count;
                    this.inputCooldown = 10;
                    this.playBlip();
                } else if (p1.down) {
                    this.unlockGuideIndex = (this.unlockGuideIndex + 2) % count;
                    this.inputCooldown = 10;
                    this.playBlip();
                } else if (p1.left || p1.right) {
                    this.unlockGuideIndex = (this.unlockGuideIndex + (p1.right ? 1 : -1) + count) % count;
                    this.inputCooldown = 10;
                    this.playBlip();
                } else if (p1.lJust || p1.hJust) {
                    this.optionsTab = 'combos';
                    this.comboPreviewTimer = 0;
                    this.inputCooldown = 14;
                    this.playConfirm();
                } else if (p1.s || p1.menuJust) {
                    this.inOptions = false;
                    this.inputCooldown = 15;
                    this.playBlip();
                }
                return;
            }

            if (this.optionsTab === 'combos') {
                const comboCount = this.comboShowList.length;
                if (p1.up) {
                    this.comboIndex = (this.comboIndex - 1 + comboCount) % comboCount;
                    this.comboPreviewTimer = 0;
                    this.inputCooldown = 10;
                    this.playBlip();
                } else if (p1.down) {
                    this.comboIndex = (this.comboIndex + 1) % comboCount;
                    this.comboPreviewTimer = 0;
                    this.inputCooldown = 10;
                    this.playBlip();
                } else if (p1.right) {
                    this._cycleComboPreviewChar(1);
                    this.inputCooldown = 12;
                } else if (p1.left) {
                    this._cycleComboPreviewChar(-1);
                    this.inputCooldown = 12;
                } else if (p1.lJust || p1.hJust) {
                    this.comboPreviewTimer = 0;
                    this.inputCooldown = 12;
                    this.playConfirm();
                } else if (p1.s || p1.menuJust) {
                    this.inOptions = false;
                    this.inputCooldown = 15;
                    this.playBlip();
                }
                return;
            }

            const optCount = 12;
            if (p1.up) {
                this.optionIndex = (this.optionIndex - 1 + optCount) % optCount;
                this.inputCooldown = 10;
                this.playBlip();
            } else if (p1.down) {
                this.optionIndex = (this.optionIndex + 1) % optCount;
                this.inputCooldown = 10;
                this.playBlip();
            } else if (p1.right) {
                this.adjustOption(1);
                this.inputCooldown = 8;
            } else if (p1.left) {
                this.adjustOption(-1);
                this.inputCooldown = 8;
            } else if (p1.lJust || p1.hJust) {
                if (this.optionIndex === 8) {
                    this.optionsTab = 'combos';
                    this.comboPreviewTimer = 0;
                    this.playConfirm();
                    this.inputCooldown = 15;
                } else if (this.optionIndex === 9) {
                    this.optionsTab = 'unlocks';
                    this.playConfirm();
                    this.inputCooldown = 15;
                } else if (this.optionIndex === 10) {
                    this.game.resetAudioMixDefaults?.();
                    this._fadeInTarget = this.game.settings.musicVolume;
                    this.playConfirm();
                    this.game.audioManager?.playHitImpactSound?.(true, true);
                    this.inputCooldown = 15;
                } else if (this.optionIndex === 11) {
                    this.inOptions = false;
                    this.inputCooldown = 15;
                    this.playBlip();
                } else {
                    this.adjustOption(1);
                    this.inputCooldown = 10;
                }
            } else if (p1.s || p1.menuJust) {
                // Back
                this.inOptions = false;
                this.inputCooldown = 15;
                this.playBlip();
            }
        }
    }

    adjustOption(dir) {
        const s = this.game.settings;
        const step = 0.05;
        switch (this.optionIndex) {
            case 0: // Master Vol (0% - 150%)
                this._setSliderValue(0, Math.round(((s.masterVolume ?? 1.0) + dir * step) * 20) / 20, true);
                break;
            case 1: // Music Vol (0% - 100%)
                this._setSliderValue(1, Math.round(((s.musicVolume ?? 0.22) + dir * step) * 20) / 20, false);
                break;
            case 2: // FX & Hits Vol (0% - 150%)
                this._setSliderValue(2, Math.round(((s.sfxVolume ?? 0.90) + dir * step) * 20) / 20, true);
                break;
            case 3: // Fighter Voices Vol (0% - 150%)
                this._setSliderValue(3, Math.round(((s.voiceVolume ?? 1.00) + dir * step) * 20) / 20, true);
                break;
            case 4: // Announcer / Story Vol (0% - 150%)
                this._setSliderValue(4, Math.round(((s.announcerVolume ?? 0.95) + dir * step) * 20) / 20, true);
                break;
            case 5: // Voice-Ducking EQ Filter
                s.bgmFilterEnabled = !s.bgmFilterEnabled;
                this.game.saveSettings?.();
                break;
            case 6: // Difficulty
                const diffs = ['EASY', 'NORMAL', 'HARD'];
                const idx = diffs.indexOf(s.difficulty);
                s.difficulty = diffs[Math.max(0, Math.min(2, idx + dir))];
                this.game.saveSettings?.();
                break;
            case 7: // Timer & Speed
                if (dir > 0) {
                    s.timer = s.timer === 99 ? 66 : 99;
                } else {
                    s.speed = s.speed >= 1.25 ? 1.0 : (s.speed + 0.25);
                }
                this.game.saveSettings?.();
                break;
            case 8: // Open STEUERUNG & KOMBO-SHOW
                this.optionsTab = 'combos';
                this.comboPreviewTimer = 0;
                this.playConfirm();
                break;
            case 9: // Open FREISCHALT-GUIDE
                this.optionsTab = 'unlocks';
                this.playConfirm();
                break;
            case 10: // Reset Studio Mix
                this.game.resetAudioMixDefaults?.();
                this._fadeInTarget = this.game.settings.musicVolume;
                this.playConfirm();
                break;
            case 11: // Back to Menu
                this.inOptions = false;
                this.inputCooldown = 15;
                break;
        }
    }

    startStoryMode() {
        const keano = ROSTER[0];
        const opponent = ROSTER[1];
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, keano);
        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);
        this.game.assetManager.loadAll();

        const combatData = {
            p1: keano,
            p2: { ...opponent, rosterIndex: 1 },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true, // Special flag to denote true story run vs. pure arcade mode
            arcadeIndex: 1,
            arcadeWins: 0,
        };

        this.game.audioManager.stopBGM();
        this.game.stateManager.switchState('Story', {
            ...STORY_PROLOGUE,
            nextState: 'VersusIntro',
            nextData: combatData,
        });
    }

    async startEndgameTest() {
        const keano = ROSTER[0];
        const pushIndex = ROSTER.length - 2; // Index 13: Putin
        const opponent = ROSTER[pushIndex];
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, keano);
        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);

        await this.game.assetManager.loadAll();

        const combatData = {
            p1: keano,
            p2: { ...opponent, rosterIndex: pushIndex },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true, // Run as story so we get the Epilogue sequence afterwards
            arcadeIndex: pushIndex,
            arcadeWins: pushIndex, // Ensure it registers as the final boss victory
        };

        this.game.audioManager.stopBGM();
        this.game.stateManager.switchState('VersusIntro', combatData);
    }

    // Sound stubs — removed synthesized oscillator sounds
    playBlip() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playConfirm() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        [600, 800].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + (idx * 0.1));
            gain.gain.setValueAtTime(0, now + (idx * 0.1));
            gain.gain.linearRampToValueAtTime(0.1, now + (idx * 0.1) + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.1) + 0.2);
            // Lowpass filter for smooth 16-bit sound
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 2000;
            osc.connect(gain);
            gain.connect(lp);
            lp.connect(ctx.destination);
            osc.start(now + (idx * 0.1));
            osc.stop(now + (idx * 0.1) + 0.2);
        });
    }

    playBuzzer() {
        const ctx = this.game.audioManager.audioCtx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    // Draw random lightning from top to bottom
    _drawLightning(ctx) {
        if (!this.lightningActive) {
            // Random chance to strike
            if (Math.random() < 0.005) { // 0.5% chance per frame (~once every few seconds typical)
                this.lightningActive = true;
                this.lightningTimer = 0.5; // lasts half a second
                this.lightningPoints = [];

                let startX = Math.random() * this.game.width;
                let currentX = startX;
                let currentY = 0;
                this.lightningPoints.push({ x: currentX, y: currentY });

                while (currentY < this.game.height) {
                    currentX += (Math.random() - 0.5) * 100;
                    currentY += Math.random() * 50 + 20;
                    this.lightningPoints.push({ x: currentX, y: currentY });
                }
            }
        } else {
            this.lightningTimer -= 1 / 60; // Approx 60fps decrement
            if (this.lightningTimer <= 0) {
                this.lightningActive = false;
            } else {
                // Draw lightning
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.lightningPoints[0].x, this.lightningPoints[0].y);
                for (let i = 1; i < this.lightningPoints.length; i++) {
                    ctx.lineTo(this.lightningPoints[i].x, this.lightningPoints[i].y);
                }

                // Opacity flickers
                let alpha = (Math.random() * 0.5 + 0.5) * (this.lightningTimer / 0.5);

                ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 15;
                ctx.stroke();


                ctx.restore();
            }
        }
    }

    draw(ctx) {
        // Draw original background image first
        const bg = this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
        } else {
            ctx.fillStyle = '#050510';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }

        // Modern animated gradient background as an overlay
        ctx.save();
        ctx.globalAlpha = 0.5; // Let the background image show through clearly
        const t = this.time * 0.3;
        const grad = ctx.createLinearGradient(0, 0, this.game.width, this.game.height);

        // Deep modern synthwave/cyberpunk colors
        const color1 = `hsl(${190 + Math.sin(t) * 20}, 90%, 12%)`; // Deep Cyan/Blue
        const color2 = `hsl(${280 + Math.cos(t) * 20}, 90%, 8%)`;  // Deep Purple

        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.restore();

        // Draw ambient particles (slightly softer flicker)
        ctx.save();
        ctx.fillStyle = '#00ffff';
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha * (0.2 + Math.sin(this.time * 2 + p.wobble) * 0.15);
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x * this.game.width, p.y * this.game.height, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        this._drawLightning(ctx);

        if (this.inOptions) {
            this.drawOptions(ctx);
            return;
        }

        // ─── KEANO ROMEO ─── Neon Cyan + Deep 3D Shadow + Slow Dimmer
        const pulse = (Math.sin(this.time * 0.8) + 1) / 2;
        const glowSize = 20 + pulse * 50;
        const cx = this.game.width / 2;

        // Push everything down
        const titleY = this.game.height * 0.30;

        ctx.textAlign = 'center';
        ctx.font = 'bold 160px "Press Start 2P"';

        ctx.save();

        // Stretch width by 1.2
        ctx.translate(cx, titleY);
        ctx.scale(1.2, 1);
        ctx.translate(-cx, -titleY);

        // Deep 3D Shadow
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000810';
        for (let i = 25; i >= 1; i--) {
            ctx.fillText("KEANO", cx, titleY + 10 + i * 2);
            ctx.fillText("ROMEO", cx, titleY + 140 + i * 2);
        }

        // Inner shadow edge
        ctx.fillStyle = '#003355';
        ctx.fillText("KEANO", cx, titleY + 15);
        ctx.fillText("ROMEO", cx, titleY + 145);

        // Core text - Enhanced contrast glow, but keep base bright enough to hide overlaps
        ctx.fillStyle = `rgba(0, 255, 255, ${0.7 + pulse * 0.3})`;
        ctx.shadowColor = `rgba(0, 255, 255, ${0.1 + pulse * 0.8})`; // Dynamic shadow alpha 
        ctx.shadowBlur = glowSize * 0.8;
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);

        ctx.shadowBlur = (glowSize + 25) * 0.8; // Second layer of glow
        ctx.fillText("KEANO", cx, titleY);
        ctx.fillText("ROMEO", cx, titleY + 130);

        ctx.restore();
        ctx.shadowBlur = 0;

        // ─── LORD OF THE LIGHT I ───
        ctx.font = 'bold 34px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText("LORD OF THE LIGHT I", cx, titleY + 235);
        ctx.shadowBlur = 0;

        // ─── Menu Options (7 Sleek Rounded Arcade-Neon Pill Buttons) ───
        const menuStartY = this.game.height * 0.56;
        for (let i = 0; i < this.options.length; i++) {
            const y = menuStartY + (i * 46);
            const isLocked = (i === 1 || i === 2 || i === 4) && !this.storyCompleted;
            const isOnline = (i === 5);
            const isTraining = (i === 3);
            const isSel = (i === this.selectedIndex);
            const btnW = 580;
            const btnH = 40;
            const accent = isLocked ? '#664444' : (isOnline ? '#00ff88' : (isTraining ? '#ffcc00' : '#00ffff'));

            ctx.save();
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(cx - btnW / 2, y - 28, btnW, btnH, 20);
            } else {
                ctx.rect(cx - btnW / 2, y - 28, btnW, btnH);
            }
            if (isSel) {
                ctx.shadowColor = accent;
                ctx.shadowBlur = 16;
                ctx.fillStyle = isOnline ? 'rgba(0, 255, 136, 0.22)' : (isTraining ? 'rgba(255, 204, 0, 0.22)' : 'rgba(0, 229, 255, 0.22)');
            } else {
                ctx.fillStyle = 'rgba(10, 16, 36, 0.78)';
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = isSel ? accent : (isOnline ? 'rgba(0, 255, 136, 0.45)' : 'rgba(0, 210, 255, 0.32)');
            ctx.lineWidth = isSel ? 3 : 1.8;
            ctx.stroke();

            ctx.font = isLocked ? 'bold 18px "Press Start 2P"' : 'bold 22px "Press Start 2P"';
            ctx.fillStyle = isSel ? (isLocked ? '#995555' : (isOnline ? '#00ff88' : (isTraining ? '#ffcc00' : '#00ffff'))) : (isLocked ? '#666666' : (isOnline ? '#99ffcc' : '#e6f4ff'));
            const label = isLocked ? `🔒 ${this.options[i]} (ERST STORY)` : this.options[i];
            ctx.fillText(label, cx, y + 1);
            ctx.restore();
        }

        // ─── INSERT COIN + Credits ───
        this.drawInsertCoin(ctx);
    }

    drawInsertCoin(ctx) {
        const cx = this.game.width / 2;
        const y = this.game.height - 80;

        // Credits display - Bottom right in Cyan
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`CREDITS: ${this.credits}`, this.game.width - 30, this.game.height - 30);

        // Reset textAlign for the rest of the text
        ctx.textAlign = 'center';

        // INSERT COIN text (blinks when no credits)
        if (this.credits <= 0) {
            const blink = Math.sin(this.time * 6) > 0;
            if (blink) {
                ctx.font = 'bold 40px "Press Start 2P"';
                ctx.fillStyle = '#ff0033';
                ctx.shadowColor = '#ff0033';
                ctx.shadowBlur = 15;
                ctx.fillText('INSERT COIN', cx, y);
                ctx.shadowBlur = 0;
            }
        } else {
            ctx.font = 'bold 30px "Press Start 2P"';
            ctx.fillStyle = '#fdbf00';
            ctx.shadowColor = '#fdbf00';
            ctx.shadowBlur = 10;
            ctx.fillText('INSERT COIN', cx, y);
            ctx.shadowBlur = 0;
        }

        // Spinning coins (left and right)
        this.drawSpinningCoin(ctx, cx - 280, y - 10);
        this.drawSpinningCoin(ctx, cx + 280, y - 10);

        // Insert coin via button press OR screen tap
        if (this.credits <= 0) {
            const p1 = this.game.inputManager.p1;
            // Accept any input: keyboard punch/kick, touchpad button, or screen tap
            if (p1.l || p1.h || p1.lJust || p1.hJust || p1.sJust || p1.up || p1.down) {
                this.credits = this.maxCredits;
                this.inputCooldown = 15;
                this.game.audioManager.unlockAudio();
            }
        }
    }

    drawSpinningCoin(ctx, x, y) {
        ctx.save();
        const scaleX = Math.cos(this.coinAngle);
        const absScale = Math.abs(scaleX);

        // 3D coin effect
        ctx.translate(x, y);
        ctx.scale(scaleX > 0 ? absScale : -absScale, 1);

        // Outer ring
        ctx.fillStyle = '#fdbf00';
        ctx.shadowColor = '#fdbf00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Star/L symbol
        ctx.fillStyle = '#cc8800';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.textAlign = 'center';
        if (absScale > 0.3) {
            ctx.fillText('L', 0, 7);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawOptions(ctx) {
        ctx.fillStyle = 'rgba(4, 6, 18, 0.94)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        const cx = this.game.width / 2;
        const s = this.game.settings;

        ctx.save();
        // Studio Console Outer Frame
        ctx.fillStyle = 'rgba(10, 14, 34, 0.96)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.fillRect(cx - 650, 38, 1300, this.game.height - 76);
        ctx.strokeRect(cx - 650, 38, 1300, this.game.height - 76);

        const drawPill = (x, y, w, h, r, fill, stroke, lw = 2) => {
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lw;
            ctx.stroke();
        };

        // Top-left back button pill for mobile/touch
        drawPill(cx - 625, 56, 205, 48, 24, 'rgba(255, 0, 85, 0.25)', '#ff0055', 2.5);
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('◀ ZURÜCK', cx - 522, 87);

        // Three Top Tab Pills: [ SOUND & MIX ] | [ KOMBOS ] | [ FREISCHALTEN ]
        const isMixer = this.optionsTab === 'mixer';
        const isCombos = this.optionsTab === 'combos';
        const isUnlocks = this.optionsTab === 'unlocks';

        // Tab 1: Sound & Mix (x: cx - 405 .. cx - 73)
        drawPill(cx - 405, 56, 332, 48, 24, isMixer ? 'rgba(0, 229, 255, 0.28)' : 'rgba(20, 26, 52, 0.85)', isMixer ? '#00ffff' : '#334466', isMixer ? 3 : 2);
        ctx.fillStyle = isMixer ? '#00ffff' : '#8899bb';
        ctx.font = 'bold 15px "Press Start 2P"';
        ctx.fillText('SOUND & MIX', cx - 239, 87);

        // Tab 2: Kombos (x: cx - 63 .. cx + 275)
        drawPill(cx - 63, 56, 338, 48, 24, isCombos ? 'rgba(255, 204, 0, 0.28)' : 'rgba(20, 26, 52, 0.85)', isCombos ? '#ffcc00' : '#334466', isCombos ? 3 : 2);
        ctx.fillStyle = isCombos ? '#ffcc00' : '#8899bb';
        ctx.font = 'bold 15px "Press Start 2P"';
        ctx.fillText('KOMBOS & MOVES', cx + 106, 87);

        // Tab 3: Freischalt-Guide (x: cx + 285 .. cx + 630)
        drawPill(cx + 285, 56, 345, 48, 24, isUnlocks ? 'rgba(255, 85, 221, 0.28)' : 'rgba(20, 26, 52, 0.85)', isUnlocks ? '#ff66dd' : '#334466', isUnlocks ? 3 : 2);
        ctx.fillStyle = isUnlocks ? '#ff88ee' : '#8899bb';
        ctx.font = 'bold 15px "Press Start 2P"';
        ctx.fillText('FREISCHALT-GUIDE', cx + 457, 87);

        if (isCombos) {
            this._drawComboShowcase(ctx, cx);
            ctx.restore();
            return;
        }

        if (isUnlocks) {
            this._drawUnlockGuide(ctx, cx);
            ctx.restore();
            return;
        }

        ctx.font = 'bold 12px "Press Start 2P"';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('REGLER ZIEHEN ODER OBEN AUF [KOMBOS & MOVES] / [FREISCHALT-GUIDE] TIPPEN', cx, 134);

        const rows = [
            { label: 'MASTER VOL', type: 'slider', val: s.masterVolume ?? 1.00, max: 1.5, color: '#ffffff' },
            { label: 'MUSIK (BGM)', type: 'slider', val: s.musicVolume ?? 0.22, max: 1.0, color: '#00e5ff' },
            { label: 'FX & HITS', type: 'slider', val: s.sfxVolume ?? 0.90, max: 1.5, color: '#ff3366' },
            { label: 'STIMMEN', type: 'slider', val: s.voiceVolume ?? 1.00, max: 1.5, color: '#ffd700' },
            { label: 'ANNOUNCER', type: 'slider', val: s.announcerVolume ?? 0.95, max: 1.5, color: '#bb66ff' },
            { label: 'VOICE-MIX', type: 'value', value: s.bgmFilterEnabled ? 'AN (AUTO)' : 'AUS' },
            { label: 'KI-LEVEL', type: 'value', value: s.difficulty },
            { label: 'ZEIT & TEMPO', type: 'value', value: `${s.timer}s · ${Math.round((s.speed || 1) * 100)}%` },
            { label: 'KOMBOS & STEUERUNG', type: 'action', color: '#ffcc00' },
            { label: 'FREISCHALT-GUIDE (BILDER)', type: 'action', color: '#ff77ee' },
            { label: 'STANDARD-MIX LADEN', type: 'action', color: '#00ff88' },
            { label: 'SPEICHERN & ZURÜCK', type: 'action', color: '#00ffff' },
        ];

        const startY = 186;
        const rowStep = 54;
        const barX = cx - 40;
        const barW = 360;
        const barH = 22;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const y = startY + i * rowStep;
            const isSel = i === this.optionIndex;

            if (isSel) {
                drawPill(cx - 560, y - 30, 1120, 44, 22, 'rgba(0, 229, 255, 0.16)', '#00ffff', 2.5);
            } else if (r.type === 'action') {
                drawPill(cx - 380, y - 30, 760, 44, 22, 'rgba(18, 24, 48, 0.78)', r.color, 1.5);
            }

            if (r.type === 'slider') {
                ctx.textAlign = 'left';
                ctx.font = 'bold 19px "Press Start 2P"';
                ctx.fillStyle = isSel ? '#ffffff' : '#bbbbbb';
                ctx.fillText(r.label, cx - 530, y - 2);

                // [-] button
                ctx.fillStyle = isSel ? '#00ffff' : '#667799';
                ctx.font = 'bold 18px "Press Start 2P"';
                ctx.textAlign = 'center';
                ctx.fillText('[-]', barX - 36, y - 2);

                // Fader Track
                const by = y - 22;
                const ratio = Math.max(0, Math.min(1, r.val / r.max));
                ctx.fillStyle = '#121629';
                ctx.fillRect(barX, by, barW, barH);

                // Fader Fill
                ctx.fillStyle = r.color;
                ctx.fillRect(barX, by, barW * ratio, barH);

                // 100% reference tick on 150% sliders
                if (r.max > 1.0) {
                    const tickX = barX + (1.0 / r.max) * barW;
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.fillRect(tickX - 1, by - 3, 2, barH + 6);
                }

                // Fader Knob
                const knobX = barX + barW * ratio;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(knobX - 6, by - 4, 12, barH + 8);

                ctx.strokeStyle = isSel ? '#ffffff' : '#445577';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX, by, barW, barH);

                // [+] button
                ctx.fillStyle = isSel ? '#00ffff' : '#667799';
                ctx.fillText('[+]', barX + barW + 36, y - 2);

                // Percentage readout
                ctx.textAlign = 'right';
                ctx.font = 'bold 19px "Press Start 2P"';
                ctx.fillStyle = isSel ? r.color : '#dddddd';
                ctx.fillText(`${Math.round(r.val * 100)}%`, cx + 530, y - 2);
            } else if (r.type === 'value') {
                ctx.textAlign = 'left';
                ctx.font = 'bold 19px "Press Start 2P"';
                ctx.fillStyle = isSel ? '#ffffff' : '#bbbbbb';
                ctx.fillText(r.label, cx - 530, y - 2);

                ctx.textAlign = 'center';
                ctx.fillStyle = isSel ? '#00ffff' : '#cccccc';
                ctx.fillText(isSel ? `< ${r.value} >` : r.value, barX + barW / 2, y - 2);
            } else if (r.type === 'action') {
                ctx.textAlign = 'center';
                ctx.font = 'bold 19px "Press Start 2P"';
                ctx.fillStyle = isSel ? r.color : (r.color === '#ffcc00' ? '#eebb33' : (r.color === '#ff77ee' ? '#dd77cc' : '#88aa99'));
                ctx.fillText(isSel ? `> ${r.label} <` : r.label, cx, y - 2);
            }
        }

        ctx.font = '13px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#88aacc';
        ctx.fillText('[↑/↓] WÄHLEN   [←/→ ODER ZIEHEN] EINSTELLEN   [S / ESC] ZURÜCK', cx, this.game.height - 56);
        ctx.restore();
    }

    _drawUnlockGuide(ctx, cx) {
        // 1. Header Instruction Box (y: 116 .. 198)
        ctx.fillStyle = 'rgba(20, 14, 42, 0.95)';
        ctx.strokeStyle = '#ff66dd';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 625, 116, 1250, 82);
        ctx.strokeRect(cx - 625, 116, 1250, 82);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText('🏆 FREISCHALT-ANLEITUNG: WELCHER SPIELER SCHALTET WEN FREI?', cx, 146);

        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Spiele STORY oder ARCADE mit dem linken Kämpfer durch ➔ schaltet den rechten Spezial-Kämpfer frei!', cx, 178);

        // 2. 2x6 Visual Grid of Unlock Chains with Fighter Portraits
        const startY = 204;
        const rowStep = 97;
        const col0X = cx - 620;
        const col1X = cx + 10;
        const cardW = 610;
        const cardH = 90;

        const fighterMap = {};
        for (const f of ALL_FIGHTERS) fighterMap[f.id] = f;

        for (let i = 0; i < UNLOCK_CHAIN_GUIDE.length; i++) {
            const chain = UNLOCK_CHAIN_GUIDE[i];
            const playChar = fighterMap[chain.playId];
            const unlockChar = fighterMap[chain.unlockId];
            const unlocked = isFighterUnlocked(chain.unlockId);
            const isSel = (i === this.unlockGuideIndex);

            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = col === 0 ? col0X : col1X;
            const y = startY + row * rowStep;

            // Card background
            ctx.fillStyle = isSel
                ? 'rgba(255, 102, 221, 0.22)'
                : (unlocked ? 'rgba(14, 28, 42, 0.92)' : 'rgba(22, 14, 28, 0.92)');
            ctx.strokeStyle = isSel ? '#ffcc00' : (unlocked ? '#00ff88' : '#663355');
            ctx.lineWidth = isSel ? 3 : 2;
            ctx.fillRect(x, y, cardW, cardH);
            ctx.strokeRect(x, y, cardW, cardH);

            // LEFT PORTRAIT (Play with this fighter)
            const playImg = this.game.assetManager.images[`${chain.playId}_front.png`];
            ctx.fillStyle = '#0a0f24';
            ctx.fillRect(x + 10, y + 6, 64, 64);
            if (playImg) {
                ctx.drawImage(playImg, x + 10, y + 6, 64, 64);
            }
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 10, y + 6, 64, 64);

            ctx.textAlign = 'center';
            ctx.font = 'bold 9px "Press Start 2P"';
            ctx.fillStyle = '#00ffff';
            const playShort = (playChar ? playChar.name : chain.playId).replace(/[⚡👑🔥🌸❄️🍳🥩]/g, '').trim();
            ctx.fillText(playShort.substring(0, 12), x + 42, y + 83);

            // CENTER ARROW (➔ ARCADE / STORY SIEG ➔)
            ctx.font = 'bold 10px "Press Start 2P"';
            ctx.fillStyle = '#ffd700';
            ctx.fillText('STORY', x + 128, y + 32);
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('➔ SIEG ➔', x + 128, y + 54);
            ctx.font = '9px "Press Start 2P"';
            ctx.fillStyle = '#88ccff';
            ctx.fillText('ARCADE', x + 128, y + 73);

            // RIGHT PORTRAIT (Unlocked Special Fighter)
            const unlockImg = this.game.assetManager.images[`${chain.unlockId}_front.png`];
            ctx.fillStyle = '#140a24';
            ctx.fillRect(x + 184, y + 6, 64, 64);
            if (unlockImg) {
                ctx.drawImage(unlockImg, x + 184, y + 6, 64, 64);
            }
            ctx.strokeStyle = unlocked ? '#ffd700' : '#ff3366';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 184, y + 6, 64, 64);

            ctx.font = 'bold 9px "Press Start 2P"';
            ctx.fillStyle = unlocked ? '#00ff88' : '#ff5577';
            ctx.fillText(unlocked ? '✓ FREI' : '🔒 GESPERRT', x + 216, y + 83);

            // RIGHT INFO TEXT (Name, Outfit & Special Attack)
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px "Press Start 2P"';
            ctx.fillStyle = unlocked ? '#ffd700' : '#ff99cc';
            const unlockTitle = unlockChar ? unlockChar.name : chain.unlockId;
            ctx.fillText(unlockTitle.substring(0, 22), x + 262, y + 25);

            ctx.font = '9px "Press Start 2P"';
            ctx.fillStyle = '#00ffff';
            ctx.fillText(`SPIELE MIT: ${playShort.toUpperCase()}`, x + 262, y + 45);

            // Word-wrap chain.desc into 2 short lines on the card
            ctx.font = '9px "Press Start 2P"';
            ctx.fillStyle = '#dddddd';
            const descWords = (chain.desc || '').split(' ');
            let l1 = '', l2 = '';
            for (const w of descWords) {
                if ((l1 + ' ' + w).trim().length <= 33) l1 = (l1 + ' ' + w).trim();
                else l2 = (l2 + ' ' + w).trim();
            }
            ctx.fillText(l1, x + 262, y + 64);
            if (l2) ctx.fillText(l2.substring(0, 35), x + 262, y + 80);
        }

        // 3. Bottom Highlight Banner for Selected Unlock Chain (y: 794 .. 852)
        const selChain = UNLOCK_CHAIN_GUIDE[this.unlockGuideIndex] || UNLOCK_CHAIN_GUIDE[0];
        const selPlay = fighterMap[selChain.playId];
        const selUnlock = fighterMap[selChain.unlockId];
        ctx.fillStyle = 'rgba(12, 20, 44, 0.96)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 620, 794, 1240, 58);
        ctx.strokeRect(cx - 620, 794, 1240, 58);

        ctx.textAlign = 'center';
        ctx.font = 'bold 13px "Press Start 2P"';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(
            `${selPlay ? selPlay.name.toUpperCase() : selChain.playId}  ➔  STORY / ARCADE DURCHSPIELEN  ➔  ${selUnlock ? selUnlock.name.toUpperCase() : selChain.unlockId}`,
            cx,
            818
        );
        ctx.font = '11px "Press Start 2P"';
        ctx.fillStyle = '#00ff88';
        ctx.fillText(`SPEZIAL-VARIANTE: ${selChain.desc}`, cx, 842);

        // Footer hint
        ctx.font = '13px "Press Start 2P"';
        ctx.fillStyle = '#88aacc';
        ctx.fillText('[PFEILTASTEN / ANTIPPEN] KÄMPFER-KETTE WÄHLEN   [P / K] ZUR KOMBO-SHOW   [S / ZURÜCK] HAUPTMENÜ', cx, this.game.height - 56);
    }

    _drawComboShowcase(ctx, cx) {
        // 1. Top Control Legend Banner (y: 120 .. 205)
        ctx.fillStyle = 'rgba(14, 22, 48, 0.95)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 625, 118, 1250, 88);
        ctx.strokeRect(cx - 625, 118, 1250, 88);

        ctx.textAlign = 'left';
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('📱 HANDY / TOUCH:', cx - 605, 146);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('[P] = PUNCH (SCHLAG)   [K] = KICK (TRITT)   [S] = SUPER / SPECIAL   [D] = DASH', cx - 340, 146);

        ctx.fillStyle = '#ffcc00';
        ctx.fillText('⌨️ TASTATUR & PAD:', cx - 605, 174);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('P1: [W/A/S/D] + [J]=P  [K]=K  [L]=S   |   PFEILTASTEN + [A]=P  [S]=K  [D]=S', cx - 340, 174);

        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 12px "Press Start 2P"';
        ctx.fillText('🛡️ BLOCKEN: Rückwärts gedrückt halten (←) oder unten-rückwärts (↙) für tiefen Block!', cx - 605, 198);

        const list = ALL_FIGHTERS && ALL_FIGHTERS.length ? ALL_FIGHTERS : ROSTER;
        const fighter = list[this.comboCharIndex] || ROSTER[0];
        const style = getFighterStyle(fighter);
        this.comboShowList = this._getComboListForFighter(fighter);

        // 2. Left Panel: Interactive List of All 10 Combos (2 Style Signatures + 8 Universal Moves)
        const listStartY = 250;
        const listStep = 62;
        for (let i = 0; i < this.comboShowList.length; i++) {
            const item = this.comboShowList[i];
            const ry = listStartY + i * listStep;
            const isSel = (i === this.comboIndex);
            const isSig = !!item.isSignature;

            ctx.fillStyle = isSel
                ? 'rgba(255, 204, 0, 0.24)'
                : (isSig ? 'rgba(30, 18, 48, 0.92)' : 'rgba(16, 20, 40, 0.88)');
            ctx.strokeStyle = isSel ? '#ffcc00' : (isSig ? (item.styleColor || '#ff00ff') : '#2a385c');
            ctx.lineWidth = isSel ? 3 : (isSig ? 2.2 : 1.5);
            ctx.fillRect(cx - 625, ry - 27, 595, 54);
            ctx.strokeRect(cx - 625, ry - 27, 595, 54);

            ctx.textAlign = 'left';
            ctx.font = 'bold 14px "Press Start 2P"';
            ctx.fillStyle = isSel ? '#ffcc00' : (isSig ? (item.styleColor || '#ffd700') : '#ffffff');
            ctx.fillText(item.name, cx - 608, ry - 4);

            ctx.font = '11px "Press Start 2P"';
            ctx.fillStyle = isSel ? '#00ffff' : (isSig ? '#ffffff' : '#88aacc');
            ctx.fillText(item.input, cx - 608, ry + 18);
        }

        // 3. Right Panel: LIVE SHOW-VORSCHAU Stage Box (x: cx + 10 .. cx + 625, y: 222 .. 850)
        const boxX = cx + 10;
        const boxY = 222;
        const boxW = 615;
        const boxH = 625;

        ctx.fillStyle = 'rgba(8, 12, 28, 0.96)';
        ctx.strokeStyle = style.color || '#ffcc00';
        ctx.lineWidth = 3;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        const combo = this.comboShowList[this.comboIndex] || this.comboShowList[0];

        // Fighter Switcher Bar & Fight Style Banner at top of preview box
        ctx.fillStyle = 'rgba(0, 229, 255, 0.16)';
        ctx.fillRect(boxX + 12, boxY + 10, boxW - 24, 62);
        ctx.strokeStyle = style.color || '#00e5ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 12, boxY + 10, boxW - 24, 62);

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`◀ ${fighter.name.toUpperCase()} · ${style.badge} ▶`, boxX + boxW / 2, boxY + 34);

        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = style.color || '#ffd700';
        ctx.fillText(`PASSIV: ${style.passive}`, boxX + boxW / 2, boxY + 58);

        // Mini Dojo Stage Background inside Preview Box
        const stageAreaY = boxY + 80;
        const stageAreaH = 381;
        const stageBg = this.game.assetManager.images['Stage_Japan'] || this.game.assetManager.images['menuBg'];
        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX + 12, stageAreaY, boxW - 24, stageAreaH);
        ctx.clip();
        if (stageBg) {
            ctx.globalAlpha = 0.45;
            ctx.drawImage(stageBg, boxX + 12, stageAreaY, boxW - 24, stageAreaH);
            ctx.globalAlpha = 1.0;
        }
        // Floor line
        const groundY = stageAreaY + 345;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
        ctx.fillRect(boxX + 12, groundY, boxW - 24, 4);

        // Determine current frame in the combo animation loop
        const frames = combo.frames;
        let totalDur = 0;
        for (const f of frames) totalDur += f.dur;
        const loopT = this.comboPreviewTimer % totalDur;
        let acc = 0;
        let activeFrame = frames[0];
        let activeStepIdx = 0;
        for (let i = 0; i < frames.length; i++) {
            if (loopT <= acc + frames[i].dur) {
                activeFrame = frames[i];
                activeStepIdx = i;
                break;
            }
            acc += frames[i].dur;
        }

        // Draw Training Dummy Silhouette on the right side of the preview stage
        const dummyX = boxX + 445 + (activeFrame.hit ? 10 : 0);
        ctx.save();
        ctx.globalAlpha = activeFrame.hit ? 0.85 : 0.45;
        ctx.fillStyle = activeFrame.hit ? '#ff3366' : '#334466';
        ctx.strokeStyle = activeFrame.hit ? '#ffffff' : '#6688aa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(dummyX, groundY - 210, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(dummyX - 28, groundY - 178, 56, 105);
        ctx.strokeRect(dummyX - 28, groundY - 178, 56, 105);
        ctx.fillRect(dummyX - 24, groundY - 73, 20, 73);
        ctx.fillRect(dummyX + 4, groundY - 73, 20, 73);
        ctx.font = 'bold 11px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('DUMMY', dummyX, groundY - 246);
        ctx.restore();

        // Draw Animated Fighter performing the Combo!
        const spriteKey = `${fighter.id}${activeFrame.suffix}`;
        const spriteImg = this.game.assetManager.images[spriteKey]
            || this.game.assetManager.images[`${fighter.id}_punch.png`]
            || this.game.assetManager.images[`${fighter.id}_right.png`];

        const fighterX = boxX + 215 + (activeFrame.x || 0);
        const fighterY = groundY + (activeFrame.y || 0);

        if (spriteImg && (spriteImg.naturalHeight || spriteImg.height)) {
            const iw = spriteImg.naturalWidth || spriteImg.width;
            const ih = spriteImg.naturalHeight || spriteImg.height;
            const scale = 285 / ih;
            const dw = iw * scale;
            const dh = ih * scale;
            ctx.drawImage(spriteImg, fighterX - dw / 2, fighterY - dh, dw, dh);
        }

        // Draw Slash / Impact Arc & Callout when striking
        if (activeFrame.slash) {
            const slashX = fighterX + 95;
            const slashY = fighterY - 155;
            ctx.save();
            ctx.strokeStyle = activeFrame.slash === 'fire' ? '#ff4400'
                : (activeFrame.slash === 'gold' ? '#ffcc00'
                : (activeFrame.slash === 'super' ? '#ff00ff' : '#00ffff'));
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 18;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(slashX, slashY, 64, -Math.PI * 0.45, Math.PI * 0.45);
            ctx.stroke();

            if (activeFrame.proj) {
                const projX = slashX + ((loopT * 360) % 160);
                const grad = ctx.createRadialGradient(projX, slashY, 4, projX, slashY, 34);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.5, '#00ffff');
                grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(projX, slashY, 34, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (activeFrame.hit) {
            ctx.save();
            ctx.font = 'bold 22px "Press Start 2P"';
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 12;
            ctx.fillText(activeFrame.hit, boxX + boxW / 2 + 45, stageAreaY + 55);
            ctx.restore();
        }
        ctx.restore();

        // Draw Glowing Button Input Badges below Stage Preview
        const badgeY = stageAreaY + stageAreaH + 38;
        const badges = combo.badges || [];
        const badgeSpacing = 68;
        const startBadgeX = boxX + boxW / 2 - ((badges.length - 1) * badgeSpacing) / 2;

        for (let b = 0; b < badges.length; b++) {
            const bx = startBadgeX + b * badgeSpacing;
            const txt = badges[b];
            const isArrowConnector = (txt === '➔' || txt === '+');
            const isActiveBadge = (b === activeStepIdx);

            if (isArrowConnector) {
                ctx.font = 'bold 20px "Press Start 2P"';
                ctx.fillStyle = '#00ffff';
                ctx.fillText(txt, bx, badgeY + 8);
            } else {
                ctx.fillStyle = isActiveBadge ? '#ffcc00' : 'rgba(0, 229, 255, 0.22)';
                ctx.strokeStyle = isActiveBadge ? '#ffffff' : '#00ffff';
                ctx.lineWidth = 2.5;
                ctx.fillRect(bx - 28, badgeY - 22, 56, 44);
                ctx.strokeRect(bx - 28, badgeY - 22, 56, 44);

                ctx.font = 'bold 18px "Press Start 2P"';
                ctx.fillStyle = isActiveBadge ? '#000000' : '#ffffff';
                ctx.fillText(txt, bx, badgeY + 8);
            }
        }

        // Damage & Move Description at bottom of Right Preview Box
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px "Press Start 2P"';
        ctx.fillStyle = '#00ff88';
        ctx.fillText(combo.dmg, boxX + boxW / 2, badgeY + 54);

        ctx.font = '12px "Press Start 2P"';
        ctx.fillStyle = '#ddeeaa';
        // Word-wrap description into 2 clean lines
        const words = (combo.desc || '').split(' ');
        let line1 = '';
        let line2 = '';
        for (const w of words) {
            if ((line1 + ' ' + w).trim().length <= 44) {
                line1 = (line1 + ' ' + w).trim();
            } else {
                line2 = (line2 + ' ' + w).trim();
            }
        }
        ctx.fillText(line1, boxX + boxW / 2, badgeY + 84);
        if (line2) {
            ctx.fillText(line2, boxX + boxW / 2, badgeY + 106);
        }

        // Footer hint
        ctx.font = '13px "Press Start 2P"';
        ctx.fillStyle = '#88aacc';
        ctx.fillText('[↑/↓ ODER ANTIPPEN] KOMBO WÄHLEN   [←/→] KÄMPFER WECHSELN   [S / ZURÜCK] HAUPTMENÜ', cx, this.game.height - 56);
    }
}
