export type PushCallback<T> = (res: T) => void
export type StopCallback<T> = () => void
export type FailCallback<T> = (err: Error) => void

export type ListenHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void
export type RemoveHandler<T> = (push: PushCallback<T>, stop: StopCallback<T>, fail: FailCallback<T>) => void

type AsyncResolver<T> = {
  resolve: (res: IteratorResult<T>) => void
  reject: (err: Error) => void
}

type AsyncQueue<T> = Array<Promise<IteratorResult<T>>>

export class EventIterator<T> implements AsyncIterable<T> {
  private listen: ListenHandler<T>
  private remove?: RemoveHandler<T>

  constructor(listen: ListenHandler<T>, remove?: RemoveHandler<T>) {
    this.listen = listen
    this.remove = remove
    Object.freeze(this)
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    let placeholder: AsyncResolver<T> | void
    const queue: AsyncQueue<T> = []
    const listen = this.listen
    const remove = this.remove

    const push: PushCallback<T> = (value: T) => {
      const resolution = {value, done: false}
      if (placeholder) {
        placeholder.resolve(resolution)
        placeholder = undefined
      } else {
        queue.push(Promise.resolve(resolution))
        if (queue.length > 100 && console) {
          console.warn("EventIterator queue filling up")
        }
      }
    }

    const stop: StopCallback<T> = () => {
      if (remove) {
        remove(push, stop, fail)
      }

      const resolution = {done: true} as IteratorResult<T>
      if (placeholder) {
        placeholder.resolve(resolution)
        placeholder = undefined
      } else {
        queue.push(Promise.resolve(resolution))
      }
    }

    const fail: FailCallback<T> = (error: Error) => {
      if (remove) {
        remove(push, stop, fail)
      }

      if (placeholder) {
        placeholder.reject(error)
        placeholder = undefined
      } else {
        const rejection = Promise.reject(error)

        /* Attach error handler to avoid leaking an unhandled promise rejection. */
        rejection.catch(() => {})
        queue.push(rejection)
      }
    }

    listen(push, stop, fail)

    return {
      next(value?: any) {
        if (queue.length) {
          return queue.shift()!
        } else {
          return new Promise((resolve, reject) => {
            placeholder = {resolve, reject}
          })
        }
      },

      return() {
        if (remove) {
          remove(push, stop, fail)
        }

        return Promise.resolve({done: true} as IteratorResult<T>)
      },
    }
  }
}

export default EventIterator
