import { describe, expect, it } from 'vitest'
import {
  PRACTICE_DATABASE_VERSION,
  PRACTICE_SESSIONS_STORE,
  PRACTICE_TURNS_STORE,
  upgradePracticeDatabase,
} from './database-schema'

describe('upgradePracticeDatabase', () => {
  it('exposes schema version 1', () => {
    expect(PRACTICE_DATABASE_VERSION).toBe(1)
  })

  it('creates v1 stores when upgrading from 0', () => {
    const createdStores: string[] = []
    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => createdStores.includes(name),
      },
      createObjectStore: (name: string) => {
        createdStores.push(name)
        return {
          createIndex: () => undefined,
        }
      },
    }

    upgradePracticeDatabase(fakeDb as unknown as IDBDatabase, 0, 1)
    expect(createdStores).toContain(PRACTICE_SESSIONS_STORE)
    expect(createdStores).toContain(PRACTICE_TURNS_STORE)
  })
})
