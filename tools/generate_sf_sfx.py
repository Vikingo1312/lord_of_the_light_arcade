#!/usr/bin/env python3
"""
Authentic Capcom CPS-1 / CPS-2 QSound Street Fighter Arcade Combat Foley & SFX Generator.
Uses physical foley modeling (multi-impulse leather/flesh slap, 800-2400Hz bone/cloth crack,
45-120Hz damped chest/kick-drum slam, nonlinear tape/tube saturation np.tanh(x * 3.5),
and short stereo gated arcade reverb) — ZERO pure sine/triangle "pippi" tones!
"""

import os
import subprocess
import tempfile
import wave
import numpy as np
from scipy import signal

SR = 44100


def butter_sos(kind, freqs, sr=SR, order=4):
    nyq = 0.5 * sr
    if isinstance(freqs, (tuple, list)):
        norm = [np.clip(f / nyq, 0.001, 0.995) for f in freqs]
    else:
        norm = np.clip(freqs / nyq, 0.001, 0.995)
    return signal.butter(order, norm, btype=kind, output="sos")


def bandpass(sig, low_hz, high_hz, sr=SR, order=4):
    sos = butter_sos("band", (low_hz, high_hz), sr=sr, order=order)
    return signal.sosfilt(sos, sig)


def lowpass(sig, cutoff_hz, sr=SR, order=4):
    sos = butter_sos("low", cutoff_hz, sr=sr, order=order)
    return signal.sosfilt(sos, sig)


def highpass(sig, cutoff_hz, sr=SR, order=4):
    sos = butter_sos("high", cutoff_hz, sr=sr, order=order)
    return signal.sosfilt(sos, sig)


def pink_noise(n, rng):
    """Generates rich 1/f-weighted broadband noise for natural acoustic foley texture."""
    white = rng.standard_normal(n)
    # 3-stage Paul Kellet pinking filter approximation
    b = np.array([0.049922035, -0.095993537, 0.050612699, -0.004408786])
    a = np.array([1.0, -2.494956002, 2.017265875, -0.522189400])
    pink = signal.lfilter(b, a, white)
    std = np.std(pink)
    return pink / (std if std > 1e-9 else 1.0)


def velvet_impulses(n, density_hz, rng):
    """Sparse high-crest-factor micro-impulse train modeling leather/flesh/bone micro-fractures."""
    out = np.zeros(n, dtype=np.float64)
    step = max(2, int(SR / density_hz))
    for idx in range(0, n - step, step):
        offset = rng.integers(0, step)
        out[idx + offset] = rng.choice([-1.0, 1.0]) * rng.uniform(0.65, 1.35)
    return out


def shift_signal(sig, delay_s, sr=SR):
    d = int(round(delay_s * sr))
    if d <= 0:
        return sig.copy()
    if d >= len(sig):
        return np.zeros_like(sig)
    out = np.zeros_like(sig)
    out[d:] = sig[:-d]
    return out


def flesh_leather_slap(n, delay_s=0.0, hardness=1.0, rng=None):
    """
    Crisp leather/flesh transient slap:
    Multi-impulse surface contact (0-9ms) + skin/leather formant resonances (1.1kHz-5.2kHz).
    """
    if rng is None:
        rng = np.random.default_rng(101)
    t = np.arange(n, dtype=np.float64) / SR
    raw = 0.65 * pink_noise(n, rng) + 0.55 * velvet_impulses(n, 3800.0, rng)

    # Ultra-fast double-contact envelope (knuckle + skin compression)
    env_fast = np.exp(-t / 0.0038) + 0.65 * np.exp(-np.maximum(0.0, t - 0.0022) / 0.0065)
    env_tail = 0.25 * np.exp(-t / 0.022)

    slap_mid = bandpass(raw * env_fast, 950.0, 2600.0, order=3)
    slap_hi = bandpass(raw * (env_fast + env_tail), 2400.0, min(6800.0 * hardness, 12000.0), order=3)
    slap = np.tanh((1.35 * slap_mid + 1.15 * slap_hi) * (2.6 * hardness))
    return shift_signal(slap, delay_s)


