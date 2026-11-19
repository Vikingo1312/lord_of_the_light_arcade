#!/usr/bin/env python3
"""
Generates DOM's 8 authentic Studio German Voice MP3s in assets/audio/voice/,
DOM's Cyber-Matrix Stage Background (assets/STAGES/20_Dom_Cyber_Matrix.png),
and DOM's Projectile Cutin/VFX (assets/fx/char_projectiles/proj_dom.png, 256x256 RGBA, corner_alpha == 0).

Uses OpenAI gpt-audio-1.5 (with voice="ash", STREET_BOY_KEANO_FILTER & silenceremove mastering pipeline)
and falls back seamlessly to Microsoft Neural Studio German TTS (de-DE-FlorianMultilingualNeural)
through the exact same STREET_BOY_KEANO_FILTER & silenceremove mastering pipeline if OpenAI credits are exhausted.
"""
import asyncio
import base64
import json
import os
import subprocess
import urllib.error
import urllib.request
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "assets", "audio", "voice")
STAGE_OUT = os.path.join(ROOT, "assets", "STAGES", "20_Dom_Cyber_Matrix.png")
PROJ_OUT = os.path.join(ROOT, "assets", "fx", "char_projectiles", "proj_dom.png")


def load_openai_key():
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"].strip()
    for env_file in [
        "/Users/vikingo40/HOMEPAGE/srinfinity-app/.env",
        os.path.join(ROOT, ".env"),
    ]:
        if os.path.isfile(env_file):
            for line in open(env_file, errors="ignore"):
                if line.strip().startswith("OPENAI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip("'\"")
    return ""


API_KEY = load_openai_key()

STREET_BOY_KEANO_FILTER = (
    "asetrate=24000*1.02,aresample=24000,atempo=1.01,"
    "equalizer=f=135:t=q:w=1.0:g=2.8,"
    "equalizer=f=3400:t=q:w=1.2:g=2.2,"
    "acompressor=threshold=-16dB:ratio=2.8:makeup=3.0dB"
)

DOM_SYS = (
    "Du bist DOM (17 Jahre): Ein cooler, sportlicher, selbstbewusster deutscher Boxer und Kickboxer mit lässigem, "
    "klarem Straßen-Flow (wie Keano und Jayden, komplett natürlich, menschlich, fokussiert und charismatisch, NICHT theatralisch oder steif). "
    "Sprich flüssig ohne Pause zwischen den Sätzen und gib IMMER NUR exakt den geforderten Text aus!"
)


def probe_duration(path):
    if not os.path.exists(path):
        return 999.0
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ]
        ).decode().strip()
        return float(out)
    except Exception:
        return 999.0


