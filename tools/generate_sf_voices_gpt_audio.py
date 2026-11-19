#!/usr/bin/env python3
"""
Authentic Street & Native-Dialect Voice Generator for
KEANO ROMEO: LORD OF THE LIGHT (All 23 Fighters).

Key Upgrades per Jan's direct instructions:
1. Keep `marley` (Jamaica) and `pablo` (Brazil) untouched as Jan loves them.
2. Natural vocal filters (zero robotic `0.82` asetrate distortion, zero `alloy`/`fable` metallic voices).
3. 🔥Keano (`keano`, `hyper_keano`, `supreme_keano`) & 💫Jayden (`jayden`, `jay_x`):
   Cool teenage street fighters / Ghetto Boys ("Digga", "Bruder", "Safe", "Vallahi", "Komm ran") — NOT stiff/theatrical!
4. VIKINGO40 (`vikingo`, `vikingo_raw`):
   The Big Boss / Der Charakter-Pate / Familien-Oberhaupt (deep, commanding `onyx` voice, zero Italian accent,
   and full unbroken sentence in `vikingo_win.mp3`: "Ich bin stolz auf euch. Die Lichtlinie leuchtet heller als jemals zuvor.").
5. Country fighters with authentic native accents & requested slang:
   - `juan` (Spain): Ends intro with `pendejo`, uses `maricón` / `cabrón`.
   - `paco` (Mexico): Mexican accent + `Cabrón` / `Pendejo`.
   - `putin` (Russia): Deep `onyx` Russian bass + `Blyat`.
   - `gargamel` & `gargamel_hoodie`: Natural gritty Turkish-Berlin street boss (`echo`/`ash`) + `sikedim amk`.
   - `kowalski` (Poland): Heavy Polish accent + `Kurwa`.
   - `alcapone` (Italy): Italian Mafia Padrino + `Fratello`.
6. New unlockable sisters:
   - `emely` (`🌸 Emy 🌸` — 16yo sister, `coral` voice, `BLOSSOM SHOT!`, `PETAL STORM NOVA!`)
   - `cayle` (`Cayle` — 12yo sister, youthful `sage` voice, `ICEBALL BARRAGE!`, `GLACIER BLIZZARD!`)
"""
import base64
import concurrent.futures
import glob
import json
import os
import shutil
import subprocess
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "assets", "audio", "voice")
AUDIO_DIR = os.path.join(ROOT, "assets", "audio")


def load_openai_key():
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"].strip()
    env_file = os.path.join(ROOT, ".env")
    if os.path.isfile(env_file):
        for line in open(env_file, errors="ignore"):
            if line.strip().startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    raise RuntimeError("Bitte OPENAI_API_KEY als Umgebungsvariable oder in .env setzen")


API_KEY = load_openai_key()


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


def generate_gpt_audio(voice, sys_prompt, user_prompt, out_path, ffmpeg_filter=None, max_dur=6.8, is_short_sfx=False):
    tmp_raw = out_path + ".raw.mp3"
    for attempt in range(5):
        prompt_to_send = user_prompt
        if attempt > 0:
            prompt_to_send = (
                user_prompt
                + " WICHTIG: Sprich flüssig ohne Pause zwischen den Sätzen und gib AUSSCHLIESSLICH exakt den Text nach dem Doppelpunkt aus!"
            )
        payload = {
            "model": "gpt-audio-1.5",
            "modalities": ["text", "audio"],
            "audio": {"voice": voice, "format": "mp3"},
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt_to_send},
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
            with urllib.request.urlopen(req, timeout=45) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                b64 = res["choices"][0]["message"]["audio"]["data"]
                raw = base64.b64decode(b64)
                with open(tmp_raw, "wb") as f:
                    f.write(raw)
        except Exception as e:
            if attempt == 4:
                raise e
            continue

        # Remove leading silence AND compress any mid-sentence pause longer than 0.25s so 2-sentence lines never pause or cut off!
        af_chain = [
            "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.26:stop_threshold=-44dB"
        ]
        if ffmpeg_filter:
            af_chain.append(ffmpeg_filter)
        af_chain.append("alimiter=limit=0.95")
        if is_short_sfx:
            af_chain.append("afade=t=out:st=0.45:d=0.20")
        else:
            af_chain.append("apad=pad_dur=0.22")

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

        dur = probe_duration(out_path)
        min_d = 0.20 if is_short_sfx else 0.45
        if min_d <= dur <= max_dur:
            return out_path
    return out_path


# Natural studio mastering filters (NO extreme asetrate pitch distortion!)
STREET_BOY_KEANO_FILTER = (
    "asetrate=24000*1.02,aresample=24000,atempo=1.01,"
    "equalizer=f=135:t=q:w=1.0:g=2.8,"
    "equalizer=f=3400:t=q:w=1.2:g=2.2,"
    "acompressor=threshold=-16dB:ratio=2.8:makeup=3.0dB"
)

