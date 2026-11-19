/**
 * Master Roster Definition for LORD OF THE LIGHT I
 * 14 Opponents + Keano (Hero) = 15 Main Roster
 * Each fighter maps to their home stage
 */
// ─── MAIN ROSTER (Arcade/Story Mode Order) ───
// Keano is the hero. The 14 opponents follow in story order.
export const FIGHT_STYLES = {
    LIGHT_DRAGON: {
        id: 'LIGHT_DRAGON',
        name: 'LIGHT DRAGON KARATE',
        badge: '☀️ LIGHT DRAGON STYLE',
        color: '#00ffff',
        passive: '+20% Kombo-Tempo & Solar-Launcher beim 3. Schlag',
        sig1Name: 'SOLAR FLASH RUSH',
        sig1Input: 'P ➔ P ➔ P  (oder P ➔ P ➔ ↑+K)',
        sig1Badges: ['P', '➔', 'P', '➔', 'P'],
        sig1Dmg: '88 DMG · SOLAR DRAGON LAUNCHER',
        sig1Desc: '2 blitzschnelle Licht-Jabs + explosiver Solar-Dragon-Uppercut, der den Gegner hoch in die Luft schleudert!',
        sig2Name: 'HEAVENLY LIGHT FLURRY',
        sig2Input: 'P ➔ K ➔ ↓+S',
        sig2Badges: ['P', '➔', 'K', '➔', 'S'],
        sig2Dmg: '96 DMG · 5-HIT LICHT-WIRBEL',
        sig2Desc: 'Verbindet Punch und Roundhouse-Kick nahtlos mit einem 3-fachen Licht-Wirbelsturm-Kick!'
    },
    SHADOW_ASSASSIN: {
        id: 'SHADOW_ASSASSIN',
        name: 'SHADOW ASSASSIN',
        badge: '💫 SHADOW ASSASSIN STYLE',
        color: '#cc55ff',
        passive: 'Phantom-Crossup: Kann mitten in der Kombo hinter den Gegner teleport-dashen!',
        sig1Name: 'PHANTOM SHADOW BLITZ',
        sig1Input: 'K ➔ P ➔ K  (oder P ➔ P ➔ K)',
        sig1Badges: ['K', '➔', 'P', '➔', 'K'],
        sig1Dmg: '92 DMG · TELEPORT-CROSSUP',
        sig1Desc: 'Schatten-Kick, gefolgt von einem blitzschnellen Phantom-Dash durch den Gegner und Überkopf-Axttritt!',
        sig2Name: 'ECLIPSE ASSASSIN CHAIN',
        sig2Input: '→+P ➔ K ➔ S',
        sig2Badges: ['→+P', '➔', 'K', '➔', 'S'],
        sig2Dmg: '108 DMG · DECKUNGSBRECHER',
        sig2Desc: 'Bricht geduckte Deckung mit der Rückfaust und jagt sofort die dunkle Schatten-Flamme hinterher!'
    },
    VALHALLA_BERSERKER: {
        id: 'VALHALLA_BERSERKER',
        name: 'VALHALLA BERSERKER',
        badge: '⚡ VALHALLA BERSERKER STYLE',
        color: '#ffcc00',
        passive: 'Donner-Rüstung (Super-Armor bei schweren Attacken) + massiver Rückstoß',
        sig1Name: 'THUNDER HAMMER SMASH',
        sig1Input: '→+P ➔ P ➔ K',
        sig1Badges: ['→+P', '➔', 'P', '➔', 'K'],
        sig1Dmg: '104 DMG · SUPER-ARMOR BREAKER',
        sig1Desc: 'Unaufhaltsamer Berserker-Vorstoß mit Donner-Rüstung und vernichtendem Walhalla-Hammer-Tritt!',
        sig2Name: 'RAGNAROK EARTHQUAKE',
        sig2Input: 'K ➔ ↓+K ➔ ↑+S',
        sig2Badges: ['K', '➔', '↓+K', '➔', '↑+S'],
        sig2Dmg: '112 DMG · HOCH-TIEF KOMBO',
        sig2Desc: 'Zwingt den Gegner erst in den hohen Block, fegt ihn dann tief von den Beinen und schleudert ihn hoch!'
    },
    CAPOEIRA_TRICKSTER: {
        id: 'CAPOEIRA_TRICKSTER',
        name: 'CAPOEIRA & RASTA FLOW',
        badge: '🤸 CAPOEIRA TRICKSTER STYLE',
        color: '#00ff88',
        passive: 'Triple-Kick-Flow: Kann 3 verschiedene Kicks nahtlos aneinanderketten!',
        sig1Name: 'TRIPLE CAPOEIRA HELICOPTER',
        sig1Input: 'K ➔ K ➔ K  (3x Kick-Taste!)',
        sig1Badges: ['K', '➔', 'K', '➔', 'K'],
        sig1Dmg: '94 DMG · TIEF ➔ MITTEL ➔ ÜBERKOPF',
        sig1Desc: 'Einzigartige 3er-Kick-Kette: Tiefer Fußfeger ➔ gedrehter Spin-Kick ➔ Überkopf-Axttritt!',
        sig2Name: 'TROPICAL CYCLONE SPIN',
        sig2Input: '↓+K ➔ K ➔ ↓+S',
        sig2Badges: ['↓+K', '➔', 'K', '➔', '↓+S'],
        sig2Dmg: '102 DMG · 5-HIT WIRBELSTURM',
        sig2Desc: 'Fegt den Gegner vom Boden in einen nicht enden wollenden Capoeira-Wirbelsturm!'
    },
    TITAN_GRAPPLER: {
        id: 'TITAN_GRAPPLER',
        name: 'TITAN GRAPPLER & BRAWLER',
        badge: '🤼 TITAN GRAPPLER STYLE',
        color: '#ff4444',
        passive: 'Combo-Throw: Kann direkt aus einem Treffer einen UNBLOCKBAREN Wurf-Slam ausführen!',
        sig1Name: 'UNBLOCKABLE COMBO SLAM',
        sig1Input: 'P ➔ P+K  (Schlag in Wurf!)',
        sig1Badges: ['P', '➔', 'P+K'],
        sig1Dmg: '90 DMG · 100% UNBLOCKBARER SLAM',
        sig1Desc: 'Nach einem Jab packt der Titan den Gegner sofort im Genick und rammt ihn unblockbar in den Boden!',
        sig2Name: 'HEAVYWEIGHT CRUSHER',
        sig2Input: '→+K ➔ P ➔ P+K',
        sig2Badges: ['→+K', '➔', 'P', '➔', 'P+K'],
        sig2Dmg: '110 DMG · BRUTALER BODENBRECHER',
        sig2Desc: 'Bricht die Deckung von oben und beendet die Kette mit einem verheerenden Lucha-/MMA-Wurf!'
    },
    MASTER_STRIKER: {
        id: 'MASTER_STRIKER',
        name: 'GRANDE MASTER ARTS',
        badge: '🗡️ MASTER STRIKER STYLE',
        color: '#ffaa00',
        passive: 'Meister-Präzision: +25% Konter-Schaden & blitzschnelle 4-Hit-Technikkette',
        sig1Name: 'IMPERIAL 4-STRIKE BLADE',
        sig1Input: 'P ➔ P ➔ →+K',
        sig1Badges: ['P', '➔', 'P', '➔', '→+K'],
        sig1Dmg: '92 DMG · PRÄZISIONS-FINISHER',
        sig1Desc: 'Blitzschnelle Meister-Kombination mit doppeltem Vorwärtsschritt und Überkopf-Finisher!',
        sig2Name: 'DRAGON MASTER ASCENSION',
        sig2Input: '↓+K ➔ P ➔ ↑+S',
        sig2Badges: ['↓+K', '➔', 'P', '➔', '↑+S'],
        sig2Dmg: '98 DMG · KONTER-LAUNCHER',
        sig2Desc: 'Tiefer Feger direkt gecancelt in einen aufsteigenden Meister-Drachenschlag!'
    },
    KNEIPEN_TERRORIST: {
        id: 'KNEIPEN_TERRORIST',
        name: 'KNEIPENTERRORISTEN',
        badge: '🔥 KNEIPEN-BRAWLER',
        color: '#ff7700',
        passive: 'Gusseisen-Armor: Super-Armor & +26px Reichweite auf schwere Schwinger!',
        sig1Name: 'IRON FLAME OVERHEAD CRUSH',
        sig1Input: 'P ➔ P ➔ →+K',
        sig1Badges: ['P', '➔', 'P', '➔', '→+K'],
        sig1Dmg: '96 DMG · BRICHT JEDE DECKUNG!',
        sig1Desc: 'Schnelle Kombination, beendet mit einem beidhändigen Überkopf-Smash!',
        sig2Name: 'HELLFIRE METEOR BARRAGE',
        sig2Input: 'P ➔ K ➔ S',
        sig2Badges: ['P', '➔', 'K', '➔', 'S'],
        sig2Dmg: '112 DMG · DOPPEL-FEUER-SALVE',
        sig2Desc: 'High-Top-Kick direkt gecancelt in die brennende Doppel-Salve!'
    },
    SONIC_STRIKER: {
        id: 'SONIC_STRIKER',
        name: 'SONIC BOOM & FLASH KICK',
        badge: '🌙 GUILE SONIC STRIKER',
        color: '#00ff88',
        passive: 'Guile-Style: Sonic Matrix Boom, 2-Hit Spinning Backfist (→+P) & 360° Backflip Somersault Flash Kick!',
        sig1Name: 'SOMERSAULT FLASH KICK',
        sig1Input: '↓↑+K  oder  ↑+S / ↑+P',
        sig1Badges: ['↓', '↑', '+', 'K'],
        sig1Dmg: '96 DMG · 360° BACKFLIP FLASH KICK',
        sig1Desc: 'Guiles legendärer Rückwärtssalto-Flash-Kick mit riesiger grün-goldener Sichelwelle gegen Luft- und Bodenziele!',
        sig2Name: 'SONIC BOOM & BACKFIST COMBO',
        sig2Input: '→+P ➔ →+K ➔ S',
        sig2Badges: ['→+P', '➔', '→+K', '➔', 'S'],
        sig2Dmg: '108 DMG · SPINNING BACKFIST + SONIC BOOM',
        sig2Desc: 'Guiles gedrehte Spinning-Backfist in den Reverse-Kick, abgeschlossen mit einer doppelten Sonic-Matrix-Boom-Sichel!'
    }
};

