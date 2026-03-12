/**
 * Master Roster Definition for LORD OF THE LIGHT I
 * 14 Opponents + Keano (Hero) = 15 Main Roster
 * Each fighter maps to their home stage
 */

// ─── MAIN ROSTER (Arcade/Story Mode Order) ───
// Keano is the hero. The 14 opponents follow in story order.
export const ROSTER = [
    { id: 'Keano', folder: '0.Keano', name: 'Keano Romeo', nickname: 'Lord of the Light', country: 'Universal', stageId: 'Japan', hp: 420, speed: 520, power: 100 },
    { id: 'Hattori', folder: '1.Hattori_Japan', name: 'Hattori', nickname: 'The Silent Blade', country: 'Japan', stageId: 'Japan', hp: 380, speed: 600, power: 90 },
    { id: 'Raheel', folder: '2.Raheel', name: 'Raheel', nickname: 'Desert Storm', country: 'India', stageId: 'India', hp: 400, speed: 500, power: 95 },
    { id: 'Pablo', folder: '3.Pablo', name: 'Pablo', nickname: 'Capoeira King', country: 'Brazil', stageId: 'Brazil', hp: 390, speed: 580, power: 85 },
    { id: 'Tzubaza', folder: '4.Tzubaza', name: 'Tzubaza', nickname: 'The Dragon', country: 'China', stageId: 'China', hp: 450, speed: 480, power: 110 },
    { id: 'AlCapone', folder: '5.Al_Capone', name: 'Al Capone', nickname: 'Mob Boss', country: 'Italy', stageId: 'Italy', hp: 460, speed: 450, power: 105 },
    { id: 'Gargamel', folder: '6.C_Gargamel', name: 'C. Gargamel', nickname: 'Dark Alchemist', country: 'Germany', stageId: 'Germany', hp: 410, speed: 490, power: 115 },
    { id: 'Marley', folder: '7.Marley_Jamaica', name: 'Marley', nickname: 'Rasta Warrior', country: 'Jamaica', stageId: 'Jamaica', hp: 390, speed: 550, power: 95 },
    { id: 'Kowalski', folder: '8.Kowalski_Poland', name: 'Kowalski', nickname: 'Iron Bear', country: 'Poland', stageId: 'Poland', hp: 500, speed: 400, power: 125 },
    { id: 'Paco', folder: '9.Paco_el_Taco', name: 'Paco el Taco', nickname: 'Lucha Libre', country: 'Mexico', stageId: 'Mexico', hp: 430, speed: 530, power: 90 },
    { id: 'Juan', folder: '10.Juan', name: 'Juan', nickname: 'Matador', country: 'Spain', stageId: 'Spain', hp: 400, speed: 560, power: 100 },
    { id: 'Lee', folder: '11.Lee', name: 'Lee', nickname: 'Fist of Fury', country: 'Japan', stageId: 'Japan_Night', hp: 380, speed: 650, power: 85 },
    { id: 'JJDark', folder: '12.JJ_Dark', name: 'JJ Dark', nickname: 'Shadow Master', country: 'Unknown', stageId: 'Dojo', hp: 440, speed: 580, power: 110 },
    { id: 'Putin', folder: '13.Putin', name: 'Putin', nickname: 'Cold War', country: 'Russia', stageId: 'Russia', hp: 550, speed: 380, power: 130 },
    { id: 'VikingoRaw', folder: '14.1.vikingo_shirtless', name: 'Dark Vikingo', nickname: 'God of War', country: 'Valhalla', stageId: 'Valhalla', hp: 600, speed: 600, power: 150 },
];

// ─── SPECIAL / SECRET CHARACTERS ───
// "unlockedBy" defines the Bloodline progression requirement (who you need to beat Arcade mode with)
export const SPECIALS = [
    { id: 'Vikingo', folder: '14.vikingo_coat', name: 'Vikingo', nickname: 'The Creator', country: 'Valhalla', special: true, stageId: 'Canada', unlockedBy: 'VikingoRaw', hp: 650, speed: 650, power: 160 },
    { id: 'SupremeKeano', folder: '0.1.Supreme_Keano', name: 'Supreme Keano', nickname: 'Ascended Hero', country: 'Ascended', special: true, stageId: 'Japan', unlockedBy: 'HyperKeano', hp: 600, speed: 600, power: 140, portrait: 'assets/UI/clean_supreme_keano.png' },
    { id: 'HyperKeano', folder: '0.2.Hyper_Keano', name: 'Hyper Keano', nickname: 'Vengeful Hero', country: 'Beyond', special: true, stageId: 'Japan', unlockedBy: 'Keano', hp: 500, speed: 650, power: 120, portrait: 'assets/UI/clean_hyper_keano.png' },
    { id: 'JayX', folder: '12.1.Jay_X', name: 'Jay X', nickname: 'Neon Shadow', country: 'Shadow', special: true, stageId: 'Dojo', unlockedBy: 'JJDark', hp: 480, speed: 700, power: 100 },
    { id: 'GargamelHoodie', folder: '6.1.C_Gargamel_Hoodie', name: 'Gargamel Hoodie', nickname: 'Street Chemist', country: 'Germany', special: true, stageId: 'Germany', unlockedBy: 'Gargamel', hp: 450, speed: 520, power: 120 },
    { id: 'Simba', folder: '16.Simba', name: 'Simba', nickname: 'Lion King', country: 'Serengeti', special: true, stageId: 'Jamaica', unlockedBy: 'Vikingo', hp: 580, speed: 620, power: 145 },
];