STREET_BOY_JAYDEN_FILTER = (
    "asetrate=24000*0.99,aresample=24000,atempo=1.02,"
    "equalizer=f=120:t=q:w=1.0:g=3.2,"
    "equalizer=f=3300:t=q:w=1.2:g=2.4,"
    "acompressor=threshold=-16dB:ratio=2.8:makeup=3.0dB"
)

BIG_BOSS_VIKINGO_FILTER = (
    "asetrate=24000*0.93,aresample=24000,atempo=1.05,"
    "equalizer=f=95:t=q:w=1.0:g=4.2,"
    "equalizer=f=2800:t=q:w=1.2:g=2.2,"
    "acompressor=threshold=-16dB:ratio=3.0:makeup=3.5dB"
)

NATURAL_DEEP_FILTER = (
    "asetrate=24000*0.94,aresample=24000,atempo=1.05,"
    "equalizer=f=100:t=q:w=1.0:g=3.8,"
    "equalizer=f=3100:t=q:w=1.2:g=2.2,"
    "acompressor=threshold=-16dB:ratio=2.8:makeup=3.2dB"
)

NATURAL_MID_FILTER = (
    "asetrate=24000*0.98,aresample=24000,atempo=1.03,"
    "equalizer=f=125:t=q:w=1.0:g=2.8,"
    "equalizer=f=3300:t=q:w=1.2:g=2.4,"
    "acompressor=threshold=-16dB:ratio=2.8:makeup=3.0dB"
)

EMELY_FILTER = (
    "asetrate=24000*1.03,aresample=24000,atempo=1.01,"
    "equalizer=f=180:t=q:w=1.0:g=2.0,"
    "equalizer=f=3800:t=q:w=1.2:g=2.5,"
    "acompressor=threshold=-16dB:ratio=2.6:makeup=3.0dB"
)

CAYLE_FILTER = (
    "asetrate=24000*1.08,aresample=24000,atempo=0.98,"
    "equalizer=f=210:t=q:w=1.0:g=1.8,"
    "equalizer=f=4000:t=q:w=1.2:g=2.6,"
    "acompressor=threshold=-16dB:ratio=2.6:makeup=3.0dB"
)

# Authentic Voice Personas
KEANO_SYS = (
    "Du bist KEANO (14 Jahre): Ein richtig cooler, lässiger, selbstbewusster Junge von der Straße (Ghetto-Boy / Berliner/Frankfurter Straßen-Vibe, "
    "NICHT theatralisch, NICHT geschwollen oder affig, sondern echt, direkt, cool, wie ein echter 14-jähriger Straßenkämpfer!). "
    "Sprich komplett natürlich, locker und mit echtem Street-Flow. Gib IMMER NUR exakt den geforderten Satz aus!"
)

JAYDEN_SYS = (
    "Du bist JAYDEN / JAY X (15 Jahre, Keanos älterer Bruder): Ein eiskalter, ultra-cooler Junge von der Straße (Ghetto-Boy / Street-Fighter Vibe, "
    "NICHT affig oder theatralisch, sondern lässig, rau, direkt, selbstbewusst mit echter Straßen-Attitüde!). "
    "Sprich komplett natürlich und authentisch. Gib IMMER NUR exakt den geforderten Satz aus!"
)

VIKINGO_SYS = (
    "Du bist VIKINGO40: Der Big Boss, das unantastbare Familien-Oberhaupt, der Charakter-Pate (KEIN italienischer Akzent, sondern tiefes, "
    "souveränes, väterlich-mächtiges Deutsch mit absoluter Boss-Autorität und natürlicher menschlicher Stimme!). "
    "WICHTIG: Sprich alle Sätze flüssig hintereinander ohne lange Pause dazwischen! Gib IMMER NUR exakt den geforderten Text aus!"
)

ALCAPONE_SYS = (
    "Du bist AL CAPONE: Ein echter italienischer Mafia-Padrino mit authentischem, natürlichem italienischen Akzent im Deutschen, "
    "der Wörter wie 'Fratello' und 'La Famiglia' mit eiskalter Ehre ausspricht. Gib IMMER NUR exakt den geforderten Text aus!"
)

GARGAMEL_SYS = (
    "Du bist GARGAMEL aus Berlin: Ein harter, straßenerfahrener deutsch-türkischer Untergrund-Boss aus Berlin-Kreuzberg "
    "mit echtem, natürlichem türkisch-deutschen Straßen-Akzent ('Lan', 'Bruder', 'sikedim amk' = 'sikecem amına koyayım' kurz und rau ausgesprochen). "
    "Klinge 100% menschlich und echt, niemals wie ein Roboter! Gib IMMER NUR exakt den geforderten Text aus!"
)