def bone_cloth_crack(n, delay_s=0.0, intensity=1.0, rng=None):
    """
    Signature Street Fighter 800-2400Hz bone/cloth crack:
    Clustered micro-transients passed through high-energy 800-2400Hz formant bands.
    """
    if rng is None:
        rng = np.random.default_rng(202)
    t = np.arange(n, dtype=np.float64) / SR

    # 4 tightly spaced micro-impulses (like wet denim whip + bone impact)
    micro_Offsets = [0.0, 0.0019, 0.0043, 0.0078]
    micro_weights = [1.0, 0.85, 0.72, 0.48]
    burst = np.zeros(n, dtype=np.float64)
    for off, w in zip(micro_Offsets, micro_weights):
        dt = np.maximum(0.0, t - off)
        mask = (t >= off).astype(np.float64)
        exc = (0.6 * pink_noise(n, rng) + 0.7 * rng.standard_normal(n)) * mask
        burst += w * exc * np.exp(-dt / 0.0055)

    # 800-2400Hz multi-formant crack
    f1 = bandpass(burst, 800.0, 1350.0, order=4)
    f2 = bandpass(burst, 1300.0, 1900.0, order=4)
    f3 = bandpass(burst, 1800.0, 2400.0, order=4)
    crack = (1.15 * f1 + 1.35 * f2 + 1.10 * f3) * intensity
    crack = np.tanh(crack * 3.2)
    return shift_signal(crack, delay_s)


def chest_punch_slam(n, delay_s=0.0, f_start=120.0, f_end=48.0, decay=0.068, drive=3.2, rng=None):
    """
    Heavy 45-120Hz punch chest slam:
    Physical damped leather-bag / acoustic kick-membrane displacement combined with
    low-passed impact turbulence (no pure continuous synth tone!).
    """
    if rng is None:
        rng = np.random.default_rng(303)
    t = np.arange(n, dtype=np.float64) / SR

    # Rapid pitch drop over first 14ms (membrane/chest cavity compression)
    freq_t = f_end + (f_start - f_end) * np.exp(-t / 0.013)
    # Add turbulent phase jitter from pink noise so it behaves like a physical leather skin
    jitter = lowpass(pink_noise(n, rng), 180.0, order=3) * 0.35
    phase = 2.0 * np.pi * np.cumsum(freq_t) / SR + jitter

    amp_env = (1.0 - np.exp(-t / 0.0008)) * np.exp(-t / decay)
    membrane = np.sin(phase) * amp_env

    # Heavy low-end bag thud noise (45-135Hz)
    bag_thud = bandpass(pink_noise(n, rng), 45.0, 135.0, order=4) * np.exp(-t / (decay * 0.85))
    knock_body = bandpass(pink_noise(n, rng), 130.0, 310.0, order=3) * np.exp(-t / 0.022)

    combined = np.tanh((1.25 * membrane + 0.95 * bag_thud + 0.55 * knock_body) * drive)
    return shift_signal(combined, delay_s)


def swept_air_whoosh(n, f_start, f_peak, f_end, peak_pos=0.42, flutter_hz=34.0, rng=None):
    """
    Aerodynamic martial-arts limb/gi-cloth whip using time-varying formant filtering
    and turbulent vortex modulation.
    """
    if rng is None:
        rng = np.random.default_rng(404)
    t = np.arange(n, dtype=np.float64) / SR
    dur = n / SR
    u = np.clip(t / max(dur, 1e-5), 0.0, 1.0)

    # Smooth asymmetric bell envelope for limb acceleration & deceleration
    env = np.sin(np.pi * (u ** 0.78)) ** 1.55
    # Gi-cloth vortex flutter
    flutter = 1.0 + 0.28 * np.sin(2.0 * np.pi * flutter_hz * t + 0.6 * pink_noise(n, rng))

    base_noise = 0.7 * pink_noise(n, rng) + 0.3 * rng.standard_normal(n)
    out = np.zeros(n, dtype=np.float64)

    # Multi-slice overlap-add resonant bandpass sweep
    num_slices = 18
    centers = np.linspace(0.0, 1.0, num_slices)
    width = 1.6 / num_slices
    for c in centers:
        if c <= peak_pos:
            frac = c / max(peak_pos, 1e-4)
            fc = f_start + (f_peak - f_start) * (frac ** 0.85)
        else:
            frac = (c - peak_pos) / max(1.0 - peak_pos, 1e-4)
            fc = f_peak + (f_end - f_peak) * (frac ** 1.1)

        win = np.exp(-0.5 * ((u - c) / (width * 0.55)) ** 2)
        low_f = max(55.0, fc * 0.62)
        high_f = min(14000.0, fc * 1.55)
        band = bandpass(base_noise, low_f, high_f, order=3)
        out += band * win

    # Normalize & shape
    out = out * env * flutter
    mx = np.max(np.abs(out))
    if mx > 1e-9:
        out /= mx
    return out