export const ROSTER = [
    { id: 'Keano', folder: '0.Keano', name: 'Keano Romeo', nickname: 'Lord of the Light', country: 'Universal', stageId: 'Japan', heightScale: 0.95, hp: 310, speed: 540, power: 105, styleId: 'LIGHT_DRAGON', specialName: 'LIGHT SHOT', superName: 'SOLAR NEXUS', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'keano', cutinFile: 'proj_keano.png' },
    { id: 'Hattori', folder: '1.Hattori_Japan', name: 'Hattori', nickname: 'The Silent Blade', country: 'Japan', stageId: 'Japan', heightScale: 0.99, hp: 285, speed: 510, power: 92, styleId: 'SHADOW_ASSASSIN', specialName: 'BLADE OF DAWN', superName: 'AMATERASU SLASH', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'hattori', cutinFile: 'proj_hattori.png' },
    { id: 'Raheel', folder: '2.Raheel', name: 'Raheel', nickname: 'Desert Storm', country: 'India', stageId: 'India', heightScale: 1.01, hp: 295, speed: 495, power: 95, styleId: 'MASTER_STRIKER', specialName: 'AGNI FLARE', superName: 'SOLAR MANDALA', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'raheel', cutinFile: 'proj_raheel.png' },
    { id: 'Pablo', folder: '3.Pablo', name: 'Pablo', nickname: 'Capoeira King', country: 'Brazil', stageId: 'Brazil', heightScale: 0.99, hp: 295, speed: 530, power: 96, styleId: 'CAPOEIRA_TRICKSTER', specialName: 'SOLAR GINGA', superName: 'SUPERNOVA RHYTHM', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'pablo', cutinFile: 'proj_pablo.png' },
    { id: 'Tzubaza', folder: '4.Tzubaza', name: 'Tzubaza', nickname: 'The Dragon', country: 'China', stageId: 'China', heightScale: 1.01, hp: 300, speed: 515, power: 98, styleId: 'MASTER_STRIKER', specialName: 'DRAGON PULSE', superName: 'CELESTIAL DRAGON', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'tzubaza', cutinFile: 'proj_tzubaza.png' },
    { id: 'AlCapone', folder: '5.Al_Capone', name: 'Al Capone', nickname: 'Mob Boss', country: 'Italy', stageId: 'Italy', heightScale: 1.05, hp: 310, speed: 480, power: 100, styleId: 'TITAN_GRAPPLER', specialName: 'SHADOW SALVO', superName: 'EMPIRE RECKONING', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'capone', cutinFile: 'proj_al_capone.png' },
    { id: 'Gargamel', folder: '6.C_Gargamel', name: 'C. Gargamel', nickname: 'Dark Alchemist', country: 'Germany', stageId: 'Germany', heightScale: 0.98, hp: 305, speed: 500, power: 102, styleId: 'SHADOW_ASSASSIN', specialName: 'AETHER FLASK', superName: "PHILOSOPHER'S NOVA", multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'gargamel', cutinFile: 'proj_gargamel.png' },
    { id: 'Marley', folder: '7.Marley_Jamaica', name: 'Marley', nickname: 'Rasta Warrior', country: 'Jamaica', stageId: 'Jamaica', heightScale: 1.02, hp: 310, speed: 525, power: 104, styleId: 'CAPOEIRA_TRICKSTER', specialName: 'ZION PULSE', superName: 'LION OF LIGHT', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'marley', cutinFile: 'proj_marley.png' },
    { id: 'Kowalski', folder: '8.Kowalski_Poland', name: 'Kowalski', nickname: 'Iron Bear', country: 'Poland', stageId: 'Poland', heightScale: 1.14, hp: 335, speed: 455, power: 110, styleId: 'TITAN_GRAPPLER', specialName: 'IRON TREMOR', superName: 'TITAN BREAKER', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'kowalski', cutinFile: 'proj_kowalski.png' },
    { id: 'Paco', folder: '9.Paco_el_Taco', name: 'Paco el Taco', nickname: 'Lucha Libre', country: 'Mexico', stageId: 'Mexico', heightScale: 1.06, hp: 320, speed: 530, power: 106, styleId: 'TITAN_GRAPPLER', specialName: 'AZTEC FLARE', superName: 'FIFTH SUN ECLIPSE', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'paco', cutinFile: 'proj_paco.png' },
    { id: 'Juan', folder: '10.Juan', name: 'Juan', nickname: 'Matador', country: 'Spain', stageId: 'Spain', heightScale: 1.01, hp: 310, speed: 545, power: 108, styleId: 'MASTER_STRIKER', specialName: 'CRIMSON FLASH', superName: 'ROYAL CORRIDA', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'juan', cutinFile: 'proj_juan.png' },
    { id: 'Lee', folder: '11.Lee', name: 'Lee', nickname: 'Fist of Fury', country: 'Japan', stageId: 'Japan_Night', heightScale: 0.98, hp: 305, speed: 590, power: 108, styleId: 'MASTER_STRIKER', specialName: 'LIGHTNING FIST', superName: 'THUNDER DRAGON FURY', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'lee', cutinFile: 'proj_lee.png' },
    { id: 'JJDark', folder: '12.JJ_Dark', name: 'JJ Dark', nickname: 'Shadow Master', country: 'Unknown', stageId: 'Dojo', heightScale: 0.95, hp: 325, speed: 565, power: 112, styleId: 'SHADOW_ASSASSIN', specialName: 'SHADOW FLAME', superName: 'ECLIPSE NOVA', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'jayden', cutinFile: 'proj_jayden.png' },
    { id: 'Putin', folder: '13.Putin', name: 'Putin', nickname: 'Cold War', country: 'Russia', stageId: 'Russia', heightScale: 1.15, hp: 345, speed: 465, power: 115, styleId: 'TITAN_GRAPPLER', specialName: 'FROST VORTEX', superName: 'ABSOLUTE ZERO', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'putin', cutinFile: 'proj_putin.png' },
    { id: 'VikingoRaw', folder: '14.1.vikingo_shirtless', name: 'Dark Vikingo', nickname: 'God of War', country: 'Valhalla', stageId: 'Valhalla', heightScale: 1.12, hp: 365, speed: 575, power: 122, styleId: 'VALHALLA_BERSERKER', specialName: 'ABYSS BREAKER', superName: 'RAGNAROK ECLIPSE', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'vikingo_shirtless', cutinFile: 'proj_dark_vikingo.png' },
];
// ─── SPECIAL / SECRET CHARACTERS ───
// "unlockedBy" defines the Bloodline progression requirement (who you need to beat Arcade mode with)
export const SPECIALS = [
    { id: 'Vikingo', folder: '14.vikingo_coat', name: 'Vikingo', nickname: 'The Creator', country: 'Valhalla', special: true, stageId: 'Canada', unlockedBy: 'VikingoRaw', heightScale: 1.10, hp: 380, speed: 630, power: 132, styleId: 'VALHALLA_BERSERKER', specialName: 'VALHALLA THUNDER', superName: 'BIFROST GENESIS', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'vikingo_coat', cutinFile: 'proj_vikingo_coat.png' },
    { id: 'SupremeKeano', folder: '0.1.Supreme_Keano', name: 'Supreme Keano', nickname: 'Ascended Hero', country: 'Ascended', special: true, stageId: 'Supreme_Keano', unlockedBy: 'HyperKeano', heightScale: 0.97, hp: 360, speed: 615, power: 126, styleId: 'LIGHT_DRAGON', specialType: 'SPECIAL_DASH', specialName: 'CELESTIAL FLASH', superName: 'GENESIS OF LIGHT', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'keano', cutinFile: 'proj_supreme_keano.png' },
    { id: 'HyperKeano', folder: '0.2.Hyper_Keano', name: 'Hyper Keano', nickname: 'Vengeful Hero', country: 'Beyond', special: true, stageId: 'Japan', unlockedBy: 'Keano', heightScale: 0.96, hp: 335, speed: 610, power: 116, styleId: 'LIGHT_DRAGON', specialName: 'PHOTON SURGE', superName: 'ASTRAL ECLIPSE', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'keano', cutinFile: 'proj_0.2.Hyper_Keano.png' },
    { id: 'JayX', folder: '12.1.Jay_X', name: 'Jay X', nickname: 'Neon Shadow', country: 'Shadow', special: true, stageId: 'Dojo', unlockedBy: 'JJDark', heightScale: 0.96, hp: 330, speed: 660, power: 114, styleId: 'SHADOW_ASSASSIN', specialName: 'PHANTOM PULSE', superName: 'VOID HORIZON', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'jay_x', cutinFile: 'proj_jay_x.png' },
    { id: 'GargamelHoodie', folder: '6.1.C_Gargamel_Hoodie', name: 'Gargamel Hoodie', nickname: 'Street Chemist', country: 'Germany', special: true, stageId: 'Germany', unlockedBy: 'Gargamel', heightScale: 0.98, hp: 325, speed: 535, power: 114, styleId: 'SHADOW_ASSASSIN', specialName: 'TOXIC PRISM', superName: 'DARK ALCHEMY OVERDRIVE', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'gargamel', cutinFile: 'proj_gargamel.png' },
    { id: 'Simba', folder: '16.Simba', name: 'Simba', nickname: 'Lion King', country: 'Serengeti', special: true, stageId: 'Jamaica', unlockedBy: 'Vikingo', heightScale: 0.86, hp: 360, speed: 610, power: 125, styleId: 'VALHALLA_BERSERKER', largeAura: true, specialName: 'SAVANNAH ROAR', superName: 'PRIDE OF ETERNITY', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'simba', cutinFile: 'proj_simba.png' },
    { id: 'Emely', folder: '17.Emely', name: '🌸 Emy 🌸', nickname: 'Blossom Queen', country: 'Universal', special: true, stageId: 'Japan', unlockedBy: 'Simba', heightScale: 0.90, hp: 350, speed: 625, power: 124, styleId: 'LIGHT_DRAGON', specialName: 'BLOSSOM SHOT', superName: 'PETAL STORM NOVA', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'emely', cutinFile: 'proj_emely.png' },
    { id: 'HyperEmely', folder: '17.1.Hyper_Emely', name: '🌸 Hyper-Emy 🌸', nickname: 'Sakura Empress', country: 'Ascended', special: true, stageId: 'Japan', unlockedBy: 'Emely', heightScale: 0.91, hp: 365, speed: 655, power: 128, styleId: 'CAPOEIRA_TRICKSTER', specialName: 'HYPER SAKURA BEAM', superName: 'EMPRESS OF SAKURA OVERDRIVE', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'hyper_emely', cutinFile: 'proj_hyper_emely.png' },
    { id: 'Cayle', folder: '18.Cayle', name: 'Cayle', nickname: 'Frost Princess', country: 'Shadow', special: true, stageId: 'Russia', unlockedBy: 'JayX', heightScale: 0.82, hp: 340, speed: 645, power: 120, styleId: 'SHADOW_ASSASSIN', specialName: 'ICEBALL BARRAGE', superName: 'GLACIER BLIZZARD', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'cayle', cutinFile: 'proj_cayle.png' },
    { id: 'CayleMinogue', folder: '18.1.Cayle_Minogue', name: '❄️ Cayle Minogue ❄️', nickname: 'Diamond Frost Queen', country: 'France', special: true, stageId: 'France', unlockedBy: 'Cayle', heightScale: 0.83, hp: 355, speed: 670, power: 126, styleId: 'SHADOW_ASSASSIN', specialName: 'DIAMOND FROST LANCE', superName: 'PARISIAN AURORA BOREALIS', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'cayle_minogue', cutinFile: 'proj_cayle_minogue.png' },
    { id: 'Annikina', folder: '19.Annikina', name: '🔥 Annikina 🔥', nickname: 'Guardian of the Flame', country: 'Germany', special: true, stageId: 'Annikina_Pub', unlockedBy: 'HyperEmely', unlockedByAny: ['SupremeKeano', 'HyperEmely', 'CayleMinogue', 'HyperKeano', 'Emely'], heightScale: 0.87, hp: 365, speed: 675, power: 130, styleId: 'KNEIPEN_TERRORIST', specialName: 'HELLFIRE METEOR', superName: 'IRON FLAME RECKONING', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'annikina', cutinFile: 'proj_annikina.png' },
    { id: 'Dom', folder: '20.Dom', name: '🥊 DOM 🥊', nickname: 'Sonic Matrix Striker', country: 'Cyber Matrix', special: true, stageId: 'Cyber_Matrix', unlockedBy: 'Emely', unlockedByAny: ['Emely', 'HyperEmely', 'Keano', 'JJDark', 'Lee'], heightScale: 0.94, hp: 350, speed: 640, power: 125, styleId: 'SONIC_STRIKER', specialName: 'SONIC MATRIX BOOM', superName: 'SOMERSAULT FLASH KICK', multiFrameAnim: true, hasWalkSprite: true, spritePrefix: 'dom', cutinFile: 'proj_dom.png' },
];
// Combined for easy iteration
export const ALL_FIGHTERS = [...ROSTER, ...SPECIALS];

