import "./symbol-polyfill"

import {assert} from "chai"
import {EventIterator} from "../src/event-iterator"
import {EventEmitter} from "events"

describe("event iterator", function () {
  describe("with listen", function () {
    it("should await immediate value", async function () {
      const it = new EventIterator(({push}) => {
        push("val")
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: "val", done: false})
    })

    it("should await delayed value", async function () {
      const it = new EventIterator(({push}) => {
        setImmediate(() => push("val"))
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: "val", done: false})
    })

    it("should await immediate end", async function () {
      const it = new EventIterator(({push, stop}) => {
        stop()
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
    })

    it("should await delayed end", async function () {
      const it = new EventIterator(({push, stop}) => {
        setImmediate(stop)
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
    })

    it("should await immediate error", async function () {
      const it = new EventIterator(({push, stop, fail}) => {
        fail(new Error())
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
      }
    })

    it("should await delayed error", async function () {
      const it = new EventIterator(({push, stop, fail}) => {
        setImmediate(() => fail(new Error()))
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
      }
    })

    it("does not yield new items if return has been called", async function () {
      const it = new EventIterator(({push}) => {
        push("val")
      })

      await new Promise(setImmediate)
      const iter = it[Symbol.asyncIterator]()
      await iter.return?.()
      assert.deepEqual(await iter.next(), {value: undefined, done: true})
    })

    it("does not queue for new items if return has been called", async function () {
      const it = new EventIterator(({push}) => {
        push("val")
      })

      await new Promise(setImmediate)
      const iter = it[Symbol.asyncIterator]()
      assert.deepEqual(await iter.next(), {value: "val", done: false})
      await iter.return?.()
      assert.deepEqual(await iter.next(), {value: undefined, done: true})
    })
  })

  describe("with listen and remove", function () {
    it("should call remove handler with no arguments", async function () {
      let removeArgs = null
      const it = new EventIterator(({stop}) => {
        stop()
        return (...args: never[]) => (removeArgs = args)
      })
      await new Promise(setImmediate)
      await it[Symbol.asyncIterator]().return()
      assert.deepStrictEqual(removeArgs, [])
    })

    it("should call remove handler on return", async function () {
      let removed = 0
      const it = new EventIterator(() => () => (removed += 1))

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().return()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on immediate end", async function () {
      let removed = 0
      const it = new EventIterator(({stop}) => {
        stop()
        return () => (removed += 1)
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on delayed end", async function () {
      let removed = 0
      const it = new EventIterator(({stop}) => {
        setImmediate(stop)
        return () => (removed += 1)
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on immediate error", async function () {
      let removed = 0
      const it = new EventIterator(({fail}) => {
        fail(new Error())
        return () => (removed += 1)
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(removed, 1)
      }
    })

    it("should call remove handler on delayed error", async function () {
      let removed = 0
      const it = new EventIterator(({fail}) => {
        setImmediate(() => fail(new Error()))
        return () => (removed += 1)
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(removed, 1)
      }
    })

    it("should buffer iterator calls when the queue is empty", async function () {
      const event = new EventEmitter()
      const it = new EventIterator(({push, stop, fail}) => {
        event.on("data", push)
        return () => event.removeListener("data", push)
      })

      const iterator = it[Symbol.asyncIterator]()

      const requests = Promise.all([iterator.next(), iterator.next()])

      event.emit("data", "a")
      event.emit("data", "b")

      const result = await requests
      assert.deepEqual(result, [
        {value: "a", done: false},
        {value: "b", done: false},
      ])
    })
  })

  describe("with high water mark", function () {
    it("should warn", async function () {
      const oldconsole = console
      const log = (global.console = new MemoryConsole())

      const it = new EventIterator(
        ({push}) => {
          push("val")
        },
        {highWaterMark: 1},
      )

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()

      global.console = oldconsole

      assert.equal(
        log.stderr.toString(),
        "EventIterator queue reached 1 items\n",
      )
    })
  })
})

import {Console} from "console"
import {Writable} from "stream"

export class BufferStream extends Writable {
  private readonly buffers: Buffer[] = []

  _write(
    chunk: Buffer | string,
    encoding: string,
    callback: (err?: Error) => void,
  ): boolean {
    if (typeof chunk === "string") chunk = Buffer.from(chunk)
    this.buffers.push(chunk)
    callback()
    return true
  }

  clear(): void {
    this.buffers.length = 0
  }

  inspect(): string {
    return Buffer.concat(this.buffers).toString()
  }

  toString(): string {
    return Buffer.concat(this.buffers).toString()
  }
}

export class MemoryConsole extends Console {
  stdout: BufferStream
  stderr: BufferStream

  constructor() {
    const stdout = new BufferStream()
    const stderr = new BufferStream()
    super(stdout, stderr)

    this.stdout = stdout
    this.stderr = stderr
    Object.freeze(this)
  }

  clear(): void {
    this.stdout.clear()
    this.stderr.clear()
  }
}