def qsound_arcade_master(sig_l, sig_r, drive=2.2, target_peak=0.52):
    """
    100% DRY, concrete, tight Street Fighter impact master (ZERO reverb/Hall!):
    - Tight transient envelope so every hit/block stops cleanly without echo tail
    - Gentle analog warmth saturation
    - Controlled peak level (0.30 - 0.55) so SFX sit cleanly under voices & music
    """
    n = len(sig_l)
    t = np.arange(n, dtype=np.float64) / SR
    dur = n / SR

    # Tight exponential decay envelope so there is ZERO room ring or reverb tail
    tight_env = np.exp(-t / (dur * 0.42))
    out_l = np.tanh(sig_l * tight_env * drive)
    out_r = np.tanh(sig_r * tight_env * drive)

    # Smooth 8ms fade-out at end
    fade_len = min(int(0.008 * SR), n // 4)
    if fade_len > 0:
        fade = np.linspace(1.0, 0.0, fade_len)
        out_l[-fade_len:] *= fade
        out_r[-fade_len:] *= fade

    peak = max(np.max(np.abs(out_l)), np.max(np.abs(out_r)), 1e-9)
    out_l = (out_l / peak) * target_peak
    out_r = (out_r / peak) * target_peak
    return out_l, out_r


def save_stereo_mp3(out_path, left, right, sr=SR):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    stereo = np.vstack([left, right]).T
    pcm16 = np.clip(stereo * 32767.0, -32768, 32767).astype(np.int16)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = tmp.name

    try:
        with wave.open(tmp_wav, "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(pcm16.tobytes())

        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", tmp_wav,
            "-ar", str(sr),
            "-ac", "2",
            "-codec:a", "libmp3lame",
            "-b:a", "192k",
            out_path,
        ]
        subprocess.run(cmd, check=True)
    finally:
        if os.path.exists(tmp_wav):
            os.remove(tmp_wav)


def gen_whoosh_light():
    """1. sfx_whoosh_light.mp3 (0.09s dry, subtle fist air cut)"""
    n = int(round(0.09 * SR))
    rng = np.random.default_rng(1001)
    whip = swept_air_whoosh(n, 420.0, 1450.0, 480.0, peak_pos=0.35, flutter_hz=18.0, rng=rng)
    return qsound_arcade_master(whip, whip, drive=1.6, target_peak=0.26)


def gen_whoosh_heavy():
    """2. sfx_whoosh_heavy.mp3 (0.13s dry, tight kick air cut)"""
    n = int(round(0.13 * SR))
    rng = np.random.default_rng(1002)
    low_gust = swept_air_whoosh(n, 160.0, 680.0, 180.0, peak_pos=0.38, flutter_hz=20.0, rng=rng)
    return qsound_arcade_master(low_gust, low_gust, drive=1.8, target_peak=0.32)


def gen_hit_light():
    """3. sfx_hit_light.mp3 (0.11s dry, concrete jab/kick impact — single tight snap + punch thump)"""
    n = int(round(0.11 * SR))
    rng = np.random.default_rng(1003)
    slap = flesh_leather_slap(n, delay_s=0.0, hardness=0.95, rng=rng)
    thump = chest_punch_slam(n, delay_s=0.0, f_start=115.0, f_end=52.0, decay=0.032, drive=2.2, rng=rng)
    sig = 0.70 * slap + 1.15 * thump
    return qsound_arcade_master(sig, sig, drive=2.0, target_peak=0.46)


def gen_hit_heavy():
    """4. sfx_hit_heavy.mp3 (0.15s dry, concrete heavy punch/kick — deep chest thud + crisp leather snap)"""
    n = int(round(0.15 * SR))
    rng = np.random.default_rng(1004)
    slap = flesh_leather_slap(n, delay_s=0.0, hardness=1.05, rng=rng)
    crack = bone_cloth_crack(n, delay_s=0.0, intensity=0.85, rng=rng)
    slam = chest_punch_slam(n, delay_s=0.0, f_start=125.0, f_end=44.0, decay=0.048, drive=2.5, rng=rng)
    sig = 0.75 * slap + 0.65 * crack + 1.35 * slam
    return qsound_arcade_master(sig, sig, drive=2.2, target_peak=0.54)


def gen_hit_special():
    """5. sfx_hit_special.mp3 (0.19s dry, heavy special impact — deep sub punch + clean impact crack)"""
    n = int(round(0.19 * SR))
    rng = np.random.default_rng(1005)
    slap = flesh_leather_slap(n, delay_s=0.0, hardness=1.10, rng=rng)
    crack = bone_cloth_crack(n, delay_s=0.0, intensity=0.95, rng=rng)
    slam = chest_punch_slam(n, delay_s=0.0, f_start=135.0, f_end=40.0, decay=0.065, drive=2.8, rng=rng)
    sig = 0.80 * slap + 0.75 * crack + 1.50 * slam
    return qsound_arcade_master(sig, sig, drive=2.4, target_peak=0.58)


def gen_block():
    """6. sfx_block.mp3 (0.10s dry, concrete forearm guard thud)"""
    n = int(round(0.10 * SR))
    rng = np.random.default_rng(1006)
    t = np.arange(n, dtype=np.float64) / SR
    guard_thud = chest_punch_slam(n, delay_s=0.0, f_start=98.0, f_end=55.0, decay=0.028, drive=2.0, rng=rng)
    leather_guard = bandpass(pink_noise(n, rng), 180.0, 950.0, order=3) * np.exp(-t / 0.014)
    sig = 1.20 * guard_thud + 0.65 * leather_guard
    return qsound_arcade_master(sig, sig, drive=1.9, target_peak=0.42)


def gen_throw():
    """7. sfx_throw.mp3 (0.20s dry grab + concrete mat slam)"""
    n = int(round(0.20 * SR))
    rng = np.random.default_rng(1007)
    t = np.arange(n, dtype=np.float64) / SR
    grab = bandpass(pink_noise(n, rng), 300.0, 1800.0, order=3) * np.exp(-((t - 0.015) / 0.015) ** 2)
    slam = chest_punch_slam(n, delay_s=0.055, f_start=120.0, f_end=42.0, decay=0.055, drive=2.5, rng=rng)
    slap = flesh_leather_slap(n, delay_s=0.055, hardness=0.95, rng=rng)
    sig = 0.45 * grab + 1.35 * slam + 0.65 * slap
    return qsound_arcade_master(sig, sig, drive=2.2, target_peak=0.54)


def gen_ko_boom():
    """8. sfx_ko_boom.mp3 (0.38s tight, concrete K.O. double-impact without echo wash)"""
    n = int(round(0.38 * SR))
    rng = np.random.default_rng(1008)
    slam1 = chest_punch_slam(n, delay_s=0.0, f_start=130.0, f_end=40.0, decay=0.075, drive=2.6, rng=rng)
    slap1 = flesh_leather_slap(n, delay_s=0.0, hardness=1.05, rng=rng)
    slam2 = chest_punch_slam(n, delay_s=0.065, f_start=115.0, f_end=38.0, decay=0.095, drive=2.6, rng=rng)
    slap2 = flesh_leather_slap(n, delay_s=0.065, hardness=0.95, rng=rng)
    sig = (1.1 * slam1 + 0.6 * slap1) + 0.75 * (1.1 * slam2 + 0.5 * slap2)
    return qsound_arcade_master(sig, sig, drive=2.3, target_peak=0.60)


def generate_all_sfx(out_dir="/Users/vikingo40/.gemini/antigravity/scratch/keano_lord_of_the_light/assets/audio/sfx"):
    os.makedirs(out_dir, exist_ok=True)
    sfx_builders = {
        "sfx_whoosh_light.mp3": gen_whoosh_light,
        "sfx_whoosh_heavy.mp3": gen_whoosh_heavy,
        "sfx_hit_light.mp3": gen_hit_light,
        "sfx_hit_heavy.mp3": gen_hit_heavy,
        "sfx_hit_special.mp3": gen_hit_special,
        "sfx_block.mp3": gen_block,
        "sfx_throw.mp3": gen_throw,
        "sfx_ko_boom.mp3": gen_ko_boom,
    }

    for fname, builder in sfx_builders.items():
        left, right = builder()
        out_path = os.path.join(out_dir, fname)
        save_stereo_mp3(out_path, left, right)
        size_kb = os.path.getsize(out_path) / 1024.0
        dur = len(left) / SR
        print(f"✅ Generated {fname:22s} | {dur:.2f}s | {size_kb:.1f} KB")


if __name__ == "__main__":
    generate_all_sfx()