export const UNLOCK_CHAIN_GUIDE = [
    { playId: 'Keano', unlockId: 'HyperKeano', desc: 'Story / Arcade mit Keano Romeo durchspielen' },
    { playId: 'HyperKeano', unlockId: 'SupremeKeano', desc: 'Story / Arcade mit Hyper Keano durchspielen' },
    { playId: 'JJDark', unlockId: 'JayX', desc: 'Story / Arcade mit JJ Dark (Jayden) durchspielen' },
    { playId: 'JayX', unlockId: 'Cayle', desc: 'Story / Arcade mit Jay X durchspielen' },
    { playId: 'Cayle', unlockId: 'CayleMinogue', desc: 'Story / Arcade mit Cayle durchspielen' },
    { playId: 'VikingoRaw', unlockId: 'Vikingo', desc: 'Story / Arcade mit Dark Vikingo durchspielen' },
    { playId: 'Vikingo', unlockId: 'Simba', desc: 'Story / Arcade mit Vikingo durchspielen' },
    { playId: 'Simba', unlockId: 'Emely', desc: 'Story / Arcade mit Simba durchspielen' },
    { playId: 'Emely', unlockId: 'HyperEmely', desc: 'Story / Arcade mit 🌸 Emy 🌸 durchspielen' },
    { playId: 'HyperEmely', unlockId: 'Annikina', desc: 'Mit Kinder-Weiterentwicklungen (Hyper-Emy / Supreme Keano) siegen!' },
    { playId: 'Gargamel', unlockId: 'GargamelHoodie', desc: 'Story / Arcade mit C. Gargamel durchspielen' },
    { playId: 'Emely', unlockId: 'Dom', desc: 'Story / Arcade mit 🌸 Emy 🌸 (seiner Freundin), Keano oder Jayden durchspielen' },
];

