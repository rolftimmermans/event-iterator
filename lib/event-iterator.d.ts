export declare type PushCallback<T> = (res: T) => void;
export declare type StopCallback<T> = () => void;
export declare type FailCallback<T> = (err: Error) => void;
export declare type OnPauseCallback<T> = () => void;
export declare type OnResumeCallback<T> = () => void;
export declare type OnPauseSetter<T> = (fn: OnPauseCallback<T>) => void;
export declare type OnResumeSetter<T> = (fn: OnResumeCallback<T>) => void;
export interface EventQueue<T> {
    push: PushCallback<T>;
    stop: StopCallback<T>;
    fail: FailCallback<T>;
    onPause: OnPauseSetter<T>;
    onResume: OnResumeSetter<T>;
}
export declare type RemoveHandler = () => void;
export declare type ListenHandler<T> = (eventQueue: EventQueue<T>) => void | RemoveHandler;
export interface EventIteratorOptions {
    highWaterMark?: number;
    onPause?: Function;
    onResume?: Function;
}
export declare class EventIterator<T> implements AsyncIterable<T> {
    private listen;
    private options;
    constructor(listen: ListenHandler<T>, options?: EventIteratorOptions);
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
export default EventIterator;
