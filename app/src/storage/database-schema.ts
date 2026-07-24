/**
 * Versioned IndexedDB schema for practice progress.
 * Bump DATABASE_VERSION and extend onUpgrade when the shape changes.
 */

export const PRACTICE_DATABASE_NAME = 'my-personal-english-teacher'
/** Schema version — increment only with a matching upgrade path. */
export const PRACTICE_DATABASE_VERSION = 1

export const PRACTICE_SESSIONS_STORE = 'practice_sessions'
export const PRACTICE_TURNS_STORE = 'practice_turns'

export const SESSION_UPDATED_AT_INDEX = 'updatedAtIso'
export const TURN_SESSION_ID_INDEX = 'sessionId'
export const TURN_CREATED_AT_INDEX = 'createdAtIso'

/**
 * Apply migrations for a given new version.
 * v1: create sessions + turns object stores and indexes.
 */
export function upgradePracticeDatabase(
  database: IDBDatabase,
  oldVersion: number,
  newVersion: number | null,
): void {
  const targetVersion = newVersion ?? PRACTICE_DATABASE_VERSION
  if (oldVersion < 1 && targetVersion >= 1) {
    createVersion1Stores(database)
  }
}

function createVersion1Stores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(PRACTICE_SESSIONS_STORE)) {
    const sessions = database.createObjectStore(PRACTICE_SESSIONS_STORE, {
      keyPath: 'id',
    })
    sessions.createIndex(SESSION_UPDATED_AT_INDEX, 'updatedAtIso', { unique: false })
  }

  if (!database.objectStoreNames.contains(PRACTICE_TURNS_STORE)) {
    const turns = database.createObjectStore(PRACTICE_TURNS_STORE, {
      keyPath: 'id',
    })
    turns.createIndex(TURN_SESSION_ID_INDEX, 'sessionId', { unique: false })
    turns.createIndex(TURN_CREATED_AT_INDEX, 'createdAtIso', { unique: false })
  }
}

/** Open (or create) the practice database. */
export function openPracticeDatabase(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<IDBDatabase> {
  if (!indexedDb) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(PRACTICE_DATABASE_NAME, PRACTICE_DATABASE_VERSION)

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const database = request.result
      upgradePracticeDatabase(database, event.oldVersion, event.newVersion)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open practice IndexedDB.'))
    }
  })
}
