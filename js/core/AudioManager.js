export default class AudioManager {
    constructor(game = null) {
        this.game = game;
        this.bgm = null;
        this.currentPath = '';
        this.voiceChannel = new Audio();
        this.sfxChannels = Array.from({ length: 8 }, () => new Audio());
        this.sfxIndex = 0;

        // WebAudio API for BGM filtering
        this.audioCtx = null;
        this.bgmSource = null;
        this.lpFilter = null;
        this.gainNode = null;
    }

    _getMusicVol(fallback = 0.5) {
        return this.game?.settings?.musicVolume ?? fallback;
    }

    _getVoiceVol(fallback = 0.9) {
        return this.game?.settings?.voiceVolume ?? fallback;
    }

    _getSfxVol(fallback = 0.5) {
        return this.game?.settings?.sfxVolume ?? fallback;
    }

    _initWebAudio() {
        if (this.audioCtx && this.audioCtx.state !== 'closed') return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // --- BGM Filter Setup ---
            this.lpFilter = this.audioCtx.createBiquadFilter();
            this.lpFilter.type = 'lowpass';
            this.lpFilter.frequency.value = 20000; // Default: let all frequencies pass
            this.lpFilter.Q.value = 1.0;

            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = this._getMusicVol(0.5); // Baseline BGM volume

            this.lpFilter.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            // Voice plays CLEAN — direct to speakers, no filter

        } catch (e) {
            console.warn("WebAudio API not supported. Falling back to simple audio.", e);
        }
    }

    /**
     * MUST be called during the first user interaction (click/keydown) to bypass Safari/Chrome Autoplay policies
     * Unlocking the channels ensures that SFX requested during the game loop are not blocked.
     */
    unlockAudio() {
        if (this.audioUnlocked) return;

        try {
            // Unlock WebAudioContext if suspended (Needed for BOTH Desktop and Mobile)
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            // A tiny, 0.1s silent MP3 buffer to immediately satisfy browser AutoPlay policies
            const silentB64 = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

            // Unlock ONE SFX Channel (bypasses Mobile Safari's "must play an element" rule)
            // No need to unlock all 8 as it causes a heavy CPU stutter on Desktop
            this.sfxChannels[0].volume = 0;
            this.sfxChannels[0].src = silentB64;
            this.sfxChannels[0].play().catch(e => { });

            // Unlock Voice Channel
            this.voiceChannel.volume = 0;
            this.voiceChannel.src = silentB64;
            this.voiceChannel.play().catch(e => { });

            this.audioUnlocked = true;
            console.log("Audio Engine Unlocked by User Interaction");
        } catch (e) {
            console.error("Audio unlock failed", e);
        }
    }

    /**
     * Plays a premium deep sub-bass cinematic sweep fading in with an ethereal chord.
     * Starts on Boot click and sustains through the Caesar Splash transition.
     */
    playCinematicSweep() {
        this._initWebAudio();
        const ctx = this.audioCtx;
        if (!ctx) return;

        const now = ctx.currentTime;

        // 1. Deep Sub-Bass Sweep (120Hz to 20Hz over 6 seconds)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(120, now);
        subOsc.frequency.exponentialRampToValueAtTime(20, now + 6);

        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(1.0, now + 2.0); // Swell up safely
        subGain.gain.setValueAtTime(1.0, now + 4.0); // Hold
        subGain.gain.linearRampToValueAtTime(0.001, now + 6.0); // Fade out

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 6.0);

        // 2. Mid/High Ethereal Shimmer (E4, B4, D5, G5)
        [329.63, 493.88, 587.33, 783.99].forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = index % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.detune.setValueAtTime(index * 5, now); // Slight lush detune

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 2.0 + (index * 0.2)); // Stagger chord swell
            gain.gain.setValueAtTime(0.08, now + 4.0);
            gain.gain.linearRampToValueAtTime(0.001, now + 6.0);

            // Sweep lowpass filter for "unveiling" effect
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.linearRampToValueAtTime(3000, now + 3);

            osc.connect(gain);
            gain.connect(filter);
            filter.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 6.0);
        });
    }

    /**
     * @param {string} path - path to the audio file
     * @param {boolean} loop - whether the track should loop
     * @param {boolean} useFilter - if true, applies the muffled low-pass filter
     * @param {number} volume - BGM volume (default uses game.settings.musicVolume)
     */
    playBGM(path, loop = true, useFilter = false, volume = null, preloadedAudio = null) {
        this._initWebAudio();
        const effectiveVol = volume !== null ? volume : this._getMusicVol(0.5);

        // Target settings
        const targetFreq = useFilter ? 400 : 20000;
        this.filterActive = useFilter;

        if (this.currentPath === path && this.bgm) {
            // Track is already playing! Just adjust the filter and return.
            if (this.audioCtx && this.lpFilter) {
                // Smoothly transition the filter frequency
                this.lpFilter.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.5);
                this.gainNode.gain.setTargetAtTime(effectiveVol, this.audioCtx.currentTime, 0.5);
            } else {
                this.bgm.volume = effectiveVol;
            }
            return;
        }

        // It's a new track. Stop the old one.
        this.stopBGM();

        this.currentPath = path;
        this.bgm = preloadedAudio || new Audio(path);
        this.bgm.loop = loop;

        if (this.audioCtx && this.lpFilter && this.gainNode) {
            // Use WebAudio
            try {
                if (!this.bgm._mediaSourceNode) {
                    this.bgm._mediaSourceNode = this.audioCtx.createMediaElementSource(this.bgm);
                }
                this.bgmSource = this.bgm._mediaSourceNode;
                this.bgmSource.connect(this.lpFilter);
            } catch (e) {
                console.warn("MediaElementSource reuse fallback:", e);
            }
            this.lpFilter.frequency.value = targetFreq;
            this.gainNode.gain.value = effectiveVol;
        } else {
            // Fallback
            this.bgm.volume = effectiveVol;
        }

        // CRITICAL: Ensure AudioContext is running before playing!
        // Chrome/Safari can re-suspend the context if there's no audio activity.
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this._bgmPlayPromise = this.bgm.play();
        if (this._bgmPlayPromise) {
            this._bgmPlayPromise.catch(e => console.warn("BGM Auto-play blocked", e));
        }
    }

    stopBGM() {
        const oldBgm = this.bgm;
        const oldPromise = this._bgmPlayPromise;

        // Clear references immediately so new tracks can start without interference
        this.bgm = null;
        this._bgmPlayPromise = null;
        this.currentPath = '';

        if (this.bgmSource) {
            try { this.bgmSource.disconnect(); } catch (e) { }
            this.bgmSource = null;
        }

        if (oldBgm) {
            // Check if there is an unresolved play promise preventing an immediate pause
            if (oldPromise !== undefined && oldPromise !== null) {
                oldPromise.then(() => {
                    if (this._bgmPlayPromise === oldPromise || this._bgmPlayPromise === null) {
                        try { oldBgm.pause(); } catch (e) { }
                        oldBgm.currentTime = 0;
                    }
                }).catch(() => { });
            } else {
                try { oldBgm.pause(); } catch (e) { }
                oldBgm.currentTime = 0;
            }
        }
    }

    _createVoiceReverb() {
        // Kept as raw HTML5 audio for Mobile Safari reliability.
    }

    stopVoice() {
        if (this._voiceFallbackTimeout) {
            clearTimeout(this._voiceFallbackTimeout);
            this._voiceFallbackTimeout = null;
        }

        const oldPromise = this._voicePlayPromise;
        const voiceRef = this.voiceChannel;

        if (oldPromise !== undefined && oldPromise !== null) {
            oldPromise.then(() => {
                if (this._voicePlayPromise === oldPromise || this._voicePlayPromise === null) {
                    try { voiceRef.pause(); } catch (e) { }
                    voiceRef.currentTime = 0;
                }
            }).catch(() => {
                if (this._voicePlayPromise === oldPromise || this._voicePlayPromise === null) {
                    voiceRef.currentTime = 0;
                }
            });
        } else {
            try { voiceRef.pause(); } catch (e) { }
            voiceRef.currentTime = 0;
        }

        this._voicePlayPromise = null;
        const restoreVol = this._getMusicVol(0.5);
        // Restore BGM volume & Remove Filter
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(restoreVol, this.audioCtx.currentTime, 0.1);
            if (this.lpFilter && !this.filterActive) {
                this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.3);
            }
        } else if (this.bgm) {
            this.bgm.volume = restoreVol;
        }
    }

    playVoice(path, onEndedCallback = null) {
        if (this._voiceFallbackTimeout) {
            clearTimeout(this._voiceFallbackTimeout);
            this._voiceFallbackTimeout = null;
        }
        this._voicePlayPromise = null;

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this._createVoiceReverb();
        const restoreVol = this._getMusicVol(0.5);

        this.voiceChannel.onended = () => {
            // Restore BGM after voice
            if (this.gainNode && this.audioCtx) {
                this.gainNode.gain.setTargetAtTime(restoreVol, this.audioCtx.currentTime, 0.3);
                if (this.lpFilter && !this.filterActive) {
                    this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.3);
                }
            } else if (this.bgm) {
                this.bgm.volume = restoreVol;
            }
            if (onEndedCallback) onEndedCallback();
            this.voiceChannel.onended = null; // Clear to prevent double fires
        };

        this.voiceChannel.volume = this._getVoiceVol(0.9);
        this.voiceChannel.src = path;

        this._voicePlayPromise = this.voiceChannel.play();
        if (this._voicePlayPromise !== undefined) {
            this._voicePlayPromise.catch(e => {
                // Fallback to assets/audio/voice/ if needed
                if (path.startsWith('assets/audio/') && !path.includes('assets/audio/voice/')) {
                    const altPath = path.replace('assets/audio/', 'assets/audio/voice/');
                    this.voiceChannel.src = altPath;
                    this._voicePlayPromise = this.voiceChannel.play();
                    if (this._voicePlayPromise) {
                        this._voicePlayPromise.catch(err => {
                            console.warn("Voice play failed or was blocked by browser:", err);
                            this._voiceFallbackTimeout = setTimeout(() => {
                                if (this.voiceChannel.onended) this.voiceChannel.onended();
                            }, 15000);
                        });
                    }
                    return;
                }
                console.warn("Voice play failed or was blocked by browser:", e);
                this._voiceFallbackTimeout = setTimeout(() => {
                    if (this.voiceChannel.onended) {
                        console.log("Triggering fallback onended for blocked voice track.");
                        this.voiceChannel.onended();
                    }
                }, 15000);
            });
        }

        // Dynamic Ducking + Lowpass Filter BGM
        const duckVol = Math.min(restoreVol, 0.25);
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(duckVol, this.audioCtx.currentTime, 0.1);
            if (this.lpFilter && (this.game?.settings?.bgmFilterEnabled !== false)) {
                // Muffle BGM Down to 400Hz so voice pops out clearly
                this.lpFilter.frequency.setTargetAtTime(400, this.audioCtx.currentTime, 0.1);
            }
        } else if (this.bgm) {
            this.bgm.volume = Math.min(restoreVol, 0.2);
        }
    }

    playSFX(path, isHeavy = false) {
        const channel = this.sfxChannels[this.sfxIndex];
        const oldPromise = channel._sfxPromise;

        // Safely clear out any pending play promise from a previous sound on this channel
        if (oldPromise !== undefined && oldPromise !== null) {
            oldPromise.then(() => {
                if (channel._sfxPromise === oldPromise || channel._sfxPromise === null) {
                    try { channel.pause(); } catch (e) { }
                    channel.currentTime = 0;
                }
            }).catch(() => { });
        } else {
            try { channel.pause(); } catch (e) { }
            channel.currentTime = 0;
        }

        const baseSfx = this._getSfxVol(0.5);
        channel.src = path;
        channel.volume = Math.min(1.0, isHeavy ? Math.max(baseSfx, baseSfx * 1.4) : baseSfx);

        const tryFallback = (altPath) => {
            channel.src = altPath;
            channel._sfxPromise = channel.play();
            return channel._sfxPromise;
        };

        channel._sfxPromise = channel.play();
        if (channel._sfxPromise !== undefined) {
            channel._sfxPromise.catch(() => {
                // Automatic Fallback 1: Try switching between 'assets/audio/voice/' and 'assets/audio/'
                let altPath = null;
                if (path.includes('assets/audio/voice/')) {
                    altPath = path.replace('assets/audio/voice/', 'assets/audio/');
                } else if (path.startsWith('assets/audio/')) {
                    altPath = path.replace('assets/audio/', 'assets/audio/voice/');
                }

                const fallbackCharacterAudio = () => {
                    if (path.includes('_win.mp3')) {
                        const tauntPath = (path.includes('voice/') ? path : path.replace('assets/audio/', 'assets/audio/voice/')).replace('_win.mp3', '_taunt.mp3');
                        const p = tryFallback(tauntPath);
                        if (p) p.catch(() => { });
                    } else if (path.includes('_hit.mp3')) {
                        const p = tryFallback('assets/audio/voice/keano_hit.mp3');
                        if (p) p.catch(() => { });
                    } else if (path.includes('_ko.mp3')) {
                        const p = tryFallback('assets/audio/voice/keano_ko.mp3');
                        if (p) p.catch(() => { });
                    } else if (path.includes('_special.mp3') || path.includes('_super.mp3')) {
                        const p = tryFallback('assets/audio/voice/keano_special.mp3');
                        if (p) p.catch(() => { });
                    }
                };

                if (altPath) {
                    const p = tryFallback(altPath);
                    if (p) p.catch(fallbackCharacterAudio);
                } else {
                    fallbackCharacterAudio();
                }
            });
        }

        this.sfxIndex = (this.sfxIndex + 1) % this.sfxChannels.length;
    }

    /** Synthesized crisp arcade block sound */
    playBlockSound() {
        this._initWebAudio();
        const ctx = this.audioCtx;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const vol = Math.min(0.4, this._getSfxVol(0.5) * 0.6);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
    }

    // ─── PREMIUM CAESAR ENGINE SPLASH AUDIO ───
    playPremiumSplash() {
        if (!this.audioCtx || this.audioCtx.state === 'suspended') return;

        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const duration = 5.0; // Long, cinematic decay

        // 1. The Deep Sub-Bass Drone (The THX Rumble)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();

        subOsc.type = 'sawtooth';
        // Start very low (20Hz) and sweep up to 55Hz for a heavy sub-boom
        subOsc.frequency.setValueAtTime(20, now);
        subOsc.frequency.exponentialRampToValueAtTime(55, now + 1.5);
        subOsc.frequency.linearRampToValueAtTime(30, now + duration);

        // Sub envelope: strong swell, slow fade
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(1.0, now + 1.2);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        subOsc.connect(subGain);
        subGain.connect(this.gainNode);

        // 2. The Metallic "Netflix-Style" Riser/Chord
        // We create a wide spread of harmonics to sound huge and futuristic
        const chordFreqs = [110, 164.81, 220, 329.63, 440]; // A2, E3, A3, E4, A4
        chordFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Mix Square and Sawtooth for a rich, buzzy synth tone
            osc.type = i % 2 === 0 ? 'square' : 'sawtooth';

            // Add a slight pitch sweep for tension (starts a semitone low, resolves up)
            osc.frequency.setValueAtTime(freq * 0.95, now);
            osc.frequency.exponentialRampToValueAtTime(freq, now + 0.8);

            // Create a "stadium" fade out envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2 / chordFreqs.length, now + 0.5 + (i * 0.1)); // Arpeggiate slightly
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

            // Run high frequencies through a filter to avoid piercing the ears
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.exponentialRampToValueAtTime(4000, now + 1.5); // Filter sweeps open

            osc.connect(gain);
            gain.connect(filter);
            filter.connect(this.gainNode);

            osc.start(now);
            osc.stop(now + duration);
        });

        // 3. The "Impact" Shockwave
        // Simple noise burst mimicking a cinematic drum hit at the peak of the riser
        const bufferSize = ctx.sampleRate * 2.0; // 2 seconds of noise 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 800; // Deep thud filter

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        // Hit immediately at the peak of the sub-bass swell (1.2 seconds in)
        noiseGain.gain.setValueAtTime(0.5, now + 1.2);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.gainNode);

        subOsc.start(now);
        noise.start(now + 1.2); // Start the impact drum right as the swell peaks

        subOsc.stop(now + duration);
    }
}
