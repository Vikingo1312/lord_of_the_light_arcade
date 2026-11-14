# ⚔️ KEANO ROMEO: LORD OF THE LIGHT — Entwickler-Paket (v2.28)

Willkommen im kompletten Entwickler-Paket von **KEANO ROMEO — LORD OF THE LIGHT I**!
Hier findest du den gesamten Quellcode, alle 23 Kämpfer (jeweils 28 Street-Fighter-Sprites), alle 15 Arenen, alle Sprachdateien, Musik-Tracks, Sound-Effekte und die Generator-Tools zum Weiterbauen.

---

## 🌐 1. Wichtige Links & Zugriffe

* **Live-Spiel (PC, iPhone & iPad – weltweit spielbar):**
  👉 [https://lord-of-the-light-arcade.vercel.app/](https://lord-of-the-light-arcade.vercel.app/)
* **GitHub Repository (Code & automatisches Live-Deployment):**
  👉 [https://github.com/Vikingo1312/lord_of_the_light_arcade](https://github.com/Vikingo1312/lord_of_the_light_arcade)
  *(Jeder `git push origin main` auf dieses GitHub-Repository aktualisiert nach ca. 20 Sekunden automatisch die Live-Seite auf Vercel!)*
* **Lokaler Test-Server am PC (alle 23 Kämpfer sofort freigeschaltet):**
  👉 [http://localhost:8081](http://localhost:8081)

---

## 🚀 2. Spiel lokal am PC / Mac starten (Test-Modus mit allen 23 Charakteren)

Im lokalen Modus (`localhost` / `127.0.0.1`) sind **automatisch alle 23 Charaktere (inkl. aller 8 Geheim-Charaktere)** sofort freigeschaltet, damit du alles direkt testen kannst. Auf der Live-Seite (`vercel.app` / iPhone) bleiben die Geheim-Charaktere gesperrt und müssen im Arcade-Modus freigespielt werden.

### Auf dem Mac starten:
1. Doppelklicke einfach auf **`START_SPIEL_MAC.command`** im Projektordner.
2. Oder öffne das Terminal im Projektordner und tippe:
   ```bash
   python3 server.py
   ```
3. Öffne im Browser: **[http://localhost:8081](http://localhost:8081)**

### Auf Windows starten:
1. Doppelklicke auf **`START_SPIEL_WINDOWS.bat`**.
2. Oder öffne PowerShell / CMD im Projektordner und tippe:
   ```bat
   python server.py
   ```
3. Öffne im Browser: **[http://localhost:8081](http://localhost:8081)**

---

## 🎮 3. Steuerung im Spiel

### Am PC (Tastatur):
* **Bewegen / Springen / Ducken:** `A` / `D` / `W` / `S` (oder Pfeiltasten `←` `→` `↑` `↓`)
* **Dash (Sprint vor/zurück):** `2x schnell ←` oder `2x schnell →` (oder `Shift` / `I`)
* **Punch (Leichter Schlag):** `J`
* **Kick (Schwerer Tritt):** `K`
* **Special / Projektil / Super-Combo (wenn Balken voll):** `L`
* **Wurf (Nahkampf, durchbricht Block):** `J + K` gleichzeitig
* **Street Fighter Command & Special Moves:**
  * **Backfist (Überkopf-Schlag):** `→ + J`
  * **Axe Kick (Überkopf-Tritt):** `→ + K`
  * **Dragon Uppercut (Shoryuken):** `↓ ↑ + J` oder `↑ + L`
  * **Hurricane Kick (Tatsumaki):** `↓ ← + K` oder `↓ + L`
  * **Taunt (Spruch):** `↓ + J + K`
* **Pause & Sound-Mixer:** `ESC` oder Klick oben auf `⏸ PAUSE` / `⏸ MENU`

---

## 📂 4. Projekt-Struktur (Wo liegt was?)

```text
lord_of_the_light_arcade/
├── index.html                  # Hauptdatei, Vollbild-/iPhone-Landscape-Logik & Versionsnummer (?v=2.28)
├── server.py                   # Lokaler Entwicklungs-Server (Port 8081, No-Cache für sofortige Updates)
├── START_SPIEL_MAC.command     # 1-Klick-Starter für Mac
├── START_SPIEL_WINDOWS.bat     # 1-Klick-Starter für Windows
├── js/
│   ├── main.js                 # Startpunkt der Engine
│   ├── data.js                 # ALLE 23 Kämpfer (HP, Speed, Power, Freischaltung) & alle 15 Arenen (STAGES)
│   ├── story_data.js           # Storyboard-Texte & Bilder (Prolog, Reflexion, Epilog, Outro, Birthday)
│   ├── story_dialogues.js      # Alle Kampf-Sprüche, Untertitel & Namen der Special/Super-Attacken
│   ├── core/
│   │   ├── Game.js             # 60-FPS Game-Loop, Hitstop, Einstellungen
│   │   ├── InputManager.js     # Tastatur-, Gamepad- & Motion-Input-Erkennung (QCF, QCB, DP)
│   │   ├── TouchPad.js         # Virtueller Arcade-Stick & 4 Buttons für iPhone / iPad / Android
│   │   ├── AudioManager.js     # WebAudio-Mixer (Musik, Hits, Kämpfer-Stimmen, Announcer)
│   │   ├── AssetPreloader.js   # Lädt Sprites, Projektile, Musik und Stimmen vor
│   │   └── NetworkManager.js   # Online 1v1 & 2-Spieler Koop über PeerJS (4-stelliger Raum-Code)
│   ├── entities/
│   │   ├── Fighter.js          # Komplette Kämpfer-Logik, Animationen, Hitboxen, Combos & VFX
│   │   ├── Projectile.js       # Feuerbälle, Lichtschüsse, Blütensturm, Eisbälle & Super-Projektile
│   │   ├── StageObjects.js     # Zerstörbare Arena-Objekte & Wetter-/Atmosphären-Effekte
│   │   └── Hitbox.js           # Treffer- und Block-Kollisionen
│   ├── ai/
│   │   └── AIController.js     # Gegner-KI (Schwierigkeitsgrad steigt im Arcade-Modus an)
│   ├── states/
│   │   ├── Menu.js             # Hauptmenü & Optionen
│   │   ├── CharacterSelect.js  # Kämpfer-Auswahl (inkl. Geheim-Reihe)
│   │   ├── VersusIntro.js      # VS-Bildschirm vor dem Kampf
│   │   ├── Combat.js           # Kampf-Ablauf, Intro-Sequenz, Kamera-Zoom, Super-Freeze, K.O.
│   │   ├── StorySequence.js    # Filmische Zwischensequenzen mit Sprachausgabe
│   │   └── OnlineLobby.js      # Online-Raum erstellen / beitreten (1v1 & Koop)
│   └── ui/
│       └── CombatHUD.js        # Lebensbalken, Super-Meter, Combo-Zähler, Untertitel & Pause-Menü
├── assets/
│   ├── CHARACTERS/             # Alle 23 Charakter-Ordner (je 28 transparente PNG-Sprites)
│   ├── fx/char_projectiles/    # Alle Charakter-Projektile (proj_keano.png, proj_emely.png, proj_cayle.png ...)
│   ├── STAGES/                 # Hintergrundbilder aller 15 Arenen
│   ├── UI/                     # Story-Artworks, Logos & Menü-Hintergründe
│   └── audio/
│       ├── voice/              # Alle Kämpfer-Stimmen (*_intro, *_win, *_special, *_super, *_taunt, *_hit, *_ko)
│       ├── sfx/                # Street-Fighter Schlag-, Kick-, Block-, Wurf- und K.O.-Sounds
│       └── music/              # Arena-Soundtracks & Menü-Musik
└── tools/
    ├── generate_sf_frames.py   # Generiert automatisch alle 28 Street-Fighter-Sprites aus 7 Basis-Posen
    ├── install_new_characters.py # Entfernt weiße Hintergründe sauber & erstellt Portraits (_front.png)
    ├── generate_sf_sfx.py      # Erzeugt die Arcade-Hit-Sounds
    └── generate_sf_voices_gpt_audio.py # Skript zur Sprachgenerierung für alle 23 Charaktere
```

---

## 🛠️ 5. Anleitung zum Weiterentwickeln

### A) Werte eines Kämpfers ändern (Leben, Geschwindigkeit, Stärke)
Öffne `js/data.js`. Dort findest du `ROSTER` (die 15 Hauptkämpfer) und `SECRET_ROSTER` (die 8 freischaltbaren Geheim-Charaktere):
```javascript
{
    id: 'Keano',
    name: '🔥Keano',
    folder: '0.Keano',
    hp: 1050,        // Lebenspunkte
    speed: 1.35,     // Bewegungsgeschwindigkeit
    power: 1.25,     // Angriffsstärke
    specialColor: '#00ffff',
}
```

### B) Kampfsprüche, Antworten oder Attacken-Namen ändern
Öffne `js/story_dialogues.js`. Jeder Kämpfer hat dort seinen eigenen Block:
* `specialAttack`: Name der Special-Attacke
* `superAttack`: Name der Super-Combo
* `introQuote`: Spruch zu Beginn des Kampfes
* `keanoReply`: Was 🔥Keano diesem Gegner antwortet
* `jaydenReply`: Was 💫Jayden diesem Gegner antwortet
* `jayXReply`: Was Jay X diesem Gegner antwortet
* `winQuote`: Siegerspruch nach K.O.

### C) Neue Charakter-Bilder einbauen
Jeder Kämpfer in `assets/CHARACTERS/<Ordnername>/` benötigt 7 Basis-Bilder (mit transparentem Hintergrund, `640x640` Pixel, Blickrichtung nach **rechts**):
* `_right.png` (Kampfstellung)
* `_punch.png` (Schlag)
* `_kick.png` (Tritt)
* `_special.png` (Feuerball / Special)
* `_hit.png` (Treffer kassiert)
* `_ko.png` (Am Boden liegend)
* `_win.png` (Siegerpose)

Sobald diese 7 Bilder im Charakter-Ordner liegen, führe einfach aus:
```bash
python3 tools/generate_sf_frames.py
```
Das Skript berechnet daraus automatisch alle **28 flüssigen Street-Fighter-Animations-Frames** (inkl. `_idle_2.png`, `_walk_1.png`, `_walk_2.png`, `_crouch.png`, `_block.png`, `_jump.png`, `_backfist.png`, `_axe_kick.png`, `_hurricane_kick.png`, `_dragon_uppercut.png`).

### D) Updates live stellen (GitHub & Vercel / iPhone)
1. Erhöhe bei neuen Bildern oder Code-Änderungen kurz die Versionsnummer (z. B. von `?v=2.28` auf `?v=2.29`) in:
   * `index.html`
   * `js/core/AssetPreloader.js`
   * `js/states/Boot.js`
2. Speichere und pushe dein Update im Terminal:
   ```bash
   git add .
   git commit -m "Mein neues Update"
   git push origin main
   ```
3. Nach ca. 20 Sekunden ist die neue Version automatisch unter `https://lord-of-the-light-arcade.vercel.app/` live!