// Combined for easy iteration
export const ALL_FIGHTERS = [...ROSTER, ...SPECIALS];

/**
 * STORY/ARCADE STAGES — one per opponent, keyed by stageId
 */
export const STAGES = {
    'Japan': { file: '1_Hattori_Japan.png', music: '1_Japan.mp3', name: 'Tokyo Temple' },
    'India': { file: '2_Raheel_India.png', music: '2_India.mp3', name: 'Ganges Palace' },
    'Brazil': { file: '3_Pablo_Brazil.png', music: '3_Brazil.mp3', name: 'Rio Favela' },
    'China': { file: '4_Tzubaza_China.png', music: '4_China.mp3', name: 'Forbidden City' },
    'Italy': { file: '5_Al_Capone_Italy.png', music: '5_Italy.mp3', name: 'Colosseum' },
    'Germany': { file: '6_C_Gargamel_Germany.png', music: '6_Germany.mp3', name: 'Berlin Wall' },
    'Jamaica': { file: '7_Jamaica.png', music: '7_Jamaica.mp3', name: 'Kingston Beach' },
    'Poland': { file: '8_Kowalski_Poland.png', music: '8_Poland.mp3', name: 'Warsaw Arena' },
    'Mexico': { file: '9_Paco_El_Taco_Mexico.png', music: '9_Mexico.mp3', name: 'Aztec Ruins' },
    'Spain': { file: '10_Juan_Spain.png', music: '10_Spain.mp3', name: 'Barcelona Ring' },
    'Japan_Night': { file: '11_Lee_Japan.png', music: '11_Japan_Night.mp3', name: 'Tokyo Neon' },
    'Dojo': { file: '12_Jayden_Dojo.png', music: '12_Dojo_Dark.mp3', name: 'Shadow Dojo' },
    'Russia': { file: '13_Putin_Russia.png', music: '13_Russia_Ice.mp3', name: 'Siberian Frost' },
    'Valhalla': { file: '14_Dark Vikingo_Valhalla_Boss.png', music: 'main_soundtrack.mp3', name: 'Valhalla Gates' },
    'Canada': { file: 'Extra_Canada.png', music: 'main_soundtrack.mp3', name: 'Canada Arena' },
};

/**
 * EXTRA STAGES — Versus Mode only (random pool)
 */
export const EXTRA_STAGES = [
    { file: 'Extra_Canada.png', name: 'Canada Arena' },
    { file: 'Extra_Colosseum.png', name: 'Gladiator Colosseum' },
    { file: 'Extra_France.png', name: 'Paris Rooftops' },
    { file: 'Extra_UK.png', name: 'London Underground' },
    { file: 'Extra_USA.png', name: 'New York Streets' },
];

/**
 * BLOODLINE / PROGRESSION HELPERS
 */
export function isFighterUnlocked(id) {
    // Main roster is always unlocked
    if (ROSTER.find(f => f.id === id)) return true;

    // V21 FIX: Unlock requested special characters for the user
    if (id === 'SupremeKeano' || id === 'HyperKeano') return true;

    // Check localStorage
    const saved = localStorage.getItem(`unlock_${id}`);
    return saved === 'true';
}

export function unlockFighter(id) {
    // If they beat the game with a specific character, unlock the next in their bloodline
    const specialToUnlock = SPECIALS.find(s => s.unlockedBy === id);
    if (!specialToUnlock) return null; // No unlock for this fighter

    if (!isFighterUnlocked(specialToUnlock.id)) {
        localStorage.setItem(`unlock_${specialToUnlock.id}`, 'true');
        return specialToUnlock; // Return who was just unlocked
    }
    return null; // Already unlocked
}