KOWALSKI_SYS = (
    "Du bist KOWALSKI aus Polen: Ein bärenstarker polnischer Kämpfer mit echtem, natürlichem polnischen Akzent im Deutschen, "
    "gerolltem R und einem kräftigen 'Kurwa!' und 'Bracie!'. Gib IMMER NUR exakt den geforderten Text aus!"
)

PACO_SYS = (
    "Du bist PACO aus Mexiko: Ein feuriger mexikanischer Straßen- und Lucha-Kämpfer mit echtem mexikanisch-spanischen Akzent im Deutschen "
    "und authentischem mexikanischen Slang ('Cabrón', 'Pendejo', 'Órale'). Gib IMMER NUR exakt den geforderten Text aus!"
)

JUAN_SYS = (
    "Du bist JUAN aus Spanien: Ein stolzer, arroganter spanischer Kämpfer mit echtem, natürlichem spanischen Akzent im Deutschen, "
    "der seine Gegner scharf mit 'Maricón', 'Cabrón' und am Ende mit 'Pendejo!' provoziert. Gib IMMER NUR exakt den geforderten Text aus!"
)

PUTIN_SYS = (
    "Du bist der russische Eis-Kommandant aus Moskau/Sibirien: Eine sehr tiefe, natürliche, eiskalte russische Männerstimme "
    "mit starkem, echtem russischen Akzent im Deutschen, hart gerolltem R und 'Blyat!'. Gib IMMER NUR exakt den geforderten Text aus!"
)

