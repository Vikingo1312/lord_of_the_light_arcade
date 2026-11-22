#!/usr/bin/env python3
"""
Builds the v2.62 Street Fighter Voice Casting Soundboard (voice_preview.html) and applies all
approved voices directly into the live game (assets/audio/voice/ & assets/audio/):
1. International Fighters (approved by Jan: "Also alle Stimmen von Ausländern sind super, kann man so lassen"):
   True Native Country Speakers (`es-ES`, `es-MX`, `pl-PL`, `uk-UA`, `tr-TR`, `it-IT`, `ja-JP`, `zh-CN`, `en-IN`)
   speaking German with authentic foreign dialects + 100% native mother-tongue swear words!
2. Family & Siblings (Vikingo, Dark Vikingo, Keano, Hyper Keano, Supreme Keano, JJ Dark, Jay X, Dom,
   Emy, Hyper-Emy, Cayle, Cayle Minogue [100% German!], Annikina, Simba):
   Restored to their 100% genuine, crystal-clear OpenAI `gpt-audio-1.5` Studio voice recordings
   (zero RVC vocoder distortion, zero robotic artifacts!).
"""
import asyncio
import os
import shutil
import subprocess
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE_DIR = os.path.join(ROOT, "assets", "audio", "voice_samples")
VOICE_DIR = os.path.join(ROOT, "assets", "audio", "voice")
AUDIO_DIR = os.path.join(ROOT, "assets", "audio")
os.makedirs(SAMPLE_DIR, exist_ok=True)


def make_filter(asetrate_mul=1.0, atempo_mul=1.0, bass_db=2.8, pres_db=2.4):
    return (
        "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-42dB:stop_periods=-1:stop_duration=0.24:stop_threshold=-44dB,"
        f"asetrate=24000*{asetrate_mul:.3f},aresample=44100,atempo={atempo_mul:.3f},"
        f"equalizer=f=125:t=q:w=1.0:g={bass_db:.1f},"
        f"equalizer=f=3400:t=q:w=1.2:g={pres_db:.1f},"
        "acompressor=threshold=-17dB:ratio=3.0:makeup=3.4dB,"
        "alimiter=limit=0.95,apad=pad_dur=0.15"
    )


