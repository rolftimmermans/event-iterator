import "./symbol-polyfill"

import { assert } from "chai"
import { EventIterator } from "../src/event-iterator"
import { EventEmitter } from 'events'
import { spy } from 'sinon'
describe("event iterator", function() {
  describe("with listen", function() {
    it("should await immediate value", async function() {
      const it = new EventIterator(next => {
        next("val")
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: "val", done: false})
    })

    it("should await delayed value", async function() {
      const it = new EventIterator(next => {
        setImmediate(() => next("val"))
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: "val", done: false})
    })

    it("should await immediate end", async function() {
      const it = new EventIterator((next, stop) => {
        stop()
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
    })

    it("should await delayed end", async function() {
      const it = new EventIterator((next, stop) => {
        setImmediate(stop)
      })

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
    })

    it("should await immediate error", async function() {
      const it = new EventIterator((next, stop, fail) => {
        fail(new Error)
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
      }
    })

    it("should await delayed error", async function() {
      const it = new EventIterator((next, stop, fail) => {
        setImmediate(() => fail(new Error))
      })

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
      }
    })

    it("does not yield new items if return has been called", async function() {
      const it = new EventIterator(next => {
        next("val")
      })

      await new Promise(setImmediate)
      const iter = it[Symbol.asyncIterator]()
      await iter.return?.()
      assert.deepEqual(await iter.next(), {value: undefined, done: true})
    })

    it("does not queue for new items if return has been called", async function() {
      const it = new EventIterator(next => {
        next("val")
      })

      await new Promise(setImmediate)
      const iter = it[Symbol.asyncIterator]()
      assert.deepEqual(await iter.next(), {value: "val", done: false})
      await iter.return?.()
      assert.deepEqual(await iter.next(), {value: undefined, done: true})
    })
  })

  describe("with listen and remove", function() {
    it("should call handlers with identical arguments", async function() {
      let a, b
      const it = new EventIterator(
        (...args: any[]) => a = args,
        (...args: any[]) => b = args,
      )

      assert.equal(a, b)
    })

    it("should call remove handler on return", async function() {
      let removed = 0
      const it = new EventIterator(() => {}, () => removed += 1)

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().return!()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on immediate end", async function() {
      let removed = 0
      const it = new EventIterator((next, stop) => {
        stop()
      }, () => removed += 1)

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on delayed end", async function() {
      let removed = 0
      const it = new EventIterator((next, stop) => {
        setImmediate(stop)
      }, () => removed += 1)

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()
      assert.deepEqual(result, {value: undefined, done: true})
      assert.equal(removed, 1)
    })

    it("should call remove handler on immediate error", async function() {
      let removed = 0
      const it = new EventIterator((next, stop, fail) => {
        fail(new Error)
      }, () => removed += 1)

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(removed, 1)
      }
    })

    it("should call remove handler on delayed error", async function() {
      let removed = 0
      const it = new EventIterator((next, stop, fail) => {
        setImmediate(() => fail(new Error))
      }, () => removed += 1)

      try {
        await new Promise(setImmediate)
        const result = await it[Symbol.asyncIterator]().next()
        assert.fail()
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(removed, 1)
      }
    })

    it("should buffer iterator calls when the queue is empty", async function() {
      const event = new EventEmitter();
      const it = new EventIterator((next, stop, fail) => {
        event.on('data', next);
      }, (next) => {
        event.removeListener('data', next);
      });

      const iterator = it[Symbol.asyncIterator]();
  
      const requests = Promise.all([
        iterator.next(),
        iterator.next(),
      ]);
  
      event.emit('data', 'a');
      event.emit('data', 'b');
  
      const result = await requests;
      assert.deepEqual(result, [{ value: 'a', done: false }, { value: 'b', done: false }]);
    })
  })

  describe("with high water mark", function() {
    it("should warn", async function() {
      const oldconsole = console
      const log = global.console = new MemoryConsole

      const it = new EventIterator(next => {next("val")}, undefined, {highWaterMark: 1})

      await new Promise(setImmediate)
      const result = await it[Symbol.asyncIterator]().next()

      global.console = oldconsole

      assert.equal(log.stderr.toString(), "EventIterator queue reached 1 items\n")
    })

    it("should throw if onPause is defined without onResume", async function () {
      const pauseSpy = spy();
      assert.throws(() => {
        const it = new EventIterator(() => {}, undefined, {
          onPause: pauseSpy
        })
      }, Error, 'Cannot define onPause without an onResume')
    })

    it("should pause once the high watermark is crossed and resume once it is cleared", async function () {
      const pauseSpy = spy();
      const resumeSpy = spy();
      const event = new EventEmitter();
      const it = new EventIterator(next => {
        event.on("data", next)
      }, undefined, {
        highWaterMark: 1,
        onPause: pauseSpy,
        onResume: resumeSpy
      })

      const iter = it[Symbol.asyncIterator]();

      assert.equal(pauseSpy.called, false);
      assert.equal(resumeSpy.called, false);

      event.emit('data', 'a');

      assert.equal(pauseSpy.called, true);
      assert.equal(resumeSpy.called, false);

      // Consume the record in the queue to to trigger onResume
      await iter.next();

      assert.equal(resumeSpy.called, true);

    })
  })
})

import {Console} from "console"
import {Writable} from "stream"

export class BufferStream extends Writable {
  private readonly buffers: Buffer[] = []

  _write(chunk: Buffer | string, encoding: string, callback: (err?: Error) => void) {
    if (typeof chunk === "string") chunk = Buffer.from(chunk)
    this.buffers.push(chunk)
    callback()
    return true
  }

  clear() {
    this.buffers.length = 0
  }

  inspect() {
    return Buffer.concat(this.buffers).toString()
  }

  toString() {
    return Buffer.concat(this.buffers).toString()
  }
}

export class MemoryConsole extends Console {
  stdout: BufferStream
  stderr: BufferStream

  constructor() {
    const stdout = new BufferStream
    const stderr = new BufferStream
    super(stdout, stderr)

    this.stdout = stdout
    this.stderr = stderr
    Object.freeze(this)
  }

  clear() {
    this.stdout.clear()
    this.stderr.clear()
  }
}
