/* Fall back from Symbol.asyncIterator to Symbol.iterator to a new symbol. */
(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.iterator || Symbol.for("Symbol.asyncIterator")