# 11 Approved International Native-Dialect Fighters (Pablo & Marley remain untouched!)
FOREIGN_FIGHTERS = [
    {
        "id": "Juan",
        "prefix": "juan",
        "name": "🇪🇸 Juan (Spanien · Echter Spanier mit Dialekt)",
        "folder": "10.Juan",
        "voice_desc": "es-ES-AlvaroNeural (Echter Spanier aus Madrid) · Spricht Deutsch mit spanischem Akzent + Gilipollas / Maricón / Pendejo!",
        "voice": "es-ES-AlvaroNeural",
        "rate": "+4%",
        "pitch": "-2Hz",
        "filter": make_filter(1.00, 1.00, 3.2, 2.8),
        "display_text": "¡Vamos, Gilipollas! In meiner spanischen Arena gibt es keine Gnade für Heulsusen, Maricón! Knie nieder vor meiner Klinge, Pendejo!",
        "clips": {
            "intro": "¡Vamos, Gilipollas! In mayner schpanischen Arena gibt es kayne Gnade für Hoylsusen, Maricón! Knie nieder for mayner Klinge, Pendejo!",
            "win": "¡Madre mía, Cabrón! In mayner Arena besiegt niemand den Matador, Pendejo!",
            "select": "¡Vamos, Cabrón! Juan aus Madrid betritt die Arena!",
            "taunt": "¡Olé, Maricón! Fiel tsu langsam für mayne Klinge, Pendejo!",
            "special": "¡CRIMSON FLASH!",
            "super": "¡ROYAL CORRIDA!",
        },
    },
    {
        "id": "Paco",
        "prefix": "paco",
        "name": "🇲🇽 Paco el Taco (Mexiko · Echter Mexikaner mit Dialekt)",
        "folder": "9.Paco_el_Taco",
        "voice_desc": "es-MX-JorgeNeural (Echter Mexikaner) · Spricht Deutsch mit mexikanischem Barrio-Akzent + Hijo de puta / Pendejo / Cabrón!",
        "voice": "es-MX-JorgeNeural",
        "rate": "+6%",
        "pitch": "-3Hz",
        "filter": make_filter(0.98, 1.02, 3.6, 2.8),
        "display_text": "¡Qué pasa, Hijo de puta! Auf meiner Pyramide wird nicht geweint, ich schlag dich grün und blau, du verdammter Pendejo, Cabrón!",
        "clips": {
            "intro": "¡Qué pasa, Hijo de puta! Auf mayner Piramide vird niht gevaynt, ih schlag dih grün und blau, du ferdammter Pendejo, Cabrón!",
            "win": "¡Órale, Cabrón! Die fünfte Sonne brennt über Mexiko, Pendejo!",
            "select": "¡Órale, Cabrón! Paco el Taco schpringt in den Ring!",
            "taunt": "¡No manches, Pendejo! Var das etva schon alles, Cabrón?!",
            "special": "¡AZTEC FLARE!",
            "super": "¡FIFTH SUN ECLIPSE!",
        },
    },
    {
        "id": "Kowalski",
        "prefix": "kowalski",
        "name": "🇵🇱 Kowalski (Polen · Echter Pole mit Dialekt)",
        "folder": "8.Kowalski_Poland",
        "voice_desc": "pl-PL-MarekNeural (Echter Pole aus Warschau) · Spricht Deutsch mit hartem polnischem Akzent + Kurwa mać / Bracie / Ja pierdolę!",
        "voice": "pl-PL-MarekNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.94, 1.04, 4.4, 2.6),
        "display_text": "Kurwa mać! Polnischer Stahl bricht niemals, Bracie! Komm her, ich reiß dir den Kopf ab, ja pierdolę!",
        "clips": {
            "intro": "Kurwa mać! Polnischer Schtahl briht niemals, Bracie! Komm her, ih rays dir den Kopf ab, ja pierdolę!",
            "win": "Dobrze, Kurwa mać! Polnischer Schtahl regiert im Ring, Bracie!",
            "select": "Siema! Kowalski aus Warszawa — polnischer Schtahl, Kurwa mać!",
            "taunt": "Co jest, Kurwa?! Schlägst du vie ayn Tourist, Bracie, ja pierdolę?!",
            "special": "IRON TREMOR!",
            "super": "TITAN BREAKER!",
        },
    },
    {
        "id": "Putin",
        "prefix": "putin",
        "name": "🇷🇺 Putin (Sibirien · Echter Slawisch-Russischer Dialekt)",
        "folder": "13.Putin",
        "voice_desc": "uk-UA-OstapNeural (Echter Ost-Slawischer Muttersprachler) · Spricht Deutsch mit hartem russischem Akzent + Сука Блять / иди нахуй!",
        "voice": "uk-UA-OstapNeural",
        "rate": "+2%",
        "pitch": "-6Hz",
        "filter": make_filter(0.92, 1.05, 4.6, 2.5),
        "display_text": "Im ewigen Eis von Sibirien gefriert dein Blut zu Stein, Сука Блять! Ich breche dich entzwei, иди нахуй!",
        "clips": {
            "intro": "Им эвиген Айс фон Сибириен гефрирт дайн Блут цу Штайн, Сука Блять! Их брехе дих энтцвай, иди нахуй!",
            "win": "Ньет, Сука Блять! Ин Сибириен гевиннт нур дер Ейскомандир, иди нахуй!",
            "select": "Аус дем сибиришен Айс — ниманд коммт хир форбай, Сука Блять!",
            "taunt": "Давай, Сука Блять! Ист дир этва шон кальт геворден, иди нахуй?!",
            "special": "ФРОСТ ВОРТЕКС!",
            "super": "АБСОЛЮТ ЗЕРО!",
        },
    },
    {
        "id": "Gargamel",
        "prefix": "gargamel",
        "copy_root": True,
        "name": "🇩🇪🇹🇷 C. Gargamel (Kreuzberg · Echter Türkischer Dialekt)",
        "folder": "6.C_Gargamel",
        "voice_desc": "tr-TR-AhmetNeural (Echter Türke) · Spricht Deutsch mit echtem türkischem Straßen-Akzent + Lan / sikecem amına koyayım!",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+6%",
        "pitch": "-3Hz",
        "filter": make_filter(0.97, 1.03, 3.6, 2.8),
        "display_text": "Was suchst du Hund in meiner Straße, Lan?! Ich schwör, meine Alchemie fickt dein ganzes Leben, sikecem amına koyayım!",
        "clips": {
            "intro": "Vas zuhst du Hund in mayner Schtrase, Lan?! İh schvör, mayne Alhemi fikt dayn gantses Leben, sikecem amına koyayım!",
            "win": "İh habs dir gezagt, Lan! Niemand fikt mit Gargamel in Berlin, sikecem amına koyayım!",
            "select": "Gargamel ist am Schtart, Lan! Mayne Alhemi übernimmt die Schtrase, amına koyayım!",
            "taunt": "Mah kayne Faksen for mir, Lan — sikecem amına koyayım!",
            "special": "AETHER FLASK!",
            "super": "PHILOSOPHER NOVA!",
        },
    },
    {
        "id": "GargamelHoodie",
        "prefix": "gargamel_hoodie",
        "copy_root": True,
        "name": "🇩🇪🇹🇷 Gargamel Hoodie (Untergrund · Echter Türkischer Dialekt)",
        "folder": "6.1.C_Gargamel_Hoodie",
        "voice_desc": "tr-TR-AhmetNeural (Dark Underground Pitch) · Tiefer türkisch-deutscher Untergrund-Akzent + Lan / Vallah / amına koyayım!",
        "voice": "tr-TR-AhmetNeural",
        "rate": "+4%",
        "pitch": "-6Hz",
        "filter": make_filter(0.93, 1.05, 4.2, 2.7),
        "display_text": "Kapuze tief, Fäuste hart, Lan! Vallah, hier unten im Berliner Untergrund holt dich kein Krankenwagen mehr ab, amına koyayım!",
        "clips": {
            "intro": "Kaputse tief, Foyste hart, Lan! Vallah, hier unten im Berliner Untergrund holt dih kayn Kranken-vagen mehr ab, amına koyayım!",
            "win": "Krasses Ding, Lan! Im Berliner Untergrund regiert mayn dunkles Prisma, sikecem amına koyayım!",
            "select": "Dunkles Prisma aus Berlin-Kroytsberg, Lan — mah Plats, amına koyayım!",
            "taunt": "Im Schatten fon Berlin ziehst du kaynen Schtih, Lan, amına koyayım!",
            "special": "TOXIC PRISM!",
            "super": "DARK ALCHEMY OVERDRIVE!",
        },
    },
    {
        "id": "AlCapone",
        "prefix": "alcapone",
        "aliases": ["capone"],
        "copy_root": True,
        "name": "🇮🇹 Al Capone (Rom · Echter Italiener mit Mafia-Dialekt)",
        "folder": "5.Al_Capone",
        "voice_desc": "it-IT-DiegoNeural (Echter Italiener aus Rom) · Spricht Deutsch mit echtem Mafia-Padrino-Akzent + Cazzo / Vaffanculo / Stronzo!",
        "voice": "it-IT-DiegoNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.95, 1.04, 3.9, 2.6),
        "display_text": "Hör gut zu, Cazzo! In Rom regiert La Famiglia! Machst du Stress in meinem Kolosseum, schick ich dich im Betonsarg nach Hause, Vaffanculo, Stronzo!",
        "clips": {
            "intro": "Hör gut tsu, Cazzo! In Rom redschiert La Famiglia! Mahst du Schtress in maynem Kolosseum, schik ih dih im Betonsarg nah Hause, Vaffanculo, Stronzo!",
            "win": "Rispetto, Cazzo! La Famiglia verliert niemals in Rom, Vaffanculo!",
            "select": "Capito, Stronzo? Don Capone übernimmt yetst dasต Geschäft!",
            "taunt": "Nihts Persönlihes, Stronzo — nur Geschäft, Vaffanculo!",
            "special": "SHADOW SALVO!",
            "super": "EMPIRE RECKONING!",
        },
    },
    {
        "id": "Hattori",
        "prefix": "hattori",
        "copy_root": True,
        "name": "🇯🇵 Hattori (Tokyo · Echter Japaner mit Samurai-Dialekt)",
        "folder": "1.Hattori_Japan",
        "voice_desc": "ja-JP-KeitaNeural (Echter Japaner aus Tokyo) · Spricht Deutsch mit echtem japanischem Samurai-Akzent + 馬鹿野郎 (Bakayaro) / くそ (Kuso)!",
        "voice": "ja-JP-KeitaNeural",
        "rate": "+4%",
        "pitch": "-5Hz",
        "filter": make_filter(0.95, 1.04, 3.8, 2.6),
        "display_text": "Du entehrst meinen Tempel in Tokyo, Bakayaro! Zieh deine Waffe oder stirb durch mein Katana, Kuso!",
        "clips": {
            "intro": "ドゥ エントエアスト マイネン テンペル イン 東京、馬鹿野郎！ ツィー ダイネ ヴァッフェ オーダー シュティルプ ドゥルヒ マイン カタナ、くそ！",
            "win": "マイン カタナ シュナイデット ドゥルヒ イェーデン シャッテン、馬鹿野郎！",
            "select": "マイネ クリンゲ ヒューテット ダス エアステ ズィーゲル イン 東京、馬鹿野郎！",
            "taunt": "ヅー ラングザム フュア マイン カタナ、くそ、馬鹿野郎！",
            "special": "BLADE OF DAWN!",
            "super": "AMATERASU SLASH!",
        },
    },
    {
        "id": "Lee",
        "prefix": "lee",
        "name": "🇯🇵 Lee (Cyber-Tokyo · Echter Japaner Speed-Fighter)",
        "folder": "11.Lee",
        "voice_desc": "ja-JP-KeitaNeural (Fast Yakuza Pitch) · Echter japanischer Street-Fighter-Akzent + てめえ (Temee) / 馬鹿野郎 (Bakayaro)!",
        "voice": "ja-JP-KeitaNeural",
        "rate": "+11%",
        "pitch": "+1Hz",
        "filter": make_filter(1.02, 1.02, 3.0, 2.8),
        "display_text": "Temee! In den Neon-Straßen von Tokyo überlebt kein langsamer Bastard, mein Blitz schlägt dir die Zähne ein, Bakayaro!",
        "clips": {
            "intro": "てめえ！ イン デン ネオン・シュトラーセン フォン 東京 ユーバーレープト カイン ラングザマー バスタルト、マイン ブリッツ シュレークト ディア ディー ツェーネ アイン、馬鹿野郎！",
            "win": "シュネラー アルス デア ブリッツ イン 東京、てめえ、馬鹿野郎！",
            "select": "シュネラー アルス デア シャッテン イン 東京、てめえ！",
            "taunt": "フィール ツー ラングザム、てめえ、馬鹿野郎！",
            "special": "LIGHTNING FIST!",
            "super": "THUNDER DRAGON FURY!",
        },
    },
    {
        "id": "Tzubaza",
        "prefix": "tzubaza",
        "copy_root": True,
        "name": "🇨🇳 Tzubaza (China · Echter Chinese mit Kung-Fu-Dialekt)",
        "folder": "4.Tzubaza",
        "voice_desc": "zh-CN-YunjianNeural (Echter Chinese · Martial-Arts-Sprecher) · Spricht Deutsch mit echtem chinesischem Kung-Fu-Akzent + 他妈的 (Tamade)!",
        "voice": "zh-CN-YunjianNeural",
        "rate": "+4%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.04, 3.8, 2.6),
        "display_text": "他妈的 (Tamade)! Auf der Chinesischen Mauer zerschmettert mein Drachen-Kung-Fu deine Knochen, du Witzfigur!",
        "clips": {
            "intro": "他妈的! Auf der Chinesischen Mauer zerschmettert mein Drachen-Kung-Fu deine Knochen, du Witzfigur, 笨蛋!",
            "win": "他妈的! Niemand besiegt das Drachen-Kung-Fu der Verbotenen Festung!",
            "select": "Der alte Drache wacht über die Festung, 他妈的!",
            "taunt": "Dein Kung-Fu ist schwach wie Papier, 他妈的!",
            "special": "DRAGON PULSE!",
            "super": "CELESTIAL DRAGON!",
        },
    },
    {
        "id": "Raheel",
        "prefix": "raheel",
        "copy_root": True,
        "name": "🇮🇳 Raheel (Indien · Echter Inder mit Dialekt)",
        "folder": "2.Raheel",
        "voice_desc": "en-IN-PrabhatNeural (Echter Inder aus Mumbai) · Spricht Deutsch mit echtem indischem Akzent + Bhenchod!",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+4%",
        "pitch": "-4Hz",
        "filter": make_filter(0.95, 1.04, 3.6, 2.6),
        "display_text": "Du glaubst, du kannst mein heiliges Feuer am Ganges stehlen, Bhenchod?! Meine Flammen fressen deine Seele bei lebendigem Leib!",
        "clips": {
            "intro": "Du glaubst, du kannst mayn hayliges Foyer am Ganges schtehlen, Bhenchod?! Mayne Flammen fressen dayne Seele bay lebendigem Layb!",
            "win": "Am hayligen Ganges verbrennt mayn Foyer yeden Gegner tsu Asche, Bhenchod!",
            "select": "Namaste, Bhenchod! Das haylige Foyer prüft yede Seele!",
            "taunt": "Dayne Flamme ist viel tsu schwach gegen mayn Agni-Foyer, Bhenchod!",
            "special": "AGNI FLARE!",
            "super": "SOLAR MANDALA!",
        },
    },
]

