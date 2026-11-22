/**
 * OnlineLobbyState — Sleek Rounded Arcade-Neon Online Multiplayer Lobby.
 * Connects two iPhones, Androids, or PCs anywhere via a 4-digit Room Code for:
 *  1) 1 VS 1 DUELL (Head-to-head PvP!)
 *  2) 2P KOOP STORY (Fight side-by-side through the Story & unlock secret fighters!)
 */
import { ROSTER, SPECIALS, ALL_FIGHTERS, STAGES, isFighterUnlocked } from '../data.js?v=2.60';
import { STORY_PROLOGUE } from '../story_data.js?v=2.60';
import { preloadFighterSprites, preloadStageAssets } from '../core/AssetPreloader.js?v=2.60';

export default class OnlineLobbyState {
    constructor(game) {
        this.game = game;
        this.step = 'choice'; // 'choice' | 'enter_code' | 'room'
        this.selectedIndex = 0;
        this.inputCooldown = 0;
        this.time = 0;

        this.enteredCode = '';
        this.numpadIndex = 0; // For controller navigation on numpad

        // Available fighters for Online Mode (Main Roster + unlocked Specials on THIS device)
        this.selectableFighters = [];
        this.stageKeys = Object.keys(STAGES);
        this._onCanvasTap = null;
        this._onKeyDown = null;
    }

    _refreshSelectableFighters() {
        const unlockedSpecials = SPECIALS.filter(s => isFighterUnlocked(s.id));
        this.selectableFighters = [...ROSTER, ...unlockedSpecials];
        // Preload _front.png portraits for ALL fighters in ALL_FIGHTERS so even if the remote player picks a secret fighter not unlocked locally, their portrait renders!
        for (const f of ALL_FIGHTERS) {
            const key = `${f.id}_front.png`;
            if (!this.game.assetManager.images[key]) {
                this.game.assetManager.queueImage(key, `assets/CHARACTERS/${f.folder}/_front.png?v=2.60`);
            }
        }
        this.game.assetManager.loadAll();
    }

    enter(data) {
        this.time = 0;
        this.step = (data && data.step) ? data.step : 'choice';
        this.selectedIndex = 0;
        this.inputCooldown = 15;
        this.enteredCode = '';
        this._refreshSelectableFighters();

        this._setupListeners();
    }

    exit() {
        this._removeListeners();
    }

    _setupListeners() {
        this._removeListeners();

        this._lastTapAt = 0;

        this._onCanvasTap = (e) => {
            const now = performance.now();
            if (e.type === 'touchend') {
                this._lastTapAt = now;
            } else if (e.type === 'click' && now - this._lastTapAt < 400) {
                return;
            }

            const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
            let tx, ty;
            if (typeof window.mapTouchToCanvas === 'function') {
                const pt = window.mapTouchToCanvas(this.game.canvas, touch.clientX, touch.clientY);
                tx = pt.x;
                ty = pt.y;
            } else {
                const rect = this.game.canvas.getBoundingClientRect();
                const scaleX = this.game.canvas.width / rect.width;
                const scaleY = this.game.canvas.height / rect.height;
                tx = (touch.clientX - rect.left) * scaleX;
                ty = (touch.clientY - rect.top) * scaleY;
            }

            this._handleTap(tx, ty);
        };

        this._onKeyDown = (e) => {
            if (this.step === 'enter_code') {
                if (e.key >= '0' && e.key <= '9' && this.enteredCode.length < 4) {
                    this.enteredCode += e.key;
                    if (this.enteredCode.length === 4) {
                        this._submitJoinCode();
                    }
                } else if (e.key === 'Backspace') {
                    this.enteredCode = this.enteredCode.slice(0, -1);
                } else if (e.key === 'Enter' && this.enteredCode.length === 4) {
                    this._submitJoinCode();
                }
            }
        };

        this.game.canvas.addEventListener('touchend', this._onCanvasTap, { passive: true });
        this.game.canvas.addEventListener('click', this._onCanvasTap, { passive: true });
        window.addEventListener('keydown', this._onKeyDown);
    }

