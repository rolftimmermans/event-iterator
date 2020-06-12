export type QueueEvent = keyof EventHandlers
export type RemoveHandler = () => void
export type ListenHandler<T> = (queue: Queue<T>) => void | RemoveHandler

export interface EventIteratorOptions {
  highWaterMark: number | undefined
  lowWaterMark: number | undefined
}

export interface Queue<T> {
  push(value: T): void
  stop(): void
  fail(error: Error): void

  on<E extends QueueEvent>(event: E, fn: EventHandlers[E]): void
}

interface EventHandlers {
  highWater(): void
  lowWater(): void
}

interface AsyncResolver<T> {
  resolve: (res: IteratorResult<T>) => void
  reject: (err: Error) => void
}

class EventQueue<T> {
  highWaterMark: number | undefined
  lowWaterMark: number | undefined

  readonly pullQueue: Array<AsyncResolver<T>> = []
  readonly pushQueue: Array<Promise<IteratorResult<T>>> = []
  readonly eventHandlers: Partial<EventHandlers> = {}

  isPaused = false
  finalValue?: IteratorResult<T>
  removeCallback?: RemoveHandler

  push(value: T): void {
    const resolution = {value, done: false}
    if (this.pullQueue.length) {
      const placeholder = this.pullQueue.shift()
      if (placeholder) placeholder.resolve(resolution)
    } else {
      this.pushQueue.push(Promise.resolve(resolution))
      if (
        this.highWaterMark !== undefined &&
        this.pushQueue.length >= this.highWaterMark &&
        !this.isPaused
      ) {
        this.isPaused = true
        if (this.eventHandlers.highWater) {
          this.eventHandlers.highWater()
        } else if (console) {
          console.warn(
            `EventIterator queue reached ${this.pushQueue.length} items`,
          )
        }
      }
    }
  }

  stop(): void {
    Promise.resolve().then(() => {
      this.remove()
      this.finalValue = {value: undefined, done: true}

      if (this.pullQueue.length) {
        for (const placeholder of this.pullQueue) {
          placeholder.resolve(this.finalValue)
        }
        this.pullQueue.length = 0
      } else {
        this.pushQueue.push(Promise.resolve(this.finalValue))
      }
    })
  }

  fail(error: Error): void {
    Promise.resolve().then(() => {
      this.remove()

      if (this.pullQueue.length) {
        for (const placeholder of this.pullQueue) {
          placeholder.reject(error)
        }

        this.pullQueue.length = 0
      } else {
        const rejection = Promise.reject(error)

        /* Attach error handler to avoid leaking an unhandled promise rejection. */
        rejection.catch(() => {})
        this.pushQueue.push(rejection)
      }
    })
  }

  remove() {
    if (this.removeCallback) this.removeCallback()
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (value?: any) => {
        if (this.finalValue) {
          return Promise.resolve(this.finalValue)
        } else if (this.pushQueue.length) {
          const result = this.pushQueue.shift()!

          if (
            this.lowWaterMark !== undefined &&
            this.pushQueue.length <= this.lowWaterMark &&
            this.isPaused
          ) {
            this.isPaused = false
            if (this.eventHandlers.lowWater) {
              this.eventHandlers.lowWater()
            }
          }

          return result
        } else {
          return new Promise((resolve, reject) => {
            this.pullQueue.push({resolve, reject})
          })
        }
      },

      return: () => {
        this.remove()
        this.finalValue = {value: undefined, done: true}
        return Promise.resolve(this.finalValue)
      },
    }
  }
}

export class EventIterator<T> implements AsyncIterable<T> {
  [Symbol.asyncIterator]: () => AsyncIterator<T>

  constructor(
    listen: ListenHandler<T>,
    {highWaterMark = 100, lowWaterMark = 1}: Partial<EventIteratorOptions> = {},
  ) {
    const queue = new EventQueue<T>()
    queue.highWaterMark = highWaterMark
    queue.lowWaterMark = lowWaterMark

    queue.removeCallback =
      listen({
        push: (val: T) => queue.push(val),
        stop: () => queue.stop(),
        fail: (error: Error) => queue.fail(error),
        on: (event: QueueEvent, fn: () => void) => {
          queue.eventHandlers[event] = fn
        },
      }) || (() => {})

    this[Symbol.asyncIterator] = () => queue[Symbol.asyncIterator]()
    Object.freeze(this)
  }
}

export default EventIterator
