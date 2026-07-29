/**
 * IndexedDB store for ASR benchmark fixtures (reference text + recorded audio).
 *
 * This database is SEPARATE from the practice-progress database
 * (see database-schema.ts / session-repository.ts) so it can be wiped
 * independently without touching a learner's practice history.
 *
 * Benchmark fixtures hold raw recorded voice audio and are local-only tooling
 * for regression-testing ASR/scoring quality — they must never be committed
 * to Git or leave the machine except via explicit export.
 *
 * Record shape and JSON (de)serialization live in benchmark-fixture-types.ts;
 * this module only owns the IndexedDB schema and the store built on top of it.
 */

import type { BenchmarkFixtureRecord, CreateBenchmarkFixtureInput } from './benchmark-fixture-types'
import { createBenchmarkFixtureRecord } from './benchmark-fixture-types'

export const BENCHMARK_FIXTURE_DATABASE_NAME = 'my-personal-english-teacher-asr-benchmark'
/** Schema version — increment only with a matching upgrade path. */
export const BENCHMARK_FIXTURE_DATABASE_VERSION = 1

export const BENCHMARK_FIXTURE_STORE = 'benchmark_fixtures'

export const BENCHMARK_FIXTURE_CREATED_AT_INDEX = 'createdAtIso'

/**
 * Apply migrations for a given new version.
 * v1: create the fixtures object store and its createdAtIso index.
 */
export function upgradeBenchmarkFixtureDatabase(
  database: IDBDatabase,
  oldVersion: number,
  newVersion: number | null,
): void {
  const targetVersion = newVersion ?? BENCHMARK_FIXTURE_DATABASE_VERSION
  if (oldVersion < 1 && targetVersion >= 1) {
    createVersion1Stores(database)
  }
}

function createVersion1Stores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(BENCHMARK_FIXTURE_STORE)) {
    const fixtures = database.createObjectStore(BENCHMARK_FIXTURE_STORE, {
      keyPath: 'id',
    })
    fixtures.createIndex(BENCHMARK_FIXTURE_CREATED_AT_INDEX, 'createdAtIso', {
      unique: false,
    })
  }
}

/** Open (or create) the benchmark fixture database. */
export function openBenchmarkFixtureDatabase(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<IDBDatabase> {
  if (!indexedDb) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(
      BENCHMARK_FIXTURE_DATABASE_NAME,
      BENCHMARK_FIXTURE_DATABASE_VERSION,
    )

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const database = request.result
      upgradeBenchmarkFixtureDatabase(database, event.oldVersion, event.newVersion)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open benchmark fixture IndexedDB.'))
    }
  })
}

export interface BenchmarkFixtureStore {
  saveFixture: (input: CreateBenchmarkFixtureInput) => Promise<BenchmarkFixtureRecord>
  listFixtures: () => Promise<BenchmarkFixtureRecord[]>
  deleteFixture: (id: string) => Promise<void>
  close: () => void
}

/**
 * Create a store bound to the benchmark fixture database.
 */
export async function createBenchmarkFixtureStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<BenchmarkFixtureStore> {
  const database = await openBenchmarkFixtureDatabase(indexedDb)

  async function saveFixture(input: CreateBenchmarkFixtureInput): Promise<BenchmarkFixtureRecord> {
    const fixture = createBenchmarkFixtureRecord(input)
    await putRecord(fixture)
    return fixture
  }

  async function listFixtures(): Promise<BenchmarkFixtureRecord[]> {
    // Index order is ascending; oldest first — the benchmark screen decides presentation order.
    return getAllFromCreatedAtIndex()
  }

  async function deleteFixture(id: string): Promise<void> {
    return removeRecord(id)
  }

  function putRecord(value: BenchmarkFixtureRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(BENCHMARK_FIXTURE_STORE, 'readwrite')
      const store = transaction.objectStore(BENCHMARK_FIXTURE_STORE)
      const request = store.put(value)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to put into ${BENCHMARK_FIXTURE_STORE}.`))
    })
  }

  function getAllFromCreatedAtIndex(): Promise<BenchmarkFixtureRecord[]> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(BENCHMARK_FIXTURE_STORE, 'readonly')
      const store = transaction.objectStore(BENCHMARK_FIXTURE_STORE)
      const index = store.index(BENCHMARK_FIXTURE_CREATED_AT_INDEX)
      const request = index.getAll()
      request.onsuccess = () => resolve((request.result as BenchmarkFixtureRecord[]) ?? [])
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to list ${BENCHMARK_FIXTURE_STORE}.`))
    })
  }

  function removeRecord(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(BENCHMARK_FIXTURE_STORE, 'readwrite')
      const store = transaction.objectStore(BENCHMARK_FIXTURE_STORE)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to delete from ${BENCHMARK_FIXTURE_STORE}.`))
    })
  }

  return {
    saveFixture,
    listFixtures,
    deleteFixture,
    close: () => {
      database.close()
    },
  }
}