HATTORI_SYS = (
    "Du bist HATTORI aus Japan: Ein ruhiger, ehrwürdiger japanischer Samurai-Meister mit natürlichem japanischen Akzent im Deutschen. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

RAHEEL_SYS = (
    "Du bist RAHEEL aus Indien: Ein stolzer indischer Krieger mit natürlichem indischen Akzent im Deutschen. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

TZUBAZA_SYS = (
    "Du bist TZUBAZA aus China: Ein erfahrener chinesischer Kung-Fu-Meister mit natürlichem chinesischen Akzent im Deutschen. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

LEE_SYS = (
    "Du bist LEE aus Tokyo: Ein junger, blitzschneller japanischer Kampfkünstler mit feinem japanischen Akzent im Deutschen. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

EMELY_SYS = (
    "Du bist EMELY (🌸 Emy 🌸, 16 Jahre alt): Die coole, selbstbewusste 16-jährige Schwester von Keano und Jayden! "
    "Du hast eine natürliche, jugendliche, weibliche 16-jährige Stimme mit echtem Selbstbewusstsein, Power und Charisma. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

CAYLE_SYS = (
    "Du bist CAYLE (12 Jahre alt): Die freche, blitzschnelle 12-jährige kleine Schwester von Jayden! "
    "Du hast eine helle, natürliche, energiegeladene 12-jährige Mädchenstimme und wirfst eiskalte Eisbälle. "
    "Gib IMMER NUR exakt den geforderten Text aus!"
)

DOM_SYS = (
    "Du bist DOM (17 Jahre): Ein cooler, sportlicher, selbstbewusster deutscher Boxer und Kickboxer mit lässigem, "
    "klarem Straßen-Flow (wie Keano und Jayden, komplett natürlich, menschlich, fokussiert und charismatisch, NICHT theatralisch oder steif). "
    "Sprich flüssig ohne Pause zwischen den Sätzen und gib IMMER NUR exakt den geforderten Text aus!"
)

FIGHTERS = {
    "dom": {
        "voice": "ash",
        "copy_root": False,
        "aliases": [],
        "sys": DOM_SYS,
        "filter": STREET_BOY_KEANO_FILTER,
        "clips": {
            "intro": "Sprich als cooler, selbstbewusster 17-jähriger deutscher Boxer flüssig ohne Pause: In dieser Cyber-Matrix ist alles nur ein Code — außer unserem Licht! Zieh deine Handschuhe an, Bruder, jetzt wird geboxt!",
            "win": "Sprich als cooler, selbstbewusster 17-jähriger deutscher Boxer flüssig ohne Pause: System gecrasht, Bruder! Keine Matrix der Welt kann echtes Licht berechnen!",
            "special": "Rufe explosiv als 17-jähriger Boxer: MATRIX BREAKER!",
            "super": "Rufe mit voller Knockout-Power: CYBER KNOCKOUT OVERDRIVE!",
            "select": "Sprich lässig und fokussiert: Dom ist im Ring — bereit, die Matrix zu sprengen!",
            "taunt": "Sprich lässig und herausfordernd: Deckung hoch, Bruder — meine Kombo sieht man erst, wenn sie einschlägt!",
            "hit": "Kurzer harter Boxer-Treffer-Laut (0.4 Sekunden): Ugh!",
            "ko": "Dramatisches K.O.-Stöhnen eines Boxers (1.1 Sekunden): Aaagh...!",
        },
    },
    "keano": {
        "voice": "ash",
        "copy_root": True,
        "aliases": [],
        "sys": KEANO_SYS,
        "filter": STREET_BOY_KEANO_FILTER,
        "clips": {
            "special": "Rufe als cooler 14-jähriger Straßenkämpfer explosiv: LIGHT SHOT!",
            "super": "Rufe mit voller Power: SOLAR NEXUS!",
            "select": "Sprich lässig, cool und direkt wie ein echter 14-jähriger Junge von der Straße: Digga, das Licht gehört uns allen. Komm ran, wir regeln das!",
            "intro": "Sprich als cooler 14-jähriger Ghetto-Boy direkt und selbstbewusst: Digga, wer das Licht einsperrt, hat schon verloren. Komm ran, Bruder — wir klären das hier und jetzt!",
            "taunt": "Sprich lässig und herausfordernd: War das schon alles, Bruder? Komm schon!",
            "win": "Sprich lässig und stolz wie ein echter Straßenjunge: Ich schwör, nächstes Siegel gebrochen, Bruder. Das Licht gehört wieder allen!",
        },
    },
    "hyper_keano": {
        "voice": "ash",
        "copy_root": True,
        "aliases": [],
        "sys": KEANO_SYS,
        "filter": STREET_BOY_KEANO_FILTER,
        "clips": {
            "special": "Rufe explosiv und kraftvoll: PHOTON SURGE!",
            "super": "Rufe mit maximaler Energie: ASTRAL ECLIPSE!",
            "select": "Sprich als cooler, voll aufgeladener Straßenjunge: Keine Zurückhaltung mehr, Digga. Jetzt wird abgerechnet!",
            "intro": "Sprich direkt, hungrig und cool: Keine Halbgas-Runden mehr, Digga! Mein Licht brennt heute jede Barriere weg, komm ran!",
            "taunt": "Sprich souverän und taff: Halt lieber Abstand, Bruder — die Energie ist auf Anschlag!",
            "win": "Sprich lässig und siegreich: Safe, Bruder! Wenn das Licht erwacht, hält uns gar nichts mehr auf!",
        },
    },
    "supreme_keano": {
        "voice": "ash",
        "copy_root": True,
        "aliases": [],
        "sys": KEANO_SYS,
        "filter": STREET_BOY_KEANO_FILTER,
        "clips": {
            "special": "Rufe machtvoll und explosiv: CELESTIAL FLASH!",
            "super": "Rufe mit ultimativer Power: GENESIS OF LIGHT!",
            "select": "Sprich cool, souverän und unantastbar: Supreme Level, Bruder. Alle Welten stehen hinter uns.",
            "intro": "Sprich souverän, cool und fokussiert: Höchste Stufe erreicht, Bruder. Licht und Schatten sind eins — niemand auf dieser Welt kann uns aufhalten!",
            "taunt": "Sprich eiskalt und lässig: Gegen dieses Level gibt es keine Deckung, Digga!",
            "win": "Sprich stolz und souverän: Alle Welten sind vereint, Bruder. Der Kreis des Lichts ist perfekt!",
        },
    },
    "jayden": {
        "voice": "echo",
        "copy_root": False,
        "aliases": [],
        "sys": JAYDEN_SYS,
        "filter": STREET_BOY_JAYDEN_FILTER,
        "clips": {
            "special": "Rufe als cooler 15-jähriger Straßenkämpfer explosiv: SHADOW FLAME!",
            "super": "Rufe dunkel und explosiv: ECLIPSE NOVA!",
            "select": "Sprich als 15-jähriger cooler Straßenkämpfer lässig und eiskalt: Jayden ist am Start. Mein Schattenfeuer regelt das im Alleingang.",
            "intro": "Sprich als eiskalter, selbstbewusster 15-jähriger Kämpfer direkt: Du stehst vor dem falschen Gegner. Mein Schattenfeuer brennt alles nieder, was sich mir in den Weg stellt!",
            "taunt": "Sprich lässig und provokant: Mehr hast du nicht drauf? Spiel nicht mit meinem Feuer!",
            "win": "Sprich eiskalt und souverän: Eiskalt beendet. Gegen meine Schattenflamme bleibt nur Asche übrig!",
        },
    },
    "jay_x": {
        "voice": "echo",
        "copy_root": False,
        "aliases": [],
        "sys": JAYDEN_SYS,
        "filter": STREET_BOY_JAYDEN_FILTER,
        "clips": {
            "special": "Rufe blitzschnell und eiskalt: PHANTOM PULSE!",
            "super": "Rufe dunkel und mächtig: VOID HORIZON!",
            "select": "Sprich als ultra-cooler Street-Fighter: Jay X — neuer Drip, dunkle Energie. Niemand kommt an mein Level ran.",
            "intro": "Sprich als lässiger, gefährlicher 15-jähriger Street-Fighter: Neuer Style, doppelte Power. Bevor du blinzelst, hat dich mein Phantom-Puls schon getroffen!",
            "taunt": "Sprich eiskalt und lässig: Viel zu langsam für meinen Style. Versuch’s nochmal!",
            "win": "Sprich souverän und echt: Ich schwör, anderes Level! Jay X übernimmt ab hier das Kommando!",
        },
    },
    "vikingo_raw": {
        "voice": "onyx",
        "copy_root": False,
        "aliases": [],
        "sys": VIKINGO_SYS,
        "filter": BIG_BOSS_VIKINGO_FILTER,
        "clips": {
            "special": "Brülle als mächtiger Big Boss mit tiefer Bruststimme: ABYSS BREAKER!",
            "super": "Brülle mit monumentaler Boss-Urgewalt: RAGNAROK ECLIPSE!",
            "select": "Sprich tief, souverän und einschüchternd als der Big Boss: Die Tore von Walhalla beben. Wer wagt es, vor den Boss zu treten?",
            "intro": "Sprich tief, mächtig und ohne Pause als der gefangene Big Boss von Walhalla: Ich bin der Boss von Walhalla! Der dunkle Fluch hält meine Ketten — zeigt mir eure ganze Macht und befreit mich!",
            "taunt": "Rufe tief und dominant wie ein echter Pate: Ist das alles, was ihr draufhabt?! Mehr Druck!",
            "win": "Sprich tief, schwer und gebieterisch ohne Pause: Solange das Siegel von Walhalla steht, regiert hier die eiserne Macht des Paten!",
        },
    },
    "vikingo": {
        "voice": "onyx",
        "copy_root": False,
        "aliases": [],
        "sys": VIKINGO_SYS,
        "filter": BIG_BOSS_VIKINGO_FILTER,
        "clips": {
            "special": "Brülle donnernd als das Familien-Oberhaupt: VALHALLA THUNDER!",
            "super": "Brülle mit voller Boss-Autorität: BIFROST GENESIS!",
            "select": "Sprich tief, ruhig und mit absoluter Charakter-Paten-Autorität: Ich bin Vikingo — das Oberhaupt der Familie und Hüter der Lichtlinie.",
            "intro": "Sprich tief, stolz und flüssig als der Big Boss und Vater: Hier spricht das Oberhaupt der Familie. Unser Blut trägt das Feuer und das Licht — zeigt mir eure wahre Ehre!",
            "taunt": "Rufe tief und kraftvoll: Steh auf, Kämpfer! In unserer Familie gibt niemand auf!",
            "win": "Sprich beide Sätze direkt und flüssig hintereinander OHNE Pause dazwischen mit tiefer, stolzer Vater- und Boss-Stimme: Ich bin stolz auf euch. Die Lichtlinie leuchtet heller als jemals zuvor.",
        },
    },
    "alcapone": {
        "voice": "onyx",
        "copy_root": True,
        "aliases": ["capone"],
        "sys": ALCAPONE_SYS,
        "filter": NATURAL_DEEP_FILTER,
        "clips": {
            "special": "Rufe als italienischer Mafia-Padrino hart: SHADOW SALVO!",
            "super": "Rufe mit Mafia-Boss-Wucht: EMPIRE RECKONING!",
            "select": "Sprich mit echtem italienischen Padrino-Akzent: Capito, Fratello? Don Capone übernimmt jetzt das Geschäft.",
            "intro": "Sprich mit starkem italienischen Mafia-Akzent zügig auf Deutsch: Hör gut zu, Fratello: In Rom regiert La Famiglia! Wer das Licht will, muss erst an mir vorbei!",
            "taunt": "Sprich eiskalt mit italienischem Akzent: Nichts Persönliches, Fratello — nur Geschäft!",
            "win": "Sprich tief mit italienischem Padrino-Akzent: Rispetto, Fratello... selbst Rom erkennt deine Stärke an.",
        },
    },
    "gargamel": {
        "voice": "echo",
        "copy_root": True,
        "aliases": [],
        "sys": GARGAMEL_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe rau und explosiv: AETHER FLASK!",
            "super": "Rufe mit voller Straßen-Wucht: PHILOSOPHER'S NOVA!",
            "select": "Sprich mit echtem türkisch-Berliner Straßen-Akzent: Gargamel ist am Start, Lan! Meine Alchemie übernimmt die Straße.",
            "intro": "Sprich mit hartem türkisch-Berliner Straßen-Akzent direkt und aggressiv: Was willst du in meinem Revier, Lan? Meine Alchemie regiert diese Straße — sikedim amk!",
            "taunt": "Rufe rau mit türkisch-deutschem Straßen-Akzent: Mach keine Faxen vor mir, Lan — sikedim amk!",
            "win": "Sprich rau mit türkisch-deutschem Akzent: Unmöglich, Lan... kein Gefäß hält dieses Licht auf, sikedim amk!",
        },
    },
    "gargamel_hoodie": {
        "voice": "ash",
        "copy_root": True,
        "aliases": [],
        "sys": GARGAMEL_SYS,
        "filter": NATURAL_DEEP_FILTER,
        "clips": {
            "special": "Rufe dunkel und hart: TOXIC PRISM!",
            "super": "Rufe explosiv: DARK ALCHEMY OVERDRIVE!",
            "select": "Sprich dunkel mit Berliner Untergrund-Slang: Dunkles Prisma aus Berlin-Kreuzberg, Bruder — mach Platz!",
            "intro": "Sprich rau und direkt mit türkisch-Berliner Straßen-Akzent: Willkommen im Berliner Untergrund, Bruder! Hier überlebt nur der Härteste — sikedim amk!",
            "taunt": "Sprich kalt mit Berliner Straßen-Akzent: Im Schatten von Berlin siehst du keinen Stich, Lan!",
            "win": "Sprich respektvoll im Berliner Straßen-Ton: Krasses Ding, Bruder... dein Licht sprengt jede Grenze.",
        },
    },
    "kowalski": {
        "voice": "onyx",
        "copy_root": False,
        "aliases": [],
        "sys": KOWALSKI_SYS,
        "filter": NATURAL_DEEP_FILTER,
        "clips": {
            "special": "Brülle mit polnischem Akzent: IRON TREMOR!",
            "super": "Brülle mit bärenstarker Wucht: TITAN BREAKER!",
            "select": "Sprich tief mit starkem polnischen Akzent: Siema! Kowalski aus Warschau — polnischer Stahl, Kurwa!",
            "intro": "Sprich kräftig mit starkem polnischen Akzent und gerolltem R: Kurwa! Polnischer Stahl bricht niemals, Bracie! Komm her und zeig mir, was deine Fäuste aushalten!",
            "taunt": "Rufe mit schwerem polnischen Akzent: Co jest, Kurwa?! Schlägst du wie ein Tourist, Bracie?",
            "win": "Sprich tief und anerkennend mit polnischem Akzent: Dobrze, Kurwa! Du hast ein Herz aus echtem Stahl, Bracie!",
        },
    },
    "paco": {
        "voice": "verse",
        "copy_root": False,
        "aliases": [],
        "sys": PACO_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe feurig mit mexikanischem Akzent: AZTEC FLARE!",
            "super": "Rufe explosiv: FIFTH SUN ECLIPSE!",
            "select": "Sprich feurig mit mexikanisch-spanischem Akzent: ¡Órale, Cabrón! Paco el Taco springt in den Ring!",
            "intro": "Sprich temperamentvoll mit echtem mexikanischen Akzent: ¡Qué pasa, Cabrón! Auf dieser Pyramide brennt das Feuer von Mexiko — zeig deinen Mut, Pendejo!",
            "taunt": "Rufe spöttisch mit mexikanischem Akzent: ¡No manches, Pendejo! War das etwa schon alles, Cabrón?",
            "win": "Sprich stolz mit mexikanischem Akzent: ¡Órale, Cabrón! Die fünfte Sonne erhebt sich wieder über Mexiko!",
        },
    },
    "juan": {
        "voice": "ballad",
        "copy_root": False,
        "aliases": [],
        "sys": JUAN_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe stolz mit spanischem Akzent: CRIMSON FLASH!",
            "super": "Rufe mit spanischer Arena-Wucht: ROYAL CORRIDA!",
            "select": "Sprich stolz mit echtem spanischen Akzent: ¡Vamos, Cabrón! Juan aus Madrid betritt die Arena!",
            "intro": "Sprich stolz und scharf mit starkem spanischen Akzent und beende den Satz klar mit Pendejo: In meiner spanischen Arena gibt es keine Gnade für Anfänger, Maricón — stell dich meiner Klinge, Pendejo!",
            "taunt": "Rufe arrogant mit spanischem Akzent: ¡Olé, Maricón! Viel zu langsam für meine Klinge, Pendejo!",
            "win": "Sprich stolz mit spanischem Akzent: ¡Madre mía, Cabrón! Du kämpfst wie ein echter Champion in der Arena!",
        },
    },
    "putin": {
        "voice": "onyx",
        "copy_root": False,
        "aliases": [],
        "sys": PUTIN_SYS,
        "filter": BIG_BOSS_VIKINGO_FILTER,
        "clips": {
            "special": "Brülle tief mit russischem Akzent: FROST VORTEX!",
            "super": "Brülle eiskalt und donnernd: ABSOLUTE ZERO!",
            "select": "Sprich sehr tief mit starkem russischen Akzent: Aus dem sibirischen Eis — niemand kommt hier vorbei, Blyat!",
            "intro": "Sprich sehr tief, eiskalt und mit starkem russischen Akzent: Im ewigen Eis von Sibirien gefriert dein Blut zu Stein, Blyat! Niemand kommt hier lebend vorbei!",
            "taunt": "Rufe tief grollend mit russischem Akzent: Davai, Blyat! Ist dir etwa schon kalt geworden, Tovarisch?",
            "win": "Sprich tief mit schwerem russischen Akzent: Nyet, Blyat... das Eis bricht! Die Tore von Walhalla stehen offen!",
        },
    },
    "hattori": {
        "voice": "sage",
        "copy_root": True,
        "aliases": [],
        "sys": HATTORI_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe als japanischer Samurai scharf: BLADE OF DAWN!",
            "super": "Rufe machtvoll: AMATERASU SLASH!",
            "select": "Sprich mit ruhigem japanischen Samurai-Akzent: Meine Klinge hütet das erste Siegel des Lichts.",
            "intro": "Sprich mit authentischem japanischen Samurai-Akzent auf Deutsch: Dieser Tempel hütet das erste Siegel von Tokyo. Beweise deinen Mut vor meiner Klinge, Krieger!",
            "taunt": "Sprich ruhig mit japanischem Akzent: Ein zögernder Geist kann kein Siegel brechen.",
            "win": "Sprich ehrenvoll mit japanischem Akzent: Dein Geist ist rein, Krieger. Das Siegel des Tempels öffnet sich.",
        },
    },
    "raheel": {
        "voice": "verse",
        "copy_root": True,
        "aliases": [],
        "sys": RAHEEL_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe kraftvoll mit indischem Akzent: AGNI FLARE!",
            "super": "Rufe majestätisch: SOLAR MANDALA!",
            "select": "Sprich mit warmem indischen Akzent: Namaste. Das heilige Feuer prüft jede Seele.",
            "intro": "Sprich mit authentischem indischen Akzent flüssig auf Deutsch: Am heiligen Ganges prüft das Feuer jede Seele. Zeig mir, ob du stark genug bist, das Licht zu befreien!",
            "taunt": "Sprich mit indischem Akzent: Deine Flamme muss noch heller brennen, mein Freund!",
            "win": "Sprich weise mit indischem Akzent: Die Täuschung fällt ab. Möge das befreite Licht über alle Grenzen strömen.",
        },
    },
    "tzubaza": {
        "voice": "echo",
        "copy_root": True,
        "aliases": [],
        "sys": TZUBAZA_SYS,
        "filter": NATURAL_DEEP_FILTER,
        "clips": {
            "special": "Rufe als Kung-Fu-Meister kräftig: DRAGON PULSE!",
            "super": "Rufe mit Drachen-Wucht: CELESTIAL DRAGON!",
            "select": "Sprich als chinesischer Kung-Fu-Meister mit feinem chinesischen Akzent: Der alte Drache wacht über das versiegelte Himmelslicht.",
            "intro": "Sprich mit natürlichem chinesischen Akzent würdevoll auf Deutsch: Hinter diesen alten Mauern ruht das Drachensiegel. Beweise deine wahre Stärke im Kung-Fu!",
            "taunt": "Sprich ruhig als Kung-Fu-Meister: Deine Kraft ist groß, doch dein Geist sucht noch das Gleichgewicht.",
            "win": "Sprich weise mit chinesischem Akzent: Der Drache verneigt sich. Wahres Licht muss geteilt werden.",
        },
    },
    "lee": {
        "voice": "ash",
        "copy_root": False,
        "aliases": [],
        "sys": LEE_SYS,
        "filter": NATURAL_MID_FILTER,
        "clips": {
            "special": "Rufe blitzschnell: LIGHTNING FIST!",
            "super": "Rufe explosiv: THUNDER DRAGON FURY!",
            "select": "Sprich schnell und scharf als junger Shinobi aus Tokyo: Schneller als der Schatten — präzise wie der Blitz.",
            "intro": "Sprich als junger japanischer Kämpfer schnell und direkt: In den Neon-Schatten von Tokyo regiert der Blitz. Mal sehen, ob du mit meinem Tempo mithältst!",
            "taunt": "Sprich schnell: Wenn du zweifelst, holt dich der Schatten ein!",
            "win": "Sprich respektvoll: Deine Geschwindigkeit und dein Geist sind eins. Der Weg zum Schatten-Dojo ist frei.",
        },
    },
    "emely": {
        "voice": "coral",
        "copy_root": False,
        "aliases": [],
        "sys": (
            "Du bist EMELY (🌸 Emy 🌸, 16 Jahre alt): Ein echtes, super-cooles, selbstbewusstes 16-jähriges It-Girl "
            "und die Schwester von Keano und Jayden! Du klingst stylisch, schlagfertig, jung, charmant-frech und absolut selbstsicher. "
            "Gib IMMER NUR exakt den geforderten Text aus!"
        ),
        "filter": EMELY_FILTER,
        "clips": {
            "special": "Rufe als cooles 16-jähriges It-Girl kraftvoll auf Englisch: BLOSSOM SHOT!",
            "super": "Rufe mit voller Blütensturm-Power auf Englisch: PETAL STORM NOVA!",
            "select": "Sprich als cooles, selbstbewusstes 16-jähriges It-Girl: Mach Platz, ich bin ein echtes It-Girl — schön, stylisch und unschlagbar!",
            "intro": "Sprich als cooles, selbstbewusstes 16-jähriges It-Girl mit echtem Attitude-Vibe: Ich bin ein It-Girl, Schatz — mein Style ist perfekt und mein Blütensturm fegt dich weg!",
            "taunt": "Sprich frech, lässig und selbstbewusst wie ein It-Girl: Bist du etwa neidisch auf meinen Vibe? Ein It-Girl verliert nie!",
            "win": "Sprich stolz, lässig und charmant wie ein echtes It-Girl: Ein echtes It-Girl gewinnt immer mit Style — nicht mal meine Frisur ist verrutscht!",
            "hit": "Kurzer kämpferischer Treffer-Ausruf einer 16-jährigen Kämpferin (0.4 Sekunden): Ah!",
            "ko": "Kurzes kämpferisches K.O.-Stöhnen einer 16-jährigen Kämpferin (0.6 Sekunden, kein langer Schrei): Ughh...!",
        },
    },
    "cayle": {
        "voice": "sage",
        "copy_root": False,
        "aliases": [],
        "sys": CAYLE_SYS,
        "filter": CAYLE_FILTER,
        "clips": {
            "special": "Rufe als freche, energiegeladene 12-jährige Kämpferin auf Englisch: ICEBALL BARRAGE!",
            "super": "Rufe mit voller Eissturm-Power auf Englisch: GLACIER BLIZZARD!",
            "select": "Sprich als coole, freche 12-jährige kleine Schwester: Cayle ist am Start! Meine Eisbälle liegen schon bereit!",
            "intro": "Sprich als mutige, freche 12-jährige Kämpferin: Ich bin vielleicht die Jüngste, aber meine Eisbälle frieren dich sofort ein! Mach dich bereit!",
            "taunt": "Rufe frech und fröhlich: Zu langsam! Willst du noch einen Eisball abbekommen?",
            "win": "Sprich stolz und begeistert: Eiskalt abgeliefert! Gegen meine Eisbälle hat keiner eine Chance!",
            "hit": "Kurzer Treffer-Ausruf eines 12-jährigen Mädchens (0.4 Sekunden): Hey!",
            "ko": "Kurzes K.O.-Stöhnen (0.6 Sekunden, kein langer Schrei): Oh nein...!",
        },
    },
}

