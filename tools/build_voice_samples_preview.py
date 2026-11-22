#!/usr/bin/env python3
"""
Builds 25 newly cast & mastered Street Fighter voice samples (preserving Marley & Pablo untouched)
into assets/audio/voice_samples/ and generates an interactive HTML Soundboard (voice_preview.html)
so Jan can audition every single fighter's new voice, accent, pitch, and provocative street lines!
"""
import asyncio
import os
import shutil
import subprocess
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE_DIR = os.path.join(ROOT, "assets", "audio", "voice_samples")
VOICE_DIR = os.path.join(ROOT, "assets", "audio", "voice")
os.makedirs(SAMPLE_DIR, exist_ok=True)


def make_filter(asetrate_mul=1.0, atempo_mul=1.0, bass_db=2.8, pres_db=2.4):
    return (
        "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.22:stop_threshold=-44dB,"
        f"asetrate=24000*{asetrate_mul:.3f},aresample=44100,atempo={atempo_mul:.3f},"
        f"equalizer=f=125:t=q:w=1.0:g={bass_db:.1f},"
        f"equalizer=f=3400:t=q:w=1.2:g={pres_db:.1f},"
        "acompressor=threshold=-17dB:ratio=3.0:makeup=3.4dB,"
        "alimiter=limit=0.95,apad=pad_dur=0.15"
    )