    _removeListeners() {
        if (this._onCanvasTap) {
            this.game.canvas.removeEventListener('touchend', this._onCanvasTap);
            this.game.canvas.removeEventListener('click', this._onCanvasTap);
            this._onCanvasTap = null;
        }
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
    }

    _handleTap(tx, ty) {
        const w = this.game.width;
        const cx = w / 2;

        // Top-left ZURÜCK pill button (x: 24..230, y: 20..88)
        if (tx < 250 && ty < 96) {
            this._goBack();
            return;
        }

        if (this.step === 'choice') {
            const cards = [
                { y: 300, action: () => this._startHosting('duel') },
                { y: 430, action: () => this._startHosting('coop') },
                { y: 560, action: () => { this.step = 'enter_code'; this.enteredCode = ''; this.inputCooldown = 15; } },
                { y: 690, action: () => this._startLocalCoopWithAI() },
                { y: 815, action: () => this._goBack() }
            ];
            for (let i = 0; i < cards.length; i++) {
                if (Math.abs(tx - cx) < 440 && Math.abs(ty - cards[i].y) < 52) {
                    this.selectedIndex = i;
                    cards[i].action();
                    return;
                }
            }
        } else if (this.step === 'enter_code') {
            const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
            const gridStartX = cx - 220;
            const gridStartY = 430;
            const cellW = 220;
            const cellH = 105;

            for (let i = 0; i < keys.length; i++) {
                const col = i % 3;
                const row = Math.floor(i / 3);
                const bx = gridStartX + col * cellW;
                const by = gridStartY + row * cellH;
                if (Math.abs(tx - bx) < 95 && Math.abs(ty - by) < 45) {
                    this._pressNumpadKey(keys[i]);
                    return;
                }
            }
        } else if (this.step === 'room') {
            const net = this.game.networkManager;
            // Two dedicated side-by-side Mode pills at y ~ 256:
            if (Math.abs(ty - 256) < 42 && Math.abs(tx - cx) < 480) {
                if (tx < cx) {
                    this._setMode('coop');
                } else {
                    this._setMode('duel');
                }
                return;
            }

            // Center Arena Selector Pill (y ~ 676, x ~ cx - 280 .. cx + 280)
            if (Math.abs(ty - 676) < 32 && Math.abs(tx - cx) < 290) {
                this._cycleStage(tx < cx ? -1 : 1);
                return;
            }

            // P1 character cycle (left card x ~ cx - 410, y ~ 304..640)
            if (Math.abs(tx - (cx - 410)) < 250 && ty > 304 && ty < 640) {
                if (net.role === 'host') {
                    this._cycleChar('host', tx < (cx - 410) ? -1 : 1);
                } else if (net.role === 'guest') {
                    // If Guest accidentally taps Left card, still cycle Guest's own fighter!
                    this._cycleChar('guest', tx < (cx - 410) ? -1 : 1);
                }
                return;
            }

            // P2 character cycle (right card x ~ cx + 410, y ~ 304..640)
            if (Math.abs(tx - (cx + 410)) < 250 && ty > 304 && ty < 640) {
                this._cycleChar('guest', tx < (cx + 410) ? -1 : 1);
                return;
            }

            // Start Online Match button (y ~ 808) — works for BOTH Host and Guest!
            if (Math.abs(tx - cx) < 400 && Math.abs(ty - 808) < 52) {
                if (net.role === 'host') {
                    this._launchOnlineMatch(false);
                } else if (net.role === 'guest' && net.status === 'connected') {
                    net.send({ type: 'START_MATCH_REQUEST' });
                }
                return;
            }
        }
    }

    _pressNumpadKey(key) {
        if (key === 'CLR') {
            this.enteredCode = '';
        } else if (key === 'OK') {
            if (this.enteredCode.length === 4) {
                this._submitJoinCode();
            }
        } else if (this.enteredCode.length < 4) {
            this.enteredCode += key;
            if (this.enteredCode.length === 4) {
                this._submitJoinCode();
            }
        }
    }

