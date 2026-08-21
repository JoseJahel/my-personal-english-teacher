import type { StudyBookmark, StudySession } from './study-types'

export function createStudySession(documentId: string): StudySession {
  return {
    documentId,
    activeSectionIndex: 0,
    completedSectionIds: [],
    bookmark: null,
  }
}

export function setSessionBookmark(session: StudySession, bookmark: StudyBookmark): StudySession {
  return { ...session, bookmark }
}

export function clearSessionBookmark(session: StudySession): StudySession {
  return { ...session, bookmark: null }
}

/** Out-of-range indexes are a no-op (no silent clamp). */
export function selectSection(
  session: StudySession,
  index: number,
  sectionCount: number,
): StudySession {
  if (!Number.isInteger(index) || index < 0 || index >= sectionCount) {
    return session
  }
  if (index === session.activeSectionIndex) {
    return session
  }
  return { ...session, activeSectionIndex: index }
}

/** Last section: stay put. */
export function goToNextSection(session: StudySession, sectionCount: number): StudySession {
  if (sectionCount <= 0 || session.activeSectionIndex >= sectionCount - 1) {
    return session
  }
  return { ...session, activeSectionIndex: session.activeSectionIndex + 1 }
}

/** First section: stay put. */
export function goToPreviousSection(session: StudySession): StudySession {
  if (session.activeSectionIndex <= 0) {
    return session
  }
  return { ...session, activeSectionIndex: session.activeSectionIndex - 1 }
}

export function markSectionCompleted(session: StudySession, sectionId: string): StudySession {
  if (sectionId.length === 0 || session.completedSectionIds.includes(sectionId)) {
    return session
  }
  return {
    ...session,
    completedSectionIds: [...session.completedSectionIds, sectionId],
  }
}

/** Completed-section ratio in [0, 1]. Empty syllabus → 0. */
export function studyProgress01(session: StudySession, sectionCount: number): number {
  if (sectionCount <= 0) {
    return 0
  }
  const completed = session.completedSectionIds.length
  if (completed <= 0) {
    return 0
  }
  if (completed >= sectionCount) {
    return 1
  }
  return completed / sectionCount
}
