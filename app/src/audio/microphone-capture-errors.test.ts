import { describe, expect, it } from 'vitest'
import { MicrophoneCaptureError, toMicrophoneCaptureError } from './microphone-capture-errors'

describe('MicrophoneCaptureError', () => {
  it('sets name, reason, and message like a standard Error', () => {
    const error = new MicrophoneCaptureError('permission-denied', 'denied by user')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('MicrophoneCaptureError')
    expect(error.reason).toBe('permission-denied')
    expect(error.message).toBe('denied by user')
  })

  it('carries a cause through ErrorOptions', () => {
    const cause = new Error('root cause')
    const error = new MicrophoneCaptureError('unknown', 'wrapped', { cause })
    expect(error.cause).toBe(cause)
  })
})

describe('toMicrophoneCaptureError', () => {
  it('returns the same instance when already a MicrophoneCaptureError', () => {
    const original = new MicrophoneCaptureError('unknown', 'already wrapped')
    expect(toMicrophoneCaptureError(original)).toBe(original)
  })

  it('maps NotAllowedError to permission-denied', () => {
    const domException = new DOMException('blocked', 'NotAllowedError')
    const error = toMicrophoneCaptureError(domException)
    expect(error.reason).toBe('permission-denied')
    expect(error.message).toContain('permission denied')
    expect(error.cause).toBe(domException)
  })

  it('maps SecurityError to permission-denied', () => {
    const domException = new DOMException('blocked', 'SecurityError')
    const error = toMicrophoneCaptureError(domException)
    expect(error.reason).toBe('permission-denied')
  })

  it('maps NotFoundError to a helpful no-device message', () => {
    const domException = new DOMException('missing', 'NotFoundError')
    const error = toMicrophoneCaptureError(domException)
    expect(error.reason).toBe('unknown')
    expect(error.message).toContain('No microphone device')
  })

  it('maps NotReadableError to a device-in-use message', () => {
    const domException = new DOMException('busy', 'NotReadableError')
    const error = toMicrophoneCaptureError(domException)
    expect(error.reason).toBe('unknown')
    expect(error.message).toContain('already in use')
  })

  it('falls back to a generic message for a DOMException whose name is not specifically handled', () => {
    // DOMException is not `instanceof Error` in this runtime, so names outside
    // NotAllowedError/SecurityError/NotFoundError/NotReadableError skip the
    // "reuse error.message" branch entirely and hit the generic fallback.
    const domException = new DOMException('the operation was aborted', 'AbortError')
    const error = toMicrophoneCaptureError(domException)
    expect(error.reason).toBe('unknown')
    expect(error.message).toBe('Unexpected failure while opening the microphone.')
    expect(error.cause).toBe(domException)
  })

  it('preserves the message of a plain Error with content', () => {
    const plainError = new Error('device disconnected mid-recording')
    const error = toMicrophoneCaptureError(plainError)
    expect(error.reason).toBe('unknown')
    expect(error.message).toBe('device disconnected mid-recording')
    expect(error.cause).toBe(plainError)
  })

  it('falls back to a generic message for an Error with an empty message', () => {
    const emptyError = new Error('   ')
    const error = toMicrophoneCaptureError(emptyError)
    expect(error.reason).toBe('unknown')
    expect(error.message).toBe('Unexpected failure while opening the microphone.')
  })

  it('falls back to a generic message for a non-Error value', () => {
    const error = toMicrophoneCaptureError('just a string, not an Error')
    expect(error.reason).toBe('unknown')
    expect(error.message).toBe('Unexpected failure while opening the microphone.')
    expect(error.cause).toBe('just a string, not an Error')
  })
})
