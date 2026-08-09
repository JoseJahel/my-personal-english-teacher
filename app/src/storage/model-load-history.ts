/**
 * Remembers which models have already completed a load in this browser, so the
 * UI can tell a first-time download apart from a load served from cache.
 *
 * Why not inspect the transformers.js cache directly: on @huggingface/transformers
 * 3.8.1 a cached read emits the same byte-level `progress` events as a network
 * download (verified with instrumented runs — no network requests, identical
 * events), so the events carry no origin signal. The cache name is also a
 * library internal that can change between releases.
 *
 * This history lives in `localStorage`, which the browser clears together with
 * Cache storage when the user clears site data. That shared lifetime is the
 * point: the history cannot claim a model is cached after the weights are gone.
 *
 * MAIN THREAD ONLY — `localStorage` is not available inside a Web Worker.
 * The inference worker must not import this module.
 */

import type { ModelRegistryKey } from '../ia/model-registry'

const STORAGE_KEY_PREFIX = 'mpet:model-loaded:'
const STORED_VALUE = '1'

/** Where a model load is being served from, from the learner's point of view. */
export type ModelLoadOrigin = 'first-download' | 'cache'

/**
 * Read-only view of the history taken before a load starts.
 *
 * Loads must resolve their origin against a snapshot rather than querying live:
 * `markLoaded` flips the flag, so a live query would report `cache` halfway
 * through the very download that is still running.
 */
export type ModelLoadHistorySnapshot = {
  originFor(modelKey: ModelRegistryKey): ModelLoadOrigin
}

export type ModelLoadHistory = {
  /** Captures the current state so origins stay stable for the whole load. */
  snapshot(): ModelLoadHistorySnapshot
  /** Records that `modelKey` finished loading successfully at least once. */
  markLoaded(modelKey: ModelRegistryKey): void
}

function storageKeyFor(modelKey: ModelRegistryKey): string {
  return `${STORAGE_KEY_PREFIX}${modelKey}`
}

/**
 * Creates a history backed by `storage`.
 *
 * Every access is guarded: Safari private browsing and storage-disabled
 * profiles throw on `localStorage` access rather than returning null. A failure
 * degrades to "never loaded before", which shows the conservative
 * first-download copy — a slower-sounding message is a far better failure than
 * promising an offline start the browser cannot deliver.
 */
export function createModelLoadHistory(
  storage: Storage | null = readDefaultStorage(),
): ModelLoadHistory {
  function hasLoadedBefore(modelKey: ModelRegistryKey): boolean {
    if (!storage) {
      return false
    }
    try {
      return storage.getItem(storageKeyFor(modelKey)) === STORED_VALUE
    } catch {
      return false
    }
  }

  return {
    snapshot(): ModelLoadHistorySnapshot {
      // Memoises whichever answer came first, in both directions. Caching only
      // the `cache` outcome would let a running first download relabel itself
      // the moment `markLoaded` lands.
      const resolvedOrigins = new Map<ModelRegistryKey, ModelLoadOrigin>()
      return {
        originFor(modelKey: ModelRegistryKey): ModelLoadOrigin {
          const alreadyResolved = resolvedOrigins.get(modelKey)
          if (alreadyResolved) {
            return alreadyResolved
          }
          const origin: ModelLoadOrigin = hasLoadedBefore(modelKey) ? 'cache' : 'first-download'
          resolvedOrigins.set(modelKey, origin)
          return origin
        },
      }
    },

    markLoaded(modelKey: ModelRegistryKey): void {
      if (!storage) {
        return
      }
      try {
        storage.setItem(storageKeyFor(modelKey), STORED_VALUE)
      } catch {
        // Quota exhausted or storage disabled: the next visit simply shows the
        // first-download copy again. Never break a working load over this.
      }
    },
  }
}

function readDefaultStorage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}