export function getFighterStyle(fighterOrId) {
    const f = typeof fighterOrId === 'string'
        ? ALL_FIGHTERS.find(x => x.id === fighterOrId)
        : fighterOrId;
    const styleKey = (f && f.styleId) || 'LIGHT_DRAGON';
    return FIGHT_STYLES[styleKey] || FIGHT_STYLES.LIGHT_DRAGON;
}
/**
 * STORY/ARCADE & VERSUS STAGES — all 22 Arenas keyed by stageId
 */
export const STAGES = {
    'Annikina_Pub': { file: '19_Annikina_Arena.png', music: '19_Annikina.mp3', name: 'Kneipenterroristen Grill' },
    'Cyber_Matrix': { file: '20_Dom_Cyber_Matrix.png', music: '11_Japan_Night.mp3', name: 'Cyber Matrix Core' },
    'Japan': { file: '1_Hattori_Japan.png', music: '1_Japan.mp3', name: 'Tokyo Temple' },
    'India': { file: '2_Raheel_India.png', music: '2_India.mp3', name: 'Ganges Palace' },
    'Brazil': { file: '3_Pablo_Brazil.png', music: '3_Brazil.mp3', name: 'Rio Favela' },
    'China': { file: '4_Tzubaza_China.png', music: '4_China.mp3', name: 'Forbidden City' },
    'Italy': { file: '5_Al_Capone_Italy.png', music: '5_Italy.mp3', name: 'Colosseum Rome' },
    'Germany': { file: '6_C_Gargamel_Germany.png', music: '6_Germany.mp3', name: 'Berlin Wall' },
    'Jamaica': { file: '7_Jamaica.png', music: '7_Jamaica.mp3', name: 'Kingston Beach' },
    'Poland': { file: '8_Kowalski_Poland.png', music: '8_Poland.mp3', name: 'Warsaw Arena' },
    'Mexico': { file: '9_Paco_El_Taco_Mexico.png', music: '9_Mexico.mp3', name: 'Aztec Ruins' },
    'Spain': { file: '10_Juan_Spain.png', music: '10_Spain.mp3', name: 'Barcelona Ring' },
    'Japan_Night': { file: '11_Lee_Japan.png', music: '11_Japan_Night.mp3', name: 'Tokyo Neon' },
    'Dojo': { file: '12_Jayden_Dojo.png', music: '12_Dojo_Dark.mp3', name: 'Shadow Dojo' },
    'Russia': { file: '13_Putin_Russia.png', music: '13_Russia_Ice.mp3', name: 'Siberian Frost' },
    'Valhalla': { file: '14_Dark Vikingo_Valhalla_Boss.png', music: 'main_soundtrack.mp3', name: 'Valhalla Gates' },
    'Supreme_Keano': { file: 'stage_Supreme_Keano.png', music: 'main_soundtrack.mp3', name: 'Supreme Ascendance' },
    'Canada': { file: 'Extra_Canada.png', music: 'main_soundtrack.mp3', name: 'Canada Arena' },
    'Colosseum': { file: 'Extra_Colosseum.png', music: '5_Italy.mp3', name: 'Gladiator Colosseum' },
    'France': { file: 'Extra_France.png', music: 'main_soundtrack.mp3', name: 'Paris Rooftops' },
    'UK': { file: 'Extra_UK.png', music: '6_Germany.mp3', name: 'London Underground' },
    'USA': { file: 'Extra_USA.png', music: '12_Dojo_Dark.mp3', name: 'New York Streets' },
};
/**
 * EXTRA STAGES — Versus Mode pool
 */
