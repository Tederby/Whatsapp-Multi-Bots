/**
 * Global Download Queue
 *
 * Limits concurrent yt-dlp downloads to prevent resource exhaustion.
 * Callers `acquire()` a slot before downloading and `release()` when done.
 */

import setting from "../setting.js";

class DownloadQueue {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        /** @type {{ resolve: Function, reject: Function }[]} */
        this.queue = [];
    }

    /**
     * Acquire a download slot.  Resolves immediately if a slot is free,
     * otherwise waits until one becomes available.
     *
     * @returns {Promise<{ position: number }>}
     *   position = 0 means the slot was free; > 0 means queued.
     */
    acquire() {
        if (this.active < this.maxConcurrent) {
            this.active++;
            return Promise.resolve({ position: 0 });
        }
        const position = this.queue.length + 1;
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve: () => resolve({ position: 0 }), reject });
        });
    }

    /** Release a slot and wake the next waiter if any. */
    release() {
        this.active = Math.max(0, this.active - 1);
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.active++;
            next.resolve();
        }
    }

    /** Current queue length (waiters only, not active). */
    get pending() {
        return this.queue.length;
    }

    /** Number of active downloads right now. */
    get running() {
        return this.active;
    }
}

export const downloadQueue = new DownloadQueue(
    setting.ytdlp?.maxConcurrent || 4
);
