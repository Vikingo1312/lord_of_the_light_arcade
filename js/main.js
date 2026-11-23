import Game from './core/Game.js?v=2.73';
import BootState from './states/Boot.js?v=2.73';
import CaesarSplash from './states/CaesarSplash.js?v=2.73';
import MenuState from './states/Menu.js?v=2.73';
import CharacterSelectState from './states/CharacterSelect.js?v=2.73';
import CombatState from './states/Combat.js?v=2.73';
import StorySequence from './states/StorySequence.js?v=2.73';
import VersusIntro from './states/VersusIntro.js?v=2.73';
import OnlineLobbyState from './states/OnlineLobby.js?v=2.73';

// V2.0 Entry Point
window.onload = () => {
    console.log("🔥 Initializing LORD OF THE LIGHT V2.0 ENGINE 🔥");

    const canvas = document.getElementById('gameCanvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const game = new Game(canvas);
    window.__gameRef = game; // Expose for mobile hamburger menu

    // Register states
    game.stateManager.addState('Boot', new BootState(game));
    game.stateManager.addState('CaesarSplash', new CaesarSplash(game));
    game.stateManager.addState('Menu', new MenuState(game));
    game.stateManager.addState('CharSelect', new CharacterSelectState(game));
    game.stateManager.addState('Combat', new CombatState(game));
    game.stateManager.addState('Story', new StorySequence(game));
    game.stateManager.addState('VersusIntro', new VersusIntro(game));
    game.stateManager.addState('OnlineLobby', new OnlineLobbyState(game));

    // Start at Boot to preload massive assets
    game.stateManager.switchState('Boot');

    // Kickoff the loop
    game.start();
};
