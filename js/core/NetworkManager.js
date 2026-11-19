/**
 * NetworkManager — Hybrid Cloud-Relay (MQTT-over-WSS) + WebRTC (PeerJS with TURN) + BroadcastChannel
 * Connects two iPhones, Androids, or PCs anywhere (Wi-Fi, 5G, cross-network) using a 4-digit Room Code.
 * Supports:
 *  - CO-OP STORY MODE (Host = P1, Guest = Ally fighting side-by-side through Story Mode!)
 *  - 1v1 DUEL MODE (Host = P1, Guest = P2 fighting head-to-head!)
 */
import { ROSTER, ALL_FIGHTERS, unlockFighter } from '../data.js?v=2.52';
import { preloadFighterSprites, preloadStageAssets } from './AssetPreloader.js?v=2.52';

const PEER_PREFIX = 'lotl-arcade-v234-room-';
const MQTT_TOPIC_PREFIX = 'lotl-arcade-v234/room/';

const MQTT_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
];

// STUN + Free OpenRelay TURN servers so WebRTC traverses symmetric NATs, iOS Private Relay & 5G
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

export default class NetworkManager {
    constructor(game) {
        this.game = game;
        this.clientId = 'c_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
        this.peer = null;
        this.conn = null;
        this.bc = null;          // BroadcastChannel for same-browser multi-tab testing
        this.mqttClients = [];   // Redundant WSS MQTT clients for 100% firewall-proof mobile/PC relay
        this._seqOut = 0;
        this._seenPackets = new Set();

        this.active = false;
        this.role = null;        // 'host' | 'guest' | null
        this.roomCode = '';      // 4-digit code e.g. '4821'
        this.status = 'idle';    // 'idle' | 'waiting' | 'connecting' | 'connected' | 'error'
        this.errorMsg = '';

        // Online Game Configuration synced in Lobby
        this.mode = 'coop';      // 'coop' (2v1 Story Co-Op) | 'duel' (1v1 Versus)
        this.hostCharId = 'Keano';
        this.guestCharId = 'JJDark';
        this._guestHasPickedChar = false;
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
        this._handshakeTimer = 0;
        this._inputSendAccum = 0;
        this.latencyMs = 0;
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

    /** Ensure MQTT.js browser client is available for WSS Cloud Relay */
    async _ensureMQTT() {
        if (typeof window !== 'undefined' && window.mqtt) return true;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
            script.onload = () => resolve(Boolean(window.mqtt));
            script.onerror = () => {
                const fallback = document.createElement('script');
                fallback.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
                fallback.onload = () => resolve(Boolean(window.mqtt));
                fallback.onerror = () => resolve(false);
                document.head.appendChild(fallback);
            };
            document.head.appendChild(script);
        });
    }

    /** Setup redundant WSS Cloud Pub/Sub Relay channels for instant cross-network connection */
    async _setupCloudRelay(code) {
        this._closeCloudRelay();
        const hasMqtt = await this._ensureMQTT();
        if (!hasMqtt || !window.mqtt || !this.active || this.roomCode !== code) return;

        const topic = `${MQTT_TOPIC_PREFIX}${code}`;
        for (const brokerUrl of MQTT_BROKERS) {
            try {
                const client = window.mqtt.connect(brokerUrl, {
                    clientId: `lotl_${this.clientId}_${Math.random().toString(36).slice(2, 6)}`,
                    clean: true,
                    connectTimeout: 5000,
                    reconnectPeriod: 2000
                });

                client.on('connect', () => {
                    if (!this.active || this.roomCode !== code) {
                        try { client.end(true); } catch (e) {}
                        return;
                    }
                    client.subscribe(topic, { qos: 0 }, (err) => {
                        if (!err) {
                            if (this.role === 'guest') {
                                this.send({ type: 'HELLO_FROM_GUEST', code: this.roomCode, guestCharId: this.guestCharId });
                            } else if (this.role === 'host') {
                                this.syncLobby();
                            }
                        }
                    });
                });

                client.on('message', (rcvTopic, payload) => {
                    if (rcvTopic !== topic || !payload) return;
                    try {
                        const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
                        const data = JSON.parse(text);
                        this._handleMessage(data);
                    } catch (e) {}
                });

                client.on('error', () => {});
                this.mqttClients.push({ client, topic });
            } catch (e) {}
        }
    }

    _closeCloudRelay() {
        for (const item of this.mqttClients) {
            try { item.client.end(true); } catch (e) {}
        }
        this.mqttClients = [];
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
        this._guestHasPickedChar = false;

        // 1. Setup BroadcastChannel for same-device / local testing
        this._setupBroadcastChannel(this.roomCode);

        // 2. Setup WSS Cloud Relay (Works 100% across iPhones, PCs, Wi-Fi & 5G!)
        this._setupCloudRelay(this.roomCode);

        // 3. Setup PeerJS WebRTC (with TURN servers) in parallel
        const hasPeer = await this._ensurePeerJS();
        if (!hasPeer || !window.Peer || !this.active) {
            return this.roomCode;
        }

        try {
            const peerId = `${PEER_PREFIX}${this.roomCode}`;
            this.peer = new window.Peer(peerId, {
                config: { iceServers: ICE_SERVERS },
                debug: 0
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
                if (err && err.type === 'unavailable-id') {
                    // Code collision: generate a fresh 4-digit code automatically
                    this.hostRoom(String(Math.floor(1000 + Math.random() * 9000)), this.mode);
                }
            });
        } catch (e) {}

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
        this._guestHasPickedChar = false;

        // 1. Setup BroadcastChannel for instant local-tab connection
        this._setupBroadcastChannel(cleanCode);
        this.send({ type: 'HELLO_FROM_GUEST', code: cleanCode, guestCharId: this.guestCharId });

        // 2. Setup WSS Cloud Relay (100% reliable mobile-to-PC and mobile-to-mobile!)
        this._setupCloudRelay(cleanCode);

        // 3. Setup PeerJS WebRTC (with TURN servers) in parallel
        const hasPeer = await this._ensurePeerJS();
        if (!hasPeer || !window.Peer || !this.active) return;

        try {
            this.peer = new window.Peer({
                config: { iceServers: ICE_SERVERS },
                debug: 0
            });

            this.peer.on('open', () => {
                if (!this.active) return;
                const hostPeerId = `${PEER_PREFIX}${cleanCode}`;
                const conn = this.peer.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json'
                });
                this.conn = conn;
                this._setupDataConnection(conn);
            });

            this.peer.on('error', () => {
                // Keep status='connecting' because Cloud Relay (WSS) connects independently of PeerJS!
            });
        } catch (e) {}
    }

    _setupDataConnection(conn) {
        conn.on('open', () => {
            this.status = 'connected';
            this.errorMsg = '';
            if (this.role === 'guest') {
                this.send({ type: 'HELLO_FROM_GUEST', code: this.roomCode, guestCharId: this.guestCharId });
            } else if (this.role === 'host') {
                this.syncLobby();
            }
        });

        conn.on('data', (data) => {
            this._handleMessage(data);
        });

        conn.on('close', () => {
            // Only mark disconnected if MQTT relay isn't active
            if (this.status === 'connected' && this.mqttClients.length === 0) {
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
        } catch (e) {}
    }

    _sendBC(msg) {
        if (this.bc) {
            try { this.bc.postMessage(msg); } catch (e) {}
        }
    }

    send(msg) {
        if (!this.active || !msg) return;
        const packet = {
            ...msg,
            _from: this.clientId,
            _seq: ++this._seqOut
        };

        // 1. Send via direct WebRTC DataChannel if open
        if (this.conn && this.conn.open) {
            try { this.conn.send(packet); } catch (e) {}
        }

        // 2. Send via WSS Cloud Relay (MQTT) so NAT/firewalls never block packets
        if (this.mqttClients.length > 0) {
            const serialized = JSON.stringify(packet);
            const shouldRetain = Boolean(msg.type === 'LOBBY_SYNC');
            for (const item of this.mqttClients) {
                if (item.client && item.client.connected) {
                    try {
                        item.client.publish(item.topic, serialized, { qos: 0, retain: shouldRetain });
                    } catch (e) {}
                }
            }
        }

        // 3. Send via local BroadcastChannel
        this._sendBC(packet);
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
        if (msg._from && msg._from === this.clientId) return; // Ignore own echoed packets

        if (msg._from && msg._seq) {
            const key = `${msg._from}:${msg._seq}`;
            if (this._seenPackets.has(key)) return;
            this._seenPackets.add(key);
            if (this._seenPackets.size > 600) {
                const firstKey = this._seenPackets.values().next().value;
                this._seenPackets.delete(firstKey);
            }
        }

        switch (msg.type) {
            case 'HELLO_FROM_GUEST':
                if (this.role === 'host') {
                    this.status = 'connected';
                    this.errorMsg = '';
                    if (msg.guestCharId) this.guestCharId = msg.guestCharId;
                    this.syncLobby();
                }
                break;

            case 'LOBBY_SYNC':
                if (this.role === 'guest') {
                    const wasWaiting = this.status !== 'connected';
                    this.status = 'connected';
                    this.errorMsg = '';
                    this.mode = msg.mode || 'coop';
                    this.hostCharId = msg.hostCharId || 'Keano';
                    if (!this._guestHasPickedChar && msg.guestCharId) {
                        this.guestCharId = msg.guestCharId;
                    }
                    if (msg.stageId) this.stageId = msg.stageId;
                    if (wasWaiting) {
                        // Immediately reply with Guest's chosen character so Host flips from 'waiting' to 'connected' and shows Guest's fighter!
                        this.send({ type: 'GUEST_SELECT', guestCharId: this.guestCharId });
                    }
                }
                break;

            case 'GUEST_SELECT':
                if (this.role === 'host') {
                    this.status = 'connected';
                    this.errorMsg = '';
                    if (msg.guestCharId) this.guestCharId = msg.guestCharId;
                    if (msg.stageId) this.stageId = msg.stageId;
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
                    this.status = 'connected';
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
                    } catch (e) {}
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
     * - Periodically sends Lobby Handshake so Host & Guest discover each other automatically
     * - If Guest: captures local controller input and sends to Host
     * - Periodically measures ping
     */
    update(dt) {
        if (!this.active) return;

        // Automatic Lobby Discovery Heartbeat (every 0.65s while waiting/connecting or in Lobby)
        this._handshakeTimer += dt;
        if (this._handshakeTimer >= 0.65) {
            this._handshakeTimer = 0;
            const curState = this.game.stateManager?.currentState;
            const inLobby = Boolean(curState && (curState.step !== undefined || curState.constructor?.name === 'OnlineLobbyState'));
            if (this.role === 'guest' && (this.status !== 'connected' || inLobby)) {
                this.send({ type: 'HELLO_FROM_GUEST', code: this.roomCode });
                // Retry direct PeerJS WebRTC connection if DataChannel isn't open yet
                if (this.peer && this.peer.open && (!this.conn || !this.conn.open)) {
                    try {
                        const hostPeerId = `${PEER_PREFIX}${this.roomCode}`;
                        const conn = this.peer.connect(hostPeerId, { reliable: true, serialization: 'json' });
                        this.conn = conn;
                        this._setupDataConnection(conn);
                    } catch (e) {}
                }
            } else if (this.role === 'host' && (inLobby || this.status === 'waiting')) {
                // Broadcast LOBBY_SYNC both while waiting AND while connected in Lobby so Guest discovers Room in <0.5s!
                this.syncLobby();
            }
        }

        if (this.status !== 'connected') return;

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

            const hasUrgentLatch = L.lJust || L.hJust || L.sJust || L.dashLeftJust || L.dashRightJust || L.dashJust || L.skipJust || L.qcfRight || L.qcfLeft;
            this._inputSendAccum += dt;
            // Send immediately on button press, or at 30Hz steady rate for smooth movement
            if (hasUrgentLatch || this._inputSendAccum >= 0.033) {
                this._inputSendAccum = 0;
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
    }

    /**
     * Returns a fresh copy of the remote player's input for the current Host frame,
     * consuming one-shot "Just" latches so special/attack presses trigger cleanly once.
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
        this._seenPackets.clear();

        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        if (this.bc) {
            try { this.bc.close(); } catch (e) {}
            this.bc = null;
        }
        this._closeCloudRelay();
    }
}
