export default class AudioManager {
    constructor() {
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
            this.gainNode.gain.value = 0.5; // Baseline BGM volume

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
            // Unlock WebAudioContext if suspended
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            // Unlock all 8 HTML5 SFX Audio elements by forcing an empty load/play
            this.sfxChannels.forEach(channel => {
                channel.volume = 0;
                channel.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
                channel.play().catch(e => { });
            });

            this.voiceChannel.volume = 0;
            this.voiceChannel.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
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
     * @param {number} volume - BGM volume (default 0.5)
     */
    playBGM(path, loop = true, useFilter = false, volume = 0.5) {
        this._initWebAudio();

        // Target settings
        const targetFreq = useFilter ? 400 : 20000;

        if (this.currentPath === path && this.bgm) {
            // Track is already playing! Just adjust the filter and return.
            if (this.audioCtx && this.lpFilter) {
                // Smoothly transition the filter frequency
                this.lpFilter.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.5);
                this.gainNode.gain.setTargetAtTime(volume, this.audioCtx.currentTime, 0.5);
            } else {
                this.bgm.volume = volume;
            }
            return;
        }

        // It's a new track. Stop the old one.
        this.stopBGM();

        this.currentPath = path;
        this.bgm = new Audio(path);
        this.bgm.crossOrigin = 'anonymous';
        this.bgm.loop = loop;

        if (this.audioCtx && this.lpFilter && this.gainNode) {
            // Use WebAudio
            this.bgmSource = this.audioCtx.createMediaElementSource(this.bgm);
            this.bgmSource.connect(this.lpFilter);
            this.lpFilter.frequency.value = targetFreq;
            this.gainNode.gain.value = volume;
        } else {
            // Fallback
            this.bgm.volume = volume;
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
        // Clear any pending play promise reference (but do NOT use .then() to pause — 
        // that creates a race condition where the callback pauses the NEW bgm!)
        this._bgmPlayPromise = null;

        if (this.bgm) {
            try { this.bgm.pause(); } catch (e) { }
            this.bgm.removeAttribute('src'); // Completely nuke the source so it can't restart
            this.bgm.load(); // Force element reload state
            this.bgm = null;
        }
        if (this.bgmSource) {
            try { this.bgmSource.disconnect(); } catch (e) { }
            this.bgmSource = null;
        }
        this.currentPath = '';
    }
    _createVoiceReverb() {
        if (!this.audioCtx || this.voiceReverbNode) return;

        // Connect voice via WebAudio if not already done
        if (!this.voiceSource) {
            this.voiceSource = this.audioCtx.createMediaElementSource(this.voiceChannel);
            this.voiceGain = this.audioCtx.createGain();
            this.voiceReverbNode = this.audioCtx.createConvolver();
            this.reverbGain = this.audioCtx.createGain();

            // Reverb mixture (mostly dry, slight wet for depth but no long hall)
            this.voiceGain.gain.value = 0.85; // Dry signal
            this.reverbGain.gain.value = 0.25; // Subtle wet signal

            // Generate a very short impulse response (room-like, no long tails)
            const length = this.audioCtx.sampleRate * 0.15; // 150ms tail is very short (slight room depth)
            const impulse = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                // Exponential decay for impulse
                const decay = Math.exp(-i / (this.audioCtx.sampleRate * 0.05));
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            this.voiceReverbNode.buffer = impulse;

            // Route: Source -> Dry (VoiceGain) -> Destination
            //        Source -> ReverbNode -> ReverbGain -> Destination
            this.voiceSource.connect(this.voiceGain);
            this.voiceSource.connect(this.voiceReverbNode);
            this.voiceReverbNode.connect(this.reverbGain);

            this.voiceGain.connect(this.audioCtx.destination);
            this.reverbGain.connect(this.audioCtx.destination);
        }
    }

    stopVoice() {
        if (this._voiceFallbackTimeout) {
            clearTimeout(this._voiceFallbackTimeout);
            this._voiceFallbackTimeout = null;
        }
        this.voiceChannel.pause();
        this.voiceChannel.currentTime = 0;
        // Restore BGM volume & Remove Filter
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(0.5, this.audioCtx.currentTime, 0.1);
            if (this.lpFilter) this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.3);
        } else if (this.bgm) {
            this.bgm.volume = 0.5;
        }
    }

    playVoice(path, onEndedCallback = null) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Initialize WebAudio for voice (if supported) for the reverb effect
        this._createVoiceReverb();

        this.voiceChannel.onended = () => {
            // Restore BGM after voice
            if (this.gainNode && this.audioCtx) {
                this.gainNode.gain.setTargetAtTime(0.5, this.audioCtx.currentTime, 0.3);
                if (this.lpFilter) this.lpFilter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.3);
            } else if (this.bgm) {
                this.bgm.volume = 0.5;
            }
            if (onEndedCallback) onEndedCallback();
            this.voiceChannel.onended = null; // Clear to prevent double fires
        };

        this.voiceChannel.volume = 1.0; // Restore volume (unlockAudio sets it to 0)
        this.voiceChannel.src = path;

        const playPromise = this.voiceChannel.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn("Voice play failed or was blocked by browser:", e);
                // CRITICAL FIX: If the voice is blocked by Safari Autoplay Policy or is a 404 missing file, 
                // the 'onended' event will NEVER fire natively. This completely breaks Story sequences!
                // We must manually trigger the callback after a fallback text-reading delay (e.g. 15 seconds).
                this._voiceFallbackTimeout = setTimeout(() => {
                    if (this.voiceChannel.onended) {
                        console.log("Triggering fallback onended for blocked voice track.");
                        this.voiceChannel.onended();
                    }
                }, 15000);
            });
        }

        // Dynamic Ducking + Lowpass Filter BGM
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(0.25, this.audioCtx.currentTime, 0.1);
            if (this.lpFilter) {
                // Muffle BGM Down to 400Hz so voice pops out clearly
                this.lpFilter.frequency.setTargetAtTime(400, this.audioCtx.currentTime, 0.1);
            }
        } else if (this.bgm) {
            this.bgm.volume = 0.2;
        }
    }

    playSFX(path, isHeavy = false) {
        // SFX channels are raw HTML5 Audio elements, NOT routed through WebAudio,
        // so they should play even if AudioContext is suspended.
        const channel = this.sfxChannels[this.sfxIndex];
        channel.src = path;
        channel.volume = isHeavy ? 1.0 : 0.6;

        channel.play().catch(e => {
            // Automatic Fallback 1: 'voice/' subdirectory mismatch
            if (path.includes('voice/')) {
                const fallbackPath = path.replace('voice/', '');
                channel.src = fallbackPath;
                channel.play().catch(() => { });
            }
            // Automatic Fallback 2: Missing Character Audio
            // If a boss lacks custom hit/ko/special voice sounds, fall back to Keano 
            // so that at least the physical impact (punch smack) is heard!
            else if (path.includes('_hit.mp3')) {
                channel.src = 'assets/audio/keano_hit.mp3';
                channel.play().catch(() => { });
            } else if (path.includes('_ko.mp3')) {
                channel.src = 'assets/audio/keano_ko.mp3';
                channel.play().catch(() => { });
            } else if (path.includes('_special.mp3') || path.includes('_super.mp3')) {
                channel.src = 'assets/audio/keano_special.mp3';
                channel.play().catch(() => { });
            }
        });

        this.sfxIndex = (this.sfxIndex + 1) % this.sfxChannels.length;
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
