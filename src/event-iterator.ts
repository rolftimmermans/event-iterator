export type PushCallback<T> = (res: T) => void
export type StopCallback<T> = () => void
export type FailCallback<T> = (err: Error) => void

export type ListenHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void
export type RemoveHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void

export interface EventIteratorOptions {
  highWaterMark?: number,
  onPause?: Function,
  onResume?: Function
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
  private remove?: RemoveHandler<T>
  private options: EventIteratorOptions
  private state: EventIteratorState

  constructor(listen: ListenHandler<T>, remove?: RemoveHandler<T>, options: EventIteratorOptions = {}) {
    this.listen = listen;
    this.remove = remove;
    this.state = {
      paused: false
    };

    if (options.onPause && !options.onResume) {
      throw new Error('Cannot define onPause without an onResume');
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
    const remove = this.remove
    let finaliser: IteratorResult<T> | null = null;
    
    const {
      highWaterMark,
      onPause,
      onResume
    } = this.options

    const push: PushCallback<T> = (value: T) => {
      const resolution = { value, done: false }
      if (pullQueue.length) {
        const placeholder = pullQueue.shift();
        if (placeholder) placeholder.resolve(resolution)
      } else {
        pushQueue.push(Promise.resolve(resolution))
        if (highWaterMark !== undefined) {
          if (pushQueue.length >= highWaterMark) {
            if (onPause) {
              if (!this.state.paused) {
                onPause();
                this.state.paused = true;
              }
            } else if (console) {
              console.warn(`EventIterator queue reached ${pushQueue.length} items`)
            }
          }
        }
      }
    }

    const stop: StopCallback<T> = () => {
      if (remove) {
        remove(push, stop, fail)
      }

      finaliser = { value: undefined, done: true } as IteratorResult<T>
      if (pullQueue.length) {
        for (const placeholder of pullQueue) {
          placeholder.resolve(finaliser);
        }
        pullQueue = []
      } else {
        pushQueue.push(Promise.resolve(finaliser))
      }
    }

    const fail: FailCallback<T> = (error: Error) => {
      if (remove) {
        remove(push, stop, fail)
      }

      if (pullQueue.length) {
        for (const placeholder of pullQueue) {
          placeholder.reject(error);
        }

        pullQueue = []
      } else {
        const rejection = Promise.reject(error)

        /* Attach error handler to avoid leaking an unhandled promise rejection. */
        rejection.catch(() => { })
        pushQueue.push(rejection)
      }
    }

    listen(push, stop, fail)

    return {
      next: (value?: any) => {
        if (finaliser) {
          return Promise.resolve(finaliser)
        } else if (pushQueue.length) {
          const result = pushQueue.shift()!
          
          if (
            highWaterMark !== undefined && 
            onResume && 
            this.state.paused && 
            pushQueue.length < highWaterMark
          ) {
            onResume();
            this.state.paused = false;
          }
          
          return result;
        } else {
          return new Promise((resolve, reject) => {
            pullQueue.push({ resolve, reject })
          })
        }
      },

      return() {
        if (remove) {
          remove(push, stop, fail)
        }

        finaliser = { value: undefined, done: true } as IteratorResult<T>
        return Promise.resolve(finaliser)
      },
    }
  }
}

export default EventIterator
