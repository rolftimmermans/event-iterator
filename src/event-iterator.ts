export type PushCallback<T> = (res: T) => void
export type StopCallback<T> = () => void
export type FailCallback<T> = (err: Error) => void
export type OnDrainCallback<T> = () => void
export type OnFillCallback<T> = () => void
export type OnDrainSetter<T> = (fn: OnDrainCallback<T>) => void
export type OnFillSetter<T> = (fn: OnFillCallback<T>) => void

export interface EventQueue<T> {
  push: PushCallback<T>,
  stop: StopCallback<T>,
  fail: FailCallback<T>,
  onDrain: OnDrainSetter<T>,
  onFill: OnFillSetter<T>,
}
export type RemoveHandler = () => void
export type ListenHandler<T> = (
  eventQueue: EventQueue<T>,
) => void | RemoveHandler

export interface EventIteratorOptions {
  highWaterMark?: number,
  onDrain?: Function,
  onFill?: Function
}

type AsyncResolver<T> = {
  resolve: (res: IteratorResult<T>) => void
  reject: (err: Error) => void
}

type EventIteratorState = {
  paused: Boolean
}

type AsyncQueue<T> = Array<Promise<IteratorResult<T>>>

export class EventIterator<T> implements AsyncIterable<T> {
  private listen: ListenHandler<T>
  private options: EventIteratorOptions

  constructor(listen: ListenHandler<T>, options: EventIteratorOptions = {}) {
    this.listen = listen;

    if (options.onDrain && !options.onFill) {
      throw new Error('Cannot define onDrain without an onFill');
    }

    this.options = {
      highWaterMark: 100,
      ...options
    };

    Object.freeze(this);
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    let pullQueue: Array<AsyncResolver<T>> = []
    const pushQueue: AsyncQueue<T> = []
    const listen = this.listen
    let remove: RemoveHandler = () => {}
    let onDrain: OnDrainCallback<T>|null = null
    let onFill: OnFillCallback<T>|null = null
    let finaliser: IteratorResult<T>|null = null
    let {highWaterMark} = this.options
    let paused = false

    const push: PushCallback<T> = (value: T) => {
      const resolution = { value, done: false }
      if (pullQueue.length) {
        const placeholder = pullQueue.shift()
        if (placeholder) placeholder.resolve(resolution)
      } else {
        pushQueue.push(Promise.resolve(resolution))
        if (highWaterMark !== undefined) {
          if (pushQueue.length >= highWaterMark) {
            if (!onDrain && console) {
              console.warn(`EventIterator queue reached ${pushQueue.length} items`)
            } else if (onDrain && !paused) {
              onDrain();
              paused = true;
            }
          }
        }
      }
    }

    const stop: StopCallback<T> = () => {
      Promise.resolve().then(() => {
        remove()

        finaliser = {value: undefined, done: true} as IteratorResult<T>
        if (pullQueue.length) {
          for (const placeholder of pullQueue) {
            placeholder.resolve(finaliser)
          }
          pullQueue = []
        } else {
          pushQueue.push(Promise.resolve(finaliser))
        }
      })
    }

    const fail: FailCallback<T> = (error: Error) => {
      Promise.resolve().then(() => {
        remove()

        if (pullQueue.length) {
          for (const placeholder of pullQueue) {
            placeholder.reject(error)
          }

          pullQueue = []
        } else {
          const rejection = Promise.reject(error)

          /* Attach error handler to avoid leaking an unhandled promise rejection. */
          rejection.catch(() => {})
          pushQueue.push(rejection)
        }
      })
    }

    remove = listen({
      push,
      stop,
      fail,
      onDrain: (fn) => { onDrain = fn },
      onFill: (fn) => { onFill = fn },
    }) || remove

    return {
      next: (value?: any) => {
        if (finaliser) {
          return Promise.resolve(finaliser)
        } else if (pushQueue.length) {
          const result = pushQueue.shift()!

          if (
            highWaterMark !== undefined &&
            onFill &&
            paused &&
            pushQueue.length < highWaterMark
          ) {
            onFill();
            paused = false;
          }

          return result;
        } else {
          return new Promise((resolve, reject) => {
            pullQueue.push({resolve, reject})
          })
        }
      },

      return() {
        remove()

        finaliser = { value: undefined, done: true } as IteratorResult<T>
        return Promise.resolve(finaliser)
      },
    }
  }
}

export default EventIterator
