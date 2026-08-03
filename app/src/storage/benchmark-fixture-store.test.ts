import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_FIXTURE_CREATED_AT_INDEX,
  BENCHMARK_FIXTURE_DATABASE_VERSION,
  BENCHMARK_FIXTURE_STORE,
  upgradeBenchmarkFixtureDatabase,
} from './benchmark-fixture-store'

describe('upgradeBenchmarkFixtureDatabase', () => {
  it('exposes schema version 1', () => {
    expect(BENCHMARK_FIXTURE_DATABASE_VERSION).toBe(1)
  })

  it('creates the fixtures store and its createdAtIso index when upgrading from 0', () => {
    const createdStores: string[] = []
    const createdIndexesByStore = new Map<string, string[]>()
    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => createdStores.includes(name),
      },
      createObjectStore: (name: string) => {
        createdStores.push(name)
        createdIndexesByStore.set(name, [])
        return {
          createIndex: (indexName: string) => {
            createdIndexesByStore.get(name)!.push(indexName)
          },
        }
      },
    }

    upgradeBenchmarkFixtureDatabase(fakeDb as unknown as IDBDatabase, 0, 1)

    expect(createdStores).toContain(BENCHMARK_FIXTURE_STORE)
    expect(createdIndexesByStore.get(BENCHMARK_FIXTURE_STORE)).toContain(
      BENCHMARK_FIXTURE_CREATED_AT_INDEX,
    )
  })

  it('does not recreate the store when it already exists', () => {
    let createCount = 0
    const fakeDb = {
      objectStoreNames: {
        contains: () => true,
      },
      createObjectStore: () => {
        createCount += 1
        return { createIndex: () => undefined }
      },
    }

    upgradeBenchmarkFixtureDatabase(fakeDb as unknown as IDBDatabase, 0, 1)
    expect(createCount).toBe(0)
  })
})