    async _startHosting(initialMode = 'coop') {
        this._refreshSelectableFighters();
        this.step = 'room';
        this.selectedIndex = 0;
        this.inputCooldown = 20;
        await this.game.networkManager.hostRoom(null, initialMode);
    }

    async _submitJoinCode() {
        if (this.enteredCode.length !== 4) return;
        this._refreshSelectableFighters();
        const code = this.enteredCode;
        this.step = 'room';
        this.inputCooldown = 20;
        await this.game.networkManager.joinRoom(code);
    }

    _startLocalCoopWithAI() {
        this.game.networkManager.disconnect();
        this._startCoopStoryRun('Keano', 'JJDark', false);
    }

    _setMode(targetMode) {
        const net = this.game.networkManager;
        const cleanMode = targetMode === 'duel' ? 'duel' : 'coop';
        if (net.role === 'host') {
            net.mode = cleanMode;
            net.syncLobby();
        } else if (net.role === 'guest') {
            net.mode = cleanMode;
            net.send({ type: 'GUEST_SELECT', mode: cleanMode });
        }
    }

    _toggleMode() {
        const net = this.game.networkManager;
        this._setMode(net.mode === 'coop' ? 'duel' : 'coop');
    }

    _cycleStage(dir) {
        const net = this.game.networkManager;
        const keys = this.stageKeys && this.stageKeys.length ? this.stageKeys : Object.keys(STAGES);
        let idx = keys.indexOf(net.stageId || 'Dojo');
        if (idx < 0) idx = 0;
        idx = (idx + dir + keys.length) % keys.length;
        const nextStage = keys[idx];
        net.stageId = nextStage;
        preloadStageAssets(this.game.assetManager, nextStage);
        this.game.assetManager.loadAll();

        if (net.role === 'host') {
            net.syncLobby();
        } else if (net.role === 'guest') {
            net.send({ type: 'GUEST_SELECT', stageId: nextStage });
        }
    }

    _startOnlineMatch() {
        this._launchOnlineMatch(false);
    }

    _cycleChar(which, dir) {
        this._refreshSelectableFighters();
        const net = this.game.networkManager;
        const list = this.selectableFighters;
        if (!list.length) return;

        const currentId = which === 'host' ? net.hostCharId : net.guestCharId;
        let idx = list.findIndex(f => f.id === currentId);
        if (idx < 0) idx = 0;
        idx = (idx + dir + list.length) % list.length;
        const nextChar = list[idx];

        const key = `${nextChar.id}_front.png`;
        if (!this.game.assetManager.images[key]) {
            this.game.assetManager.queueImage(key, `assets/CHARACTERS/${nextChar.folder}/_front.png?v=2.60`);
            this.game.assetManager.loadAll();
        }

        if (which === 'host' && net.role === 'host') {
            net.hostCharId = nextChar.id;
            net.syncLobby();
        } else if (which === 'guest') {
            if (net.role === 'host') {
                net.guestCharId = nextChar.id;
                net.syncLobby();
            } else if (net.role === 'guest') {
                net._guestHasPickedChar = true;
                net.guestCharId = nextChar.id;
                net.send({ type: 'GUEST_SELECT', guestCharId: nextChar.id });
            }
        }
    }

    _launchOnlineMatch(allowAIAllyFallback = false) {
        const net = this.game.networkManager;
        if (net.role !== 'host') return;
        if (net.status !== 'connected' && !allowAIAllyFallback) {
            net.errorMsg = 'Warte noch auf Spieler 2 (Code eingeben)!';
            return;
        }

        if (net.mode === 'coop') {
            this._startCoopStoryRun(net.hostCharId, net.guestCharId, net.status === 'connected');
        } else {
            this._startOnlineDuel(net.hostCharId, net.guestCharId);
        }
    }

