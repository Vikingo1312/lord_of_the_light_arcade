import { STAGES } from '../data.js';

const AUDIO_MAP = {
    'Keano': 'keano',
    'Hattori': 'hattori',
    'Raheel': 'raheel',
    'Pablo': 'pablo',
    'Tzubaza': 'tzubaza',
    'AlCapone': 'alcapone',
    'Gargamel': 'gargamel',
    'Marley': 'marley',
    'Kowalski': 'kowalski',
    'Paco': 'paco',
    'Juan': 'juan',
    'Lee': 'lee',
    'JJDark': 'jayden',
    'Putin': 'putin',
    'VikingoRaw': 'vikingo',
    'Vikingo': 'vikingo',
    'SupremeKeano': 'keano',
    'HyperKeano': 'keano',
    'JayX': 'jayden',
    'GargamelHoodie': 'gargamel',
    'Simba': 'keano',
};

/**
 * Queue all combat sprites & projectile assets for a fighter.
 */
export function preloadFighterSprites(assetManager, char) {
    if (!assetManager || !char) return;
    const pfx = char.spritePrefix || char.id.toLowerCase();
    const suffixes = ['_right', '_left', '_front', '_punch', '_kick', '_hit', '_ko', '_special', '_win'];

    for (const suf of suffixes) {
        const key = `${char.id}${suf}.png`;
        if (!assetManager.images[key]) {
            assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${suf}.png`);
            assetManager.queueImage(`${key}_fallback`, `assets/CHARACTERS/${char.folder}/${pfx}${suf}.png`);
        }
    }

    if (char.multiFrameAnim) {
        const extraFrames = ['dive_kick', 'low_kick', 'hook_punch'];
        for (const frame of extraFrames) {
            const key = `${char.id}_${char.spritePrefix}_${frame}`;
            if (!assetManager.images[key]) {
                assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${char.spritePrefix}_${frame}.png`);
            }
        }
        if (!assetManager.images[`${char.id}_Cutin2`]) {
            const proj2 = char.cutinFile2 || 'proj_supreme_keano_2.png';
            assetManager.queueImage(`${char.id}_Cutin2`, `assets/fx/char_projectiles/${proj2}`);
        }
    }

    if (char.animations) {
        for (const animKey of Object.keys(char.animations)) {
            const anim = char.animations[animKey];
            if (anim && anim.frames) {
                for (const frame of anim.frames) {
                    const key = `${char.id}_${frame}.png`;
                    if (!assetManager.images[key]) {
                        assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${frame}.png`);
                    }
                }
            }
        }
    }

    const projFile = char.cutinFile || `proj_${char.id.toLowerCase()}.png`;
    const cutinKey = `${char.id}_Cutin`;
    if (!assetManager.images[cutinKey]) {
        assetManager.queueImage(cutinKey, `assets/fx/char_projectiles/${projFile}`);
    }
}

/**
 * Queue background image and music for a stage.
 */
export function preloadStageAssets(assetManager, stageId) {
    if (!assetManager || !stageId) return;
    const stage = STAGES[stageId];
    if (!stage) return;

    const stageKey = `Stage_${stageId}`;
    if (!assetManager.images[stageKey]) {
        assetManager.queueImage(stageKey, `assets/STAGES/${stage.file}`);
    }
    if (stage.music) {
        const musicPath = `assets/audio/music/${stage.music}`;
        if (!assetManager.audioBuffer[musicPath]) {
            assetManager.queueAudio(musicPath, musicPath);
        }
    }
}

/**
 * Play announcer voice line (round_1, fight, ko, perfect, select, etc.)
 */
export function playAnnouncer(audioManager, type) {
    if (!audioManager) return;
    audioManager.playSFX(`assets/audio/voice/announcer_${type}.mp3`, true);
}

/**
 * Play character-specific voice/SFX line (hit, ko, special, win, intro, taunt, select, super)
 */
export function playFighterSound(audioManager, fighterId, type) {
    if (!audioManager || !fighterId) return;
    const prefix = AUDIO_MAP[fighterId] || fighterId.toLowerCase();
    audioManager.playSFX(`assets/audio/voice/${prefix}_${type}.mp3`, false);
}

/**
 * Play combat impact / reaction sound
 */
export function playCombatSound(audioManager, type, charId) {
    if (!audioManager) return;
    if (type === 'hit') {
        playFighterSound(audioManager, charId, 'hit');
    } else if (type === 'ko') {
        playFighterSound(audioManager, charId, 'ko');
        playAnnouncer(audioManager, 'ko');
    } else if (type === 'special') {
        playFighterSound(audioManager, charId, 'special');
    } else if (type === 'block') {
        audioManager.playBlockSound();
    }
}
