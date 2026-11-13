/**
 * OnlineLobbyState — Mobile- & Controller-friendly Online Multiplayer Lobby.
 * Allows two iPhones (or PCs) to connect via a 4-digit Room Code for:
 *  1) CO-OP STORY MODE (Keano & JJ Dark fight side-by-side through the Story & unlock secret fighters!)
 *  2) 1v1 DUEL MODE (Keano vs JJ Dark head-to-head!)
 */
import { ROSTER, SPECIALS, isFighterUnlocked } from '../data.js';
import { STORY_PROLOGUE } from '../story_data.js';
import { preloadFighterSprites, preloadStageAssets } from '../core/AssetPreloader.js';

export default class OnlineLobbyState {
    constructor(game) {
        this.game = game;
        this.step = 'choice'; // 'choice' | 'enter_code' | 'room'
        this.selectedIndex = 0;
        this.inputCooldown = 0;
        this.time = 0;

        this.enteredCode = '';
        this.numpadIndex = 0; // For controller navigation on numpad

        // Available fighters for Online Mode (Main Roster + unlocked Specials)
        this.selectableFighters = [];
        this._onCanvasTap = null;
        this._onKeyDown = null;
    }

    _refreshSelectableFighters() {
        const unlockedSpecials = SPECIALS.filter(s => isFighterUnlocked(s.id));
        this.selectableFighters = [...ROSTER, ...unlockedSpecials];
        // Preload portraits for Keano & JJ Dark immediately
        for (const f of this.selectableFighters) {
            if (f.id === 'Keano' || f.id === 'JJDark') {
                const key = `${f.id}_front.png`;
                if (!this.game.assetManager.images[key]) {
                    this.game.assetManager.queueImage(key, `assets/CHARACTERS/${f.folder}/_front.png`);
                }
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

        this._onCanvasTap = (e) => {
            const rect = this.game.canvas.getBoundingClientRect();
            const scaleX = this.game.canvas.width / rect.width;
            const scaleY = this.game.canvas.height / rect.height;
            const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
            const tx = (touch.clientX - rect.left) * scaleX;
            const ty = (touch.clientY - rect.top) * scaleY;

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
        const h = this.game.height;
        const cx = w / 2;

        // Top-right BACK / MENU button
        if (tx > w - 260 && ty < 100) {
            this._goBack();
            return;
        }

        if (this.step === 'choice') {
            // 3 large choice cards
            const cards = [
                { y: 390, action: () => this._startHosting() },
                { y: 540, action: () => { this.step = 'enter_code'; this.enteredCode = ''; this.inputCooldown = 15; } },
                { y: 690, action: () => this._startLocalCoopWithAI() },
                { y: 830, action: () => this._goBack() }
            ];
            for (let i = 0; i < cards.length; i++) {
                if (Math.abs(tx - cx) < 520 && Math.abs(ty - cards[i].y) < 58) {
                    this.selectedIndex = i;
                    cards[i].action();
                    return;
                }
            }
        } else if (this.step === 'enter_code') {
            // Check 4x3 Numpad buttons
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
            // Mode toggle button (y ~ 260)
            if (Math.abs(tx - cx) < 460 && Math.abs(ty - 260) < 48) {
                this._toggleMode();
                return;
            }

            // P1 character cycle (left card x ~ cx - 420, y ~ 360..700)
            if (Math.abs(tx - (cx - 420)) < 260 && ty > 340 && ty < 720) {
                if (net.role === 'host') {
                    this._cycleChar('host', tx < (cx - 420) ? -1 : 1);
                }
                return;
            }

            // P2 character cycle (right card x ~ cx + 420, y ~ 340..720)
            if (Math.abs(tx - (cx + 420)) < 260 && ty > 340 && ty < 720) {
                this._cycleChar('guest', tx < (cx + 420) ? -1 : 1);
                return;
            }

            // Start Online Match button (y ~ 810)
            if (Math.abs(tx - cx) < 450 && Math.abs(ty - 810) < 55) {
                if (net.role === 'host') {
                    this._launchOnlineMatch(false);
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

    async _startHosting() {
        this.step = 'room';
        this.selectedIndex = 0;
        this.inputCooldown = 20;
        await this.game.networkManager.hostRoom();
    }

    async _submitJoinCode() {
        if (this.enteredCode.length !== 4) return;
        const code = this.enteredCode;
        this.step = 'room';
        this.inputCooldown = 20;
        await this.game.networkManager.joinRoom(code);
    }

    _startLocalCoopWithAI() {
        // Immediate Co-Op Story with Keano (Player 1) + JJ Dark (AI Partner)
        this.game.networkManager.disconnect();
        this._startCoopStoryRun('Keano', 'JJDark', false);
    }

    _toggleMode() {
        const net = this.game.networkManager;
        const nextMode = net.mode === 'coop' ? 'duel' : 'coop';
        if (net.role === 'host') {
            net.mode = nextMode;
            net.syncLobby();
        } else if (net.role === 'guest') {
            net.send({ type: 'GUEST_SELECT', mode: nextMode });
        }
    }

    _cycleChar(which, dir) {
        const net = this.game.networkManager;
        const list = this.selectableFighters;
        if (!list.length) return;

        const currentId = which === 'host' ? net.hostCharId : net.guestCharId;
        let idx = list.findIndex(f => f.id === currentId);
        if (idx < 0) idx = 0;
        idx = (idx + dir + list.length) % list.length;
        const nextChar = list[idx];

        // Lazy-load portrait if needed
        const key = `${nextChar.id}_front.png`;
        if (!this.game.assetManager.images[key]) {
            this.game.assetManager.queueImage(key, `assets/CHARACTERS/${nextChar.folder}/_front.png`);
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
                net.guestCharId = nextChar.id;
                net.send({ type: 'GUEST_SELECT', guestCharId: nextChar.id });
            }
        }
    }

    _launchOnlineMatch(allowAIAllyFallback = false) {
        const net = this.game.networkManager;
        if (net.role !== 'host') return;
        if (net.status !== 'connected' && !allowAIAllyFallback) {
            net.errorMsg = 'Warte noch auf das 2. iPhone (Code eingeben)!';
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
        const stageId = p2Char.stageId || 'Dojo';

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
                this.selectedIndex = (this.selectedIndex - 1 + 4) % 4;
                this.inputCooldown = 10;
            } else if (p1.downJust) {
                this.selectedIndex = (this.selectedIndex + 1) % 4;
                this.inputCooldown = 10;
            } else if (p1.lJust || p1.hJust || p1.sJust) {
                this.inputCooldown = 18;
                if (this.selectedIndex === 0) this._startHosting();
                else if (this.selectedIndex === 1) { this.step = 'enter_code'; this.enteredCode = ''; }
                else if (this.selectedIndex === 2) this._startLocalCoopWithAI();
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
                }
            } else if (p1.sJust) {
                this._goBack();
            }
        }
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

        // Top-right BACK button
        ctx.fillStyle = 'rgba(255, 50, 80, 0.2)';
        ctx.fillRect(w - 230, 24, 200, 56);
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.strokeRect(w - 230, 24, 200, 56);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('ZURÜCK', w - 130, 60);

        // Header
        ctx.font = 'bold 52px "Press Start 2P"';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 18;
        ctx.fillText('ONLINE & KOOP MODUS', cx, 110);
        ctx.shadowBlur = 0;

        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = '#aaddff';
        ctx.fillText('KEANO 🔥 & JJ DARK 💫 — ZUSAMMEN AUF 2 IPHONES', cx, 160);

        if (this.step === 'choice') {
            this._drawChoiceStep(ctx, cx);
        } else if (this.step === 'enter_code') {
            this._drawEnterCodeStep(ctx, cx);
        } else if (this.step === 'room') {
            this._drawRoomStep(ctx, cx);
        }
    }

    _drawChoiceStep(ctx, cx) {
        const items = [
            {
                title: '1. RAUM ERSTELLEN (SPIELER 1)',
                sub: 'Erstellt einen 4-stelligen Code für das 2. iPhone',
                color: '#00ffff',
                y: 390
            },
            {
                title: '2. MIT CODE BEITRETEN (SPIELER 2)',
                sub: '4-stelligen Raum-Code vom 1. iPhone eingeben',
                color: '#bb66ff',
                y: 540
            },
            {
                title: '3. SOFORT KOOP MIT KI-PARTNER',
                sub: 'Keano & JJ Dark kämpfen sofort zusammen durch die Story!',
                color: '#ffcc00',
                y: 690
            },
            {
                title: 'ZURÜCK ZUM HAUPTMENÜ',
                sub: '',
                color: '#ff4466',
                y: 830
            }
        ];

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const isSel = (i === this.selectedIndex);
            const boxW = 1040;
            const boxH = it.sub ? 110 : 80;

            ctx.save();
            ctx.fillStyle = isSel ? 'rgba(0, 220, 255, 0.18)' : 'rgba(15, 20, 40, 0.85)';
            ctx.fillRect(cx - boxW / 2, it.y - boxH / 2, boxW, boxH);
            ctx.strokeStyle = isSel ? it.color : '#334466';
            ctx.lineWidth = isSel ? 4 : 2;
            ctx.strokeRect(cx - boxW / 2, it.y - boxH / 2, boxW, boxH);

            ctx.fillStyle = isSel ? it.color : '#ffffff';
            ctx.font = 'bold 28px "Press Start 2P"';
            ctx.fillText(it.title, cx, it.sub ? it.y - 10 : it.y + 10);

            if (it.sub) {
                ctx.fillStyle = '#99bbdd';
                ctx.font = '16px "Press Start 2P"';
                ctx.fillText(it.sub, cx, it.y + 30);
            }
            ctx.restore();
        }
    }

    _drawEnterCodeStep(ctx, cx) {
        ctx.font = 'bold 28px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('4-STELLIGEN RAUM-CODE EINGEBEN:', cx, 240);

        // 4 Digit Slots
        const slotW = 100;
        const gap = 25;
        const startX = cx - (4 * slotW + 3 * gap) / 2 + slotW / 2;

        for (let i = 0; i < 4; i++) {
            const sx = startX + i * (slotW + gap);
            const sy = 315;
            const ch = this.enteredCode[i] || '_';

            ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
            ctx.fillRect(sx - slotW / 2, sy - 50, slotW, 95);
            ctx.strokeStyle = i === this.enteredCode.length ? '#00ffff' : '#446688';
            ctx.lineWidth = 3;
            ctx.strokeRect(sx - slotW / 2, sy - 50, slotW, 95);

            ctx.fillStyle = '#fdbf00';
            ctx.font = 'bold 48px "Press Start 2P"';
            ctx.fillText(ch, sx, sy + 16);
        }

        // 4x3 Touch & Controller Numpad
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

            ctx.fillStyle = isSel ? 'rgba(0, 255, 255, 0.25)' : 'rgba(20, 28, 50, 0.9)';
            ctx.fillRect(bx - 95, by - 42, 190, 84);
            ctx.strokeStyle = isSel ? '#00ffff' : '#445577';
            ctx.lineWidth = isSel ? 3 : 2;
            ctx.strokeRect(bx - 95, by - 42, 190, 84);

            ctx.fillStyle = keys[i] === 'OK' ? '#00ff88' : (keys[i] === 'CLR' ? '#ff5577' : '#ffffff');
            ctx.font = 'bold 30px "Press Start 2P"';
            ctx.fillText(keys[i], bx, by + 12);
        }
    }

    _drawRoomStep(ctx, cx) {
        const net = this.game.networkManager;
        const isConnected = net.status === 'connected';

        // Room Code Banner
        ctx.font = 'bold 34px "Press Start 2P"';
        ctx.fillStyle = '#fdbf00';
        ctx.fillText(`RAUM-CODE: ${net.roomCode || '----'}`, cx, 215);

        // Mode Switcher Bar
        const modeLabel = net.mode === 'coop'
            ? '🤝 MODUS: KOOP STORY (ZUSAMMEN DURCHSPIELEN)'
            : '⚔️ MODUS: 1 VS 1 DUELL (GEGENEINANDER)';
        ctx.fillStyle = 'rgba(0, 212, 255, 0.16)';
        ctx.fillRect(cx - 520, 232, 1040, 56);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 520, 232, 1040, 56);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.fillText(`◀  ${modeLabel}  ▶`, cx, 268);

        // Player 1 & Player 2 Fighter Cards
        this._drawFighterSlot(
            ctx,
            cx - 420,
            510,
            'SPIELER 1 (IPHONE 1)',
            net.getFighterById(net.hostCharId),
            '#00ffff',
            net.role === 'host'
        );

        this._drawFighterSlot(
            ctx,
            cx + 420,
            510,
            isConnected ? 'SPIELER 2 (IPHONE 2 ✅)' : 'SPIELER 2 (WARTET...)',
            net.getFighterById(net.guestCharId),
            '#bb66ff',
            true
        );

        // Center VS / TEAM Badge
        ctx.font = 'bold 44px "Press Start 2P"';
        ctx.fillStyle = net.mode === 'coop' ? '#00ff88' : '#ff3366';
        ctx.fillText(net.mode === 'coop' ? 'TEAM' : 'VS', cx, 520);

        // Connection Status & Ping
        ctx.font = 'bold 20px "Press Start 2P"';
        if (isConnected) {
            ctx.fillStyle = '#00ff88';
            const pingTxt = net.latencyMs ? ` (${net.latencyMs}ms)` : '';
            ctx.fillText(`✅ BEIDE IPHONES LIVE VERBUNDEN!${pingTxt}`, cx, 735);
        } else if (net.status === 'error') {
            ctx.fillStyle = '#ff4466';
            ctx.fillText(`⚠️ ${net.errorMsg}`, cx, 735);
        } else {
            ctx.fillStyle = '#ffcc00';
            const msg = net.role === 'host'
                ? `⏳ Gib auf dem 2. iPhone den Code ${net.roomCode} ein...`
                : `⏳ Verbinde mit Raum ${net.roomCode}...`;
            ctx.fillText(msg, cx, 735);
        }

        // Start Button (Host)
        if (net.role === 'host') {
            const canStart = isConnected;
            ctx.fillStyle = canStart ? 'rgba(0, 255, 128, 0.25)' : 'rgba(80, 80, 100, 0.3)';
            ctx.fillRect(cx - 440, 765, 880, 82);
            ctx.strokeStyle = canStart ? '#00ff88' : '#666688';
            ctx.lineWidth = 3;
            ctx.strokeRect(cx - 440, 765, 880, 82);

            ctx.fillStyle = canStart ? '#00ff88' : '#8888aa';
            ctx.font = 'bold 28px "Press Start 2P"';
            ctx.fillText(
                canStart ? '🚀 ONLINE KAMPF STARTEN!' : 'WARTE AUF SPIELER 2...',
                cx,
                816
            );
        } else {
            ctx.fillStyle = '#aaddff';
            ctx.font = '20px "Press Start 2P"';
            ctx.fillText('Spieler 1 startet gleich das Match...', cx, 815);
        }
    }

    _drawFighterSlot(ctx, x, y, header, fighter, color, canChange) {
        const boxW = 480;
        const boxH = 360;

        ctx.save();
        ctx.fillStyle = 'rgba(12, 16, 34, 0.9)';
        ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

        ctx.fillStyle = color;
        ctx.font = 'bold 18px "Press Start 2P"';
        ctx.fillText(header, x, y - boxH / 2 + 36);

        const img = this.game.assetManager.images[`${fighter.id}_front.png`];
        if (img && img.naturalWidth) {
            const targetH = 210;
            const scale = targetH / img.naturalHeight;
            const drawW = img.naturalWidth * scale;
            ctx.drawImage(img, x - drawW / 2, y - 115, drawW, targetH);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Press Start 2P"';
        const label = canChange ? `◀ ${fighter.name.toUpperCase()} ▶` : fighter.name.toUpperCase();
        ctx.fillText(label, x, y + 135);

        ctx.fillStyle = '#99bbdd';
        ctx.font = '14px "Press Start 2P"';
        ctx.fillText(fighter.nickname || '', x, y + 165);
        ctx.restore();
    }
}
