export declare type PushCallback<T> = (res: T) => void;
export declare type StopCallback<T> = () => void;
export declare type FailCallback<T> = (err: Error) => void;
export declare type OnDrainCallback<T> = () => void;
export declare type OnFillCallback<T> = () => void;
export declare type OnDrainSetter<T> = (fn: OnDrainCallback<T>) => void;
export declare type OnFillSetter<T> = (fn: OnFillCallback<T>) => void;
export interface EventQueue<T> {
    push: PushCallback<T>;
    stop: StopCallback<T>;
    fail: FailCallback<T>;
    onDrain: OnDrainSetter<T>;
    onFill: OnFillSetter<T>;
}
export declare type RemoveHandler = () => void;
export declare type ListenHandler<T> = (eventQueue: EventQueue<T>) => void | RemoveHandler;
export interface EventIteratorOptions {
    highWaterMark?: number;
    onDrain?: Function;
    onFill?: Function;
}
export declare class EventIterator<T> implements AsyncIterable<T> {
    private listen;
    private options;
    constructor(listen: ListenHandler<T>, options?: EventIteratorOptions);
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
export default EventIterator;