export const EXTRA_STAGES = [
    { file: '19_Annikina_Arena.png', name: 'Kneipenterroristen Grill' },
    { file: '20_Dom_Cyber_Matrix.png', name: 'Cyber Matrix Core' },
    { file: 'Extra_Canada.png', name: 'Canada Arena' },
    { file: 'Extra_Colosseum.png', name: 'Gladiator Colosseum' },
    { file: 'Extra_France.png', name: 'Paris Rooftops' },
    { file: 'Extra_UK.png', name: 'London Underground' },
    { file: 'Extra_USA.png', name: 'New York Streets' },
];
/**
 * BLOODLINE / PROGRESSION HELPERS
 */
export function syncJanBrowserUnlocks() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
    const host = window.location.hostname || '';
    const isJanLocal = (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local'));
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const hasJanParam = search.includes('jan=1') || hash.includes('jan');
    const hasAnnikaParam = search.includes('annika=1') || search.includes('annikina=1') || hash.includes('annika');
    const hasEmyParam = search.includes('emy=1') || search.includes('emely=1') || hash.includes('emy');
    const hasDomParam = search.includes('dom=1') || search.includes('dominik=1') || hash.includes('dom');

    if (hasEmyParam) {
        try {
            localStorage.removeItem('lotl_vip_jan');
            localStorage.removeItem('lotl_vip_annikina');
            localStorage.removeItem('lotl_vip_dom');
            localStorage.setItem('lotl_vip_emy', 'true');
            localStorage.setItem('lotl_story_complete', 'true');
            localStorage.setItem('unlock_Emely', 'true');
        } catch (e) {}
        return false;
    }

    if (hasDomParam) {
        try {
            localStorage.removeItem('lotl_vip_jan');
            localStorage.removeItem('lotl_vip_annikina');
            localStorage.removeItem('lotl_vip_emy');
            localStorage.setItem('lotl_vip_dom', 'true');
            localStorage.setItem('lotl_story_complete', 'true');
            localStorage.setItem('unlock_Dom', 'true');
        } catch (e) {}
        return false;
    }

    if ((isJanLocal && !localStorage.getItem('lotl_vip_emy') && !localStorage.getItem('lotl_vip_dom') && !localStorage.getItem('lotl_vip_annikina') && !localStorage.getItem('lotl_clean_progression')) || hasJanParam || localStorage.getItem('lotl_vip_jan') === 'true') {
        try {
            localStorage.setItem('lotl_vip_jan', 'true');
            localStorage.setItem('lotl_story_complete', 'true');
            for (const s of SPECIALS) {
                localStorage.setItem(`unlock_${s.id}`, 'true');
            }
        } catch (e) {}
        return true;
    }
    if (hasAnnikaParam || localStorage.getItem('lotl_vip_annikina') === 'true') {
        try {
            localStorage.setItem('lotl_vip_annikina', 'true');
            localStorage.setItem('lotl_story_complete', 'true');
            localStorage.setItem('unlock_Annikina', 'true');
        } catch (e) {}
    }
    if (localStorage.getItem('lotl_vip_emy') === 'true') {
        try {
            localStorage.setItem('lotl_story_complete', 'true');
            localStorage.setItem('unlock_Emely', 'true');
        } catch (e) {}
    }
    if (localStorage.getItem('lotl_vip_dom') === 'true') {
        try {
            localStorage.setItem('lotl_story_complete', 'true');
            localStorage.setItem('unlock_Dom', 'true');
        } catch (e) {}
    }
    return false;
}

