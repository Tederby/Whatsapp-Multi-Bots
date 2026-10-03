/**
 * Media Conversion Concurrency Queue
 *
 * Limits concurrent FFmpeg conversion processes to prevent
 * CPU spikes and RAM exhaustion on VPS servers.
 */

class MediaQueue {
    constructor(maxConcurrent = 2) {
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        /** @type {{ resolve: Function, reject: Function }[]} */
        this.queue = [];
    }

    /**
     * Acquire a slot in the queue.
     * @returns {Promise<{ position: number }>}
     *   position = 0 means immediate execution; > 0 means queued position.
     */
    acquire() {
        if (this.active < this.maxConcurrent) {
            this.active++;
            return Promise.resolve({ position: 0 });
        }
        const position = this.queue.length + 1;
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve: () => resolve({ position }), reject });
        });
    }

    /**
     * Release an active slot and awaken next waiter.
     */
    release() {
        this.active = Math.max(0, this.active - 1);
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.active++;
            next.resolve({ position: 0 });
        }
    }

    /**
     * Helper to run an async operation safely within a concurrency slot.
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    async run(task) {
        await this.acquire();
        try {
            return await task();
        } finally {
            this.release();
        }
    }

    get pending() {
        return this.queue.length;
    }

    get running() {
        return this.active;
    }
}

export const mediaQueue = new MediaQueue(2);
export default mediaQueue;
