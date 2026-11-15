/**
 * NetworkManager — Peer-to-Peer Online Multiplayer (WebRTC via PeerJS + BroadcastChannel fallback)
 * Connects two iPhones / browsers anywhere using a simple 4-digit Room Code.
 * Supports:
 *  - CO-OP STORY MODE (Host = P1 e.g. Keano, Guest = Ally e.g. JJ Dark, fighting together through Story Mode!)
 *  - 1v1 DUEL MODE (Host = P1, Guest = P2 fighting head-to-head!)
 */
import { ROSTER, ALL_FIGHTERS, unlockFighter } from '../data.js';
import { preloadFighterSprites, preloadStageAssets } from './AssetPreloader.js';

const PEER_PREFIX = 'lotl-arcade-v2-room-';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

export default class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.conn = null;
        this.bc = null; // BroadcastChannel for instant local-tab testing

        this.active = false;
        this.role = null;       // 'host' | 'guest' | null
        this.roomCode = '';     // 4-digit code e.g. '4821'
        this.status = 'idle';   // 'idle' | 'waiting' | 'connecting' | 'connected' | 'error'
        this.errorMsg = '';

        // Online Game Configuration synced in Lobby
        this.mode = 'coop';     // 'coop' (2v1 Story Co-Op) | 'duel' (1v1 Versus)
        this.hostCharId = 'Keano';
        this.guestCharId = 'JJDark';
        this.stageId = 'Dojo';

        // Remote player's live controller state (consumed by Host in Combat.js)
        this.remoteInput = this._emptyInput();
        this._remoteLatches = {
            lJust: false,
            hJust: false,
            sJust: false,
            dashLeftJust: false,
            dashRightJust: false,
            dashJust: false,
            skipJust: false,
            qcfRight: false,
            qcfLeft: false
        };

        // Guest-side outgoing input latch so fast mobile taps are never lost between packets
        this._guestOutgoingLatches = {
            lJust: false,
            hJust: false,
            sJust: false,
            dashLeftJust: false,
            dashRightJust: false,
            dashJust: false,
            skipJust: false,
            qcfRight: false,
            qcfLeft: false
        };

        // Latest authoritative combat snapshot received by Guest from Host
        this.latestSnapshot = null;
        this.pendingCombatEvents = [];

        this._pingTimer = 0;
        this.latencyMs = 0;
        this._lastPingSent = 0;
    }

    _emptyInput() {
        return {
            up: false, down: false, left: false, right: false,
            l: false, h: false, s: false, dash: false,
            lJust: false, hJust: false, sJust: false,
            dashLeftJust: false, dashRightJust: false, dashJust: false,
            skipJust: false, qcfRight: false, qcfLeft: false
        };
    }

    /** Ensure PeerJS script is available in browser */
    async _ensurePeerJS() {
        if (typeof window !== 'undefined' && window.Peer) return true;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
            script.onload = () => resolve(Boolean(window.Peer));
            script.onerror = () => {
                const fallback = document.createElement('script');
                fallback.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
                fallback.onload = () => resolve(Boolean(window.Peer));
                fallback.onerror = () => resolve(false);
                document.head.appendChild(fallback);
            };
            document.head.appendChild(script);
        });
    }

    /** Host creates a room with a 4-digit code */
    async hostRoom(customCode = null, initialMode = 'coop') {
        this.disconnect();
        this.role = 'host';
        this.active = true;
        this.roomCode = customCode || String(Math.floor(1000 + Math.random() * 9000));
        this.status = 'waiting';
        this.errorMsg = '';
        this.mode = (initialMode === 'duel') ? 'duel' : 'coop';
        this.hostCharId = 'Keano';
        this.guestCharId = 'JJDark';

        // 1. Setup BroadcastChannel for same-device / local testing
        this._setupBroadcastChannel(this.roomCode);

        // 2. Setup PeerJS for internet-wide iPhone-to-iPhone connection
        const hasPeer = await this._ensurePeerJS();
        if (!hasPeer || !window.Peer) {
            // BroadcastChannel still works for local multi-tab testing
            return this.roomCode;
        }

        try {
            const peerId = `${PEER_PREFIX}${this.roomCode}`;
            this.peer = new window.Peer(peerId, {
                config: { iceServers: ICE_SERVERS },
                debug: 1
            });

            this.peer.on('open', () => {
                if (this.status === 'waiting') {
                    console.log(`[Online] Room ${this.roomCode} ready & waiting for Player 2 (mode: ${this.mode})`);
                }
            });

            this.peer.on('connection', (conn) => {
                this.conn = conn;
                this._setupDataConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.warn('[Online Host] Peer error:', err.type || err.message);
                if (err.type === 'unavailable-id') {
                    // Code collision: generate a fresh 4-digit code automatically
                    this.hostRoom(String(Math.floor(1000 + Math.random() * 9000)), this.mode);
                } else if (this.status !== 'connected') {
                    this.errorMsg = 'Netzwerk-Hinweis: ' + (err.type || 'Verbindung wird gesucht');
                }
            });
        } catch (e) {
            console.warn('[Online Host] Peer init error:', e);
        }

        return this.roomCode;
    }

    /** Guest joins an existing 4-digit room code */
    async joinRoom(code) {
        const cleanCode = String(code || '').trim();
        if (cleanCode.length !== 4) {
            this.status = 'error';
            this.errorMsg = 'Bitte 4-stelligen Code eingeben!';
            return;
        }

        this.disconnect();
        this.role = 'guest';
        this.active = true;
        this.roomCode = cleanCode;
        this.status = 'connecting';
        this.errorMsg = '';

        // 1. Setup BroadcastChannel for instant local-tab connection
        this._setupBroadcastChannel(cleanCode);
        this._sendBC({ type: 'HELLO_FROM_GUEST', code: cleanCode });

        // 2. Setup PeerJS for internet iPhone-to-iPhone connection
        const hasPeer = await this._ensurePeerJS();
        if (!hasPeer || !window.Peer) return;

        try {
            this.peer = new window.Peer({
                config: { iceServers: ICE_SERVERS },
                debug: 1
            });

            this.peer.on('open', () => {
                if (this.status === 'connected') return; // Already connected via BC
                const hostPeerId = `${PEER_PREFIX}${cleanCode}`;
                const conn = this.peer.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json'
                });
                this.conn = conn;
                this._setupDataConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.warn('[Online Guest] Peer error:', err.type || err.message);
                if (this.status !== 'connected') {
                    this.status = 'error';
                    this.errorMsg = err.type === 'peer-unavailable'
                        ? `Raum ${cleanCode} nicht gefunden!`
                        : 'Verbindungsfehler – bitte Code prüfen!';
                }
            });
        } catch (e) {
            console.warn('[Online Guest] Peer init error:', e);
        }
    }

    _setupDataConnection(conn) {
        conn.on('open', () => {
            console.log(`[Online] Connected to peer in room ${this.roomCode}!`);
            this.status = 'connected';
            this.errorMsg = '';
            if (this.role === 'guest') {
                this.send({ type: 'HELLO_FROM_GUEST', code: this.roomCode });
            } else if (this.role === 'host') {
                this.syncLobby();
            }
        });

        conn.on('data', (data) => {
            this._handleMessage(data);
        });

        conn.on('close', () => {
            if (this.status === 'connected') {
                this.errorMsg = 'Mitspieler hat die Verbindung getrennt.';
                this.status = 'waiting';
            }
        });
    }

    _setupBroadcastChannel(code) {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            if (this.bc) this.bc.close();
            this.bc = new BroadcastChannel(`lotl_room_${code}`);
            this.bc.onmessage = (ev) => {
                if (ev && ev.data) {
                    this._handleMessage(ev.data);
                }
            };
        } catch (e) { }
    }

    _sendBC(msg) {
        if (this.bc) {
            try { this.bc.postMessage(msg); } catch (e) { }
        }
    }

    send(msg) {
        if (!this.active) return;
        let sentViaPeer = false;
        if (this.conn && this.conn.open) {
            try {
                this.conn.send(msg);
                sentViaPeer = true;
            } catch (e) { }
        }
        if (!sentViaPeer) {
            this._sendBC(msg);
        }
    }

    syncLobby() {
        if (this.role !== 'host') return;
        this.send({
            type: 'LOBBY_SYNC',
            mode: this.mode,
            hostCharId: this.hostCharId,
            guestCharId: this.guestCharId,
            stageId: this.stageId
        });
    }

    _handleMessage(msg) {
        if (!msg || typeof msg !== 'object') return;

        switch (msg.type) {
            case 'HELLO_FROM_GUEST':
                if (this.role === 'host') {
                    this.status = 'connected';
                    this.errorMsg = '';
                    this.syncLobby();
                }
                break;

            case 'LOBBY_SYNC':
                if (this.role === 'guest') {
                    this.status = 'connected';
                    this.errorMsg = '';
                    this.mode = msg.mode || 'coop';
                    this.hostCharId = msg.hostCharId || 'Keano';
                    this.guestCharId = msg.guestCharId || 'JJDark';
                    this.stageId = msg.stageId || 'Dojo';
                }
                break;

            case 'GUEST_SELECT':
                if (this.role === 'host') {
                    if (msg.guestCharId) this.guestCharId = msg.guestCharId;
                    if (msg.mode === 'duel' || msg.mode === 'coop') this.mode = msg.mode;
                    this.syncLobby();
                }
                break;

            case 'START_MATCH_REQUEST':
                if (this.role === 'host' && this.status === 'connected') {
                    const currentState = this.game.stateManager && this.game.stateManager.currentState;
                    if (currentState && typeof currentState._startOnlineMatch === 'function') {
                        currentState._startOnlineMatch();
                    }
                }
                break;

            case 'INPUT':
                if (this.role === 'host' && msg.input) {
                    const inp = msg.input;
                    this.remoteInput.up = Boolean(inp.up);
                    this.remoteInput.down = Boolean(inp.down);
                    this.remoteInput.left = Boolean(inp.left);
                    this.remoteInput.right = Boolean(inp.right);
                    this.remoteInput.l = Boolean(inp.l);
                    this.remoteInput.h = Boolean(inp.h);
                    this.remoteInput.s = Boolean(inp.s);
                    this.remoteInput.dash = Boolean(inp.dash);

                    if (inp.lJust) this._remoteLatches.lJust = true;
                    if (inp.hJust) this._remoteLatches.hJust = true;
                    if (inp.sJust) this._remoteLatches.sJust = true;
                    if (inp.dashLeftJust) this._remoteLatches.dashLeftJust = true;
                    if (inp.dashRightJust) this._remoteLatches.dashRightJust = true;
                    if (inp.dashJust) this._remoteLatches.dashJust = true;
                    if (inp.skipJust) this._remoteLatches.skipJust = true;
                    if (inp.qcfRight) this._remoteLatches.qcfRight = true;
                    if (inp.qcfLeft) this._remoteLatches.qcfLeft = true;
                }
                break;

            case 'STATE_SWITCH':
                if (this.role === 'guest' && msg.stateName) {
                    const data = msg.stateData || {};
                    if (data.p1) preloadFighterSprites(this.game.assetManager, data.p1);
                    if (data.p2) preloadFighterSprites(this.game.assetManager, data.p2);
                    if (data.ally) preloadFighterSprites(this.game.assetManager, data.ally);
                    if (data.stageId) preloadStageAssets(this.game.assetManager, data.stageId);
                    if (data.nextData) {
                        if (data.nextData.p1) preloadFighterSprites(this.game.assetManager, data.nextData.p1);
                        if (data.nextData.p2) preloadFighterSprites(this.game.assetManager, data.nextData.p2);
                        if (data.nextData.ally) preloadFighterSprites(this.game.assetManager, data.nextData.ally);
                        if (data.nextData.stageId) preloadStageAssets(this.game.assetManager, data.nextData.stageId);
                    }
                    this.game.assetManager.loadAll();
                    this.latestSnapshot = null;
                    this.pendingCombatEvents = [];
                    this.game.stateManager.switchState(msg.stateName, data);
                }
                break;

            case 'COMBAT_SNAPSHOT':
                if (this.role === 'guest') {
                    this.latestSnapshot = msg;
                }
                break;

            case 'COMBAT_EVENT':
                if (this.role === 'guest') {
                    this.pendingCombatEvents.push(msg);
                }
                break;

            case 'UNLOCK_FIGHTERS':
                if (Array.isArray(msg.fighterIds)) {
                    try {
                        localStorage.setItem('lotl_story_complete', 'true');
                    } catch (e) { }
                    for (const fid of msg.fighterIds) {
                        unlockFighter(fid);
                    }
                }
                break;

            case 'PING':
                this.send({ type: 'PONG', t: msg.t });
                break;

            case 'PONG':
                if (msg.t) {
                    this.latencyMs = Math.max(1, Math.round(performance.now() - msg.t));
                }
                break;
        }
    }

    /**
     * Called every frame by Game.js:
     * - If Guest: captures local controller input and sends to Host
     * - Periodically measures ping
     */
    update(dt) {
        if (!this.active || this.status !== 'connected') return;

        this._pingTimer += dt;
        if (this._pingTimer >= 2.0) {
            this._pingTimer = 0;
            this.send({ type: 'PING', t: performance.now() });
        }

        if (this.role === 'guest') {
            const p1 = this.game.inputManager.p1;
            const L = this._guestOutgoingLatches;
            if (p1.lJust) L.lJust = true;
            if (p1.hJust) L.hJust = true;
            if (p1.sJust) L.sJust = true;
            if (p1.dashLeftJust) L.dashLeftJust = true;
            if (p1.dashRightJust) L.dashRightJust = true;
            if (p1.dashJust) L.dashJust = true;
            if (p1.skipJust) L.skipJust = true;
            if (this.game.inputManager.hasQCF(1)) L.qcfRight = true;
            if (this.game.inputManager.hasQCF(-1)) L.qcfLeft = true;

            this.send({
                type: 'INPUT',
                input: {
                    up: p1.up,
                    down: p1.down,
                    left: p1.left,
                    right: p1.right,
                    l: p1.l,
                    h: p1.h,
                    s: p1.s,
                    dash: p1.dash,
                    lJust: L.lJust,
                    hJust: L.hJust,
                    sJust: L.sJust,
                    dashLeftJust: L.dashLeftJust,
                    dashRightJust: L.dashRightJust,
                    dashJust: L.dashJust,
                    skipJust: L.skipJust,
                    qcfRight: L.qcfRight,
                    qcfLeft: L.qcfLeft
                }
            });

            // Reset outgoing edge-latches after sending
            L.lJust = false;
            L.hJust = false;
            L.sJust = false;
            L.dashLeftJust = false;
            L.dashRightJust = false;
            L.dashJust = false;
            L.skipJust = false;
            L.qcfRight = false;
            L.qcfLeft = false;
        }
    }

    /**
     * Called by Host in Combat.js once per frame to get Guest's input
     * and consume edge-triggered flags cleanly.
     */
    consumeRemoteInput() {
        const out = {
            ...this.remoteInput,
            lJust: this._remoteLatches.lJust,
            hJust: this._remoteLatches.hJust,
            sJust: this._remoteLatches.sJust,
            dashLeftJust: this._remoteLatches.dashLeftJust,
            dashRightJust: this._remoteLatches.dashRightJust,
            dashJust: this._remoteLatches.dashJust,
            skipJust: this._remoteLatches.skipJust,
            qcfRight: this._remoteLatches.qcfRight,
            qcfLeft: this._remoteLatches.qcfLeft
        };
        this._remoteLatches.lJust = false;
        this._remoteLatches.hJust = false;
        this._remoteLatches.sJust = false;
        this._remoteLatches.dashLeftJust = false;
        this._remoteLatches.dashRightJust = false;
        this._remoteLatches.dashJust = false;
        this._remoteLatches.skipJust = false;
        this._remoteLatches.qcfRight = false;
        this._remoteLatches.qcfLeft = false;
        return out;
    }

    getFighterById(id) {
        return ALL_FIGHTERS.find(f => f.id === id) || ROSTER[0];
    }

    disconnect() {
        this.active = false;
        this.role = null;
        this.status = 'idle';
        this.errorMsg = '';
        this.latestSnapshot = null;
        this.pendingCombatEvents = [];
        if (this.conn) {
            try { this.conn.close(); } catch (e) { }
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) { }
            this.peer = null;
        }
        if (this.bc) {
            try { this.bc.close(); } catch (e) { }
            this.bc = null;
        }
    }
}
