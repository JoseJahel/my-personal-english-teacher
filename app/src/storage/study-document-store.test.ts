import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createSampleStudyDocument } from '../study/create-sample-study-document'
import { createStudySession, markSectionCompleted } from '../study/study-session'
import {
  createStudyDocumentStore,
  STUDY_DOCUMENT_DATABASE_VERSION,
  STUDY_DOCUMENT_STORE,
  STUDY_PROGRESS_STORE,
  upgradeStudyDocumentDatabase,
} from './study-document-store'
import {
  createStudyProgressRecord,
  studySessionFromProgress,
} from './study-document-types'

describe('upgradeStudyDocumentDatabase', () => {
  it('exposes schema version 2', () => {
    expect(STUDY_DOCUMENT_DATABASE_VERSION).toBe(2)
  })

  it('creates the progress store from v0', () => {
    const createdStores: string[] = []
    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => createdStores.includes(name),
      },
      createObjectStore: (name: string) => {
        createdStores.push(name)
        return { createIndex: () => undefined }
      },
      deleteObjectStore: () => undefined,
    }
    upgradeStudyDocumentDatabase(fakeDb as unknown as IDBDatabase, 0, 2)
    expect(createdStores).toContain(STUDY_PROGRESS_STORE)
    expect(createdStores).not.toContain(STUDY_DOCUMENT_STORE)
  })

  it('deletes the v1 document store when upgrading to v2', () => {
    const deleted: string[] = []
    const createdStores: string[] = []
    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => name === STUDY_DOCUMENT_STORE,
      },
      createObjectStore: (name: string) => {
        createdStores.push(name)
        return { createIndex: () => undefined }
      },
      deleteObjectStore: (name: string) => {
        deleted.push(name)
      },
    }
    upgradeStudyDocumentDatabase(fakeDb as unknown as IDBDatabase, 1, 2)
    expect(deleted).toContain(STUDY_DOCUMENT_STORE)
    expect(createdStores).toContain(STUDY_PROGRESS_STORE)
  })
})

describe('study progress record factory', () => {
  it('stores catalog ids and session, not lesson bodies', () => {
    const document = createSampleStudyDocument()
    const session = markSectionCompleted(createStudySession(document.id), document.sections[0]!.id)
    const record = createStudyProgressRecord(document, session, '2026-08-19T10:00:00.000Z')
    expect(record.catalogId).toBe(document.id)
    expect(record.sectionIds).toEqual(document.sections.map((section) => section.id))
    expect(record.completedSectionIds).toEqual(session.completedSectionIds)
    expect(Object.keys(record)).not.toContain('pages')
    expect(Object.keys(record)).not.toContain('bodyText')
    expect(Object.keys(record)).not.toContain('sections')
    expect(studySessionFromProgress(record, document)?.completedSectionIds).toEqual(
      session.completedSectionIds,
    )
  })

  it('starts a new session when catalog ids change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = createSampleStudyDocument()
    const record = {
      ...createStudyProgressRecord(document, createStudySession(document.id)),
      sectionIds: ['old-id'],
    }
    expect(studySessionFromProgress(record, document)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('drops an invalid session index without discarding the progress', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = createSampleStudyDocument()
    const record = {
      ...createStudyProgressRecord(document, createStudySession(document.id)),
      activeSectionIndex: 99,
      completedSectionIds: ['nope', document.sections[0]!.id],
    }
    const session = studySessionFromProgress(record, document)
    expect(session?.activeSectionIndex).toBe(0)
    expect(session?.completedSectionIds).toEqual([document.sections[0]!.id])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('createStudyDocumentStore', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves and returns progress for a catalog id from a fake IndexedDB', async () => {
    const store = await createStudyDocumentStore(new IDBFactory())
    const document = createSampleStudyDocument()
    const session = markSectionCompleted(createStudySession(document.id), document.sections[0]!.id)
    await store.saveProgress(document, session)
    const loaded = await store.getProgress(document.id)
    expect(loaded?.catalogId).toBe(document.id)
    expect(loaded?.completedSectionIds).toEqual(session.completedSectionIds)
    expect(loaded).not.toHaveProperty('bodyText')
    expect(await store.getProgress('missing-catalog')).toBeNull()
    store.close()
  })
})
