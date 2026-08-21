import { useCallback, useEffect, useRef, useState } from 'react'
import { loadProcessedLessons } from '../study/load-processed-lessons'
import { bookmarkFromSection } from '../study/study-bookmark'
import {
  clearSessionBookmark,
  createStudySession,
  goToNextSection,
  goToPreviousSection,
  markSectionCompleted,
  selectSection,
  setSessionBookmark,
  studyProgress01,
} from '../study/study-session'
import type { StudyBookmark, StudyDocument, StudySection, StudySession } from '../study/study-types'
import {
  createStudyDocumentStore,
  type StudyDocumentStore,
} from '../storage/study-document-store'
import { studySessionFromProgress } from '../storage/study-document-types'
import { studyInterfaceTexts } from './study-interface-texts'

export type StudyUiStatus = 'loading' | 'empty' | 'ready'

export interface UseStudySessionOptions {
  readonly createStore?: () => Promise<StudyDocumentStore>
  readonly loadCatalog?: () => StudyDocument | null
}

export interface UseStudySessionResult {
  readonly status: StudyUiStatus
  readonly storageWarning: string | null
  readonly document: StudyDocument | null
  readonly session: StudySession | null
  readonly activeSection: StudySection | null
  readonly progress01: number
  readonly canGoNext: boolean
  readonly canGoPrevious: boolean
  readonly bookmark: StudyBookmark | null
  selectSectionIndex: (index: number) => void
  goNext: () => void
  goPrevious: () => void
  plantBookmark: () => void
  clearBookmark: () => void
}

function readCatalog(loadCatalog: (() => StudyDocument | null) | undefined): StudyDocument | null {
  try {
    const document = (loadCatalog ?? loadProcessedLessons)()
    if (!document || document.sections.length === 0) {
      return null
    }
    return document
  } catch (error: unknown) {
    console.warn('Processed lesson catalog failed to load.', error)
    return null
  }
}

export function useStudySession(options: UseStudySessionOptions = {}): UseStudySessionResult {
  const optionsRef = useRef(options)
  const storeRef = useRef<StudyDocumentStore | null>(null)

  useEffect(() => {
    optionsRef.current = options
  })

  const [status, setStatus] = useState<StudyUiStatus>('loading')
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [studyDocument, setStudyDocument] = useState<StudyDocument | null>(null)
  const [session, setSession] = useState<StudySession | null>(null)

  const persist = useCallback(async (nextDocument: StudyDocument, nextSession: StudySession) => {
    const store = storeRef.current
    if (!store) {
      return
    }
    try {
      await store.saveProgress(nextDocument, nextSession)
    } catch (error: unknown) {
      console.warn('Study progress persist failed.', error)
      setStorageWarning(studyInterfaceTexts.storageUnavailableHint)
    }
  }, [])

  const activate = useCallback(
    (nextDocument: StudyDocument, nextSession: StudySession, persistNow: boolean) => {
      const section = nextDocument.sections[nextSession.activeSectionIndex]
      const marked = section ? markSectionCompleted(nextSession, section.id) : nextSession
      setStudyDocument(nextDocument)
      setSession(marked)
      setStatus('ready')
      if (persistNow) {
        void persist(nextDocument, marked)
      }
    },
    [persist],
  )

  useEffect(() => {
    let cancelled = false
    const catalog = readCatalog(optionsRef.current.loadCatalog)
    if (!catalog) {
      setStatus('empty')
      return () => {
        cancelled = true
      }
    }

    const createStore = optionsRef.current.createStore ?? createStudyDocumentStore
    createStore()
      .then(async (store) => {
        if (cancelled) {
          store.close()
          return
        }
        storeRef.current = store
        const progress = await store.getProgress(catalog.id)
        if (cancelled) {
          return
        }
        const restored = progress ? studySessionFromProgress(progress, catalog) : null
        activate(catalog, restored ?? createStudySession(catalog.id), restored === null)
      })
      .catch((error: unknown) => {
        console.warn('Study progress store unavailable.', error)
        if (!cancelled) {
          setStorageWarning(studyInterfaceTexts.storageUnavailableHint)
          activate(catalog, createStudySession(catalog.id), false)
        }
      })
    return () => {
      cancelled = true
      storeRef.current?.close()
      storeRef.current = null
    }
  }, [activate])

  const selectSectionIndex = useCallback(
    (index: number) => {
      if (!studyDocument || !session) {
        return
      }
      const next = selectSection(session, index, studyDocument.sections.length)
      activate(studyDocument, next, true)
    },
    [activate, studyDocument, session],
  )

  const goNext = useCallback(() => {
    if (!studyDocument || !session) {
      return
    }
    const current = studyDocument.sections[session.activeSectionIndex]
    const marked = current ? markSectionCompleted(session, current.id) : session
    const next = goToNextSection(marked, studyDocument.sections.length)
    activate(studyDocument, next, true)
  }, [activate, studyDocument, session])

  const goPrevious = useCallback(() => {
    if (!studyDocument || !session) {
      return
    }
    activate(studyDocument, goToPreviousSection(session), true)
  }, [activate, studyDocument, session])

  const persistSession = useCallback(
    (nextSession: StudySession) => {
      setSession(nextSession)
      if (studyDocument) {
        void persist(studyDocument, nextSession)
      }
    },
    [persist, studyDocument],
  )

  const plantBookmark = useCallback(() => {
    if (!studyDocument || !session) {
      return
    }
    const section = studyDocument.sections[session.activeSectionIndex]
    if (!section) {
      return
    }
    const bookmark = bookmarkFromSection(
      section,
      session.activeSectionIndex + 1,
      new Date().toISOString(),
    )
    if (!bookmark) {
      return
    }
    persistSession(setSessionBookmark(session, bookmark))
  }, [persistSession, session, studyDocument])

  const clearBookmark = useCallback(() => {
    if (!session) {
      return
    }
    persistSession(clearSessionBookmark(session))
  }, [persistSession, session])

  const sectionCount = studyDocument?.sections.length ?? 0
  const activeIndex = session?.activeSectionIndex ?? 0
  const activeSection = studyDocument?.sections[activeIndex] ?? null
  const progress01 = session ? studyProgress01(session, sectionCount) : 0

  return {
    status,
    storageWarning,
    document: studyDocument,
    session,
    activeSection,
    progress01,
    canGoNext: Boolean(session && sectionCount > 0 && activeIndex < sectionCount - 1),
    canGoPrevious: Boolean(session && activeIndex > 0),
    bookmark: session?.bookmark ?? null,
    selectSectionIndex,
    goNext,
    goPrevious,
    plantBookmark,
    clearBookmark,
  }
}
