import type { StudyDocument, StudySession } from '../study/study-types'

/**
 * Persisted study progress for a packaged catalog. Never the lesson body.
 */
export interface StudyProgressRecord {
  readonly catalogId: string
  readonly sectionIds: readonly string[]
  readonly activeSectionIndex: number
  readonly completedSectionIds: readonly string[]
  readonly updatedAtIso: string
}

export function createStudyProgressRecord(
  document: StudyDocument,
  session: StudySession,
  updatedAtIso: string = new Date().toISOString(),
): StudyProgressRecord {
  return {
    catalogId: document.id,
    sectionIds: document.sections.map((section) => section.id),
    activeSectionIndex: session.activeSectionIndex,
    completedSectionIds: session.completedSectionIds,
    updatedAtIso,
  }
}

export function sameSectionIds(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  return left.every((id, index) => id === right[index])
}

export function studySessionFromProgress(
  record: StudyProgressRecord,
  document: StudyDocument,
): StudySession | null {
  const currentIds = document.sections.map((section) => section.id)
  const storedIds = Array.isArray(record.sectionIds) ? record.sectionIds : null
  if (
    record.catalogId !== document.id ||
    storedIds === null ||
    !sameSectionIds(storedIds, currentIds)
  ) {
    console.warn('Dropped study progress because the catalog ids changed.', {
      catalogId: record.catalogId,
      storedSectionIds: record.sectionIds,
    })
    return null
  }
  let activeSectionIndex = record.activeSectionIndex
  if (
    !Number.isInteger(activeSectionIndex) ||
    activeSectionIndex < 0 ||
    activeSectionIndex >= currentIds.length
  ) {
    console.warn('Dropped invalid activeSectionIndex on study progress.', {
      catalogId: record.catalogId,
      activeSectionIndex,
    })
    activeSectionIndex = 0
  }
  const knownIds = new Set(currentIds)
  const completedSectionIds = Array.isArray(record.completedSectionIds)
    ? record.completedSectionIds.filter((sectionId) => {
        if (typeof sectionId === 'string' && knownIds.has(sectionId)) {
          return true
        }
        console.warn('Dropped unknown completedSectionId on study progress.', {
          catalogId: record.catalogId,
          sectionId,
        })
        return false
      })
    : []
  if (!Array.isArray(record.completedSectionIds)) {
    console.warn('Dropped invalid completedSectionIds on study progress.', {
      catalogId: record.catalogId,
    })
  }
  return {
    documentId: document.id,
    activeSectionIndex,
    completedSectionIds,
  }
}
