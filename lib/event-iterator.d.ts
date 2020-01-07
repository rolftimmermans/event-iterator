export declare type PushCallback<T> = (res: T) => void;
export declare type StopCallback<T> = () => void;
export declare type FailCallback<T> = (err: Error) => void;
export interface EventQueue<T> {
    push: PushCallback<T>;
    stop: StopCallback<T>;
    fail: FailCallback<T>;
}
export declare type RemoveHandler = () => void;
export declare type ListenHandler<T> = (eventQueue: EventQueue<T>) => void | RemoveHandler;
export interface EventIteratorOptions {
    highWaterMark?: number;
}
export declare class EventIterator<T> implements AsyncIterable<T> {
    private listen;
    private options;
    constructor(listen: ListenHandler<T>, options?: EventIteratorOptions);
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
export default EventIterator;