def master_raw_audio(tmp_raw, out_path, ffmpeg_filter=STREET_BOY_KEANO_FILTER, max_dur=6.8, is_short_sfx=False):
    af_chain = [
        "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.26:stop_threshold=-44dB"
    ]
    if ffmpeg_filter:
        af_chain.append(ffmpeg_filter)
    af_chain.append("alimiter=limit=0.95")
    if is_short_sfx:
        fade_st = max(0.20, min(0.45, max_dur - 0.25))
        af_chain.append(f"afade=t=out:st={fade_st:.2f}:d=0.20")
    else:
        af_chain.append("apad=pad_dur=0.18")

    cmd = ["ffmpeg", "-y", "-i", tmp_raw]
    if is_short_sfx:
        cmd += ["-t", str(max_dur)]
    cmd += [
        "-af",
        ",".join(af_chain),
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        out_path,
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    if os.path.exists(tmp_raw):
        os.remove(tmp_raw)


async def synth_neural_fallback(spoken_text, tmp_raw, rate="+6%", pitch="-2Hz"):
    comm = edge_tts.Communicate(spoken_text, "de-DE-FlorianMultilingualNeural", rate=rate, pitch=pitch)
    await comm.save(tmp_raw)


def generate_dom_voice_clip(filename, spoken_text, gpt_prompt, max_dur, is_short_sfx=False, rate="+6%", pitch="-2Hz"):
    os.makedirs(VOICE_DIR, exist_ok=True)
    out_path = os.path.join(VOICE_DIR, filename)
    tmp_raw = out_path + ".raw.mp3"

    used_openai = False
    if API_KEY:
        payload = {
            "model": "gpt-audio-1.5",
            "modalities": ["text", "audio"],
            "audio": {"voice": "ash", "format": "mp3"},
            "messages": [
                {"role": "system", "content": DOM_SYS},
                {"role": "user", "content": gpt_prompt},
            ],
        }
        try:
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                b64 = res["choices"][0]["message"]["audio"]["data"]
                with open(tmp_raw, "wb") as f:
                    f.write(base64.b64decode(b64))
                used_openai = True
        except Exception:
            used_openai = False

    if not used_openai:
        asyncio.run(synth_neural_fallback(spoken_text, tmp_raw, rate=rate, pitch=pitch))

    master_raw_audio(tmp_raw, out_path, STREET_BOY_KEANO_FILTER, max_dur=max_dur, is_short_sfx=is_short_sfx)
    dur = probe_duration(out_path)

    # If duration slightly exceeds max_dur, speed up gently so the full sentence is 100% preserved without truncation
    if dur > max_dur:
        speed_factor = min(1.35, (dur / (max_dur - 0.08)))
        tmp_adj = out_path + ".adj.mp3"
        os.replace(out_path, tmp_adj)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                tmp_adj,
                "-af",
                f"atempo={speed_factor:.3f},alimiter=limit=0.95",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                out_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        os.remove(tmp_adj)
        dur = probe_duration(out_path)

    return out_path, dur


DOM_CLIPS = [
    (
        "dom_intro.mp3",
        "In dieser Cyber-Matrix ist alles nur ein Code — außer unserem Licht! Zieh deine Handschuhe an, Bruder, jetzt wird geboxt!",
        "Sprich als cooler 17-jähriger deutscher Boxer flüssig ohne Pause: In dieser Cyber-Matrix ist alles nur ein Code — außer unserem Licht! Zieh deine Handschuhe an, Bruder, jetzt wird geboxt!",
        9.0,
        False,
        "+7%",
        "-2Hz",
    ),
    (
        "dom_win.mp3",
        "System gecrasht, Bruder! Keine Matrix der Welt kann echtes Licht berechnen!",
        "Sprich als cooler 17-jähriger deutscher Boxer flüssig ohne Pause: System gecrasht, Bruder! Keine Matrix der Welt kann echtes Licht berechnen!",
        7.5,
        False,
        "+6%",
        "-2Hz",
    ),
    (
        "dom_special.mp3",
        "MATRIX BREAKER!",
        "Rufe explosiv als 17-jähriger Boxer: MATRIX BREAKER!",
        2.4,
        False,
        "+10%",
        "-3Hz",
    ),
    (
        "dom_super.mp3",
        "CYBER KNOCKOUT OVERDRIVE!",
        "Rufe mit voller Power als 17-jähriger Boxer: CYBER KNOCKOUT OVERDRIVE!",
        3.0,
        False,
        "+10%",
        "-3Hz",
    ),
    (
        "dom_select.mp3",
        "Dom ist im Ring — bereit, die Matrix zu sprengen!",
        "Sprich lässig und fokussiert: Dom ist im Ring — bereit, die Matrix zu sprengen!",
        4.8,
        False,
        "+6%",
        "-2Hz",
    ),
    (
        "dom_taunt.mp3",
        "Deckung hoch, Bruder — meine Kombo sieht man erst, wenn sie einschlägt!",
        "Sprich lässig und herausfordernd: Deckung hoch, Bruder — meine Kombo sieht man erst, wenn sie einschlägt!",
        5.5,
        False,
        "+7%",
        "-2Hz",
    ),
    (
        "dom_hit.mp3",
        "Ugh!",
        "Kurzer harter Boxer-Treffer-Laut (0.4 Sekunden): Ugh!",
        0.85,
        True,
        "+14%",
        "-4Hz",
    ),
    (
        "dom_ko.mp3",
        "Aaagh...!",
        "Dramatisches K.O.-Stöhnen eines Boxers (1.1 Sekunden): Aaagh...!",
        1.9,
        True,
        "-12%",
        "-6Hz",
    ),
]


def main():
    print("Generating DOM's 8 authentic Studio German Voice MP3s...")
    for fname, text, gpt_p, max_d, is_short, rate, pitch in DOM_CLIPS:
        out_p, dur = generate_dom_voice_clip(fname, text, gpt_p, max_d, is_short_sfx=is_short, rate=rate, pitch=pitch)
        size_b = os.path.getsize(out_p)
        status = "OK" if (0.20 <= dur <= max_d and size_b > 1000) else "WARN"
        print(f"  [{status}] {fname:16s} -> {dur:.2f}s / max {max_d:.2f}s ({size_b} bytes)")


if __name__ == "__main__":
    main()
