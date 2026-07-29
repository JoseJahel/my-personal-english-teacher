import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { awaitWithTimeout } from './await-with-timeout'

describe('awaitWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves to the value when the promise settles before the timeout', async () => {
    const pending = awaitWithTimeout(Promise.resolve('value'), 1000, new Error('should not fire'))

    await expect(pending).resolves.toBe('value')
  })

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    const originalError = new Error('inner failure')
    const pending = awaitWithTimeout(Promise.reject(originalError), 1000, new Error('timeout'))

    await expect(pending).rejects.toBe(originalError)
  })

  it('rejects with the given timeout error when the promise never settles in time', async () => {
    const timeoutError = new Error('timed out')
    const neverSettles = new Promise<string>(() => {})

    const pending = awaitWithTimeout(neverSettles, 1000, timeoutError)
    // Prevent an unhandled-rejection warning race between the assertion setup
    // below and the timer firing.
    pending.catch(() => {})

    await vi.advanceTimersByTimeAsync(1000)

    await expect(pending).rejects.toBe(timeoutError)
  })

  it('clears the timeout timer once the promise resolves before the deadline', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    await awaitWithTimeout(Promise.resolve('value'), 1000, new Error('should not fire'))

    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the timeout timer once the promise rejects before the deadline', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    await expect(
      awaitWithTimeout(Promise.reject(new Error('boom')), 1000, new Error('should not fire')),
    ).rejects.toThrow('boom')

    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not leak the timer after it fires and rejects', async () => {
    const timeoutError = new Error('timed out')
    const neverSettles = new Promise<string>(() => {})

    const pending = awaitWithTimeout(neverSettles, 1000, timeoutError)
    pending.catch(() => {})

    await vi.advanceTimersByTimeAsync(1000)
    await pending.catch(() => {})

    expect(vi.getTimerCount()).toBe(0)
  })
})
