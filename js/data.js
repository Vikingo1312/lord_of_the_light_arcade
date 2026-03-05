/**
 * Master Roster Definition for LORD OF THE LIGHT I
 * 14 Opponents + Keano (Hero) = 15 Main Roster
 * Each fighter maps to their home stage
 */

// ─── MAIN ROSTER (Arcade/Story Mode Order) ───
// Keano is the hero. The 14 opponents follow in story order.
export const ROSTER = [
    { id: 'Keano', folder: '0.Keano', name: 'Keano Romeo', country: 'Universal', stageId: 'Cosmic' },
    { id: 'Hattori', folder: '1.Hattori_Japan', name: 'Hattori', country: 'Japan', stageId: 'Japan' },
    { id: 'Raheel', folder: '2.Raheel', name: 'Raheel', country: 'India', stageId: 'India' },
    { id: 'Pablo', folder: '3.Pablo', name: 'Pablo', country: 'Brazil', stageId: 'Brazil' },
    { id: 'Tzubaza', folder: '4.Tzubaza', name: 'Tzubaza', country: 'China', stageId: 'China' },
    { id: 'AlCapone', folder: '5.Al_Capone', name: 'Al Capone', country: 'Italy', stageId: 'Italy' },
    { id: 'Gargamel', folder: '6.C_Gargamel', name: 'C. Gargamel', country: 'Germany', stageId: 'Germany' },
    { id: 'Marley', folder: '7.Marley_Jamaica', name: 'Marley', country: 'Jamaica', stageId: 'Jamaica' },
    { id: 'Kowalski', folder: '8.Kowalski_Poland', name: 'Kowalski', country: 'Poland', stageId: 'Poland' },
    { id: 'Paco', folder: '9.Paco_el_Taco', name: 'Paco el Taco', country: 'Mexico', stageId: 'Mexico' },
    { id: 'Juan', folder: '10.Juan', name: 'Juan', country: 'Spain', stageId: 'Spain' },
    { id: 'Lee', folder: '11.Lee', name: 'Lee', country: 'Japan', stageId: 'JapanNight' },
    { id: 'JJDark', folder: '12.JJ_Dark', name: 'JJ Dark', country: 'Unknown', stageId: 'Dojo' },
    { id: 'Putin', folder: '13.Putin', name: 'Putin', country: 'Russia', stageId: 'Russia' },
    { id: 'VikingoRaw', folder: '14.1.vikingo_shirtless', name: 'Dark Vikingo', country: 'Valhalla', stageId: 'Valhalla' },
];

// ─── SPECIAL / SECRET CHARACTERS ───
export const SPECIALS = [
    { id: 'Vikingo', folder: '14.vikingo_coat', name: 'Vikingo', country: 'Valhalla', special: true, stageId: 'Canada' },
    { id: 'SupremeKeano', folder: '0.1.Supreme_Keano', name: 'Supreme Keano', country: 'Ascended', special: true, stageId: 'Cosmic' },
    { id: 'HyperKeano', folder: '0.2.Hyper_Keano', name: 'Hyper Keano', country: 'Beyond', special: true, stageId: 'Cosmic' },
    { id: 'JayX', folder: '12.1.Jay_X', name: 'Jay X', country: 'Shadow', special: true, stageId: 'Dojo' },
    { id: 'GargamelHoodie', folder: '6.1.C_Gargamel_Hoodie', name: 'Gargamel Hoodie', country: 'Germany', special: true, stageId: 'Germany' },
    { id: 'Simba', folder: '16.Simba', name: 'Simba', country: 'Serengeti', special: true, stageId: 'Jamaica' },
];

// Combined for easy iteration
export const ALL_FIGHTERS = [...ROSTER, ...SPECIALS];

/**
 * STORY/ARCADE STAGES — one per opponent, keyed by stageId
 */
export const STAGES = {
    'Cosmic': { file: '1_Hattori_Japan.png', music: 'main_soundtrack.mp3', name: 'Cosmic Portal' },
    'Japan': { file: '1_Hattori_Japan.png', music: '1_Japan.mp3', name: 'Tokyo Temple' },
    'India': { file: '2_Raheel_India.png', music: '2_India.mp3', name: 'Ganges Palace' },
    'Brazil': { file: '3_Pablo_Brazil.png', music: '3_Brazil.mp3', name: 'Rio Favela' },
    'China': { file: '4_Tzubaza_China.png', music: '4_China.mp3', name: 'Forbidden City' },
    'Italy': { file: '5_Al_Capone_Italy.png', music: '5_Italy.mp3', name: 'Colosseum' },
    'Germany': { file: '6_C_Gargamel_Germany.png', music: '6_Germany.mp3', name: 'Berlin Wall' },
    'Jamaica': { file: '7_Marley_Jamaica.png', music: '7_Jamaica.mp3', name: 'Kingston Beach' },
    'Poland': { file: '8_Kowalski_Poland.png', music: '8_Poland.mp3', name: 'Warsaw Arena' },
    'Mexico': { file: '9_Paco_El_Taco_Mexico.png', music: '9_Mexico.mp3', name: 'Aztec Ruins' },
    'Spain': { file: '10_Juan_Spain.png', music: '10_Spain.mp3', name: 'Barcelona Ring' },
    'JapanNight': { file: '11_Lee_Japan.png', music: '11_Japan_Night.mp3', name: 'Edo Moonlight' },
    'Dojo': { file: '12_Jayden_Dojo.png', music: '12_Dojo_Dark.mp3', name: 'Shadow Dojo' },
    'Russia': { file: '13_Putin_Russia.png', music: '13_Russia_Ice.mp3', name: 'Siberian Frost' },
    'Valhalla': { file: '14_Dark Vikingo_Valhalla_Boss.png', music: 'Main_soundtrack.wav', name: 'Valhalla Gates' },
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
