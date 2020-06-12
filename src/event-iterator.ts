export type PushCallback<T> = (res: T) => void
export type StopCallback<T> = () => void
export type FailCallback<T> = (err: Error) => void

export interface EventQueue<T> {
  push: PushCallback<T>
  stop: StopCallback<T>
  fail: FailCallback<T>
}
export type RemoveHandler = () => void
export type ListenHandler<T> = (
  eventQueue: EventQueue<T>,
) => void | RemoveHandler

export interface EventIteratorOptions {
  highWaterMark?: number
}

type AsyncResolver<T> = {
  resolve: (res: IteratorResult<T>) => void
  reject: (err: Error) => void
}

type AsyncQueue<T> = Array<Promise<IteratorResult<T>>>

export class EventIterator<T> implements AsyncIterable<T> {
  private listen: ListenHandler<T>
  private options: EventIteratorOptions

  constructor(listen: ListenHandler<T>, options: EventIteratorOptions = {}) {
    this.listen = listen
    this.options = {highWaterMark: 100, ...options}
    Object.freeze(this)
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    let pullQueue: Array<AsyncResolver<T>> = []
    const pushQueue: AsyncQueue<T> = []
    const listen = this.listen
    let remove: RemoveHandler = () => {}
    let finaliser: IteratorResult<T> | null = null

    const push: PushCallback<T> = (value: T) => {
      const resolution = {value, done: false}
      if (pullQueue.length) {
        const placeholder = pullQueue.shift()
        if (placeholder) placeholder.resolve(resolution)
      } else {
        pushQueue.push(Promise.resolve(resolution))
        const {highWaterMark} = this.options
        if (
          highWaterMark !== undefined &&
          pushQueue.length >= highWaterMark &&
          console
        ) {
          console.warn(`EventIterator queue reached ${pushQueue.length} items`)
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

    remove = listen({push, stop, fail}) || remove

    return {
      next(value?: any) {
        if (finaliser) {
          return Promise.resolve(finaliser)
        } else if (pushQueue.length) {
          return pushQueue.shift()!
        } else {
          return new Promise((resolve, reject) => {
            pullQueue.push({resolve, reject})
          })
        }
      },

      return() {
        remove()

        finaliser = {value: undefined, done: true} as IteratorResult<T>
        return Promise.resolve(finaliser)
      },
    }
  }
}

export default EventIterator
