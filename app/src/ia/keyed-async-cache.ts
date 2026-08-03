/**
 * Generic per-key promise memoization. Used by the inference worker to keep
 * one loaded pipeline per model key (e.g. one Whisper pipeline per ASR
 * candidate) without re-triggering a load that is already in flight.
 */
export class KeyedAsyncCache<TKey, TValue> {
  private readonly promisesByKey = new Map<TKey, Promise<TValue>>()

  /**
   * Returns the memoized promise for `key`, or calls `load()` once and
   * memoizes it. A rejected load is evicted so the next call retries.
   */
  get(key: TKey, load: () => Promise<TValue>): Promise<TValue> {
    const existing = this.promisesByKey.get(key)
    if (existing) {
      return existing
    }

    const promise = load().catch((error: unknown) => {
      if (this.promisesByKey.get(key) === promise) {
        this.promisesByKey.delete(key)
      }
      throw error
    })
    this.promisesByKey.set(key, promise)
    return promise
  }

  has(key: TKey): boolean {
    return this.promisesByKey.has(key)
  }

  get size(): number {
    return this.promisesByKey.size
  }

  clear(): void {
    this.promisesByKey.clear()
  }
}