# 27 Fighters Voice Casting Table (19 distinct neural models + custom per-character studio mastering!)
CAST = [
    {
        "id": "Keano",
        "name": "🔥 Keano Romeo (14 J.)",
        "folder": "0.Keano",
        "voice_desc": "de-DE-KillianNeural · Junger 14-jähriger Ghetto-Street-Flow (heller, frech, direkt)",
        "voice": "de-DE-KillianNeural",
        "rate": "+9%",
        "pitch": "+2Hz",
        "filter": make_filter(1.03, 1.00, 2.6, 2.6),
        "text": "Was guckst du so, Bruder? Wer unser Licht anfasst, geht heute auf den Brettern schlafen, komm ran, Digga!",
    },
    {
        "id": "HyperKeano",
        "name": "⚡ Hyper Keano",
        "folder": "0.2.Hyper_Keano",
        "voice_desc": "de-DE-KillianNeural · Aufgeladen, aggressiver & schneller",
        "voice": "de-DE-KillianNeural",
        "rate": "+12%",
        "pitch": "+1Hz",
        "filter": make_filter(1.02, 1.02, 3.0, 2.8),
        "text": "Keine Halbgas-Runden mehr, Digga! Du wolltest Stress? Jetzt kriegst du mein volles Hyper-Licht direkt in deine Fresse, Bruder!",
    },
    {
        "id": "SupremeKeano",
        "name": "👑 Supreme Keano",
        "folder": "0.1.Supreme_Keano",
        "voice_desc": "de-DE-KillianNeural · Tieferes Gottes-Level-Mastering mit Boss-Resonanz",
        "voice": "de-DE-KillianNeural",
        "rate": "+7%",
        "pitch": "-1Hz",
        "filter": make_filter(0.99, 1.02, 3.6, 2.6),
        "text": "Höchste Stufe erreicht, Digga. Licht und Schatten gehören mir, knie nieder oder geh unter!",
    },
    {
        "id": "JJDark",
        "name": "🌑 JJ Dark / Jayden (15 J.)",
        "folder": "12.JJ_Dark",
        "voice_desc": "de-DE-FlorianMultilingualNeural · Eiskalter 15-jähriger älterer Bruder (dunkler & rauer als Keano)",
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+8%",
        "pitch": "-2Hz",
        "filter": make_filter(0.98, 1.03, 3.4, 2.5),
        "text": "Du stehst vor dem falschen Gegner, du Hund. Mein Schattenfeuer brennt dich bis auf die Knochen nieder!",
    },
    {
        "id": "JayX",
        "name": "🟣 Jay X",
        "folder": "12.1.Jay_X",
        "voice_desc": "de-DE-FlorianMultilingualNeural · Schneller, arroganter Street-Drip",
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+11%",
        "pitch": "-1Hz",
        "filter": make_filter(0.99, 1.04, 3.2, 2.8),
        "text": "Bevor du dein Maul aufmachst, hat dich mein Phantom-Puls schon zerfetzt, komm ran, du Opfer!",
    },
    {
        "id": "Dom",
        "name": "🥊 DOM (17 J. · Emys Freund)",
        "folder": "20.Dom",
        "voice_desc": "en-US-BrianMultilingualNeural · 17-jähriger Guile-Boxer/Kickboxer (trockener Street-Punch)",
        "voice": "en-US-BrianMultilingualNeural",
        "rate": "+10%",
        "pitch": "-2Hz",
        "filter": make_filter(1.02, 1.02, 3.4, 2.6),
        "text": "Fass mein Mädchen Emy oder die Familie an und ich brech dir jeden Knochen, Digga! Handschuhe sind zu, Sonic Boom und Licht aus!",
    },
    {
        "id": "Emely",
        "name": "🌸 Emy (16 J.)",
        "folder": "17.Emely",
        "voice_desc": "de-DE-SeraphinaMultilingualNeural · 16-jähriges It-Girl (stylisch, arrogant, scharfzüngig)",
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "+8%",
        "pitch": "+3Hz",
        "filter": make_filter(1.03, 1.00, 2.0, 2.8),
        "text": "Mach Platz, Bitch! Guck mich nicht so billig an, Schatz, Dom steht hinter mir und mein Blütensturm fegt dich weg!",
    },
    {
        "id": "HyperEmely",
        "name": "🌸 Hyper-Emy",
        "folder": "17.1.Hyper_Emely",
        "voice_desc": "en-US-AvaMultilingualNeural · Sakura-Queen (noch dominanterer It-Girl-Vibe)",
        "voice": "en-US-AvaMultilingualNeural",
        "rate": "+9%",
        "pitch": "+2Hz",
        "filter": make_filter(1.02, 1.01, 2.4, 2.8),
        "text": "Hyper-Emy ist da, Bitches! Du dachtest echt, du hast eine Chance gegen die Queen? Mit Dom an meiner Seite zerlege ich deine ganze Arena!",
    },
    {
        "id": "Cayle",
        "name": "❄️ Cayle (12 J. · Deutsch)",
        "folder": "18.Cayle",
        "voice_desc": "de-CH-LeniNeural (Hochdeutsch) · Helle, rotzfreche 12-jährige deutsche Mädchenstimme",
        "voice": "de-CH-LeniNeural",
        "rate": "+10%",
        "pitch": "+8Hz",
        "filter": make_filter(1.08, 0.96, 1.6, 2.8),
        "text": "Unterschätz mich noch einmal, weil ich die Jüngste bin, und ich frier dein großes Maul direkt zu, du Opfer!",
    },
    {
        "id": "CayleMinogue",
        "name": "💎 Cayle Minogue (Deutsch · Diamond Queen)",
        "folder": "18.1.Cayle_Minogue",
        "voice_desc": "de-DE-AmalaNeural · 100% Deutsch! Coole, frech-überlegene deutsche Diamant-Queen",
        "voice": "de-DE-AmalaNeural",
        "rate": "+9%",
        "pitch": "+5Hz",
        "filter": make_filter(1.05, 0.98, 2.0, 2.8),
        "text": "Als Cayle Minogue glitzert mein Eis wie echte Diamanten! Mach Platz, du Verlierer, mein Diamant-Frost schneidet dich in tausend Stücke!",
    },
    {
        "id": "Annikina",
        "name": "🔥 Annikina (Mama · Kneipenterroristen)",
        "folder": "19.Annikina",
        "voice_desc": "de-DE-KatjaNeural · Knallharte, erwachsene deutsche Straßen-Löwin mit gusseiserner Pfanne",
        "voice": "de-DE-KatjaNeural",
        "rate": "+8%",
        "pitch": "-3Hz",
        "filter": make_filter(0.97, 1.04, 3.2, 2.8),
        "text": "Du wagst es, meine Kinder anzufassen, du Dreckssack?! Jetzt gibt es die heiße gusseiserne Bratpfanne quer durch die Fresse!",
    },
    {
        "id": "VikingoRaw",
        "name": "⚡ Dark Vikingo (Kriegsgott von Walhalla)",
        "folder": "14.1.vikingo_shirtless",
        "voice_desc": "de-DE-ConradNeural (Dark Bass) · Brachialer, grollender Endboss-Bass",
        "voice": "de-DE-ConradNeural",
        "rate": "+4%",
        "pitch": "-8Hz",
        "filter": make_filter(0.90, 1.08, 4.8, 2.4),
        "text": "Ich bin der verdammte Boss von Walhalla! Zeigt mir, ob ihr Eier aus Stahl habt, oder ich zerschmettere euch im Staub!",
    },
    {
        "id": "Vikingo",
        "name": "👑 Vikingo (VIKINGO40 · Der Big Boss)",
        "folder": "14.vikingo_coat",
        "voice_desc": "de-DE-ConradNeural (Paten-Mastering) · Souveränes, tiefes Familien-Oberhaupt",
        "voice": "de-DE-ConradNeural",
        "rate": "+5%",
        "pitch": "-5Hz",
        "filter": make_filter(0.93, 1.06, 4.4, 2.5),
        "text": "Hier spricht das Oberhaupt der Familie. Ich habe diese Welt gebaut und unser Blut trägt das Feuer. Zeigt mir Respekt im Ring, oder ich beende euch mit einem Schlag!",
    },
    {
        "id": "Simba",
        "name": "🦁 Simba (König der Savanne)",
        "folder": "16.Simba",
        "voice_desc": "de-DE-ChristophNeural (Sub-Bass Beast) · Tiefes, animalisch-donnerndes Wächter-Organ",
        "voice": "de-DE-ChristophNeural",
        "rate": "+2%",
        "pitch": "-10Hz",
        "filter": make_filter(0.87, 1.10, 5.2, 2.2),
        "text": "Ich bin der Wächter des Hauses und der König der Savanne. Ein Biss und dein Kampf ist vorbei!",
    },
    {
        "id": "Hattori",
        "name": "🇯🇵 Hattori (Tokyo Samurai)",
        "folder": "1.Hattori_Japan",
        "voice_desc": "ko-KR-HyunsuMultilingualNeural · Echter asiatischer Samurai-Akzent im Deutschen + Bakayaro/Kuso",
        "voice": "ko-KR-HyunsuMultilingualNeural",
        "rate": "+5%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.05, 3.6, 2.5),
        "text": "Du entehrst meinen Tempel in Tokyo, Bakayaro! Zieh deine Waffe oder stirb durch mein Katana, Kuso!",
    },
    {
        "id": "Lee",
        "name": "🇯🇵 Lee (Cyber-Tokyo Speed-Fighter)",
        "folder": "11.Lee",
        "voice_desc": "ko-KR-HyunsuMultilingualNeural (Fast Pitch) · Blitzschneller junger Yakuza-Fighter aus Tokyo",
        "voice": "ko-KR-HyunsuMultilingualNeural",
        "rate": "+14%",
        "pitch": "+2Hz",
        "filter": make_filter(1.03, 1.02, 2.8, 2.8),
        "text": "Temee! In den Neon-Straßen von Tokyo überlebt kein langsamer Bastard, mein Blitz schlägt dir die Zähne ein, Bakayaro!",
    },
    {
        "id": "Tzubaza",
        "name": "🇨🇳 Tzubaza (China Kung-Fu Meister)",
        "folder": "4.Tzubaza",
        "voice_desc": "ko-KR-HyunsuMultilingualNeural (Deep Master) · Strenger, arroganter Kung-Fu-Großmeister",
        "voice": "ko-KR-HyunsuMultilingualNeural",
        "rate": "+3%",
        "pitch": "-6Hz",
        "filter": make_filter(0.92, 1.06, 3.8, 2.4),
        "text": "Tamadé! Du wagst es, mit deinem billigen Straßenkampf in meine Festung zu kommen?! Mein Drachen-Kung-Fu bricht dir sämtliche Knochen!",
    },
    {
        "id": "Raheel",
        "name": "🇮🇳 Raheel (Indien · Dhalsim-Feuermeister)",
        "folder": "2.Raheel",
        "voice_desc": "en-AU-WilliamMultilingualNeural · Exotischer Dhalsim-Mystiker-Akzent mit tiefer Resonanz",
        "voice": "en-AU-WilliamMultilingualNeural",
        "rate": "+6%",
        "pitch": "-3Hz",
        "filter": make_filter(0.96, 1.04, 3.4, 2.5),
        "text": "Du glaubst, du kannst mein heiliges Feuer am Ganges stehlen, du Narr? Meine Flammen fressen deine Seele bei lebendigem Leib!",
    },
    {
        "id": "AlCapone",
        "name": "🇮🇹 Al Capone (Rom · Mafia Padrino)",
        "folder": "5.Al_Capone",
        "voice_desc": "it-IT-GiuseppeMultilingualNeural · ECHTER italienischer Muttersprachler spricht Deutsch + Vaffanculo/Cazzo!",
        "voice": "it-IT-GiuseppeMultilingualNeural",
        "rate": "+6%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.04, 3.8, 2.5),
        "text": "Hör gut zu, Cazzo: In Rom regiert La Famiglia! Machst du Stress in meinem Kolosseum, schick ich dich im Betonsarg nach Hause, Vaffanculo, Stronzo!",
    },
    {
        "id": "Gargamel",
        "name": "🇩🇪🇹🇷 C. Gargamel (Berlin-Kreuzberg)",
        "folder": "6.C_Gargamel",
        "voice_desc": "de-AT-JonasNeural (Kreuzberg Street Filter) · Aggressiver Berliner Untergrund-Boss + Lan / sikedim amk",
        "voice": "de-AT-JonasNeural",
        "rate": "+10%",
        "pitch": "-3Hz",
        "filter": make_filter(0.97, 1.04, 3.6, 2.8),
        "text": "Was suchst du Hund in meiner Straße, Lan?! Ich schwör, meine Alchemie fickt dein ganzes Leben, sikedim amk!",
    },
    {
        "id": "GargamelHoodie",
        "name": "🇩🇪🇹🇷 Gargamel Hoodie (Berliner Untergrund)",
        "folder": "6.1.C_Gargamel_Hoodie",
        "voice_desc": "de-CH-JanNeural (Dark Underground Filter) · Tiefer, dreckiger Straßen-Alchemist",
        "voice": "de-CH-JanNeural",
        "rate": "+9%",
        "pitch": "-5Hz",
        "filter": make_filter(0.94, 1.05, 4.0, 2.7),
        "text": "Kapuze tief, Fäuste hart, Lan! Hier unten im Berliner Untergrund holt dich kein Krankenwagen mehr ab, sikedim amk!",
    },
    {
        "id": "Kowalski",
        "name": "🇵🇱 Kowalski (Warschau · Iron Bear)",
        "folder": "8.Kowalski_Poland",
        "voice_desc": "de-DE-ChristophNeural (Heavy Polish Brawler Bass) · Schwerer Warschauer Hooligan-Tank + Kurwa mać / Ja pierdolę",
        "voice": "de-DE-ChristophNeural",
        "rate": "+6%",
        "pitch": "-6Hz",
        "filter": make_filter(0.92, 1.06, 4.5, 2.5),
        "text": "Kurwa mać! Polnischer Stahl bricht niemals, Bracie! Komm her, ich reiß dir den Kopf ab, ja pierdolę!",
    },
    {
        "id": "Paco",
        "name": "🇲🇽 Paco el Taco (Mexiko · Lucha Brawler)",
        "folder": "9.Paco_el_Taco",
        "voice_desc": "fr-FR-RemyMultilingualNeural · Feuriger lateinamerikanischer Akzent im Deutschen + Hijo de puta / Cabrón / Pendejo",
        "voice": "fr-FR-RemyMultilingualNeural",
        "rate": "+9%",
        "pitch": "-2Hz",
        "filter": make_filter(0.98, 1.03, 3.4, 2.7),
        "text": "¡Qué pasa, Hijo de puta! Auf meiner Pyramide wird nicht geweint, ich schlag dich grün und blau, du verdammter Pendejo, Cabrón!",
    },
    {
        "id": "Juan",
        "name": "🇪🇸 Juan (Spanien · Matador)",
        "folder": "10.Juan",
        "voice_desc": "it-IT-GiuseppeMultilingualNeural (Spanish Torero Pitch) · Arroganter spanischer Arena-Akzent + Maricón / Pendejo",
        "voice": "it-IT-GiuseppeMultilingualNeural",
        "rate": "+10%",
        "pitch": "+1Hz",
        "filter": make_filter(1.01, 1.02, 3.0, 2.8),
        "text": "In meiner spanischen Arena gibt es keine Gnade für Heulsusen, Maricón! Knie nieder vor meiner Klinge, Pendejo!",
    },
    {
        "id": "Putin",
        "name": "🇷🇺 Putin (Sibirien · Cold War Tank)",
        "folder": "13.Putin",
        "voice_desc": "en-AU-WilliamMultilingualNeural (Deep Siberian Bass) · Eiskalter russischer Kommandanten-Bass + Suka Blyat / Idi nahui",
        "voice": "en-AU-WilliamMultilingualNeural",
        "rate": "+3%",
        "pitch": "-8Hz",
        "filter": make_filter(0.89, 1.08, 4.8, 2.4),
        "text": "Im ewigen Eis von Sibirien gefriert dein Blut zu Stein, Suka Blyat! Ich breche dich entzwei, idi nahui!",
    },
]


