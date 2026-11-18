export default class AssetManager {
    constructor(game) {
        this.game = game;  // Reference to Game for settings access
        this.images = {};
        this.audioBuffer = {};

        this.queue = [];
        this.loadingKeys = new Set();
        this.loadedCount = 0;
        this._activeLoadPromises = [];

        // Tiny 1x1 reusable canvas to inspect corner transparency without allocating 1024x1024 canvases
        this._probeCanvas = null;
        this._probeCtx = null;
    }

    queueImage(key, path) {
        if (!key || !path) return;
        if (this.images[key] || this.loadingKeys.has(key)) return;
        if (this.queue.some(item => item.key === key)) return;
        this.queue.push({ type: 'image', key, path });
    }

    queueAudio(key, path) {
        if (!key || !path) return;
        if (this.audioBuffer[key] || this.loadingKeys.has(key)) return;
        if (this.queue.some(item => item.key === key)) return;
        this.queue.push({ type: 'audio', key, path });
    }

    async loadAll(onProgressCallback) {
        if (this.queue.length === 0) {
            if (this._activeLoadPromises.length > 0) {
                await Promise.all(this._activeLoadPromises);
            }
            if (onProgressCallback) onProgressCallback(1);
            return Promise.resolve();
        }

        const currentQueue = [...this.queue];
        this.queue = [];
        let batchLoaded = 0;

        for (const item of currentQueue) {
            this.loadingKeys.add(item.key);
        }

        const batchPromise = Promise.all(currentQueue.map(item => {
            return new Promise((resolve) => {
                if (item.type === 'image') {
                    const img = new Image();
                    img.onload = () => {
                        // Store raw image immediately so a fighter is NEVER invisible even while/if chroma-keying runs
                        this.images[item.key] = img;
                        this.processChromaKey(img, item.key, () => {
                            this.loadingKeys.delete(item.key);
                            batchLoaded++;
                            this.loadedCount++;
                            if (onProgressCallback) onProgressCallback(batchLoaded / currentQueue.length);
                            resolve();
                        });
                    };
                    img.onerror = () => {
                        this.loadingKeys.delete(item.key);
                        const fallbackKey = item.key + '_fallback';
                        const fallbackItem = currentQueue.find(q => q.key === fallbackKey);

                        if (fallbackItem && !item.key.endsWith('_fallback')) {
                            batchLoaded++;
                            if (onProgressCallback) onProgressCallback(batchLoaded / currentQueue.length);
                            resolve();
                        } else {
                            if (!item.key.endsWith('_fallback')) {
                                console.warn(`[AssetManager] Failed to load image: ${item.path}`);
                            }
                            batchLoaded++;
                            if (onProgressCallback) onProgressCallback(batchLoaded / currentQueue.length);
                            resolve();
                        }
                    };
                    // Avoid malformed double "?v=2.51?v=..." URLs and allow session caching
                    img.src = item.path.includes('?') ? item.path : `${item.path}?v=2.51`;
                } else if (item.type === 'audio') {
                    this.audioBuffer[item.key] = true;
                    let settled = false;
                    const finishAudio = () => {
                        if (settled) return;
                        settled = true;
                        this.loadingKeys.delete(item.key);
                        batchLoaded++;
                        this.loadedCount++;
                        if (onProgressCallback) onProgressCallback(batchLoaded / currentQueue.length);
                        resolve();
                    };
                    const timer = setTimeout(finishAudio, 2500);
                    if (this.game && this.game.audioManager && typeof this.game.audioManager.preloadAudio === 'function') {
                        this.game.audioManager.preloadAudio(item.path)
                            .then(() => { clearTimeout(timer); finishAudio(); })
                            .catch(() => { clearTimeout(timer); finishAudio(); });
                    } else {
                        clearTimeout(timer);
                        finishAudio();
                    }
                }
            });
        }));

        this._activeLoadPromises.push(batchPromise);
        try {
            await Promise.all(this._activeLoadPromises);
        } finally {
            this._activeLoadPromises = this._activeLoadPromises.filter(p => p !== batchPromise);
        }
    }

    /**
     * Fast corner alpha probe using a single shared 4x1 canvas (0 MB memory overhead).
     * Returns true if the 4 extreme corners of the image are already transparent.
     */
    _areCornersTransparent(img) {
        try {
            if (!this._probeCanvas) {
                this._probeCanvas = document.createElement('canvas');
                this._probeCanvas.width = 4;
                this._probeCanvas.height = 1;
                this._probeCtx = this._probeCanvas.getContext('2d', { willReadFrequently: true });
            }
            const ctx = this._probeCtx;
            if (!ctx) return true;
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (!w || !h) return true;

            ctx.clearRect(0, 0, 4, 1);
            ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
            ctx.drawImage(img, w - 1, 0, 1, 1, 1, 0, 1, 1);
            ctx.drawImage(img, 0, h - 1, 1, 1, 2, 0, 1, 1);
            ctx.drawImage(img, w - 1, h - 1, 1, 1, 3, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 4, 1).data;
            // If all 4 extreme corner pixels are transparent, the PNG already has its alpha channel!
            return (d[3] < 40 && d[7] < 40 && d[11] < 40 && d[15] < 40);
        } catch (e) {
            return true;
        }
    }

    /**
     * Applies Background Removal ONLY if the image actually has an opaque background at its corners.
     * Pre-cleaned RGBA character sprites skip full-canvas processing immediately —
     * preserving white/grey clothing details and using 0 MB of iOS Safari canvas memory!
     */
    processChromaKey(img, key, callback) {
        const k = key.toLowerCase();
        // Skip background stripping for UI elements, Stages, Portraits (_front), and Projectile Cut-ins
        if (k.startsWith('stage_') || k.startsWith('menu') || k.includes('cutin') || k.includes('caesar') || k.includes('_front')) {
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

        // FAST PATH: If the PNG already has transparent corners, DO NOT run destructive ChromaKey on clothes
        // and DO NOT allocate a 1024x1024 canvas!
        if (this._areCornersTransparent(img)) {
            this.images[key] = img;
            callback();
            return;
        }

        let canvas = null;
        try {
            canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                this.images[key] = img;
                callback();
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const w = canvas.width;
            const h = canvas.height;

            // Sample only the 2px outer perimeter for background color
            const borderPixels = [];
            for (let x = 0; x < w; x++) {
                for (const y of [0, 1, h - 2, h - 1]) {
                    const idx = (y * w + x) * 4;
                    if (data[idx + 3] > 200) {
                        borderPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
                    }
                }
            }

            if (borderPixels.length === 0) {
                canvas.width = 0;
                canvas.height = 0;
                this.images[key] = img;
                callback();
                return;
            }

            let avgR = 0, avgG = 0, avgB = 0;
            for (const p of borderPixels) {
                avgR += p.r;
                avgG += p.g;
                avgB += p.b;
            }
            avgR = Math.round(avgR / borderPixels.length);
            avgG = Math.round(avgG / borderPixels.length);
            avgB = Math.round(avgB / borderPixels.length);

            const tolerance = 42;
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a === 0) continue;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const dr = r - avgR, dg = g - avgG, db = b - avgB;
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                if (dist < tolerance) {
                    data[i + 3] = 0;
                } else if (dist < tolerance * 1.35) {
                    const alpha = Math.floor(((dist - tolerance) / (tolerance * 0.35)) * 255);
                    data[i + 3] = Math.min(a, alpha);
                }
            }

            ctx.putImageData(imgData, 0, 0);
            const dataUrl = canvas.toDataURL();
            // Immediately release WebKit canvas backing store memory!
            canvas.width = 0;
            canvas.height = 0;

            const newImg = new Image();
            newImg.onload = () => {
                if (newImg.width >= 10 && newImg.height >= 10) {
                    this.images[key] = newImg;
                } else {
                    this.images[key] = img;
                }
                callback();
            };
            newImg.onerror = () => {
                this.images[key] = img;
                callback();
            };
            newImg.src = dataUrl;
        } catch (e) {
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
            this.images[key] = img;
            callback();
        }
    }
}

