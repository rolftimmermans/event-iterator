import { EventIterator } from "./event-iterator";
export declare function subscribe(this: EventTarget, event: string, options?: AddEventListenerOptions): EventIterator<Event>;
export { EventIterator };
export default EventIterator;
