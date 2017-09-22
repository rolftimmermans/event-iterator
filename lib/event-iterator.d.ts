export declare type PushCallback<T> = (res: T) => void;
export declare type StopCallback<T> = () => void;
export declare type FailCallback<T> = (err: Error) => void;
export declare type ListenHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void;
export declare type RemoveHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void;
export declare class EventIterator<T> {
    private listen;
    private remove?;
    constructor(listen: ListenHandler<T>, remove?: RemoveHandler<T>);
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
export default EventIterator;
