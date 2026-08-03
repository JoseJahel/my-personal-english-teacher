import { describe, expect, it } from 'vitest'
import { KeyedAsyncCache } from './keyed-async-cache'

describe('KeyedAsyncCache', () => {
  it('memoizes the loader per key', async () => {
    const cache = new KeyedAsyncCache<string, number>()
    let calls = 0
    const load = () => {
      calls += 1
      return Promise.resolve(42)
    }

    const first = await cache.get('a', load)
    const second = await cache.get('a', load)

    expect(first).toBe(42)
    expect(second).toBe(42)
    expect(calls).toBe(1)
  })

  it('loads independently per key', async () => {
    const cache = new KeyedAsyncCache<string, string>()
    const resultA = await cache.get('a', () => Promise.resolve('value-a'))
    const resultB = await cache.get('b', () => Promise.resolve('value-b'))

    expect(resultA).toBe('value-a')
    expect(resultB).toBe('value-b')
    expect(cache.size).toBe(2)
  })

  it('evicts a rejected load so the next call retries', async () => {
    const cache = new KeyedAsyncCache<string, number>()
    let attempt = 0
    const load = () => {
      attempt += 1
      return attempt === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(7)
    }

    await expect(cache.get('a', load)).rejects.toThrow('boom')
    expect(cache.has('a')).toBe(false)

    const result = await cache.get('a', load)
    expect(result).toBe(7)
    expect(attempt).toBe(2)
  })

  it('does not evict a fresh entry when a stale in-flight load rejects after clear()', async () => {
    const cache = new KeyedAsyncCache<string, number>()
    let rejectLoad1: (error: Error) => void = () => {}
    const load1 = () =>
      new Promise<number>((_resolve, reject) => {
        rejectLoad1 = reject
      })

    const firstGet = cache.get('a', load1)
    const firstGetCaught = firstGet.catch(() => {
      // Expected: this stale load rejects after clear(); swallow it so it
      // doesn't surface as an unhandled rejection in the test.
    })

    cache.clear()

    let freshCalls = 0
    const freshLoad = () => {
      freshCalls += 1
      return Promise.resolve(7)
    }
    const freshResult = await cache.get('a', freshLoad)
    expect(freshResult).toBe(7)

    rejectLoad1(new Error('stale'))
    await firstGetCaught

    expect(cache.has('a')).toBe(true)

    const thirdResult = await cache.get('a', freshLoad)
    expect(thirdResult).toBe(7)
    expect(freshCalls).toBe(1)
  })

  it('deduplicates concurrent in-flight loads for the same key', async () => {
    const cache = new KeyedAsyncCache<string, number>()
    let calls = 0
    let resolveLoad: (value: number) => void = () => {}
    const load = () => {
      calls += 1
      return new Promise<number>((resolve) => {
        resolveLoad = resolve
      })
    }

    const first = cache.get('a', load)
    const second = cache.get('a', load)

    resolveLoad(99)

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toBe(99)
    expect(secondResult).toBe(99)
    expect(calls).toBe(1)
  })

  it('clear() empties the cache for all keys', async () => {
    const cache = new KeyedAsyncCache<string, string>()
    await cache.get('a', () => Promise.resolve('value-a'))
    await cache.get('b', () => Promise.resolve('value-b'))

    cache.clear()

    expect(cache.size).toBe(0)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(false)
  })
})
