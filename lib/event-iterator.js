"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventIterator {
    constructor(listen, options = {}) {
        this.listen = listen;
        if (options.onDrain && !options.onFill) {
            throw new Error('Cannot define onDrain without an onFill');
        }
        this.options = Object.assign({ highWaterMark: 100 }, options);
        Object.freeze(this);
    }
    [Symbol.asyncIterator]() {
        let pullQueue = [];
        const pushQueue = [];
        const listen = this.listen;
        let remove = () => { };
        let onDrain = null;
        let onFill = null;
        let finaliser = null;
        let { highWaterMark } = this.options;
        let paused = false;
        const push = (value) => {
            const resolution = { value, done: false };
            if (pullQueue.length) {
                const placeholder = pullQueue.shift();
                if (placeholder)
                    placeholder.resolve(resolution);
            }
            else {
                pushQueue.push(Promise.resolve(resolution));
                if (highWaterMark !== undefined) {
                    if (pushQueue.length >= highWaterMark) {
                        if (!onDrain && console) {
                            console.warn(`EventIterator queue reached ${pushQueue.length} items`);
                        }
                        else if (onDrain && !paused) {
                            onDrain();
                            paused = true;
                        }
                    }
                }
            }
        };
        const stop = () => {
            Promise.resolve().then(() => {
                remove();
                finaliser = { value: undefined, done: true };
                if (pullQueue.length) {
                    for (const placeholder of pullQueue) {
                        placeholder.resolve(finaliser);
                    }
                    pullQueue = [];
                }
                else {
                    pushQueue.push(Promise.resolve(finaliser));
                }
            });
        };
        const fail = (error) => {
            Promise.resolve().then(() => {
                remove();
                if (pullQueue.length) {
                    for (const placeholder of pullQueue) {
                        placeholder.reject(error);
                    }
                    pullQueue = [];
                }
                else {
                    const rejection = Promise.reject(error);
                    /* Attach error handler to avoid leaking an unhandled promise rejection. */
                    rejection.catch(() => { });
                    pushQueue.push(rejection);
                }
            });
        };
        remove = listen({
            push,
            stop,
            fail,
            onDrain: (fn) => { onDrain = fn; },
            onFill: (fn) => { onFill = fn; },
        }) || remove;
        return {
            next: (value) => {
                if (finaliser) {
                    return Promise.resolve(finaliser);
                }
                else if (pushQueue.length) {
                    const result = pushQueue.shift();
                    if (highWaterMark !== undefined &&
                        onFill &&
                        paused &&
                        pushQueue.length < highWaterMark) {
                        onFill();
                        paused = false;
                    }
                    return result;
                }
                else {
                    return new Promise((resolve, reject) => {
                        pullQueue.push({ resolve, reject });
                    });
                }
            },
            return() {
                remove();
                finaliser = { value: undefined, done: true };
                return Promise.resolve(finaliser);
            },
        };
    }
}
exports.EventIterator = EventIterator;
exports.default = EventIterator;
