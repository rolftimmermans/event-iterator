/// <reference types="node" />
import { Readable } from "stream";
import { EventIterator } from "./event-iterator";
export declare function stream(this: Readable): EventIterator<Buffer>;
export { EventIterator };
export default EventIterator;