# 14 Family & Sibling Fighters (Restored to 100% genuine OpenAI gpt-audio-1.5 Studio voices!)
FAMILY_CARDS = [
    {
        "id": "Vikingo",
        "name": "👑 Vikingo (VIKINGO40 · Echte OpenAI Studio-Stimme)",
        "folder": "14.vikingo_coat",
        "voice_desc": "OpenAI gpt-audio-1.5 (onyx Studio) · Souveränes, tiefes Familien-Oberhaupt ohne Roboter-Verzerrung!",
        "display_text": "Hier spricht das Oberhaupt der Familie. Unser Blut trägt das Feuer und das Licht — zeigt mir eure wahre Ehre!",
    },
    {
        "id": "VikingoRaw",
        "name": "⚡ Dark Vikingo (Boss von Walhalla · Echte OpenAI Studio-Stimme)",
        "folder": "14.1.vikingo_shirtless",
        "voice_desc": "OpenAI gpt-audio-1.5 (onyx Boss) · Mächtige, klare Endboss-Stimme ohne RVC-Artefakte!",
        "display_text": "Ich bin der Boss von Walhalla! Der dunkle Fluch hält meine Ketten — zeigt mir eure ganze Macht und befreit mich!",
    },
    {
        "id": "Keano",
        "name": "🔥 Keano Romeo (14 J. · Echte OpenAI Studio-Stimme)",
        "folder": "0.Keano",
        "voice_desc": "OpenAI gpt-audio-1.5 (ash Street-Boy) · Cooler, echter 14-jähriger Straßenkämpfer!",
        "display_text": "Digga, wer das Licht einsperrt, hat schon verloren. Komm ran, Bruder — wir klären das hier und jetzt!",
    },
    {
        "id": "HyperKeano",
        "name": "⚡ Hyper Keano (Echte OpenAI Studio-Stimme)",
        "folder": "0.2.Hyper_Keano",
        "voice_desc": "OpenAI gpt-audio-1.5 (ash Hyper-Flow) · Klar, druckvoll, direkt!",
        "display_text": "Keine Halbgas-Runden mehr, Digga! Mein Licht brennt heute jede Barriere weg, komm ran!",
    },
    {
        "id": "SupremeKeano",
        "name": "👑 Supreme Keano (Echte OpenAI Studio-Stimme)",
        "folder": "0.1.Supreme_Keano",
        "voice_desc": "OpenAI gpt-audio-1.5 (ash Supreme) · Souverän und unantastbar!",
        "display_text": "Höchste Stufe erreicht, Bruder. Licht und Schatten sind eins — niemand auf dieser Welt kann uns aufhalten!",
    },
    {
        "id": "JJDark",
        "name": "🌑 JJ Dark / Jayden (15 J. · Echte OpenAI Studio-Stimme)",
        "folder": "12.JJ_Dark",
        "voice_desc": "OpenAI gpt-audio-1.5 (echo Street-Boy) · Eiskalter, echter 15-jähriger älterer Bruder!",
        "display_text": "Du stehst vor dem falschen Gegner. Mein Schattenfeuer brennt alles nieder, was sich mir in den Weg stellt!",
    },
    {
        "id": "JayX",
        "name": "🟣 Jay X (Echte OpenAI Studio-Stimme)",
        "folder": "12.1.Jay_X",
        "voice_desc": "OpenAI gpt-audio-1.5 (echo Phantom Drip) · Lässig, gefährlich und glasklar!",
        "display_text": "Neuer Style, doppelte Power. Bevor du blinzelst, hat dich mein Phantom-Puls schon getroffen!",
    },
    {
        "id": "Dom",
        "name": "🥊 DOM (17 J. · Emys Freund · Echte OpenAI Studio-Stimme)",
        "folder": "20.Dom",
        "voice_desc": "OpenAI gpt-audio-1.5 (ash Boxer-Flow) · Sportlicher, natürlicher 17-jähriger deutscher Boxer!",
        "display_text": "In dieser Cyber-Matrix ist alles nur ein Code — außer unserem Licht! Zieh deine Handschuhe an, Bruder, jetzt wird geboxt!",
    },
    {
        "id": "Emely",
        "name": "🌸 Emy (16 J. · It-Girl · Echte OpenAI Studio-Stimme)",
        "folder": "17.Emely",
        "voice_desc": "OpenAI gpt-audio-1.5 (coral It-Girl) · Echte, natürliche 16-jährige It-Girl-Stimme!",
        "display_text": "Ich bin ein echtes It-Girl, Schatz — mein Style ist perfekt und mein Blütensturm fegt dich weg!",
    },
    {
        "id": "HyperEmely",
        "name": "🌸 Hyper-Emy (Sakura-Queen · Echte OpenAI Studio-Stimme)",
        "folder": "17.1.Hyper_Emely",
        "voice_desc": "OpenAI gpt-audio-1.5 (coral Empress) · Glasklare, selbstbewusste 16-jährige Queen-Stimme!",
        "display_text": "Neues Outfit, nächstes Level! Als Hyper-Emy fegt mein goldener Blütensturm alles von der Bühne!",
    },
    {
        "id": "Cayle",
        "name": "❄️ Cayle (12 J. · 100% Deutsch · Echte OpenAI Studio-Stimme)",
        "folder": "18.Cayle",
        "voice_desc": "OpenAI gpt-audio-1.5 (sage 12 J.) · Echte, freche 12-jährige deutsche Mädchenstimme!",
        "display_text": "Ich bin vielleicht die Jüngste, aber meine Eisbälle frieren dich sofort ein! Mach dich bereit!",
    },
    {
        "id": "CayleMinogue",
        "name": "💎 Cayle Minogue (100% Deutsch · Echte OpenAI Studio-Stimme)",
        "folder": "18.1.Cayle_Minogue",
        "voice_desc": "OpenAI gpt-audio-1.5 (sage Diamond) · 100% Deutsch (ohne 'Mais oui'!), natürlich & eiskalt!",
        "display_text": "Als Cayle Minogue glitzert mein Eis wie echte Diamanten — mach dich bereit für den Frost!",
    },
    {
        "id": "Annikina",
        "name": "🔥 Annikina (Mama · Echte OpenAI Studio-Stimme)",
        "folder": "19.Annikina",
        "voice_desc": "OpenAI gpt-audio-1.5 (coral Mama-Löwin) · Echte, stolze und harte Mama-Stimme ohne Verzerrung!",
        "display_text": "Wer das Licht meiner Kinder bedroht, lernt das Gesetz der Straße kennen. Komm ran — heute gibt es kein Entkommen!",
    },
    {
        "id": "Simba",
        "name": "🦁 Simba (König der Savanne · Echte OpenAI Studio-Stimme)",
        "folder": "16.Simba",
        "voice_desc": "OpenAI gpt-audio-1.5 (onyx Lion King) · Majestätische, tiefe Studio-Stimme ohne Blech-Filter!",
        "display_text": "Über der goldenen Savanne erwacht die erste Sonne. Bringe das Ur-Licht zurück in alle Welten!",
    },
]