async def build_samples():
    # Copy untouched favorites Pablo & Marley into samples folder so all 27 are on the board!
    for fav_id, fav_prefix in [("Pablo", "pablo"), ("Marley", "marley")]:
        src = os.path.join(VOICE_DIR, f"{fav_prefix}_intro.mp3")
        dst = os.path.join(SAMPLE_DIR, f"sample_{fav_id}.mp3")
        if os.path.exists(src):
            shutil.copy2(src, dst)

    for item in CAST:
        cid = item["id"]
        out_mp3 = os.path.join(SAMPLE_DIR, f"sample_{cid}.mp3")
        tmp_raw = out_mp3 + ".raw.mp3"
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(
                    item["text"],
                    item["voice"],
                    rate=item["rate"],
                    pitch=item["pitch"],
                )
                await comm.save(tmp_raw)
                break
            except Exception as e:
                if attempt == 2:
                    raise e
                await asyncio.sleep(0.8)

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                tmp_raw,
                "-af",
                item["filter"],
                "-ar",
                "44100",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                out_mp3,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        if os.path.exists(tmp_raw):
            os.remove(tmp_raw)
        print(f"Built sample_{cid}.mp3 ({item['voice']})")


def build_html():
    all_cards = list(CAST) + [
        {
            "id": "Pablo",
            "name": "🇧🇷 Pablo (Rio · Unberührt wie gewünscht)",
            "folder": "3.Pablo",
            "voice_desc": "Originaler Pablo-Sound (bleibt 100% erhalten!)",
            "text": "Unter der Sonne von Rio tanzt der Sturm! Zeig mir deinen Rhythmus im Kampf, Amigo!",
        },
        {
            "id": "Marley",
            "name": "🇯🇲 Marley (Kingston · Unberührt wie gewünscht)",
            "folder": "7.Marley_Jamaica",
            "voice_desc": "Originaler Marley-Sound (bleibt 100% erhalten!)",
            "text": "An der Küste von Jamaika schlägt das Herz der Freiheit, Bredren. Zeig mir deine Kraft!",
        },
    ]

    cards_html = []
    for idx, c in enumerate(all_cards, 1):
        cid = c["id"]
        cards_html.append(f"""
        <div class="card" id="card-{cid}">
            <div class="card-head">
                <img src="assets/CHARACTERS/{c['folder']}/_front.png" alt="{c['name']}">
                <div>
                    <div class="num">FIGHTER #{idx}</div>
                    <h3>{c['name']}</h3>
                    <div class="vdesc">{c['voice_desc']}</div>
                </div>
            </div>
            <div class="quote">„{c['text']}“</div>
            <div class="controls">
                <button class="play-btn" onclick="playSample('{cid}')">▶ STIMME ANHÖREN</button>
                <audio id="aud-{cid}" src="assets/audio/voice_samples/sample_{cid}.mp3" preload="none"></audio>
            </div>
        </div>
        """)

    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STREET FIGHTER VOICE-CASTING & MUSTER (ALLE 27 FIGHTER)</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
