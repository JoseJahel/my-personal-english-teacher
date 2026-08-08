import { describe, expect, it } from 'vitest'
import { createModelLoadHistory } from '../storage/model-load-history'
import type { ModelRegistryKey } from '../ia/model-registry'
import {
  OFFLINE_READINESS_MODEL_KEYS,
  offlineReadinessMessageFor,
  resolveOfflineReadiness,
} from './offline-readiness'
import { homeScreenInterfaceTexts } from './interface-texts'

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

function snapshotWithLoaded(...loadedKeys: readonly ModelRegistryKey[]) {
  const storage = createMemoryStorage()
  const history = createModelLoadHistory(storage)
  for (const modelKey of loadedKeys) {
    history.markLoaded(modelKey)
  }
  return createModelLoadHistory(storage).snapshot()
}

describe('OFFLINE_READINESS_MODEL_KEYS', () => {
  it('excludes the vocoder, which never emits model-ready', () => {
    expect(OFFLINE_READINESS_MODEL_KEYS).not.toContain('textToSpeechVocoder')
  })

  it('covers the four models the worker reports as ready', () => {
    expect([...OFFLINE_READINESS_MODEL_KEYS]).toEqual([
      'automaticSpeechRecognition',
      'grammarCorrection',
      'textToSpeech',
      'conversationSuggestions',
    ])
  })
})

describe('resolveOfflineReadiness', () => {
  it('reports none-cached on a browser that never loaded a model', () => {
    expect(resolveOfflineReadiness(snapshotWithLoaded())).toBe('none-cached')
  })

  it('reports partially-cached when only speech recognition was loaded', () => {
    expect(resolveOfflineReadiness(snapshotWithLoaded('automaticSpeechRecognition'))).toBe(
      'partially-cached',
    )
  })

  it('reports partially-cached when every model but one was loaded', () => {
    const snapshot = snapshotWithLoaded(
      'automaticSpeechRecognition',
      'grammarCorrection',
      'textToSpeech',
    )

    expect(resolveOfflineReadiness(snapshot)).toBe('partially-cached')
  })

  it('reports fully-cached once all four tracked models were loaded', () => {
    expect(resolveOfflineReadiness(snapshotWithLoaded(...OFFLINE_READINESS_MODEL_KEYS))).toBe(
      'fully-cached',
    )
  })

  it('does not count the vocoder towards readiness', () => {
    expect(resolveOfflineReadiness(snapshotWithLoaded('textToSpeechVocoder'))).toBe('none-cached')
  })
})

describe('offlineReadinessMessageFor', () => {
  it('warns about the first download when nothing is cached', () => {
    expect(offlineReadinessMessageFor('none-cached')).toBe(
      homeScreenInterfaceTexts.offlineReadiness.noneCached,
    )
  })

  it('explains the mixed state when some models are cached', () => {
    expect(offlineReadinessMessageFor('partially-cached')).toBe(
      homeScreenInterfaceTexts.offlineReadiness.partiallyCached,
    )
  })

  it('confirms offline practice once everything is cached', () => {
    expect(offlineReadinessMessageFor('fully-cached')).toBe(
      homeScreenInterfaceTexts.offlineReadiness.fullyCached,
    )
  })

  it('never returns an empty message', () => {
    for (const readiness of ['none-cached', 'partially-cached', 'fully-cached'] as const) {
      expect(offlineReadinessMessageFor(readiness).trim().length).toBeGreaterThan(0)
    }
  })
})
