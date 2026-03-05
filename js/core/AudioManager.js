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

            // --- Voice Filter Setup ---
            this.voiceNode = this.audioCtx.createMediaElementSource(this.voiceChannel);
            this.voiceFilter = this.audioCtx.createBiquadFilter();
            this.voiceFilter.type = 'lowpass';
            // Set voice filter lower to give that deep, muffled cinematic feel
            this.voiceFilter.frequency.value = 800; // Muffled voice
            this.voiceFilter.Q.value = 1.5;

            // Connect voice through filter then direct to output
            this.voiceNode.connect(this.voiceFilter);
            this.voiceFilter.connect(this.audioCtx.destination);

        } catch (e) {
            console.warn("WebAudio API not supported. Falling back to simple audio.", e);
        }
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

        this.bgm.play().catch(e => console.warn("BGM Auto-play blocked", e));
    }

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
            this.bgm = null;
        }
        if (this.bgmSource) {
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
        this.currentPath = '';
    }

    playVoice(path) {
        this.voiceChannel.src = path;
        this.voiceChannel.play().catch(e => console.warn(e));
        // Dynamic Ducking:
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(0.2, this.audioCtx.currentTime, 0.1);
        } else if (this.bgm) {
            this.bgm.volume = 0.2;
        }

        this.voiceChannel.onended = () => {
            if (this.gainNode && this.audioCtx) {
                this.gainNode.gain.setTargetAtTime(0.5, this.audioCtx.currentTime, 0.3);
            } else if (this.bgm) {
                this.bgm.volume = 0.5;
            }
        };
    }

    playSFX(path, isHeavy = false) {
        const channel = this.sfxChannels[this.sfxIndex];
        channel.src = path;
        channel.volume = isHeavy ? 1.0 : 0.6;
        channel.play().catch(e => console.warn(e));

        this.sfxIndex = (this.sfxIndex + 1) % this.sfxChannels.length;
    }
}