<style>
    body {{
        background: #070913;
        color: #f0f4ff;
        font-family: 'Outfit', sans-serif;
        margin: 0;
        padding: 28px;
    }}
    h1 {{
        font-family: 'Orbitron', sans-serif;
        color: #ffd700;
        text-align: center;
        font-size: 28px;
        margin-bottom: 6px;
        text-shadow: 0 0 18px rgba(255, 215, 0, 0.45);
    }}
    .sub {{
        text-align: center;
        color: #00e5ff;
        margin-bottom: 26px;
        font-size: 16px;
    }}
    .top-bar {{
        display: flex;
        justify-content: center;
        gap: 14px;
        margin-bottom: 26px;
        flex-wrap: wrap;
    }}
    .top-btn {{
        background: linear-gradient(135deg, #ff2255, #ff8800);
        color: #fff;
        border: 2px solid #ffd700;
        padding: 12px 22px;
        border-radius: 10px;
        font-family: 'Orbitron', sans-serif;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
    }}
    .grid {{
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 18px;
        max-width: 1520px;
        margin: 0 auto;
    }}
    .card {{
        background: linear-gradient(160deg, #11162b 0%, #0b0e1c 100%);
        border: 2px solid #263159;
        border-radius: 14px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.2s ease;
    }}
    .card.playing {{
        border-color: #00ff88;
        box-shadow: 0 0 22px rgba(0, 255, 136, 0.35);
        transform: translateY(-2px);
    }}
    .card-head {{
        display: flex;
        gap: 14px;
        align-items: center;
        margin-bottom: 12px;
    }}
    .card-head img {{
        width: 68px;
        height: 68px;
        object-fit: cover;
        object-position: top center;
        border-radius: 10px;
        border: 2px solid #ffd700;
        background: #1a1f3c;
        flex-shrink: 0;
    }}
    .num {{
        font-size: 11px;
        color: #00e5ff;
        font-weight: 700;
        letter-spacing: 1px;
    }}
    h3 {{
        margin: 2px 0 4px 0;
        font-size: 18px;
        color: #ffd700;
    }}
    .vdesc {{
        font-size: 12px;
        color: #9cb0d9;
        line-height: 1.3;
    }}
    .quote {{
        background: rgba(0, 0, 0, 0.42);
        border-left: 3px solid #00e5ff;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: 14.5px;
        line-height: 1.45;
        color: #ffffff;
        margin-bottom: 14px;
    }}
    .play-btn {{
        width: 100%;
        background: linear-gradient(135deg, #00c853, #009624);
        color: #fff;
        border: 1.5px solid #69f0ae;
        padding: 11px;
        border-radius: 8px;
        font-family: 'Orbitron', sans-serif;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }}
    .play-btn:hover {{
        filter: brightness(1.12);
    }}
</style>
</head>
<body>
    <h1>🎙️ STREET FIGHTER VOICE-CASTING — HÖRPROBEN ALLER 27 CHARAKTERE</h1>
    <div class="sub">Klicke bei jedem Kämpfer auf „▶ STIMME ANHÖREN“ (Cayle & Cayle Minogue sind jetzt 100% Deutsch!)</div>
    <div class="top-bar">
        <button class="top-btn" onclick="playAllSequential()">▶ ALLE 27 NACHEINANDER ABSPIELEN</button>
        <button class="top-btn" style="background:#333;border-color:#888;" onclick="stopAll()">⏹ STOP</button>
    </div>
    <div class="grid">
        {''.join(cards_html)}
    </div>
<script>
let currentAudio = null;
let seqRunning = false;
const allIds = {[c["id"] for c in all_cards]};

function stopAll() {{
    seqRunning = false;
    document.querySelectorAll('audio').forEach(a => {{ a.pause(); a.currentTime = 0; }});
    document.querySelectorAll('.card').forEach(c => c.classList.remove('playing'));
}}

function playSample(id, onEnd) {{
    document.querySelectorAll('audio').forEach(a => {{ a.pause(); a.currentTime = 0; }});
    document.querySelectorAll('.card').forEach(c => c.classList.remove('playing'));
    const aud = document.getElementById('aud-' + id);
    const card = document.getElementById('card-' + id);
    if (!aud) return;
    card.classList.add('playing');
    aud.onended = () => {{
        card.classList.remove('playing');
        if (onEnd) onEnd();
    }};
    aud.play();
}}

function playAllSequential(idx = 0) {{
    if (idx === 0) {{ stopAll(); seqRunning = true; }}
    if (!seqRunning || idx >= allIds.length) return;
    const id = allIds[idx];
    const card = document.getElementById('card-' + id);
    if (card) card.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
    playSample(id, () => {{
        if (seqRunning) setTimeout(() => playAllSequential(idx + 1), 350);
    }});
}}
</script>
</body>
</html>
"""
    out_html = os.path.join(ROOT, "voice_preview.html")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html)
    print("Saved interactive soundboard:", out_html)


if __name__ == "__main__":
    asyncio.run(build_samples())
    build_html()
