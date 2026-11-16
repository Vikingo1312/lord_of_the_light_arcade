export default class BootState {
    constructor(game) {
        this.game = game;
        this.engineReady = false;
        this.loaded = false;
        // Start engine on first interaction (click, touchend, pointerup, touchstart, or keydown for iPhone/iPad/Android/Desktop)
        const startEngine = () => {
            this.game.audioManager._initWebAudio();
            this.game.audioManager.unlockAudio();
            if (!this.engineReady) {
                this.engineReady = true;
                this.game.start();
                this.game.audioManager.preloadCoreAudio();
                this.loadAssets();
            }
        };
        ['touchend', 'pointerup', 'click', 'keydown', 'touchstart'].forEach((evt) => {
            window.addEventListener(evt, startEngine, { once: true, passive: true });
        });
    }

    async loadAssets() {
        console.log("Loading V2.20 Core Assets...");

        // Shared Background for Menu / Boot screen
        this.game.assetManager.queueImage('menuBg', 'assets/UI/UX_Cosmic_Shimmer.png');

        // Premium Intro Logo
        this.game.assetManager.queueImage('caesar_logo', 'assets/UI/caesar_logo.png?v=2.35');

        // Dynamically load ALL fighter portraits for the Character Select grid
        const { ALL_FIGHTERS, STAGES } = await import('../data.js');
        for (const char of ALL_FIGHTERS) {
            this.game.assetManager.queueImage(
                `${char.id}_front.png`,
                `assets/CHARACTERS/${char.folder}/_front.png?v=2.28`
            );
        }

        // Preload ALL stage backgrounds
        for (const [stageId, stage] of Object.entries(STAGES)) {
            this.game.assetManager.queueImage(
                `Stage_${stageId}`,
                `assets/STAGES/${stage.file}`
            );
        }

        await this.game.assetManager.loadAll((progress) => {
            this.loadProgress = progress;
        });

        this.loaded = true;

        // Transition to the Premium Caesar Engine Splash Screen securely
        setTimeout(() => {
            this.game.stateManager.switchState('CaesarSplash');
        }, 800);
    }

    update(dt) {
        // Nothing heavy to update on boot screen besides waiting
    }

    draw(ctx) {
        // Render Cosmic Portal Background if it exists, otherwise plain color
        const bg = this.game.assetManager.images['menuBg'];

        if (!this.engineReady) {
            ctx.fillStyle = '#110022';
            ctx.fillRect(0, 0, this.game.width, this.game.height);

            ctx.fillStyle = '#ff00ff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px "Press Start 2P"';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 20;
            ctx.fillText("CLICK TO START ENGINE", this.game.width / 2, this.game.height / 2);
        } else if (!this.loaded) {
            // Loading Screen (Show portal if loaded, with dark overlay)
            if (bg) {
                ctx.drawImage(bg, 0, 0, this.game.width, this.game.height);
                ctx.fillStyle = 'rgba(10, 0, 17, 0.7)'; // Dark wash so text pops
            } else {
                ctx.fillStyle = '#0a0011';
            }
            ctx.fillRect(0, 0, this.game.width, this.game.height);

            ctx.fillStyle = '#00ffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 40px "Press Start 2P"';
            let pct = Math.floor((this.loadProgress || 0) * 100);
            ctx.fillText(`LOADING ASSETS... ${pct}%`, this.game.width / 2, this.game.height / 2);
        } else {
            // Clean black before Caesar Splash
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }
    }
}
