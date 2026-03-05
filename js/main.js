import Game from './core/Game.js';
import BootState from './states/Boot.js';
import MenuState from './states/Menu.js';
import CharacterSelectState from './states/CharacterSelect.js';
import CombatState from './states/Combat.js';
import StorySequence from './states/StorySequence.js';
import VersusIntro from './states/VersusIntro.js';

// V2.0 Entry Point
window.onload = () => {
    console.log("🔥 Initializing LORD OF THE LIGHT V2.0 ENGINE 🔥");

    const canvas = document.getElementById('gameCanvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const game = new Game(canvas);

    // Register states
    game.stateManager.addState('Boot', new BootState(game));
    game.stateManager.addState('Menu', new MenuState(game));
    game.stateManager.addState('CharSelect', new CharacterSelectState(game));
    game.stateManager.addState('Combat', new CombatState(game));
    game.stateManager.addState('Story', new StorySequence(game));
    game.stateManager.addState('VersusIntro', new VersusIntro(game));

    // Start at Boot to preload massive assets
    game.stateManager.switchState('Boot');

    // Kickoff the loop
    game.start();
};
