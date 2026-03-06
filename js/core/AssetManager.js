export default class AssetManager {
    constructor(game) {
        this.game = game;  // Reference to Game for settings access
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
                    // NOTE: Do NOT set crossOrigin for same-origin images (localhost).
                    // Python SimpleHTTP has no CORS headers → tainted canvas → getImageData fails!
                    img.onload = () => {
                        this.processChromaKey(img, item.key, () => {
                            this.loadedCount++;
                            if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                            resolve();
                        });
                    };
                    img.onerror = () => {
                        // Check if we queued a fallback image for this key
                        const fallbackKey = item.key + '_fallback';
                        const fallbackItem = this.queue.find(q => q.key === fallbackKey);

                        if (fallbackItem && !item.key.endsWith('_fallback')) {
                            console.log(`[AssetManager] Image ${item.path} not found. Attempting fallback: ${fallbackItem.path}`);
                            // We don't resolve the primary promise yet, the fallback will resolve it
                            // when the queue naturally gets to the fallbackItem.
                            this.loadedCount++;
                            if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                            resolve();
                        } else {
                            // If it's already a fallback that failed or no fallback exists
                            console.warn(`[AssetManager] Failed to load image: ${item.path}`);
                            this.loadedCount++;
                            if (onProgressCallback) onProgressCallback(this.loadedCount / this.queue.length);
                            resolve(); // Resolve anyway so the game doesn't hang, but it will be a missing texture
                        }
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
     * Applies Background Removal using Edge-Sampling.
     * Samples border pixels to detect the background color, then removes
     * all matching pixels. Much safer than hardcoded thresholds.
     */
    processChromaKey(img, key, callback) {
        const k = key.toLowerCase();
        // Skip background stripping for UI elements, Stages, and Projectile Cut-ins
        if (k.startsWith('stage_') || k.startsWith('menu') || k.includes('cutin') || k.includes('caesar')) {
            this.images[key] = img;
            callback();
            return;
        }

        // BYPASS: Skip chroma key if disabled in settings
        if (this.game && this.game.settings && !this.game.settings.chromaKeyEnabled) {
            this.images[key] = img;
            callback();
            return;
        }

        console.log(`🎨 ChromaKey START: ${key} (${img.width}x${img.height})`);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.drawImage(img, 0, 0);
        let imgData;
        try {
            imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            console.log(`🎨 ChromaKey getImageData SUCCESS: ${key}`);
        } catch (e) {
            console.warn(`🔴 CORS BLOCKED getImageData: ${key}`, e.message);
            this.images[key] = img;
            callback();
            return;
        }

        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        // --- Step 1: Sample border pixels to find background color ---
        const borderPixels = [];
        const sampleDepth = Math.max(3, Math.floor(Math.min(w, h) * 0.03)); // 3% border

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // Only sample the border strip
                if (x >= sampleDepth && x < w - sampleDepth &&
                    y >= sampleDepth && y < h - sampleDepth) continue;

                const idx = (y * w + x) * 4;
                const a = data[idx + 3];
                if (a > 200) { // Only opaque border pixels
                    borderPixels.push({
                        r: data[idx],
                        g: data[idx + 1],
                        b: data[idx + 2]
                    });
                }
            }
        }

        // If no opaque border pixels found, image is already transparent (or background doesn't touch edges)
        if (borderPixels.length === 0) {
            console.log(`⏩ ChromaKey SKIPPED (No opaque border pixels): ${key}`);
            this.images[key] = img;
            callback();
            return;
        }

        // --- Step 2: Find the dominant border color ---
        let avgR = 0, avgG = 0, avgB = 0;
        let hasBorderColor = borderPixels.length > 0;

        if (hasBorderColor) {
            for (const p of borderPixels) {
                avgR += p.r;
                avgG += p.g;
                avgB += p.b;
            }
            avgR = Math.round(avgR / borderPixels.length);
            avgG = Math.round(avgG / borderPixels.length);
            avgB = Math.round(avgB / borderPixels.length);
        }

        // --- Step 3: Remove matching pixels ---
        const tolerance = 50;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue; // Already transparent

            // 0. GREEN SCREEN — AGGRESSIVE detection for any green background
            // Check if green is clearly the dominant color FIRST to prevent green halos
            if (g > r * 1.1 && g > b * 1.1 && g > 40) {
                data[i + 3] = 0;
                continue;
            }

            // PASS 1: Edge-sampling — remove pixels matching detected border color
            if (hasBorderColor) {
                const dr = r - avgR;
                const dg = g - avgG;
                const db = b - avgB;
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);

                if (dist < tolerance) {
                    data[i + 3] = 0;
                    continue;
                }
                if (dist < tolerance * 1.5) {
                    const alpha = Math.floor(((dist - tolerance) / (tolerance * 0.5)) * 255);
                    data[i + 3] = Math.min(a, alpha);
                    continue;
                }
            }

            // PASS 2: Proven brightness/saturation thresholds (original working values)
            // Even if the image has a transparent outer border, it might have a white box
            // in the middle of the image, so always check for pure white/grey.
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
            const brightness = (r + g + b) / 3;

            // 1. Pure white / near-white
            if (r >= 240 && g >= 240 && b >= 240) {
                data[i + 3] = 0;
            }
            // 2. Light grey, low saturation
            else if (brightness > 200 && saturation < 0.08) {
                data[i + 3] = 0;
            }
            // 3. Off-white / lighter grey
            else if (brightness > 170 && saturation < 0.20) {
                data[i + 3] = 0;
            }
            // 4. Medium grey
            else if (brightness > 130 && saturation < 0.15) {
                data[i + 3] = 0;
            }
            // 5. Darker neutral grey — feathered
            else if (brightness > 100 && saturation < 0.10) {
                data[i + 3] = Math.max(0, Math.min(a, Math.floor((130 - brightness) * 8)));
            }
        }

        ctx.putImageData(imgData, 0, 0);

        const newImg = new Image();
        newImg.onload = () => {
            if (key.includes('Cutin')) console.log(`✅ ChromaKey DONE for Projectile: ${key} (Size: ${newImg.width}x${newImg.height})`);
            this.images[key] = newImg;
            callback();
        };
        newImg.onerror = () => {
            console.error("❌ Failed to re-encode processed pixel data for:", key);
            this.images[key] = img;
            callback();
        };
        newImg.src = canvas.toDataURL();
    }
}