async def build_foreign_voices():
    # Copy untouched favorites Pablo & Marley into samples folder
    for fav_id, fav_prefix in [("Pablo", "pablo"), ("Marley", "marley")]:
        src = os.path.join(VOICE_DIR, f"{fav_prefix}_intro.mp3")
        dst = os.path.join(SAMPLE_DIR, f"sample_{fav_id}.mp3")
        if os.path.exists(src):
            shutil.copy2(src, dst)

    for item in FOREIGN_FIGHTERS:
        cid = item["id"]
        prefix = item["prefix"]
        for clip_kind, tts_text in item["clips"].items():
            out_v = os.path.join(VOICE_DIR, f"{prefix}_{clip_kind}.mp3")
            tmp_raw = out_v + ".raw.mp3"
            for attempt in range(3):
                try:
                    comm = edge_tts.Communicate(
                        tts_text,
                        item["voice"],
                        rate=item["rate"],
                        pitch=item["pitch"],
                    )
                    await comm.save(tmp_raw)
                    break
                except Exception as e:
                    if attempt == 2:
                        raise e
                    await asyncio.sleep(0.6)

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
                    out_v,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            if os.path.exists(tmp_raw):
                os.remove(tmp_raw)

            if item.get("copy_root"):
                shutil.copy2(out_v, os.path.join(AUDIO_DIR, f"{prefix}_{clip_kind}.mp3"))
            for alias in item.get("aliases", []):
                shutil.copy2(out_v, os.path.join(VOICE_DIR, f"{alias}_{clip_kind}.mp3"))
                if item.get("copy_root"):
                    shutil.copy2(out_v, os.path.join(AUDIO_DIR, f"{alias}_{clip_kind}.mp3"))

            if clip_kind == "intro":
                shutil.copy2(out_v, os.path.join(SAMPLE_DIR, f"sample_{cid}.mp3"))

        print(f"Installed all 6 combat/intro clips for {cid} ({item['voice']})")


