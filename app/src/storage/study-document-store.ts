/**
 * IndexedDB for study progress (catalog id + index + completed ids).
 * Separate from the practice-progress database so it can be wiped independently.
 */

import type { StudyDocument, StudySession } from '../study/study-types'
import type { StudyProgressRecord } from './study-document-types'
import { createStudyProgressRecord } from './study-document-types'

export const STUDY_DOCUMENT_DATABASE_NAME = 'my-personal-english-teacher-study'
export const STUDY_DOCUMENT_DATABASE_VERSION = 2
export const STUDY_DOCUMENT_STORE = 'study_documents'
export const STUDY_PROGRESS_STORE = 'study_progress'

export function upgradeStudyDocumentDatabase(
  database: IDBDatabase,
  oldVersion: number,
  newVersion: number | null,
): void {
  const targetVersion = newVersion ?? STUDY_DOCUMENT_DATABASE_VERSION
  if (oldVersion < 2 && targetVersion >= 2) {
    if (database.objectStoreNames.contains(STUDY_DOCUMENT_STORE)) {
      database.deleteObjectStore(STUDY_DOCUMENT_STORE)
    }
    if (!database.objectStoreNames.contains(STUDY_PROGRESS_STORE)) {
      database.createObjectStore(STUDY_PROGRESS_STORE, { keyPath: 'catalogId' })
    }
  }
}

export function openStudyDocumentDatabase(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<IDBDatabase> {
  if (!indexedDb) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(STUDY_DOCUMENT_DATABASE_NAME, STUDY_DOCUMENT_DATABASE_VERSION)
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      upgradeStudyDocumentDatabase(request.result, event.oldVersion, event.newVersion)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open study document IndexedDB.'))
  })
}

export interface StudyDocumentStore {
  saveProgress: (document: StudyDocument, session: StudySession) => Promise<StudyProgressRecord>
  getProgress: (catalogId: string) => Promise<StudyProgressRecord | null>
  close: () => void
}

export async function createStudyDocumentStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
): Promise<StudyDocumentStore> {
  const database = await openStudyDocumentDatabase(indexedDb)

  function putRecord(value: StudyProgressRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STUDY_PROGRESS_STORE, 'readwrite')
      const request = transaction.objectStore(STUDY_PROGRESS_STORE).put(value)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to put into ${STUDY_PROGRESS_STORE}.`))
    })
  }

  function getRecord(catalogId: string): Promise<StudyProgressRecord | null> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STUDY_PROGRESS_STORE, 'readonly')
      const request = transaction.objectStore(STUDY_PROGRESS_STORE).get(catalogId)
      request.onsuccess = () =>
        resolve((request.result as StudyProgressRecord | undefined) ?? null)
      request.onerror = () =>
        reject(request.error ?? new Error(`Failed to get ${STUDY_PROGRESS_STORE}.`))
    })
  }

  async function saveProgress(
    document: StudyDocument,
    session: StudySession,
  ): Promise<StudyProgressRecord> {
    const record = createStudyProgressRecord(document, session)
    await putRecord(record)
    return record
  }

  return {
    saveProgress,
    getProgress: getRecord,
    close: () => {
      database.close()
    },
  }
}
