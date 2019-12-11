"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class EventIterator {
    constructor(listen, remove, options = {}) {
        this.listen = listen;
        this.remove = remove;
        this.state = {
            paused: false
        };
        if (options.onPause && !options.onResume) {
            throw new Error('Cannot define onPause without an onResume');
        }
        this.options = Object.assign({ highWaterMark: 100 }, options);
        Object.freeze(this);
    }
    [Symbol.asyncIterator]() {
        let pullQueue = [];
        const pushQueue = [];
        const listen = this.listen;
        const remove = this.remove;
        let finaliser = null;
        const { highWaterMark, onPause, onResume } = this.options;
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
                        if (onPause) {
                            if (!this.state.paused) {
                                onPause();
                                this.state.paused = true;
                            }
                        }
                        else if (console) {
                            console.warn(`EventIterator queue reached ${pushQueue.length} items`);
                        }
                    }
                }
            }
        };
        const stop = () => {
            if (remove) {
                remove(push, stop, fail);
            }
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
        };
        const fail = (error) => {
            if (remove) {
                remove(push, stop, fail);
            }
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
        };
        listen(push, stop, fail);
        return {
            next: (value) => {
                if (finaliser) {
                    return Promise.resolve(finaliser);
                }
                else if (pushQueue.length) {
                    const result = pushQueue.shift();
                    if (highWaterMark !== undefined &&
                        onResume &&
                        this.state.paused &&
                        pushQueue.length < highWaterMark) {
                        onResume();
                        this.state.paused = false;
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
                if (remove) {
                    remove(push, stop, fail);
                }
                finaliser = { value: undefined, done: true };
                return Promise.resolve(finaliser);
            },
        };
    }
}
exports.EventIterator = EventIterator;
exports.default = EventIterator;
