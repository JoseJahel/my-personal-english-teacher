import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createSampleStudyDocument } from '../study/create-sample-study-document'
import { bookmarkFromSection } from '../study/study-bookmark'
import {
  createStudySession,
  markSectionCompleted,
  setSessionBookmark,
} from '../study/study-session'
import { applyPracticeSrsResult, createPracticeSrsCard } from '../study/practice-srs'
import {
  createStudyDocumentStore,
  createStudyPracticeSrsStore,
  STUDY_DOCUMENT_DATABASE_VERSION,
  STUDY_DOCUMENT_STORE,
  STUDY_PRACTICE_SRS_STORE,
  STUDY_PROGRESS_STORE,
  upgradeStudyDocumentDatabase,
} from './study-document-store'
import {
  createStudyProgressRecord,
  studySessionFromProgress,
} from './study-document-types'

describe('upgradeStudyDocumentDatabase', () => {
  it('exposes schema version 3', () => {
    expect(STUDY_DOCUMENT_DATABASE_VERSION).toBe(3)
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
    upgradeStudyDocumentDatabase(fakeDb as unknown as IDBDatabase, 0, 3)
    expect(createdStores).toContain(STUDY_PROGRESS_STORE)
    expect(createdStores).toContain(STUDY_PRACTICE_SRS_STORE)
    expect(createdStores).not.toContain(STUDY_DOCUMENT_STORE)
  })

  it('deletes the v1 document store when upgrading to v3', () => {
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
    upgradeStudyDocumentDatabase(fakeDb as unknown as IDBDatabase, 1, 3)
    expect(deleted).toContain(STUDY_DOCUMENT_STORE)
    expect(createdStores).toContain(STUDY_PROGRESS_STORE)
    expect(createdStores).toContain(STUDY_PRACTICE_SRS_STORE)
  })

  it('adds the practice SRS store when upgrading from v2', () => {
    const createdStores: string[] = []
    const fakeDb = {
      objectStoreNames: {
        contains: (name: string) => name === STUDY_PROGRESS_STORE,
      },
      createObjectStore: (name: string) => {
        createdStores.push(name)
        return { createIndex: () => undefined }
      },
      deleteObjectStore: () => undefined,
    }
    upgradeStudyDocumentDatabase(fakeDb as unknown as IDBDatabase, 2, 3)
    expect(createdStores).toEqual([STUDY_PRACTICE_SRS_STORE])
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

  it('round-trips a bookmark and drops an unknown id without losing completed sections', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = createSampleStudyDocument()
    const section = document.sections[0]!
    const bookmark = bookmarkFromSection(section, 1, '2026-08-21T00:00:00.000Z')
    const session = setSessionBookmark(
      markSectionCompleted(createStudySession(document.id), section.id),
      bookmark!,
    )
    const record = createStudyProgressRecord(document, session, '2026-08-21T00:00:00.000Z')
    expect(record.bookmark).toEqual(bookmark)
    expect(studySessionFromProgress(record, document)?.bookmark).toEqual(bookmark)

    const ghost = studySessionFromProgress(
      { ...record, bookmark: { ...bookmark!, sectionId: 'ghost-lesson' } },
      document,
    )
    expect(ghost?.bookmark).toBeNull()
    expect(ghost?.completedSectionIds).toEqual([section.id])
    expect(ghost?.activeSectionIndex).toBe(session.activeSectionIndex)
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

  it('persists a bookmark on the same progress record', async () => {
    const store = await createStudyDocumentStore(new IDBFactory())
    const document = createSampleStudyDocument()
    const section = document.sections[1]!
    const bookmark = bookmarkFromSection(section, 2, '2026-08-21T00:00:00.000Z')
    const session = setSessionBookmark(createStudySession(document.id), bookmark!)
    await store.saveProgress(document, session)
    const loaded = await store.getProgress(document.id)
    expect(loaded?.bookmark).toEqual(bookmark)
    expect(STUDY_DOCUMENT_DATABASE_VERSION).toBe(3)
    store.close()
  })
})

describe('createStudyPracticeSrsStore', () => {
  it('round-trips a card and skips an invalid record without dropping others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const indexedDb = new IDBFactory()
    const store = await createStudyPracticeSrsStore(indexedDb)
    const card = applyPracticeSrsResult(createPracticeSrsCard('v1'), 'v1', true, 1_700_000_000_000, 'besingular')
    await store.putCard(card)
    expect(await store.getCard('v1')).toEqual(card)

    const rawDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open('my-personal-english-teacher-study', 3)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = rawDb.transaction(STUDY_PRACTICE_SRS_STORE, 'readwrite')
      const request = transaction.objectStore(STUDY_PRACTICE_SRS_STORE).put({ itemId: '   ', ease: 2 })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    rawDb.close()

    const listed = await store.getAllCards()
    expect(listed).toEqual([card])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    store.close()
  })
})
