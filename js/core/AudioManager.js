export default class AudioManager {
    constructor(game = null) {
        this.game = game;
        this.currentPath = '';
        this.filterActive = false;

        // WebAudio Engine & 5-Bus Studio Mixing Console (Works 100% on iPhone iOS, Android & Desktop!)
        this.audioCtx = null;
        this.masterGain = null;
        this.gainNode = null;       // Music / BGM bus gain
        this.lpFilter = null;       // Music low-pass filter for voice ducking
        this.sfxGain = null;        // Combat FX / Hit sounds bus gain
        this.voiceGain = null;      // Fighter & Story voiceover bus gain
        this.announcerGain = null;  // Announcer bus gain

        // In-memory decoded AudioBuffer cache & in-flight fetch promises
        this.bufferCache = new Map();
        this.loadingPromises = new Map();

        // Active WebAudio source nodes & strict generation tokens (prevents stale/delayed audio from playing in later levels!)
        this.bgmSource = null;
        this._bgmToken = 0;
        this._desiredBgm = null; // { path, loop, useFilter, volume }

        this.voiceSource = null;
        this._voiceToken = 0;
        this._voicePlaying = false;
        this.voiceChannel = { duration: 0 }; // Exposed for StorySequence scroll sync

        this.fighterVoiceSource = null;
        this._fighterVoiceToken = 0;
        this._fighterVoicePlaying = false;
        this._fighterVoicePriority = 0;
        this._lastHitVoiceTime = 0;

        this.announcerSource = null;
        this._announcerToken = 0;
        this._announcerPlaying = false;

        // Legacy compatibility array for any external code referencing sfxChannels
        this.sfxChannels = [];
        this.audioUnlocked = false;

        this._setupGlobalMobileUnlock();
    }

    // ─── MIXER VOLUME GETTERS (Connected to Game.settings Mischpult) ───
    _getMasterVol() {
        return this.game?.settings?.masterVolume ?? 1.0;
    }

    _getMusicVol(fallback = 0.22) {
        return this.game?.settings?.musicVolume ?? fallback;
    }

    _getVoiceVol(fallback = 1.0) {
        return this.game?.settings?.voiceVolume ?? fallback;
    }

    _getSfxVol(fallback = 0.90) {
        return this.game?.settings?.sfxVolume ?? fallback;
    }

    _getAnnouncerVol(fallback = 0.95) {
        return this.game?.settings?.announcerVolume ?? fallback;
    }

    /**
     * Immediately syncs all WebAudio mixer faders when changed in the Options Mischpult or Pause Menu.
     */
    applyMixerSettings() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(Math.max(0, this._getMasterVol()), now, 0.03);
        }
        if (this.gainNode) {
            const isDucked = this._voicePlaying || this._announcerPlaying || (this._fighterVoicePlaying && this._fighterVoicePriority >= 2);
            const baseMusic = Math.max(0, this._getMusicVol(0.22));
            const targetMusic = isDucked ? baseMusic * 0.35 : baseMusic;
            this.gainNode.gain.setTargetAtTime(targetMusic, now, 0.05);
        }
        if (this.sfxGain) {
            // 1.25x studio boost so hits & blocks punch cleanly above BGM
            this.sfxGain.gain.setTargetAtTime(Math.max(0, this._getSfxVol(0.90) * 1.25), now, 0.03);
        }
        if (this.voiceGain) {
            // 1.40x studio boost so fighter & story voices are crystal-clear and upfront
            this.voiceGain.gain.setTargetAtTime(Math.max(0, this._getVoiceVol(1.0) * 1.40), now, 0.03);
        }
        if (this.announcerGain) {
            this.announcerGain.gain.setTargetAtTime(Math.max(0, this._getAnnouncerVol(0.95) * 1.30), now, 0.03);
        }
    }

    applyVolumeSettings() {
        this.applyMixerSettings();
    }

    _initWebAudio() {
        if (this.audioCtx && this.audioCtx.state !== 'closed') return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();

            // Master Console Bus
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = this._getMasterVol();
            this.masterGain.connect(this.audioCtx.destination);

            // Bus 1: BGM (with Lowpass Filter for Voiceover Ducking)
            this.lpFilter = this.audioCtx.createBiquadFilter();
            this.lpFilter.type = 'lowpass';
            this.lpFilter.frequency.value = 20000;
            this.lpFilter.Q.value = 1.0;

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = this._getMusicVol(0.22);
            this.lpFilter.connect(this.gainNode);
            this.gainNode.connect(this.masterGain);

            // Bus 2: Combat SFX (Hits, Blocks, Whooshes, Throws, K.O. Boom)
            this.sfxGain = this.audioCtx.createGain();
            this.sfxGain.gain.value = this._getSfxVol(0.90) * 1.25;
            this.sfxGain.connect(this.masterGain);

            // Bus 3 & 4 Shared Cinematic Studio Voice Processor:
            // Warm chest resonance (175Hz +3.5dB) + Anti-Robotic Mid-Notch (2650Hz -2.6dB) + Air Presence (6.5kHz +2.2dB) + Subtle Arena Ambience + Studio Compressor
            const voiceLowShelf = this.audioCtx.createBiquadFilter();
            voiceLowShelf.type = 'lowshelf';
            voiceLowShelf.frequency.value = 175;
            voiceLowShelf.gain.value = 3.5;

            const voiceDeHarsh = this.audioCtx.createBiquadFilter();
            voiceDeHarsh.type = 'peaking';
            voiceDeHarsh.frequency.value = 2650;
            voiceDeHarsh.Q.value = 1.35;
            voiceDeHarsh.gain.value = -2.6;

            const voiceAir = this.audioCtx.createBiquadFilter();
            voiceAir.type = 'highshelf';
            voiceAir.frequency.value = 6500;
            voiceAir.gain.value = 2.2;

            const voiceComp = this.audioCtx.createDynamicsCompressor();
            voiceComp.threshold.value = -16;
            voiceComp.knee.value = 12;
            voiceComp.ratio.value = 2.6;
            voiceComp.attack.value = 0.004;
            voiceComp.release.value = 0.14;

            // Subtle 26ms Arena Room Slapback (13% wet) so voices sound live in the arena, never flat/static
            const roomDelay = this.audioCtx.createDelay(0.1);
            roomDelay.delayTime.value = 0.026;
            const roomLp = this.audioCtx.createBiquadFilter();
            roomLp.type = 'lowpass';
            roomLp.frequency.value = 2600;
            const roomWet = this.audioCtx.createGain();
            roomWet.gain.value = 0.13;

            voiceLowShelf.connect(voiceDeHarsh);
            voiceDeHarsh.connect(voiceAir);
            voiceAir.connect(voiceComp);
            voiceComp.connect(this.masterGain);

            voiceAir.connect(roomDelay);
            roomDelay.connect(roomLp);
            roomLp.connect(roomWet);
            roomWet.connect(voiceComp);

            // Bus 3: Fighter & Story Voices
            this.voiceGain = this.audioCtx.createGain();
            this.voiceGain.gain.value = this._getVoiceVol(1.0) * 1.40;
            this.voiceGain.connect(voiceLowShelf);

            // Bus 4: Arcade Announcer
            this.announcerGain = this.audioCtx.createGain();
            this.announcerGain.gain.value = this._getAnnouncerVol(0.95) * 1.30;
            this.announcerGain.connect(voiceLowShelf);
        } catch (e) {
            console.warn("WebAudio API not supported:", e);
        }
    }

    /**
     * Global capture-phase unlocker for iPhone iOS Safari, iPad, Android Chrome, and Desktop.
     * Ensures AudioContext is resumed on EVERY touch/click/key gesture (including after iOS tab switch/interruption)
     * and immediately starts any pending BGM track.
     */
    _setupGlobalMobileUnlock() {
        const handleGesture = () => {
            this.unlockAudio();
        };
        const events = ['touchend', 'pointerup', 'click', 'keydown', 'touchstart'];
        for (const ev of events) {
            window.addEventListener(ev, handleGesture, { capture: true, passive: true });
        };
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.audioCtx && this.audioCtx.state !== 'running') {
                this.audioCtx.resume().catch(() => {});
            }
        });
    }

    unlockAudio() {
        this._initWebAudio();
        if (!this.audioCtx) return;

        if (this.audioCtx.state !== 'running') {
            this.audioCtx.resume().then(() => {
                this.audioUnlocked = true;
                this._resumePendingBGMIfNeeded();
            }).catch(() => {});
        } else {
            this.audioUnlocked = true;
            this._resumePendingBGMIfNeeded();
        }

        // Play a 1-sample silent buffer to force iOS Safari hardware audio pipeline open
        if (!this._silentPrimed && this.audioCtx) {
            try {
                const buf = this.audioCtx.createBuffer(1, 1, 22050);
                const src = this.audioCtx.createBufferSource();
                src.buffer = buf;
                src.connect(this.audioCtx.destination);
                src.start(0);
                this._silentPrimed = true;
                this.preloadCoreAudio();
            } catch (e) {}
        }
    }

    _resumePendingBGMIfNeeded() {
        if (this._desiredBgm && !this.bgmSource && this.audioCtx && this.audioCtx.state === 'running') {
            const { path, loop, useFilter, volume } = this._desiredBgm;
            this.currentPath = ''; // Force start
            this.playBGM(path, loop, useFilter, volume);
        }
    }

    /**
     * Preloads and decodes core combat SFX, announcer clips, and main soundtrack into WebAudio RAM
     * so mobile & desktop have 0ms latency and zero network stalls during gameplay.
     */
    preloadCoreAudio() {
        const coreFiles = [
            'assets/audio/sfx/sfx_hit_light.mp3',
            'assets/audio/sfx/sfx_hit_heavy.mp3',
            'assets/audio/sfx/sfx_hit_special.mp3',
            'assets/audio/sfx/sfx_block.mp3',
            'assets/audio/sfx/sfx_whoosh_light.mp3',
            'assets/audio/sfx/sfx_whoosh_heavy.mp3',
            'assets/audio/sfx/sfx_throw.mp3',
            'assets/audio/sfx/sfx_ko_boom.mp3',
            'assets/audio/voice/announcer_round_1.mp3',
            'assets/audio/voice/announcer_fight.mp3',
            'assets/audio/voice/announcer_ko.mp3',
            'assets/audio/voice/announcer_perfect.mp3',
            'assets/audio/music/main_soundtrack.mp3',
            'assets/audio/prologue_voice.mp3',
            'assets/audio/reflexion_voice.mp3',
            'assets/audio/epilogue_voice.mp3',
            'assets/audio/outro_voice.mp3'
        ];
        for (const f of coreFiles) {
            this.preloadAudio(f);
        }
    }

    /**
     * Fetches and decodes an audio file into an AudioBuffer (cached in RAM).
     * Automatically tries fallback paths ('assets/audio/voice/' <-> 'assets/audio/') if needed.
     */
    async preloadAudio(path) {
        if (!path) return null;
        this._initWebAudio();
        if (!this.audioCtx) return null;

        if (this.bufferCache.has(path)) {
            return this.bufferCache.get(path);
        }
        if (this.loadingPromises.has(path)) {
            return this.loadingPromises.get(path);
        }

        const fetchAndDecode = async (tryPath) => {
            const urlWithVer = tryPath.includes('?') ? tryPath : `${tryPath}?v=2.36`;
            const res = await fetch(urlWithVer);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${tryPath}`);
            const arr = await res.arrayBuffer();
            return await new Promise((resolve, reject) => {
                this.audioCtx.decodeAudioData(arr, resolve, reject);
            });
        };

        const promise = (async () => {
            try {
                const buf = await fetchAndDecode(path);
                this.bufferCache.set(path, buf);
                return buf;
            } catch (e) {
                let altPath = null;
                if (path.includes('assets/audio/voice/')) {
                    altPath = path.replace('assets/audio/voice/', 'assets/audio/');
                } else if (path.startsWith('assets/audio/') && !path.includes('assets/audio/sfx/') && !path.includes('assets/audio/music/')) {
                    altPath = path.replace('assets/audio/', 'assets/audio/voice/');
                }
                if (altPath) {
                    try {
                        const buf = await fetchAndDecode(altPath);
                        this.bufferCache.set(path, buf);
                        this.bufferCache.set(altPath, buf);
                        return buf;
                    } catch (e2) {}
                }
                console.warn("[AudioManager] Could not decode audio:", path);
                return null;
            } finally {
                this.loadingPromises.delete(path);
            }
        })();

        this.loadingPromises.set(path, promise);
        return promise;
    }

    // ─── BGM PLAYBACK (Pure WebAudio Buffer Source — 100% iOS & Desktop Reliable) ───
    playBGM(path, loop = true, useFilter = false, volume = null) {
        if (!path) return;
        this._initWebAudio();
        const effectiveVol = volume !== null ? volume : this._getMusicVol(0.22);
        const targetFreq = useFilter ? 450 : 20000;
        this.filterActive = useFilter;
        this._desiredBgm = { path, loop, useFilter, volume };

        if (this.currentPath === path && this.bgmSource) {
            if (this.audioCtx && this.lpFilter && this.gainNode) {
                this.lpFilter.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.25);
                this.gainNode.gain.setTargetAtTime(effectiveVol, this.audioCtx.currentTime, 0.25);
            }
            return;
        }

        this._stopBGMSourceOnly();
        this.currentPath = path;
        const token = ++this._bgmToken;

        if (this.audioCtx && this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        this.preloadAudio(path).then((buffer) => {
            if (!buffer || token !== this._bgmToken || this.currentPath !== path) return;
            if (!this.audioCtx) return;

            this._stopBGMSourceOnly();
            const src = this.audioCtx.createBufferSource();
            src.buffer = buffer;
            src.loop = loop;

            this.lpFilter.frequency.setValueAtTime(targetFreq, this.audioCtx.currentTime);
            this.gainNode.gain.setValueAtTime(effectiveVol, this.audioCtx.currentTime);

            src.connect(this.lpFilter);
            try {
                src.start(0);
                this.bgmSource = src;
                src.onended = () => {
                    if (this.bgmSource === src) {
                        this.bgmSource = null;
                    }
                };
            } catch (e) {
                console.warn("[AudioManager] BGM start error:", e);
            }
        });
    }

    _stopBGMSourceOnly() {
        if (this.bgmSource) {
            try { this.bgmSource.onended = null; } catch (e) {}
            try { this.bgmSource.stop(0); } catch (e) {}
            try { this.bgmSource.disconnect(); } catch (e) {}
            this.bgmSource = null;
        }
    }

    stopBGM() {
        this._bgmToken++;
        this.currentPath = '';
        this._desiredBgm = null;
        this._stopBGMSourceOnly();
    }

    // ─── STORY NARRATOR VOICEOVER PLAYBACK ───
    stopVoice() {
        this._voiceToken++;
        this._voicePlaying = false;
        if (this._voiceFallbackTimeout) {
            clearTimeout(this._voiceFallbackTimeout);
            this._voiceFallbackTimeout = null;
        }
        if (this.voiceSource) {
            try { this.voiceSource.onended = null; } catch (e) {}
            try { this.voiceSource.stop(0); } catch (e) {}
            try { this.voiceSource.disconnect(); } catch (e) {}
            this.voiceSource = null;
        }
        this._restoreCombatBGM();
        if (this.lpFilter && this.audioCtx && !this.filterActive) {
            this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.25);
        }
    }

    playVoice(path, onEndedCallback = null) {
        this.stopVoice();
        if (!path) {
            if (onEndedCallback) onEndedCallback();
            return;
        }
        this._initWebAudio();
        const token = ++this._voiceToken;
        this._voicePlaying = true;
        this.voiceChannel.duration = 0;

        if (this.audioCtx && this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        // Duck & low-pass filter BGM so Story Narrator is crystal-clear
        this._duckCombatBGM(0.32);
        if (this.lpFilter && this.audioCtx && (this.game?.settings?.bgmFilterEnabled !== false)) {
            this.lpFilter.frequency.setTargetAtTime(450, this.audioCtx.currentTime, 0.12);
        }

        let finished = false;
        const finish = () => {
            if (finished || token !== this._voiceToken) return;
            finished = true;
            this._voicePlaying = false;
            if (this._voiceFallbackTimeout) {
                clearTimeout(this._voiceFallbackTimeout);
                this._voiceFallbackTimeout = null;
            }
            this.voiceSource = null;
            this._restoreCombatBGM();
            if (this.lpFilter && this.audioCtx && !this.filterActive) {
                this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.3);
            }
            if (onEndedCallback) onEndedCallback();
        };

        this.preloadAudio(path).then((buffer) => {
            if (token !== this._voiceToken) return;
            if (!buffer || !this.audioCtx) {
                this._voiceFallbackTimeout = setTimeout(finish, 4000);
                return;
            }

            this.voiceChannel.duration = buffer.duration;
            this.applyMixerSettings();

            const src = this.audioCtx.createBufferSource();
            src.buffer = buffer;
            src.connect(this.voiceGain);
            src.onended = finish;
            this.voiceSource = src;

            try {
                src.start(0);
                this._voiceFallbackTimeout = setTimeout(finish, Math.ceil(buffer.duration * 1000) + 1200);
            } catch (e) {
                this._voiceFallbackTimeout = setTimeout(finish, 4000);
            }
        });
    }

    // ─── COMBAT SFX PLAYBACK (Instantaneous Zero-Latency WebAudio Buffer Pool) ───
    playSFX(path, isHeavy = false) {
        if (!path) return;
        this._initWebAudio();
        if (!this.audioCtx) return;

        if (this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        let sfxMul = isHeavy ? 1.05 : 0.90;
        if (path.includes('sfx_whoosh')) {
            sfxMul = 0.62;
        } else if (path.includes('sfx_block')) {
            sfxMul = 0.95;
        } else if (path.includes('sfx_hit_light')) {
            sfxMul = 0.92;
        } else if (path.includes('sfx_hit_heavy') || path.includes('sfx_throw')) {
            sfxMul = 1.08;
        } else if (path.includes('sfx_hit_special') || path.includes('sfx_ko_boom')) {
            sfxMul = 1.20;
        }

        const playBuffer = (buffer) => {
            if (!buffer || !this.audioCtx) return;
            try {
                this.applyMixerSettings();
                const src = this.audioCtx.createBufferSource();
                const itemGain = this.audioCtx.createGain();
                itemGain.gain.value = sfxMul;
                src.buffer = buffer;
                src.connect(itemGain);
                itemGain.connect(this.sfxGain);
                src.start(0);
            } catch (e) {}
        };

        // If already in RAM cache, fire synchronously (< 1ms latency)!
        const cached = this.bufferCache.get(path);
        if (cached) {
            playBuffer(cached);
            return;
        }

        const spawnTime = performance.now();
        this.preloadAudio(path).then((buffer) => {
            // Never play a combat SFX if it took more than 450ms to load (prevents delayed SFX in later rounds!)
            if (performance.now() - spawnTime > 450) return;
            playBuffer(buffer);
        });
    }

    _duckCombatBGM(factor = 0.35) {
        const baseVol = this._getMusicVol(0.22);
        const ducked = baseVol * factor;
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(ducked, this.audioCtx.currentTime, 0.05);
        }
    }

    _restoreCombatBGM() {
        const fighterActive = this._fighterVoicePlaying && this._fighterVoicePriority >= 2;
        if (this._voicePlaying || this._announcerPlaying || fighterActive) return;
        const baseVol = this._getMusicVol(0.22);
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(baseVol, this.audioCtx.currentTime, 0.16);
        }
    }

    // ─── FIGHTER VOICE PLAYBACK (Strict Priority + Token Cancellation) ───
    stopFighterVoice() {
        this._fighterVoiceToken++;
        this._fighterVoicePlaying = false;
        this._fighterVoicePriority = 0;
        if (this._fighterVoiceTimeout) {
            clearTimeout(this._fighterVoiceTimeout);
            this._fighterVoiceTimeout = null;
        }
        if (this.fighterVoiceSource) {
            try { this.fighterVoiceSource.onended = null; } catch (e) {}
            try { this.fighterVoiceSource.stop(0); } catch (e) {}
            try { this.fighterVoiceSource.disconnect(); } catch (e) {}
            this.fighterVoiceSource = null;
        }
        this._restoreCombatBGM();
    }

    isFighterVoicePlaying() {
        return Boolean(this._fighterVoicePlaying);
    }

    playFighterVoice(path, type = 'hit', onEndedCallback = null) {
        if (!path) {
            if (onEndedCallback) onEndedCallback();
            return;
        }
        this._initWebAudio();

        const PRIORITY = {
            hit: 1,
            taunt: 2,
            select: 2,
            intro: 4,
            special: 3,
            super: 3,
            ko: 5,
            win: 6
        };
        const prio = PRIORITY[type] || 1;
        const now = performance.now();

        if (type === 'hit') {
            if (this._fighterVoicePlaying || this._announcerPlaying) return;
            if (now - this._lastHitVoiceTime < 850) return;
            this._lastHitVoiceTime = now;
        } else {
            if (this._fighterVoicePlaying && prio < this._fighterVoicePriority) return;
        }

        this.stopFighterVoice();
        const token = ++this._fighterVoiceToken;
        this._fighterVoicePriority = prio;
        this._fighterVoicePlaying = true;
        const requestTime = performance.now();

        if (this.audioCtx && this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        if (prio >= 2) {
            this._duckCombatBGM(0.35);
        }

        let callbackFired = false;
        const finish = () => {
            if (callbackFired || token !== this._fighterVoiceToken) return;
            callbackFired = true;
            this._fighterVoicePlaying = false;
            this._fighterVoicePriority = 0;
            if (this._fighterVoiceTimeout) {
                clearTimeout(this._fighterVoiceTimeout);
                this._fighterVoiceTimeout = null;
            }
            this.fighterVoiceSource = null;
            this._restoreCombatBGM();
            if (onEndedCallback) onEndedCallback();
        };

        this.preloadAudio(path).then((buffer) => {
            if (token !== this._fighterVoiceToken) return;
            // Drop stale hit/special grunts if network took too long
            if ((type === 'hit' || type === 'special') && performance.now() - requestTime > 700) {
                finish();
                return;
            }
            if (!buffer || !this.audioCtx) {
                finish();
                return;
            }

            this.applyMixerSettings();
            const src = this.audioCtx.createBufferSource();
            const clipGain = this.audioCtx.createGain();
            clipGain.gain.value = type === 'hit' ? 0.68 : 1.0;
            src.buffer = buffer;
            src.connect(clipGain);
            clipGain.connect(this.voiceGain);
            src.onended = finish;
            this.fighterVoiceSource = src;

            try {
                src.start(0);
                this._fighterVoiceTimeout = setTimeout(finish, Math.ceil(buffer.duration * 1000) + 400);
            } catch (e) {
                finish();
            }
        });
    }

    // ─── ANNOUNCER VOICE PLAYBACK (ROUND 1, FIGHT!, K.O.!, PERFECT!) ───
    stopAnnouncerVoice() {
        this._announcerToken++;
        this._announcerPlaying = false;
        if (this._announcerTimeout) {
            clearTimeout(this._announcerTimeout);
            this._announcerTimeout = null;
        }
        if (this.announcerSource) {
            try { this.announcerSource.onended = null; } catch (e) {}
            try { this.announcerSource.stop(0); } catch (e) {}
            try { this.announcerSource.disconnect(); } catch (e) {}
            this.announcerSource = null;
        }
        this._restoreCombatBGM();
    }

    isAnnouncerPlaying() {
        return Boolean(this._announcerPlaying && this.announcerSource);
    }

    playAnnouncerVoice(path, onEndedCallback = null) {
        if (!path) {
            if (onEndedCallback) onEndedCallback();
            return;
        }
        this._initWebAudio();

        // Only silence low-priority hit grunts (never cut off intro/win speeches!)
        if (this._fighterVoicePriority <= 1) {
            this.stopFighterVoice();
        }

        this.stopAnnouncerVoice();
        const token = ++this._announcerToken;
        this._announcerPlaying = true;
        const requestTime = performance.now();

        if (this.audioCtx && this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        this._duckCombatBGM(0.35);

        let callbackFired = false;
        const finish = () => {
            if (callbackFired || token !== this._announcerToken) return;
            callbackFired = true;
            this._announcerPlaying = false;
            if (this._announcerTimeout) {
                clearTimeout(this._announcerTimeout);
                this._announcerTimeout = null;
            }
            this.announcerSource = null;
            this._restoreCombatBGM();
            if (onEndedCallback) onEndedCallback();
        };

        this.preloadAudio(path).then((buffer) => {
            if (token !== this._announcerToken) return;
            if (performance.now() - requestTime > 2500 || !buffer || !this.audioCtx) {
                finish();
                return;
            }

            this.applyMixerSettings();
            const src = this.audioCtx.createBufferSource();
            src.buffer = buffer;
            src.connect(this.announcerGain);
            src.onended = finish;
            this.announcerSource = src;

            try {
                src.start(0);
                this._announcerTimeout = setTimeout(finish, Math.ceil(buffer.duration * 1000) + 350);
            } catch (e) {
                finish();
            }
        });
    }

    // ─── STREET FIGHTER COMBAT SFX HELPERS ───
    playHitImpactSound(isHeavy = false, isSpecialHit = false) {
        if (isSpecialHit) {
            this.playSFX('assets/audio/sfx/sfx_hit_special.mp3', true);
        } else if (isHeavy) {
            this.playSFX('assets/audio/sfx/sfx_hit_heavy.mp3', true);
        } else {
            this.playSFX('assets/audio/sfx/sfx_hit_light.mp3', false);
        }
    }

    playWhooshSound(isHeavy = false) {
        this.playSFX(isHeavy ? 'assets/audio/sfx/sfx_whoosh_heavy.mp3' : 'assets/audio/sfx/sfx_whoosh_light.mp3', false);
    }

    playThrowSound() {
        this.playSFX('assets/audio/sfx/sfx_throw.mp3', true);
    }

    playKOBoomSound() {
        this.playSFX('assets/audio/sfx/sfx_ko_boom.mp3', true);
    }

    playBlockSound() {
        this.playSFX('assets/audio/sfx/sfx_block.mp3', false);
    }

    // ─── CINEMATIC BOOT & CAESAR SPLASH SYNTHS ───
    playCinematicSweep() {
        this._initWebAudio();
        const ctx = this.audioCtx;
        if (!ctx) return;

        const now = ctx.currentTime;
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(20, now + 6);

        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(0.65, now + 2.0);
        subGain.gain.setValueAtTime(0.65, now + 4.0);
        subGain.gain.linearRampToValueAtTime(0.001, now + 6.0);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain || ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 6.0);

        [329.63, 493.88, 587.33, 783.99].forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = index % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.detune.setValueAtTime(index * 5, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 2.0 + (index * 0.2));
            gain.gain.setValueAtTime(0.06, now + 4.0);
            gain.gain.linearRampToValueAtTime(0.001, now + 6.0);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.linearRampToValueAtTime(3000, now + 3);

            osc.connect(gain);
            gain.connect(filter);
            filter.connect(this.masterGain || ctx.destination);

            osc.start(now);
            osc.stop(now + 6.0);
        });
    }

    playPremiumSplash() {
        this._initWebAudio();
        if (!this.audioCtx) return;
        if (this.audioCtx.state !== 'running') {
            this.audioCtx.resume().catch(() => {});
        }

        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const duration = 5.0;
        const dest = this.masterGain || ctx.destination;

        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();

        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(20, now);
        subOsc.frequency.exponentialRampToValueAtTime(55, now + 1.5);
        subOsc.frequency.linearRampToValueAtTime(30, now + duration);

        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(0.45, now + 1.2);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        subOsc.connect(subGain);
        subGain.connect(dest);

        const chordFreqs = [110, 164.81, 220, 329.63, 440];
        chordFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i % 2 === 0 ? 'square' : 'sawtooth';
            osc.frequency.setValueAtTime(freq * 0.95, now);
            osc.frequency.exponentialRampToValueAtTime(freq, now + 0.8);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.12 / chordFreqs.length, now + 0.5 + (i * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.exponentialRampToValueAtTime(4000, now + 1.5);

            osc.connect(gain);
            gain.connect(filter);
            filter.connect(dest);

            osc.start(now);
            osc.stop(now + duration);
        });

        const bufferSize = ctx.sampleRate * 2.0;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 800;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.setValueAtTime(0.28, now + 1.2);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(dest);

        subOsc.start(now);
        noise.start(now + 1.2);
        subOsc.stop(now + duration);
    }
}
