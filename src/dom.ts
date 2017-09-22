import {EventIterator} from "./event-iterator"

export function subscribe(this: EventTarget, event: string, options?: AddEventListenerOptions) {
  return new EventIterator<Event>(
    (push) => {
      this.addEventListener(event, push, options)
    },

    (push) => {
      this.removeEventListener(event, push, options)
    },
  )
}

export {EventIterator}
export default EventIterator
