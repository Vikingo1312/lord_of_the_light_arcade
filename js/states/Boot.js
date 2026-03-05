export default class BootState {
    constructor(game) {
        this.game = game;
        this.engineReady = false;
        this.loaded = false;

        window.addEventListener('click', () => {
            if (!this.engineReady) {
                this.engineReady = true;
                this.game.start(); // Starts the loop rendering

                // Commence Asset Loading immediately so audio errors don't block it
                this.loadAssets();

                try {
                    this.playCapcomChord();
                } catch (e) {
                    console.warn("Audio block: ", e);
                }
            }
        }, { once: true });
    }

    async loadAssets() {
        console.log("Loading V2.0 Core Assets...");

        // Shared Background for Menu / Boot screen
        this.game.assetManager.queueImage('menuBg', 'assets/UI/UX_Cosmic_Shimmer.png');

        // Dynamically load ALL fighter portraits for the Character Select grid
        const { ALL_FIGHTERS, STAGES } = await import('../data.js');
        for (const char of ALL_FIGHTERS) {
            this.game.assetManager.queueImage(
                `${char.id}_front.png`,
                `assets/CHARACTERS/${char.folder}/_front.png`
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

        // Transition to Main Menu
        setTimeout(() => {
            this.game.stateManager.switchState('Menu');
        }, 1000);
    }

    playCapcomChord() {
        // Synthesize the famous "coin drop" A-Dur Chord
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const freqs = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        const dur = 1.5;

        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05); // quick attack
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); // long decay

            osc.connect(gain);
            gain.connect(ctx.destination);

            setTimeout(() => osc.start(ctx.currentTime), idx * 20); // Arpeggiate slightly
            osc.stop(ctx.currentTime + dur);
        });
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
            // Flash white when done
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
        }
    }
}
