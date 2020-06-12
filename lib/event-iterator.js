"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventQueue {
    constructor() {
        this.pullQueue = [];
        this.pushQueue = [];
        this.eventHandlers = {};
        this.isPaused = false;
    }
    push(value) {
        const resolution = { value, done: false };
        if (this.pullQueue.length) {
            const placeholder = this.pullQueue.shift();
            if (placeholder)
                placeholder.resolve(resolution);
        }
        else {
            this.pushQueue.push(Promise.resolve(resolution));
            if (this.highWaterMark !== undefined &&
                this.pushQueue.length >= this.highWaterMark &&
                !this.isPaused) {
                this.isPaused = true;
                if (this.eventHandlers.highWater) {
                    this.eventHandlers.highWater();
                }
                else if (console) {
                    console.warn(`EventIterator queue reached ${this.pushQueue.length} items`);
                }
            }
        }
    }
    stop() {
        Promise.resolve().then(() => {
            this.remove();
            this.finalValue = { value: undefined, done: true };
            if (this.pullQueue.length) {
                for (const placeholder of this.pullQueue) {
                    placeholder.resolve(this.finalValue);
                }
                this.pullQueue.length = 0;
            }
            else {
                this.pushQueue.push(Promise.resolve(this.finalValue));
            }
        });
    }
    fail(error) {
        Promise.resolve().then(() => {
            this.remove();
            if (this.pullQueue.length) {
                for (const placeholder of this.pullQueue) {
                    placeholder.reject(error);
                }
                this.pullQueue.length = 0;
            }
            else {
                const rejection = Promise.reject(error);
                /* Attach error handler to avoid leaking an unhandled promise rejection. */
                rejection.catch(() => { });
                this.pushQueue.push(rejection);
            }
        });
    }
    remove() {
        if (this.removeCallback)
            this.removeCallback();
    }
    [Symbol.asyncIterator]() {
        return {
            next: (value) => {
                if (this.finalValue) {
                    return Promise.resolve(this.finalValue);
                }
                else if (this.pushQueue.length) {
                    const result = this.pushQueue.shift();
                    if (this.lowWaterMark !== undefined &&
                        this.pushQueue.length <= this.lowWaterMark &&
                        this.isPaused) {
                        this.isPaused = false;
                        if (this.eventHandlers.lowWater) {
                            this.eventHandlers.lowWater();
                        }
                    }
                    return result;
                }
                else {
                    return new Promise((resolve, reject) => {
                        this.pullQueue.push({ resolve, reject });
                    });
                }
            },
            return: () => {
                this.remove();
                this.finalValue = { value: undefined, done: true };
                return Promise.resolve(this.finalValue);
            },
        };
    }
}
class EventIterator {
    constructor(listen, { highWaterMark = 100, lowWaterMark = 1 } = {}) {
        const queue = new EventQueue();
        queue.highWaterMark = highWaterMark;
        queue.lowWaterMark = lowWaterMark;
        queue.removeCallback =
            listen({
                push: (val) => queue.push(val),
                stop: () => queue.stop(),
                fail: (error) => queue.fail(error),
                on: (event, fn) => {
                    queue.eventHandlers[event] = fn;
                },
            }) || (() => { });
        this[Symbol.asyncIterator] = () => queue[Symbol.asyncIterator]();
        Object.freeze(this);
    }
}
exports.EventIterator = EventIterator;
exports.default = EventIterator;
