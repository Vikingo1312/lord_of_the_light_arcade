#!/usr/bin/env python3
"""
Builds 25 authentic Native-Dialect + RVC Human Voice samples (preserving Marley & Pablo untouched)
into assets/audio/voice_samples/ and generates an interactive HTML Soundboard (voice_preview.html)
so Jan can audition every single fighter's authentic accent, native swear word pronunciation,
and his own real RVC human voice (`vikingo040.pth`)!
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

RVC_BASE = "/Users/vikingo40/.gemini/antigravity-ide/scratch/voice-swap"
RVC_PYTHON = os.path.join(RVC_BASE, "python310", "python", "bin", "python3.10")
RVC_SITE = os.path.join(RVC_BASE, "venv", "lib", "python3.10", "site-packages")
RVC_SCRIPT = os.path.join(RVC_BASE, "core", "rvc_infer.py")
RVC_MODEL = os.path.join(RVC_BASE, "models", "vikingo040.pth")
RVC_INDEX = os.path.join(RVC_BASE, "models", "vikingo040.index")


def make_filter(asetrate_mul=1.0, atempo_mul=1.0, bass_db=2.8, pres_db=2.4):
    return (
        "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.24:stop_threshold=-44dB,"
        f"asetrate=24000*{asetrate_mul:.3f},aresample=44100,atempo={atempo_mul:.3f},"
        f"equalizer=f=125:t=q:w=1.0:g={bass_db:.1f},"
        f"equalizer=f=3400:t=q:w=1.2:g={pres_db:.1f},"
        "acompressor=threshold=-17dB:ratio=3.0:makeup=3.4dB,"
        "alimiter=limit=0.95,apad=pad_dur=0.15"
    )


def make_rvc_post_filter(bass_db=3.6, pres_db=2.6):
    return (
        "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.25:stop_threshold=-44dB,"
        f"equalizer=f=120:t=q:w=1.0:g={bass_db:.1f},"
        f"equalizer=f=3200:t=q:w=1.2:g={pres_db:.1f},"
        "acompressor=threshold=-16dB:ratio=3.2:makeup=3.5dB,"
        "alimiter=limit=0.95,apad=pad_dur=0.15"
    )


# 27 Fighters Voice Casting Table:
# - Real Human RVC Voice Cloning (`vikingo040.pth`) for Vikingo, Dark Vikingo & Family Male Roster
# - True Native Country Speakers (`es-ES`, `es-MX`, `pl-PL`, `uk-UA`, `tr-TR`, `it-IT`, `ja-JP`, `zh-CN`, `en-IN`)
#   speaking German with authentic foreign dialects + 100% native mother-tongue swear words!
CAST = [
    {
        "id": "Vikingo",
        "name": "👑 Vikingo (VIKINGO40 · Deine ECHTE RVC-Stimme!)",
        "folder": "14.vikingo_coat",
        "voice_desc": "ECHTES RVC-VOICE-CLONING (vikingo040.pth) · Deine eigene echte Stimme vom Laptop!",
        "voice": "de-DE-ConradNeural",
        "rate": "+4%",
        "pitch": "-3Hz",
        "use_rvc": True,
        "rvc_pitch": -1,
        "rvc_index_rate": 0.72,
        "filter": make_rvc_post_filter(3.8, 2.8),
        "display_text": "Hier spricht das Oberhaupt der Familie! Auf der Elbe habe ich schon ganz andere Stürme überlebt. Zeig mir Respekt im Ring, oder ich beende dich mit einem Schlag!",
        "tts_text": "Hier spricht das Oberhaupt der Familie! Auf der Elbe habe ich schon ganz andere Stürme überlebt. Zeig mir Respekt im Ring, oder ich beende dich mit einem Schlag!",
    },
    {
        "id": "VikingoRaw",
        "name": "⚡ Dark Vikingo (Kriegsgott · Deine ECHTE RVC-Stimme!)",
        "folder": "14.1.vikingo_shirtless",
        "voice_desc": "ECHTES RVC-VOICE-CLONING (vikingo040.pth · Dark Endboss Bass) · Deine echte Stimme im Berserker-Modus!",
        "voice": "de-DE-ConradNeural",
        "rate": "+3%",
        "pitch": "-5Hz",
        "use_rvc": True,
        "rvc_pitch": -3,
        "rvc_index_rate": 0.75,
        "filter": make_rvc_post_filter(4.6, 2.6),
        "display_text": "Ich bin der verdammte Boss von Walhalla! Zeigt mir, ob ihr Eier aus Stahl habt, oder ich zerschmettere euch im Staub!",
        "tts_text": "Ich bin der verdammte Boss von Walhalla! Zeigt mir, ob ihr Eier aus Stahl habt, oder ich zerschmettere euch im Staub!",
    },
    {
        "id": "Juan",
        "name": "🇪🇸 Juan (Spanien · Echter Spanier mit Dialekt)",
        "folder": "10.Juan",
        "voice_desc": "es-ES-AlvaroNeural (ECHTER Spanier aus Madrid) · Spricht Deutsch mit echtem spanischem Akzent + Gilipollas / Maricón / Pendejo!",
        "voice": "es-ES-AlvaroNeural",
        "rate": "+4%",
        "pitch": "-2Hz",
        "filter": make_filter(1.00, 1.00, 3.2, 2.8),
        "display_text": "¡Vamos, Gilipollas! In meiner spanischen Arena gibt es keine Gnade für Heulsusen, Maricón! Knie nieder vor meiner Klinge, Pendejo!",
        "tts_text": "¡Vamos, Gilipollas! In mayner schpanischen Arena gibt es kayne Gnade für Hoylsusen, Maricón! Knie nieder for mayner Klinge, Pendejo!",
    },
    {
        "id": "Paco",
        "name": "🇲🇽 Paco el Taco (Mexiko · Echter Mexikaner mit Dialekt)",
        "folder": "9.Paco_el_Taco",
        "voice_desc": "es-MX-JorgeNeural (ECHTER Mexikaner) · Spricht Deutsch mit echtem mexikanischem Barrio-Akzent + Hijo de puta / Pendejo / Cabrón!",
        "voice": "es-MX-JorgeNeural",
        "rate": "+6%",
        "pitch": "-3Hz",
        "filter": make_filter(0.98, 1.02, 3.6, 2.8),
        "display_text": "¡Qué pasa, Hijo de puta! Auf meiner Pyramide wird nicht geweint, ich schlag dich grün und blau, du verdammter Pendejo, Cabrón!",
        "tts_text": "¡Qué pasa, Hijo de puta! Auf mayner Piramide vird niht gevaynt, ih schlag dih grün und blau, du ferdammter Pendejo, Cabrón!",
    },
    {
        "id": "Kowalski",
        "name": "🇵🇱 Kowalski (Polen · Echter Pole mit Dialekt)",
        "folder": "8.Kowalski_Poland",
        "voice_desc": "pl-PL-MarekNeural (ECHTER Pole aus Warschau) · Spricht Deutsch mit hartem polnischem Akzent + Kurwa mać / Bracie / Ja pierdolę!",
        "voice": "pl-PL-MarekNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.94, 1.04, 4.4, 2.6),
        "display_text": "Kurwa mać! Polnischer Stahl bricht niemals, Bracie! Komm her, ich reiß dir den Kopf ab, ja pierdolę!",
        "tts_text": "Kurwa mać! Polnischer Schtahl briht niemals, Bracie! Komm her, ih rays dir den Kopf ab, ja pierdolę!",
    },
    {
        "id": "Putin",
        "name": "🇷🇺 Putin (Sibirien · Echter Slawisch-Russischer Dialekt)",
        "folder": "13.Putin",
        "voice_desc": "uk-UA-OstapNeural (Echter Ost-Slawischer Muttersprachler) · Spricht Deutsch mit hartem russischem Akzent + Сука Блять / иди нахуй!",
        "voice": "uk-UA-OstapNeural",
        "rate": "+2%",
        "pitch": "-6Hz",
        "filter": make_filter(0.92, 1.05, 4.6, 2.5),
        "display_text": "Im ewigen Eis von Sibirien gefriert dein Blut zu Stein, Сука Блять! Ich breche dich entzwei, иди нахуй!",
        "tts_text": "Им эвиген Айс фон Сибириен гефрирт дайн Блут цу Штайн, Сука Блять! Их брехе дих энтцвай, иди нахуй!",
    },
    {
        "id": "Gargamel",
        "name": "🇩🇪🇹🇷 C. Gargamel (Kreuzberg · Echter Türkischer Dialekt)",
        "folder": "6.C_Gargamel",
        "voice_desc": "tr-TR-AhmetNeural (ECHTER Türke) · Spricht Deutsch mit echtem türkischem Straßen-Akzent + Lan / sikecem amına koyayım!",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+6%",
        "pitch": "-3Hz",
        "filter": make_filter(0.97, 1.03, 3.6, 2.8),
        "display_text": "Was suchst du Hund in meiner Straße, Lan?! Ich schwör, meine Alchemie fickt dein ganzes Leben, sikecem amına koyayım!",
        "tts_text": "Vas zuhst du Hund in mayner Schtrase, Lan?! İh schvör, mayne Alhemi fikt dayn gantses Leben, sikecem amına koyayım!",
    },
    {
        "id": "GargamelHoodie",
        "name": "🇩🇪🇹🇷 Gargamel Hoodie (Untergrund · Echter Türkischer Dialekt)",
        "folder": "6.1.C_Gargamel_Hoodie",
        "voice_desc": "tr-TR-AhmetNeural (Dark Underground Pitch) · Tiefer türkisch-deutscher Untergrund-Akzent + Lan / Vallah / amına koyayım!",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+4%",
        "pitch": "-6Hz",
        "filter": make_filter(0.93, 1.05, 4.2, 2.7),
        "display_text": "Kapuze tief, Fäuste hart, Lan! Vallah, hier unten im Berliner Untergrund holt dich kein Krankenwagen mehr ab, amına koyayım!",
        "tts_text": "Kaputse tief, Foyste hart, Lan! Vallah, hier unten im Berliner Untergrund holt dih kayn Kranken-vagen mehr ab, amına koyayım!",
    },
    {
        "id": "AlCapone",
        "name": "🇮🇹 Al Capone (Rom · Echter Italiener mit Mafia-Dialekt)",
        "folder": "5.Al_Capone",
        "voice_desc": "it-IT-DiegoNeural (ECHTER Italiener aus Rom) · Spricht Deutsch mit echtem Mafia-Padrino-Akzent + Cazzo / Vaffanculo / Stronzo!",
        "voice": "it-IT-DiegoNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.95, 1.04, 3.9, 2.6),
        "display_text": "Hör gut zu, Cazzo! In Rom regiert La Famiglia! Machst du Stress in meinem Kolosseum, schick ich dich im Betonsarg nach Hause, Vaffanculo, Stronzo!",
        "tts_text": "Hör gut tsu, Cazzo! In Rom redschiert La Famiglia! Mahst du Schtress in maynem Kolosseum, schik ih dih im Betonsarg nah Hause, Vaffanculo, Stronzo!",
    },
    {
        "id": "Hattori",
        "name": "🇯🇵 Hattori (Tokyo · Echter Japaner mit Samurai-Dialekt)",
        "folder": "1.Hattori_Japan",
        "voice_desc": "ja-JP-KeitaNeural (ECHTER Japaner aus Tokyo) · Spricht Deutsch mit echtem japanischem Samurai-Akzent + 馬鹿野郎 (Bakayaro) / くそ (Kuso)!",
        "voice": "ja-JP-KeitaNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.95, 1.04, 3.8, 2.6),
        "display_text": "Du entehrst meinen Tempel in Tokyo, Bakayaro! Zieh deine Waffe oder stirb durch mein Katana, Kuso!",
        "tts_text": "ドゥ エントエアスト マイネン テンペル イン 東京、馬鹿野郎！ ツィー ダイネ ヴァッフェ オーダー シュティルプ ドゥルヒ マイン カタナ、くそ！",
    },
    {
        "id": "Lee",
        "name": "🇯🇵 Lee (Cyber-Tokyo · Echter Japaner Speed-Fighter)",
        "folder": "11.Lee",
        "voice_desc": "ja-JP-KeitaNeural (Fast Yakuza Pitch) · Echter japanischer Street-Fighter-Akzent + てめえ (Temee) / 馬鹿野郎 (Bakayaro)!",
        "voice": "ja-JP-KeitaNeural",
        "rate": "+11%",
        "pitch": "+1Hz",
        "filter": make_filter(1.02, 1.02, 3.0, 2.8),
        "display_text": "Temee! In den Neon-Straßen von Tokyo überlebt kein langsamer Bastard, mein Blitz schlägt dir die Zähne ein, Bakayaro!",
        "tts_text": "てめえ！ イン デン ネオン・シュトラーセン フォン 東京 ユーバーレープト カイン ラングザマー バスタルト、マイン ブリッツ シュレークト ディア ディー ツェーネ アイン、馬鹿野郎！",
    },
    {
        "id": "Tzubaza",
        "name": "🇨🇳 Tzubaza (China · Echter Chinese mit Kung-Fu-Dialekt)",
        "folder": "4.Tzubaza",
        "voice_desc": "zh-CN-YunjianNeural (ECHTER Chinese · Martial-Arts-Sprecher) · Spricht Deutsch mit echtem chinesischem Kung-Fu-Akzent + 他妈的 (Tamade)!",
        "voice": "zh-CN-YunjianNeural",
        "rate": "+4%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.04, 3.8, 2.6),
        "display_text": "他妈的 (Tamade)! Auf der Chinesischen Mauer zerschmettert mein Drachen-Kung-Fu deine Knochen, du Witzfigur!",
        "tts_text": "他妈的! Auf der Chinesischen Mauer zerschmettert mein Drachen-Kung-Fu deine Knochen, du Witzfigur, 笨蛋!",
    },
    {
        "id": "Raheel",
        "name": "🇮🇳 Raheel (Indien · Echter Inder mit Dialekt)",
        "folder": "2.Raheel",
        "voice_desc": "en-IN-PrabhatNeural (ECHTER Inder aus Mumbai) · Spricht Deutsch mit echtem indischem Akzent + Bhenchod!",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+4%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.04, 3.6, 2.6),
        "display_text": "Du glaubst, du kannst mein heiliges Feuer am Ganges stehlen, Bhenchod?! Meine Flammen fressen deine Seele bei lebendigem Leib!",
        "tts_text": "Du glaubst, du kannst mayn hayliges Foyer am Ganges schtehlen, Bhenchod?! Mayne Flammen fressen dayne Seele bay lebendigem Layb!",
    },
    {
        "id": "Keano",
        "name": "🔥 Keano Romeo (14 J. · ECHTES RVC-Voice-Model + Teen-Pitch)",
        "folder": "0.Keano",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth +3 Semitones Jugend-Pitch) · Echte menschliche Familien-Stimmfarbe für den 14-jährigen Sohn!",
        "voice": "de-DE-KillianNeural",
        "rate": "+8%",
        "pitch": "+2Hz",
        "use_rvc": True,
        "rvc_pitch": 2,
        "rvc_index_rate": 0.48,
        "filter": make_rvc_post_filter(2.6, 3.0),
        "display_text": "Was guckst du so, Bruder? Wer unser Licht anfasst, geht heute auf den Brettern schlafen, komm ran, Digga!",
        "tts_text": "Was guckst du so, Bruder? Wer unser Licht anfasst, geht heute auf den Brettern schlafen, komm ran, Digga!",
    },
    {
        "id": "HyperKeano",
        "name": "⚡ Hyper Keano (ECHTES RVC-Voice-Model · Aufgeladen)",
        "folder": "0.2.Hyper_Keano",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth +2 Semitones Hyper-Flow) · Menschliche Textur, aggressiv & direkt!",
        "voice": "de-DE-KillianNeural",
        "rate": "+10%",
        "pitch": "+1Hz",
        "use_rvc": True,
        "rvc_pitch": 1,
        "rvc_index_rate": 0.52,
        "filter": make_rvc_post_filter(3.0, 3.0),
        "display_text": "Keine Halbgas-Runden mehr, Digga! Du wolltest Stress? Jetzt kriegst du mein volles Hyper-Licht direkt in deine Fresse, Bruder!",
        "tts_text": "Keine Halbgas-Runden mehr, Digga! Du wolltest Stress? Jetzt kriegst du mein volles Hyper-Licht direkt in deine Fresse, Bruder!",
    },
    {
        "id": "SupremeKeano",
        "name": "👑 Supreme Keano (ECHTES RVC-Voice-Model · God-Tier)",
        "folder": "0.1.Supreme_Keano",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth · Supreme Resonance) · Echte menschliche Stimmgewalt!",
        "voice": "de-DE-KillianNeural",
        "rate": "+6%",
        "pitch": "-1Hz",
        "use_rvc": True,
        "rvc_pitch": 0,
        "rvc_index_rate": 0.58,
        "filter": make_rvc_post_filter(3.5, 2.8),
        "display_text": "Höchste Stufe erreicht, Digga. Licht und Schatten gehören mir, knie nieder oder geh unter!",
        "tts_text": "Höchste Stufe erreicht, Digga. Licht und Schatten gehören mir, knie nieder oder geh unter!",
    },
    {
        "id": "JJDark",
        "name": "🌑 JJ Dark / Jayden (15 J. · ECHTES RVC-Voice-Model)",
        "folder": "12.JJ_Dark",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth +1 Semitone) · Echte, dunkle menschliche Stimme für den 15-jährigen älteren Bruder!",
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+7%",
        "pitch": "-1Hz",
        "use_rvc": True,
        "rvc_pitch": 0,
        "rvc_index_rate": 0.55,
        "filter": make_rvc_post_filter(3.4, 2.8),
        "display_text": "Du stehst vor dem falschen Gegner, du Hund. Mein Schattenfeuer brennt dich bis auf die Knochen nieder!",
        "tts_text": "Du stehst vor dem falschen Gegner, du Hund. Mein Schattenfeuer brennt dich bis auf die Knochen nieder!",
    },
    {
        "id": "JayX",
        "name": "🟣 Jay X (ECHTES RVC-Voice-Model · Phantom Drip)",
        "folder": "12.1.Jay_X",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth +1 Semitone Fast Flow) · Echte menschliche Street-Attitüde!",
        "voice": "de-DE-FlorianMultilingualNeural",
        "rate": "+9%",
        "pitch": "+0Hz",
        "use_rvc": True,
        "rvc_pitch": 1,
        "rvc_index_rate": 0.50,
        "filter": make_rvc_post_filter(3.2, 2.9),
        "display_text": "Bevor du dein Maul aufmachst, hat dich mein Phantom-Puls schon zerfetzt, komm ran, du Opfer!",
        "tts_text": "Bevor du dein Maul aufmachst, hat dich mein Phantom-Puls schon zerfetzt, komm ran, du Opfer!",
    },
    {
        "id": "Dom",
        "name": "🥊 DOM (17 J. · Emys Freund · ECHTES RVC-Voice-Model)",
        "folder": "20.Dom",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth · 17 J. Boxer-Timbre) · Trockene, echte menschliche Kämpfer-Stimme!",
        "voice": "en-US-BrianMultilingualNeural",
        "rate": "+8%",
        "pitch": "-1Hz",
        "use_rvc": True,
        "rvc_pitch": 0,
        "rvc_index_rate": 0.45,
        "filter": make_rvc_post_filter(3.4, 2.8),
        "display_text": "Fass mein Mädchen Emy oder die Familie an und ich brech dir jeden Knochen, Digga! Handschuhe sind zu, Sonic Boom und Licht aus!",
        "tts_text": "Fass mein Mädchen Emy oder die Familie an und ich brech dir jeden Knochen, Digga! Handschuhe sind zu, Sonic Boom und Licht aus!",
    },
    {
        "id": "Simba",
        "name": "🦁 Simba (König der Savanne · ECHTES RVC-Sub-Bass-Beast)",
        "folder": "16.Simba",
        "voice_desc": "ECHTES RVC-VOICE-MODEL (vikingo040.pth -5 Semitones Monster-Bass) · Brutales, echtes Löwen-Wächter-Grollen!",
        "voice": "de-DE-ChristophNeural",
        "rate": "+2%",
        "pitch": "-6Hz",
        "use_rvc": True,
        "rvc_pitch": -5,
        "rvc_index_rate": 0.65,
        "filter": make_rvc_post_filter(5.2, 2.4),
        "display_text": "Ich bin der Wächter des Hauses und der König der Savanne. Ein Biss und dein Kampf ist vorbei!",
        "tts_text": "Ich bin der Wächter des Hauses und der König der Savanne. Ein Biss und dein Kampf ist vorbei!",
    },
    {
        "id": "Emely",
        "name": "🌸 Emy (16 J. · It-Girl · Natürlich & Frech)",
        "folder": "17.Emely",
        "voice_desc": "de-DE-SeraphinaMultilingualNeural (Natural Warm Formant) · Lockeres, arrogantes 16-jähriges It-Girl ohne Roboter-Hall",
        "voice": "de-DE-SeraphinaMultilingualNeural",
        "rate": "+6%",
        "pitch": "+2Hz",
        "filter": make_filter(1.01, 1.00, 2.4, 2.6),
        "display_text": "Mach Platz, Bitch! Guck mich nicht so billig an, Schatz, Dom steht hinter mir und mein Blütensturm fegt dich weg!",
        "tts_text": "Mach Platz, Bitch! Guck mich nicht so billig an, Schatz... Dom steht hinter mir, und mein Blütensturm fegt dich weg!",
    },
    {
        "id": "HyperEmely",
        "name": "🌸 Hyper-Emy (Sakura-Queen · Natürlich & Dominant)",
        "folder": "17.1.Hyper_Emely",
        "voice_desc": "en-US-AvaMultilingualNeural (Natural Studio Mastering) · Lässige, überlegene Queen-Stimme",
        "voice": "en-US-AvaMultilingualNeural",
        "rate": "+7%",
        "pitch": "+1Hz",
        "filter": make_filter(1.01, 1.00, 2.6, 2.6),
        "display_text": "Hyper-Emy ist da, Bitches! Du dachtest echt, du hast eine Chance gegen die Queen? Mit Dom an meiner Seite zerlege ich deine ganze Arena!",
        "tts_text": "Hyper-Emy ist da, Bitches! Du dachtest echt, du hast eine Chance gegen die Queen? Mit Dom an meiner Seite zerlege ich deine ganze Arena!",
    },
    {
        "id": "Cayle",
        "name": "❄️ Cayle (12 J. · 100% Deutsch · Rotzfrech)",
        "folder": "18.Cayle",
        "voice_desc": "de-DE-AmalaNeural (Natural Young German Voice) · Echte junge deutsche Mädchenstimme (ohne unnatürlichen Chipmunk-Filter!)",
        "voice": "de-DE-AmalaNeural",
        "rate": "+8%",
        "pitch": "+4Hz",
        "filter": make_filter(1.03, 0.99, 2.0, 2.7),
        "display_text": "Unterschätz mich noch einmal, weil ich die Jüngste bin, und ich frier dein großes Maul direkt zu, du Opfer!",
        "tts_text": "Unterschätz mich noch einmal, weil ich die Jüngste bin, und ich frier dein großes Maul direkt zu, du Opfer!",
    },
    {
        "id": "CayleMinogue",
        "name": "💎 Cayle Minogue (100% Deutsch · Diamond Queen)",
        "folder": "18.1.Cayle_Minogue",
        "voice_desc": "de-DE-AmalaNeural (Natural Warm Mastering) · 100% Deutsch, lässig, eiskalt und arrogant",
        "voice": "de-DE-AmalaNeural",
        "rate": "+6%",
        "pitch": "+1Hz",
        "filter": make_filter(1.00, 1.00, 2.4, 2.6),
        "display_text": "Als Cayle Minogue glitzert mein Eis wie echte Diamanten! Mach Platz, du Verlierer, mein Diamant-Frost schneidet dich in tausend Stücke!",
        "tts_text": "Als Cayle Minogue glitzert mein Eis wie echte Diamanten! Mach Platz, du Verlierer... mein Diamant-Frost schneidet dich in tausend Stücke!",
    },
    {
        "id": "Annikina",
        "name": "🔥 Annikina (Mama · Kneipenterroristen)",
        "folder": "19.Annikina",
        "voice_desc": "de-DE-KatjaNeural (Natural Heavy Chest Tone) · Knallharte deutsche Mama-Löwin mit gusseiserner Bratpfanne",
        "voice": "de-DE-KatjaNeural",
        "rate": "+6%",
        "pitch": "-2Hz",
        "filter": make_filter(0.98, 1.02, 3.2, 2.6),
        "display_text": "Du wagst es, meine Kinder anzufassen, du Dreckssack?! Jetzt gibt es die heiße gusseiserne Bratpfanne quer durch die Fresse!",
        "tts_text": "Du wagst es, meine Kinder anzufassen, du Dreckssack?! Jetzt gibt es die heiße gusseiserne Bratpfanne quer durch die Fresse!",
    },
]


def run_rvc_conversion(input_mp3, output_wav, pitch_shift=0, index_rate=0.60):
    tmp_in_wav = input_mp3 + ".in.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_mp3, "-ar", "44100", tmp_in_wav],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    env = os.environ.copy()
    env["PYTHONPATH"] = RVC_SITE
    subprocess.run(
        [
            RVC_PYTHON,
            RVC_SCRIPT,
            tmp_in_wav,
            RVC_MODEL,
            output_wav,
            "--index",
            RVC_INDEX,
            "--index-rate",
            str(index_rate),
            "--pitch",
            str(pitch_shift),
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    if os.path.exists(tmp_in_wav):
        os.remove(tmp_in_wav)


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
        if os.path.exists(out_mp3) and cid not in ("Cayle", "CayleMinogue", "Annikina"):
            print(f"Already built sample_{cid}.mp3")
            continue
        tmp_raw = out_mp3 + ".raw.mp3"
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(
                    item["tts_text"],
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

        source_for_master = tmp_raw
        tmp_rvc_wav = out_mp3 + ".rvc.wav"
        if item.get("use_rvc") and os.path.exists(RVC_PYTHON) and os.path.exists(RVC_MODEL):
            run_rvc_conversion(
                tmp_raw,
                tmp_rvc_wav,
                pitch_shift=item.get("rvc_pitch", 0),
                index_rate=item.get("rvc_index_rate", 0.60),
            )
            source_for_master = tmp_rvc_wav

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                source_for_master,
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
        for f in (tmp_raw, tmp_rvc_wav):
            if os.path.exists(f):
                os.remove(f)
        mode_tag = "RVC-HUMAN-VOICE" if item.get("use_rvc") else f"NATIVE-{item['voice']}"
        print(f"Built sample_{cid}.mp3 [{mode_tag}]")


def build_html():
    all_cards = list(CAST) + [
        {
            "id": "Pablo",
            "name": "🇧🇷 Pablo (Rio · Unberührt wie gewünscht)",
            "folder": "3.Pablo",
            "voice_desc": "Originaler Pablo-Sound (bleibt 100% erhalten!)",
            "display_text": "Unter der Sonne von Rio tanzt der Sturm! Zeig mir deinen Rhythmus im Kampf, Amigo!",
        },
        {
            "id": "Marley",
            "name": "🇯🇲 Marley (Kingston · Unberührt wie gewünscht)",
            "folder": "7.Marley_Jamaica",
            "voice_desc": "Originaler Marley-Sound (bleibt 100% erhalten!)",
            "display_text": "An der Küste von Jamaika schlägt das Herz der Freiheit, Bredren. Zeig mir deine Kraft!",
        },
    ]

    cards_html = []
    for idx, c in enumerate(all_cards, 1):
        cid = c["id"]
        badge = "🎙️ ECHTES RVC-VOICE-CLONING" if c.get("use_rvc") else "🌍 ECHTER LANDES-DIALEKT & MUTTERSPRACHLER"
        cards_html.append(f"""
        <div class="card" id="card-{cid}">
            <div class="card-head">
                <img src="assets/CHARACTERS/{c['folder']}/_front.png" alt="{c['name']}">
                <div>
                    <div class="num">FIGHTER #{idx} · {badge}</div>
                    <h3>{c['name']}</h3>
                    <div class="vdesc">{c['voice_desc']}</div>
                </div>
            </div>
            <div class="quote">„{c['display_text']}“</div>
            <div class="controls">
                <button class="play-btn" onclick="playSample('{cid}')">▶ STIMME ANHÖREN</button>
                <audio id="aud-{cid}" src="assets/audio/voice_samples/sample_{cid}.mp3?v=261" preload="none"></audio>
            </div>
        </div>
        """)

    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STREET FIGHTER VOICE-CASTING v2.61 — ECHTE DIALEKTE & ECHTE RVC-STIMME</title>
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
        letter-spacing: 0.5px;
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
    <h1>🎙️ STREET FIGHTER VOICE-CASTING v2.61 — ECHTE DIALEKTE & ECHTE RVC-STIMME</h1>
    <div class="sub">Echte Muttersprachler (Spanisch, Mexikanisch, Polnisch, Russisch, Türkisch, Italienisch, Japanisch, Chinesisch, Indisch) mit Akzent im Deutschen + Dein eigenes RVC-Stimmmodell (vikingo040.pth)!</div>
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