    _startCoopStoryRun(p1Id, allyId, isOnlineConnected) {
        const net = this.game.networkManager;
        const p1Char = net.getFighterById(p1Id || 'Keano');
        const allyChar = net.getFighterById(allyId || 'JJDark');
        const opponent = ROSTER[1]; // Stage 1: Hattori
        const stageId = opponent.stageId;

        preloadFighterSprites(this.game.assetManager, p1Char);
        preloadFighterSprites(this.game.assetManager, allyChar);
        preloadFighterSprites(this.game.assetManager, opponent);
        preloadStageAssets(this.game.assetManager, stageId);
        this.game.assetManager.loadAll();

        const combatData = {
            p1: p1Char,
            ally: allyChar,
            p2: { ...opponent, rosterIndex: 1 },
            stageId: stageId,
            arcadeMode: true,
            storyMode: true,
            coopMode: true,
            onlineMode: isOnlineConnected ? 'coop' : null,
            arcadeIndex: 1,
            arcadeWins: 0
        };

        const storyPayload = {
            ...STORY_PROLOGUE,
            nextState: 'VersusIntro',
            nextData: combatData
        };

        this.game.audioManager.stopBGM();
        if (isOnlineConnected && net.role === 'host') {
            net.send({
                type: 'STATE_SWITCH',
                stateName: 'Story',
                stateData: storyPayload
            });
        }
        this.game.stateManager.switchState('Story', storyPayload);
    }

    _startOnlineDuel(p1Id, p2Id) {
        const net = this.game.networkManager;
        const p1Char = net.getFighterById(p1Id || 'Keano');
        const p2Char = net.getFighterById(p2Id || 'JJDark');
        const stageId = net.stageId || p2Char.stageId || 'Dojo';

        preloadFighterSprites(this.game.assetManager, p1Char);
        preloadFighterSprites(this.game.assetManager, p2Char);
        preloadStageAssets(this.game.assetManager, stageId);
        this.game.assetManager.loadAll();

        const combatData = {
            p1: p1Char,
            p2: p2Char,
            stageId: stageId,
            arcadeMode: false,
            storyMode: false,
            coopMode: false,
            onlineMode: 'duel'
        };

        this.game.audioManager.stopBGM();
        if (net.role === 'host') {
            net.send({
                type: 'STATE_SWITCH',
                stateName: 'VersusIntro',
                stateData: combatData
            });
        }
        this.game.stateManager.switchState('VersusIntro', combatData);
    }

    _goBack() {
        if (this.step !== 'choice') {
            this.game.networkManager.disconnect();
            this.step = 'choice';
            this.selectedIndex = 0;
            this.inputCooldown = 15;
            return;
        }
        this.game.networkManager.disconnect();
        this.game.stateManager.switchState('Menu');
    }

    update(dt) {
        this.time += dt;
        if (this.inputCooldown > 0) this.inputCooldown--;

        const p1 = this.game.inputManager.p1;
        if (this.inputCooldown > 0) return;

        if (p1.menuJust) {
            this._goBack();
            return;
        }

        if (this.step === 'choice') {
            if (p1.upJust) {
                this.selectedIndex = (this.selectedIndex - 1 + 5) % 5;
                this.inputCooldown = 10;
            } else if (p1.downJust) {
                this.selectedIndex = (this.selectedIndex + 1) % 5;
                this.inputCooldown = 10;
            } else if (p1.lJust || p1.hJust || p1.sJust) {
                this.inputCooldown = 18;
                if (this.selectedIndex === 0) this._startHosting('duel');
                else if (this.selectedIndex === 1) this._startHosting('coop');
                else if (this.selectedIndex === 2) { this.step = 'enter_code'; this.enteredCode = ''; }
                else if (this.selectedIndex === 3) this._startLocalCoopWithAI();
                else this._goBack();
            }
        } else if (this.step === 'enter_code') {
            const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
            if (p1.rightJust) { this.numpadIndex = (this.numpadIndex + 1) % keys.length; this.inputCooldown = 8; }
            else if (p1.leftJust) { this.numpadIndex = (this.numpadIndex - 1 + keys.length) % keys.length; this.inputCooldown = 8; }
            else if (p1.downJust) { this.numpadIndex = (this.numpadIndex + 3) % keys.length; this.inputCooldown = 8; }
            else if (p1.upJust) { this.numpadIndex = (this.numpadIndex - 3 + keys.length) % keys.length; this.inputCooldown = 8; }
            else if (p1.lJust || p1.hJust) {
                this.inputCooldown = 12;
                this._pressNumpadKey(keys[this.numpadIndex]);
            } else if (p1.sJust) {
                this._goBack();
            }
        } else if (this.step === 'room') {
            const net = this.game.networkManager;
            if (p1.upJust || p1.downJust) {
                this._toggleMode();
                this.inputCooldown = 12;
            } else if (p1.leftJust) {
                this._cycleChar(net.role === 'guest' ? 'guest' : 'host', -1);
                this.inputCooldown = 10;
            } else if (p1.rightJust) {
                this._cycleChar(net.role === 'guest' ? 'guest' : 'host', 1);
                this.inputCooldown = 10;
            } else if (p1.lJust || p1.hJust) {
                if (net.role === 'host') {
                    this._launchOnlineMatch(false);
                    this.inputCooldown = 20;
                } else if (net.role === 'guest' && net.status === 'connected') {
                    net.send({ type: 'START_MATCH_REQUEST' });
                    this.inputCooldown = 20;
                }
            } else if (p1.sJust) {
                this._goBack();
            }
        }
    }

