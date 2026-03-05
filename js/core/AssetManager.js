export default class AssetManager {
    constructor() {
        this.images = {};
        this.audioBuffer = {};

        this.queue = [];
        this.loadedCount = 0;
    }

    queueImage(key, path) {
        this.queue.push({ type: 'image', key, path });
    }

    queueAudio(key, path) {
        this.queue.push({ type: 'audio', key, path });
    }

    async loadAll(onProgressCallback) {
        if (this.queue.length === 0) return Promise.resolve();

        const promises = this.queue.map(item => {
            return new Promise((resolve, reject) => {
                if (item.type === 'image') {
                    const img = new Image();
                    img.crossOrigin = "Anonymous"; // In case we serve from external
                    img.onload = () => {
                        this.processChromaKey(img, item.key, () => {
                            this.loadedCount++;
                            if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                            resolve();
                        });
                    };
                    img.onerror = () => {
                        console.error(`Failed to load image: ${item.path}`);
                        this.loadedCount++;
                        if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                        resolve();
                    };
                    img.src = item.path + '?v=' + Date.now(); // Cache buster
                } else if (item.type === 'audio') {
                    const aud = new Audio();
                    aud.oncanplaythrough = () => {
                        this.audioBuffer[item.key] = aud;
                        this.loadedCount++;
                        if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                        resolve();
                        aud.oncanplaythrough = null;
                    };
                    aud.onerror = () => {
                        console.warn(`Failed to pre-load audio: ${item.path}`);
                        resolve();
                    };
                    aud.src = item.path;
                    aud.load();
                }
            });
        });

        await Promise.all(promises);
    }

    /**
     * Applies Chroma Keying (Background Removal) using the Canvas API.
     * Removes purely white/bright backgrounds and extremely dark non-character pixels typical of AI cards.
     */
    processChromaKey(img, key, callback) {
        const k = key.toLowerCase();
        // Skip background stripping if it's a UI element or Stage
        if (k.startsWith('stage_') || k.startsWith('menu')) {
            this.images[key] = img;
            callback();
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.drawImage(img, 0, 0);
        let imgData;
        try {
            imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            // Tainted canvas (CORS issue), fallback to raw image
            console.warn("CORS prevented Chroma Key on: " + key);
            this.images[key] = img;
            callback();
            return;
        }

        const data = imgData.data;

        // Background removal: white, light gray, medium gray, dark gray
        // And now an extremely aggressive check for the "gray square" artifact on _hit images
        const isHitSprite = key.includes('_hit.png') || key.includes('_ko.png');

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
            const brightness = (r + g + b) / 3;

            // Pure white / bright backgrounds (AI card borders)
            if (r > 210 && g > 210 && b > 210) {
                data[i + 3] = 0;
            }
            // Light gray with low saturation (typical card backgrounds)
            else if (brightness > 180 && saturation < 0.15) {
                data[i + 3] = 0;
            }
            // Medium gray — slightly darker card edges / AI generated backgrounds
            else if (brightness > 120 && saturation < 0.15) {
                data[i + 3] = 0;
            }
            // Dark gray box artifacting (very low saturation, often found on _hit AI generations)
            else if (brightness > 60 && saturation < 0.10) {
                if (isHitSprite) {
                    // Aggressive cut for hit/ko sprites which have these stubborn boxes
                    data[i + 3] = 0;
                } else {
                    // Gradual fade for other sprites to avoid cutting into dark hair/clothes
                    data[i + 3] = Math.max(0, Math.floor((120 - brightness) * 4));
                }
            }
            // Green screen chroma key
            else if (r < 80 && g > 180 && b < 80) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        const newImg = new Image();
        newImg.onload = () => {
            this.images[key] = newImg;
            callback();
        };
        newImg.onerror = () => {
            console.error("Failed to re-encode processed pixel data for:", key);
            this.images[key] = img; // Fallback to raw unkeyed image
            callback();
        };
        newImg.src = canvas.toDataURL();
    }
}