MAX_DUR_BY_TYPE = {
    "special": 3.5,
    "super": 3.8,
    "intro": 7.5,
    "select": 7.2,
    "taunt": 6.5,
    "win": 8.2,
    "hit": 0.65,
    "ko": 0.95,
}

TASKS = []
for prefix, cfg in FIGHTERS.items():
    for clip_type, prompt in cfg["clips"].items():
        out_v = os.path.join(VOICE_DIR, f"{prefix}_{clip_type}.mp3")
        copies = []
        if cfg.get("copy_root"):
            copies.append(os.path.join(AUDIO_DIR, f"{prefix}_{clip_type}.mp3"))
        for alias in cfg.get("aliases", []):
            copies.append(os.path.join(VOICE_DIR, f"{alias}_{clip_type}.mp3"))
            if cfg.get("copy_root"):
                copies.append(os.path.join(AUDIO_DIR, f"{alias}_{clip_type}.mp3"))
        max_d = MAX_DUR_BY_TYPE[clip_type]
        is_short = clip_type in ("hit", "ko")
        TASKS.append((cfg["voice"], cfg["sys"], prompt, out_v, cfg["filter"], copies, max_d, is_short))


def run_task(task):
    voice, sys_p, user_p, out_v, filt, copies, max_d, is_short = task
    generate_gpt_audio(voice, sys_p, user_p, out_v, filt, max_dur=max_d, is_short_sfx=is_short)
    for dst in copies:
        shutil.copy2(out_v, dst)
    return f"{os.path.basename(out_v)} ({probe_duration(out_v):.2f}s)"


if __name__ == "__main__":
    print(f"Generating {len(TASKS)} authentic fighter voice clips via gpt-audio-1.5 (max_workers=12)...")
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        futures = [ex.submit(run_task, t) for t in TASKS]
        for fut in concurrent.futures.as_completed(futures):
            name = fut.result()
            completed += 1
            if completed % 12 == 0 or completed == len(TASKS):
                print(f"  [{completed}/{len(TASKS)}] Generated ({name})")
    print("✅ All fighter voice clips generated & duration-verified successfully!")
