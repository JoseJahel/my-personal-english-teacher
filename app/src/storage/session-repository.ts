/**
 * IndexedDB repository for practice sessions and turns (no raw audio).
 */

import {
  openPracticeDatabase,
  PRACTICE_SESSIONS_STORE,
  PRACTICE_TURNS_STORE,
  SESSION_UPDATED_AT_INDEX,
  TURN_CREATED_AT_INDEX,
  TURN_SESSION_ID_INDEX,
} from './database-schema'
import type {
  CreatePracticeTurnInput,
  PracticeSessionRecord,
  PracticeTurnRecord,
  StoredPracticeScenarioId,
} from './practice-session-types'
import {
  createPracticeSessionRecord,
  createPracticeTurnRecord,
} from './practice-session-types'

export interface PracticeSessionRepository {
  ensureSessionForScenario: (
    scenarioId: StoredPracticeScenarioId,
  ) => Promise<PracticeSessionRecord>
  saveTurn: (input: CreatePracticeTurnInput) => Promise<PracticeTurnRecord>
  listRecentTurns: (limit?: number) => Promise<PracticeTurnRecord[]>
  listTurnsForSession: (sessionId: string) => Promise<PracticeTurnRecord[]>
  close: () => void
}

/**
 * Create a repository bound to the practice database.
 * Soft-fails are left to the caller (UI should not block the demo on storage errors).
 */
export async function createPracticeSessionRepository(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<PracticeSessionRepository> {
  const database = await openPracticeDatabase(indexedDb)

  async function ensureSessionForScenario(
    scenarioId: StoredPracticeScenarioId,
  ): Promise<PracticeSessionRecord> {
    const recentSessions = await listSessionsNewestFirst(1)
    const latest = recentSessions[0]
    if (latest && latest.scenarioId === scenarioId) {
      return latest
    }
    const session = createPracticeSessionRecord(scenarioId)
    await putRecord(PRACTICE_SESSIONS_STORE, session)
    return session
  }

  async function saveTurn(input: CreatePracticeTurnInput): Promise<PracticeTurnRecord> {
    const turn = createPracticeTurnRecord(input)
    await putRecord(PRACTICE_TURNS_STORE, turn)

    const session = await getRecord<PracticeSessionRecord>(
      PRACTICE_SESSIONS_STORE,
      input.sessionId,
    )
    if (session) {
      const updated: PracticeSessionRecord = {
        ...session,
        updatedAtIso: turn.createdAtIso,
      }
      await putRecord(PRACTICE_SESSIONS_STORE, updated)
    }

    return turn
  }

  async function listRecentTurns(limit = 12): Promise<PracticeTurnRecord[]> {
    const all = await getAllFromIndex<PracticeTurnRecord>(
      PRACTICE_TURNS_STORE,
      TURN_CREATED_AT_INDEX,
    )
    // Index order is ascending; newest last.
    return all.slice(-limit).reverse()
  }

  async function listTurnsForSession(sessionId: string): Promise<PracticeTurnRecord[]> {
    return getAllByIndexValue<PracticeTurnRecord>(
      PRACTICE_TURNS_STORE,
      TURN_SESSION_ID_INDEX,
      sessionId,
    )
  }

  async function listSessionsNewestFirst(limit: number): Promise<PracticeSessionRecord[]> {
    const all = await getAllFromIndex<PracticeSessionRecord>(
      PRACTICE_SESSIONS_STORE,
      SESSION_UPDATED_AT_INDEX,
    )
    return all.slice(-limit).reverse()
  }

  function putRecord<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put(value)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to put into ${storeName}.`))
    })
  }

  function getRecord<T>(storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to get from ${storeName}.`))
    })
  }

  function getAllFromIndex<T>(storeName: string, indexName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll()
      request.onsuccess = () => resolve((request.result as T[]) ?? [])
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to list ${storeName}.`))
    })
  }

  function getAllByIndexValue<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll(value)
      request.onsuccess = () => resolve((request.result as T[]) ?? [])
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to query ${storeName}.`))
    })
  }

  return {
    ensureSessionForScenario,
    saveTurn,
    listRecentTurns,
    listTurnsForSession,
    close: () => {
      database.close()
    },
  }
}