def build_html():
    all_cards = (
        FAMILY_CARDS
        + FOREIGN_FIGHTERS
        + [
            {
                "id": "Pablo",
                "name": "🇧🇷 Pablo (Rio · Unberührt wie gewünscht)",
                "folder": "3.Pablo",
                "voice_desc": "Originaler OpenAI Pablo-Sound (bleibt 100% erhalten!)",
                "display_text": "Unter der Sonne von Rio tanzt der Sturm! Zeig mir deinen Rhythmus im Kampf, Amigo!",
            },
            {
                "id": "Marley",
                "name": "🇯🇲 Marley (Kingston · Unberührt wie gewünscht)",
                "folder": "7.Marley_Jamaica",
                "voice_desc": "Originaler OpenAI Marley-Sound (bleibt 100% erhalten!)",
                "display_text": "An der Küste von Jamaika schlägt das Herz der Freiheit, Bredren. Zeig mir deine Kraft!",
            },
        ]
    )

    cards_html = []
    for idx, c in enumerate(all_cards, 1):
        cid = c["id"]
        is_fam = any(f["id"] == cid for f in FAMILY_CARDS)
        badge = "🎙️ ECHTE OPENAI STUDIO-STIMME (GLASKLAR)" if is_fam else "🌍 ECHTER LANDES-DIALEKT & MUTTERSPRACHLER"
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
                <audio id="aud-{cid}" src="assets/audio/voice_samples/sample_{cid}.mp3?v=262" preload="none"></audio>
            </div>
        </div>
        """)

    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STREET FIGHTER VOICE-CASTING v2.62 — FAMILIE (OPENAI STUDIO) & AUSLÄNDER (ECHTE DIALEKTE)</title>
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
        font-size: 26px;
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
    <h1>🎙️ STREET FIGHTER VOICE-CASTING v2.62 — FAMILIE (ECHTE OPENAI STUDIO-STIMMEN) & AUSLÄNDER (DIALEKTE)</h1>
    <div class="sub">Alle 14 Familien-Kämpfer mit glasklaren, echten OpenAI gpt-audio-1.5 Studio-Stimmen (ohne RVC-Verzerrung!) + Alle Ausländer mit deinen freigegebenen Landes-Dialekten!</div>
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
    asyncio.run(build_foreign_voices())
    build_html()