    /** Helper to draw sleek modern rounded Arcade-Neon pill/card buttons */
    _drawRoundedBox(ctx, x, y, w, h, radius, fillStyle, strokeStyle, lineWidth = 2.5, glowColor = null) {
        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, w, h, radius);
        } else {
            ctx.rect(x, y, w, h);
        }
        if (glowColor) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 16;
        }
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (strokeStyle && lineWidth > 0) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        // Subtle top glass shine
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x + 3, y + 2, w - 6, Math.max(8, h * 0.36), Math.max(4, radius - 3));
        } else {
            ctx.rect(x + 3, y + 2, w - 6, Math.max(8, h * 0.36));
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
        ctx.fill();
        ctx.restore();
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        const cx = w / 2;

        // Background
        const bg = this.game.assetManager.images['menuBg'];
        if (bg) {
            ctx.drawImage(bg, 0, 0, w, h);
        }
        ctx.fillStyle = 'rgba(6, 8, 22, 0.88)';
        ctx.fillRect(0, 0, w, h);

        // Top-left sleek rounded ZURÜCK pill button (never overlaps top-right mobile VOLLBILD / Menu buttons!)
        this._drawRoundedBox(
            ctx,
            28,
            24,
            195,
            52,
            26,
            'rgba(255, 45, 95, 0.22)',
            '#ff3366',
            2.5,
            'rgba(255, 51, 102, 0.45)'
        );
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('◀ ZURÜCK', 125, 57);

        // Header
        ctx.font = 'bold 44px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 18;
        ctx.fillText('ONLINE & KOOP', cx, 98);
        ctx.shadowBlur = 0;

        ctx.font = '15px "Press Start 2P"';
        ctx.fillStyle = '#aaddff';
        ctx.fillText('1 VS 1 DUELL ODER TEAM-STORY', cx, 140);

        if (this.step === 'choice') {
            this._drawChoiceStep(ctx, cx);
        } else if (this.step === 'enter_code') {
            this._drawEnterCodeStep(ctx, cx);
        } else if (this.step === 'room') {
            this._drawRoomStep(ctx, cx);
        }
    }

    _drawChoiceStep(ctx, cx) {
        // Clean, short titles without broken U+2694 emoji so iOS Safari centers every button 100% accurately!
        const items = [
            {
                title: '1 VS 1 DUELL',
                sub: 'Raum-Code erstellen & gegeneinander kämpfen',
                color: '#ff3366',
                bgActive: 'rgba(255, 51, 102, 0.24)',
                y: 300
            },
            {
                title: '2P KOOP STORY',
                sub: 'Raum-Code erstellen & im Team gegen Bosse',
                color: '#00ff88',
                bgActive: 'rgba(0, 255, 136, 0.22)',
                y: 430
            },
            {
                title: 'CODE EINGEBEN',
                sub: 'Mit 4-stelligem Code von Spieler 1 beitreten',
                color: '#bb66ff',
                bgActive: 'rgba(187, 102, 255, 0.24)',
                y: 560
            },
            {
                title: 'SOLO KOOP (MIT KI)',
                sub: 'Sofort mit KI-Partner durch die Story',
                color: '#ffcc00',
                bgActive: 'rgba(255, 204, 0, 0.22)',
                y: 690
            },
            {
                title: 'HAUPTMENÜ',
                sub: '',
                color: '#ff4466',
                bgActive: 'rgba(255, 68, 102, 0.22)',
                y: 815
            }
        ];

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const isSel = (i === this.selectedIndex);
            const boxW = it.sub ? 840 : 520;
            const boxH = it.sub ? 96 : 68;
            const radius = it.sub ? 22 : 34;

            this._drawRoundedBox(
                ctx,
                cx - boxW / 2,
                it.y - boxH / 2,
                boxW,
                boxH,
                radius,
                isSel ? it.bgActive : 'rgba(14, 20, 42, 0.88)',
                isSel ? it.color : '#33486e',
                isSel ? 3.5 : 2,
                isSel ? it.color : null
            );

            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = isSel ? it.color : '#ffffff';
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillText(it.title, cx, it.sub ? it.y - 6 : it.y + 9);

            if (it.sub) {
                ctx.fillStyle = isSel ? '#eef6ff' : '#99bbdd';
                ctx.font = '13px "Press Start 2P"';
                ctx.fillText(it.sub, cx, it.y + 26);
            }
            ctx.restore();
        }
    }

    _drawEnterCodeStep(ctx, cx) {
        ctx.font = 'bold 24px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('RAUM-CODE EINGEBEN:', cx, 235);

        // 4 Rounded Digit Slots
        const slotW = 102;
        const gap = 24;
        const startX = cx - (4 * slotW + 3 * gap) / 2 + slotW / 2;

        for (let i = 0; i < 4; i++) {
            const sx = startX + i * (slotW + gap);
            const sy = 315;
            const ch = this.enteredCode[i] || '_';
            const isActiveSlot = (i === this.enteredCode.length);

            this._drawRoundedBox(
                ctx,
                sx - slotW / 2,
                sy - 50,
                slotW,
                96,
                18,
                'rgba(0, 235, 255, 0.12)',
                isActiveSlot ? '#00ffff' : '#446688',
                isActiveSlot ? 3.5 : 2,
                isActiveSlot ? '#00ffff' : null
            );

            ctx.fillStyle = '#fdbf00';
            ctx.font = 'bold 44px "Press Start 2P"';
            ctx.fillText(ch, sx, sy + 15);
        }

        // 4x3 Rounded Touch & Controller Numpad
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
        const gridStartX = cx - 220;
        const gridStartY = 430;
        const cellW = 220;
        const cellH = 105;

        for (let i = 0; i < keys.length; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const bx = gridStartX + col * cellW;
            const by = gridStartY + row * cellH;
            const isSel = (i === this.numpadIndex);
            const k = keys[i];
            const accent = k === 'OK' ? '#00ff88' : (k === 'CLR' ? '#ff5577' : '#00ffff');

            this._drawRoundedBox(
                ctx,
                bx - 92,
                by - 41,
                184,
                82,
                20,
                isSel ? 'rgba(0, 235, 255, 0.24)' : 'rgba(18, 26, 48, 0.92)',
                isSel ? accent : '#3d5278',
                isSel ? 3 : 2,
                isSel ? accent : null
            );

            ctx.fillStyle = k === 'OK' ? '#00ff88' : (k === 'CLR' ? '#ff5577' : '#ffffff');
            ctx.font = 'bold 28px "Press Start 2P"';
            ctx.fillText(k, bx, by + 11);
        }
    }

    _drawRoomStep(ctx, cx) {
        const net = this.game.networkManager;
        const isConnected = net.status === 'connected';
        const isCoop = net.mode === 'coop';

        // Room Code Pill Banner
        this._drawRoundedBox(
            ctx,
            cx - 260,
            162,
            520,
            52,
            26,
            'rgba(253, 191, 0, 0.14)',
            '#fdbf00',
            2.5,
            'rgba(253, 191, 0, 0.35)'
        );
        ctx.font = 'bold 26px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.textAlign = 'center';
        ctx.fillText(`CODE: ${net.roomCode || '----'}`, cx, 198);

        // Two Sleek Rounded Mode Pills (Zero emoji width shift!)
        const btnW = 390;
        const btnH = 56;
        const coopX = cx - 210;
        const duelX = cx + 210;
        const modeY = 256;

        // Pill 1: 2P KOOP
        this._drawRoundedBox(
            ctx,
            coopX - btnW / 2,
            modeY - btnH / 2,
            btnW,
            btnH,
            28,
            isCoop ? 'rgba(0, 255, 136, 0.26)' : 'rgba(16, 22, 42, 0.86)',
            isCoop ? '#00ff88' : '#33486e',
            isCoop ? 3.5 : 2,
            isCoop ? '#00ff88' : null
        );
        ctx.fillStyle = isCoop ? '#00ff88' : '#88a0c0';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.fillText('2P KOOP STORY', coopX, modeY + 7);

        // Pill 2: 1 VS 1 DUELL
        this._drawRoundedBox(
            ctx,
            duelX - btnW / 2,
            modeY - btnH / 2,
            btnW,
            btnH,
            28,
            !isCoop ? 'rgba(255, 51, 102, 0.28)' : 'rgba(16, 22, 42, 0.86)',
            !isCoop ? '#ff3366' : '#33486e',
            !isCoop ? 3.5 : 2,
            !isCoop ? '#ff3366' : null
        );
        ctx.fillStyle = !isCoop ? '#ff3366' : '#88a0c0';
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.fillText('1 VS 1 DUELL', duelX, modeY + 7);

        // Player 1 & Player 2 Fighter Cards (y=470, boxH=336 -> bottom at 638, leaving clean gap above Arena Pill at 652..700)
        this._drawFighterSlot(
            ctx,
            cx - 410,
            470,
            net.role === 'host' ? 'DU: SPIELER 1 (HOST)' : 'SPIELER 1 (HOST)',
            net.getFighterById(net.hostCharId),
            '#00ffff',
            net.role === 'host'
        );

        this._drawFighterSlot(
            ctx,
            cx + 410,
            470,
            net.role === 'guest'
                ? 'DU: SPIELER 2 (GAST)'
                : (isConnected ? 'SPIELER 2 (BEREIT)' : 'SPIELER 2 (WARTET)'),
            net.getFighterById(net.guestCharId),
            isCoop ? '#00ff88' : '#ff3366',
            true
        );

        // Center VS / TEAM Badge
        if (isCoop) {
            ctx.font = 'bold 32px "Press Start 2P"';
            ctx.fillStyle = '#00ff88';
            ctx.fillText('TEAM', cx, 450);
            ctx.font = 'bold 15px "Press Start 2P"';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('GEGEN', cx, 485);
            ctx.fillStyle = '#ff4466';
            ctx.fillText('1. BOSS:', cx, 513);
            ctx.fillStyle = '#ffffff';
            ctx.fillText((ROSTER[1] && ROSTER[1].name) || 'HATTORI', cx, 541);
        } else {
            ctx.font = 'bold 50px "Press Start 2P"';
            ctx.fillStyle = '#ff3366';
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 16;
            ctx.fillText('VS', cx, 492);
            ctx.shadowBlur = 0;
            ctx.font = 'bold 14px "Press Start 2P"';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText('DIREKTES DUELL', cx, 530);
        }

        // Interactive Center Arena Selector Pill (y = 676)
        const curStageKey = net.stageId || 'Dojo';
        const stageName = (STAGES[curStageKey] && STAGES[curStageKey].name) ? STAGES[curStageKey].name.toUpperCase() : curStageKey.toUpperCase();
        this._drawRoundedBox(
            ctx,
            cx - 275,
            676 - 24,
            550,
            48,
            24,
            'rgba(0, 229, 255, 0.16)',
            '#00e5ff',
            2.5,
            'rgba(0, 229, 255, 0.35)'
        );
        ctx.font = 'bold 15px "Press Start 2P"';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.fillText(`ARENA: ◀ ${stageName} ▶`, cx, 683);

        // Connection Status & Ping
        ctx.font = 'bold 18px "Press Start 2P"';
        if (isConnected) {
            ctx.fillStyle = '#00ff88';
            const pingTxt = net.latencyMs ? ` (${net.latencyMs}ms)` : '';
            ctx.fillText(`VERBUNDEN! BEREIT ZUM KAMPF${pingTxt}`, cx, 744);
        } else if (net.status === 'error') {
            ctx.fillStyle = '#ff4466';
            ctx.fillText(net.errorMsg || 'Verbindungsfehler', cx, 744);
        } else {
            ctx.fillStyle = '#ffcc00';
            const msg = net.role === 'host'
                ? `Spieler 2 gibt Code ${net.roomCode} ein...`
                : `Verbinde mit Raum ${net.roomCode}...`;
            ctx.fillText(msg, cx, 744);
        }

        // Sleek Rounded Start Pill Button
        const canStart = isConnected;
        const startW = 680;
        const startH = 74;
        this._drawRoundedBox(
            ctx,
            cx - startW / 2,
            808 - startH / 2,
            startW,
            startH,
            37,
            canStart ? 'rgba(0, 255, 136, 0.25)' : 'rgba(55, 65, 90, 0.35)',
            canStart ? '#00ff88' : '#556688',
            canStart ? 3.5 : 2,
            canStart ? '#00ff88' : null
        );

        ctx.fillStyle = canStart ? '#00ff88' : '#8899bb';
        ctx.font = 'bold 24px "Press Start 2P"';
        const modeStartText = isCoop ? 'KOOP STARTEN!' : 'DUELL STARTEN!';
        ctx.fillText(
            canStart ? modeStartText : 'WARTE AUF SPIELER 2...',
            cx,
            818
        );
    }

    _drawFighterSlot(ctx, x, y, header, fighter, color, canChange) {
        const boxW = 460;
        const boxH = 336;

        this._drawRoundedBox(
            ctx,
            x - boxW / 2,
            y - boxH / 2,
            boxW,
            boxH,
            22,
            'rgba(12, 16, 36, 0.92)',
            color,
            3,
            color
        );

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.fillText(header, x, y - boxH / 2 + 34);

        const img = this.game.assetManager.images[`${fighter.id}_front.png`]
            || this.game.assetManager.images[`${fighter.id}_right.png`];
        if (img && (img.naturalWidth || img.width)) {
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const targetH = 180;
            const scale = targetH / ih;
            const drawW = iw * scale;
            ctx.drawImage(img, x - drawW / 2, y - 116, drawW, targetH);
        }

        if (canChange) {
            // Prominent neon ◀ and ▶ touch buttons on left and right sides of the card!
            this._drawRoundedBox(ctx, x - boxW / 2 + 14, y - 34, 54, 54, 14, 'rgba(0, 229, 255, 0.25)', color, 2.5, color);
            this._drawRoundedBox(ctx, x + boxW / 2 - 68, y - 34, 54, 54, 14, 'rgba(0, 229, 255, 0.25)', color, 2.5, color);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillText('◀', x - boxW / 2 + 41, y + 3);
            ctx.fillText('▶', x + boxW / 2 - 41, y + 3);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px "Press Start 2P"';
        const label = canChange ? `◀ ${fighter.name.toUpperCase()} ▶` : fighter.name.toUpperCase();
        ctx.fillText(label, x, y + 104);

        ctx.fillStyle = '#99bbdd';
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(fighter.nickname || '', x, y + 128);

        if (canChange) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 10px "Press Start 2P"';
            ctx.fillText(`TIPPE ◀ / ▶ ZUM KÄMPFER WÄHLEN (${this.selectableFighters.length} FREI)`, x, y + 152);
        }
        ctx.restore();
    }
}
