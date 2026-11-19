import { STAGES } from '../data.js?v=2.53';

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
    'VikingoRaw': 'vikingo_raw',
    'Vikingo': 'vikingo',
    'SupremeKeano': 'supreme_keano',
    'HyperKeano': 'hyper_keano',
    'JayX': 'jay_x',
    'GargamelHoodie': 'gargamel_hoodie',
    'Simba': 'simba',
    'Emely': 'emely',
    'HyperEmely': 'hyper_emely',
    'Cayle': 'cayle',
    'CayleMinogue': 'cayle_minogue',
    'Annikina': 'annikina',
    'Dom': 'dom',
};

/**
 * Queue all combat sprites & projectile assets for a fighter.
 */
export function preloadFighterSprites(assetManager, char) {
    if (!assetManager || !char) return;
    // Queue core visible sprites FIRST so P1, Ally, and P2 (Enemy) are immediately visible on screen
    const coreSuffixes = [
        '_front', '_right', '_punch', '_kick', '_hit', '_ko', '_special', '_win'
    ];
    const extraSuffixes = [
        '_idle_2', '_left',
        '_walk', '_walk_1', '_walk_2',
        '_crouch', '_block', '_jump',
        '_windup_punch', '_mid_punch', '_hook_punch', '_uppercut', '_backfist', '_dragon_uppercut',
        '_windup_kick', '_mid_kick', '_low_kick', '_dive_kick', '_spin_kick', '_axe_kick', '_hurricane_kick'
    ];

    const ver = '?v=2.53';
    for (const suf of [...coreSuffixes, ...extraSuffixes]) {
        const key = `${char.id}${suf}.png`;
        if (!assetManager.images[key]) {
            assetManager.queueImage(key, `assets/CHARACTERS/${char.folder}/${suf}.png${ver}`);
        }
    }

    if (char.multiFrameAnim) {
        if ((char.cutinFile2 || char.id === 'SupremeKeano') && !assetManager.images[`${char.id}_Cutin2`]) {
            const proj2 = char.cutinFile2 || 'proj_supreme_keano_2.png';
            assetManager.queueImage(`${char.id}_Cutin2`, `assets/fx/char_projectiles/${proj2}${ver}`);
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

    // Pre-decode fighter voice clips into WebAudio buffer cache for zero-latency mobile playback
    const voicePrefix = AUDIO_MAP[char.id] || char.id.toLowerCase();
    const voiceClips = ['intro', 'hit', 'special', 'super', 'ko', 'win', 'taunt', 'select'];
    const audioMgr = assetManager.game ? assetManager.game.audioManager : null;
    for (const clip of voiceClips) {
        const vPath = `assets/audio/voice/${voicePrefix}_${clip}.mp3`;
        if (audioMgr && typeof audioMgr.preloadAudio === 'function') {
            audioMgr.preloadAudio(vPath);
        }
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
export function playAnnouncer(audioManager, type, onEndedCallback = null) {
    if (!audioManager) {
        if (onEndedCallback) onEndedCallback();
        return;
    }
    if (typeof audioManager.playAnnouncerVoice === 'function') {
        audioManager.playAnnouncerVoice(`assets/audio/voice/announcer_${type}.mp3`, onEndedCallback);
    } else {
        audioManager.playSFX(`assets/audio/voice/announcer_${type}.mp3`, true);
        if (onEndedCallback) setTimeout(onEndedCallback, 900);
    }
}

/**
 * Play character-specific voice/SFX line (hit, ko, special, win, intro, taunt, select, super)
 */
export function playFighterSound(audioManager, fighterId, type, onEndedCallback = null) {
    if (!audioManager || !fighterId) {
        if (onEndedCallback) onEndedCallback();
        return;
    }
    const prefix = AUDIO_MAP[fighterId] || fighterId.toLowerCase();
    if (typeof audioManager.playFighterVoice === 'function') {
        audioManager.playFighterVoice(`assets/audio/voice/${prefix}_${type}.mp3`, type, onEndedCallback);
    } else {
        audioManager.playSFX(`assets/audio/voice/${prefix}_${type}.mp3`, false);
        if (onEndedCallback) setTimeout(onEndedCallback, 1200);
    }
}

/**
 * Play combat impact / reaction sound
 */
export function playCombatSound(audioManager, type, charId, isHeavy = false, isSpecialHit = false) {
    if (!audioManager) return;
    if (type === 'hit') {
        if (typeof audioManager.playHitImpactSound === 'function') {
            audioManager.playHitImpactSound(isHeavy, isSpecialHit);
        }
        // Only play vocal hit grunt on heavy hits or 35% of light hits (with 850ms cooldown in AudioManager)
        if (isHeavy || Math.random() < 0.35) {
            playFighterSound(audioManager, charId, 'hit');
        }
    } else if (type === 'throw') {
        if (typeof audioManager.playThrowSound === 'function') {
            audioManager.playThrowSound();
        }
        playFighterSound(audioManager, charId, 'hit');
    } else if (type === 'ko') {
        if (typeof audioManager.playKOBoomSound === 'function') {
            audioManager.playKOBoomSound();
        } else if (typeof audioManager.playHitImpactSound === 'function') {
            audioManager.playHitImpactSound(true, true);
        }
        // Sequence cleanly: first fighter's short K.O. groan, then Announcer roars "K.O.!" so they never overlap!
        playFighterSound(audioManager, charId, 'ko', () => {
            playAnnouncer(audioManager, 'ko');
        });
    } else if (type === 'special') {
        playFighterSound(audioManager, charId, 'special');
    } else if (type === 'super') {
        playFighterSound(audioManager, charId, 'super');
    } else if (type === 'block') {
        audioManager.playBlockSound();
    }
}