// Run immediately on module load so Jan's browser has all fighters & modes unlocked right away
syncJanBrowserUnlocks();

export function isFighterUnlocked(id) {
    // Main roster is always unlocked
    if (ROSTER.find(f => f.id === id)) return true;
    if (syncJanBrowserUnlocks()) return true;
    // Check localStorage
    if (localStorage.getItem(`unlock_${id}`) === 'true') return true;
    // Special rule for Mama Annikina: automatically unlocked once the evolved children (SupremeKeano + HyperEmely) are unlocked!
    if (id === 'Annikina') {
        const hasEvolvedKeano = localStorage.getItem('unlock_SupremeKeano') === 'true' || localStorage.getItem('unlock_HyperKeano') === 'true';
        const hasEvolvedEmy = localStorage.getItem('unlock_HyperEmely') === 'true';
        if (hasEvolvedKeano && hasEvolvedEmy) {
            localStorage.setItem('unlock_Annikina', 'true');
            return true;
        }
    }
    return false;
}
export function unlockFighter(id) {
    // When playing as Annikina, beating Story/Arcade unlocks her children & family (Emy -> Hyper-Emy -> Dom -> Hyper Keano -> Supreme Keano)!
    if (id === 'Annikina') {
        const kidsChain = ['Emely', 'HyperEmely', 'Dom', 'HyperKeano', 'SupremeKeano'];
        for (const kidId of kidsChain) {
            if (!isFighterUnlocked(kidId)) {
                const kidObj = SPECIALS.find(s => s.id === kidId);
                if (kidObj) {
                    localStorage.setItem(`unlock_${kidObj.id}`, 'true');
                    return kidObj;
                }
            }
        }
    }
    // When playing as Dom, beating Story/Arcade unlocks his girlfriend Emy (or Hyper-Emy if Emy is already unlocked)!
    if (id === 'Dom') {
        const domChain = ['Emely', 'HyperEmely', 'Annikina'];
        for (const targetId of domChain) {
            if (!isFighterUnlocked(targetId)) {
                const targetObj = SPECIALS.find(s => s.id === targetId);
                if (targetObj) {
                    localStorage.setItem(`unlock_${targetObj.id}`, 'true');
                    return targetObj;
                }
            }
        }
    }
    // Primary match first (exact unlockedBy === id), then fallback to unlockedByAny
    let specialToUnlock = SPECIALS.find(s => !isFighterUnlocked(s.id) && s.unlockedBy === id);
    if (!specialToUnlock) {
        specialToUnlock = SPECIALS.find(s =>
            !isFighterUnlocked(s.id) &&
            Array.isArray(s.unlockedByAny) && s.unlockedByAny.includes(id)
        );
    }
    if (!specialToUnlock) return null; // No unlock for this fighter
    localStorage.setItem(`unlock_${specialToUnlock.id}`, 'true');
    return specialToUnlock; // Return who was just unlocked
}
