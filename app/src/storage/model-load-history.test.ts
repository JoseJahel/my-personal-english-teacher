import { describe, expect, it } from 'vitest'
import { createModelLoadHistory } from './model-load-history'

/** Minimal in-memory Storage double; no jsdom localStorage dependency. */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
  }
}

/** Storage double that throws on every access (Safari private browsing). */
function createThrowingStorage(): Storage {
  const fail = (): never => {
    throw new Error('storage is not available')
  }
  return {
    get length(): number {
      return fail()
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}

describe('createModelLoadHistory', () => {
  it('reports a first download for a model that was never loaded', () => {
    const history = createModelLoadHistory(createMemoryStorage())

    expect(history.snapshot().originFor('automaticSpeechRecognition')).toBe('first-download')
  })

  it('reports cache for a model marked as loaded in an earlier visit', () => {
    const storage = createMemoryStorage()
    createModelLoadHistory(storage).markLoaded('automaticSpeechRecognition')

    const laterVisit = createModelLoadHistory(storage)

    expect(laterVisit.snapshot().originFor('automaticSpeechRecognition')).toBe('cache')
  })

  it('tracks each model independently', () => {
    const storage = createMemoryStorage()
    const history = createModelLoadHistory(storage)
    history.markLoaded('automaticSpeechRecognition')

    const snapshot = createModelLoadHistory(storage).snapshot()

    expect(snapshot.originFor('automaticSpeechRecognition')).toBe('cache')
    expect(snapshot.originFor('grammarCorrection')).toBe('first-download')
  })

  it('keeps a snapshot stable when the model is marked during the load', () => {
    const storage = createMemoryStorage()
    const history = createModelLoadHistory(storage)
    const snapshot = history.snapshot()

    expect(snapshot.originFor('automaticSpeechRecognition')).toBe('first-download')
    history.markLoaded('automaticSpeechRecognition')

    // The download that is still running must not relabel itself mid-flight.
    expect(snapshot.originFor('automaticSpeechRecognition')).toBe('first-download')
  })

  it('reports cache on a snapshot taken after the load completed', () => {
    const storage = createMemoryStorage()
    const history = createModelLoadHistory(storage)
    history.markLoaded('automaticSpeechRecognition')

    expect(history.snapshot().originFor('automaticSpeechRecognition')).toBe('cache')
  })

  it('is idempotent when the same model is marked repeatedly', () => {
    const storage = createMemoryStorage()
    const history = createModelLoadHistory(storage)
    history.markLoaded('textToSpeech')
    history.markLoaded('textToSpeech')

    expect(storage.length).toBe(1)
    expect(history.snapshot().originFor('textToSpeech')).toBe('cache')
  })

  it('degrades to first-download when storage access throws', () => {
    const history = createModelLoadHistory(createThrowingStorage())

    expect(history.snapshot().originFor('automaticSpeechRecognition')).toBe('first-download')
  })

  it('does not surface an error when marking against throwing storage', () => {
    const history = createModelLoadHistory(createThrowingStorage())

    expect(() => history.markLoaded('automaticSpeechRecognition')).not.toThrow()
  })

  it('degrades to first-download when storage is absent', () => {
    const history = createModelLoadHistory(null)

    expect(history.snapshot().originFor('conversationSuggestions')).toBe('first-download')
    expect(() => history.markLoaded('conversationSuggestions')).not.toThrow()
  })
})
