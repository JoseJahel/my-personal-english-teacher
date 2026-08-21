import { normalizeStudyBookmark } from '../study/study-bookmark'
import type { StudyBookmark, StudyDocument, StudySession } from '../study/study-types'

/**
 * Persisted study progress for a packaged catalog. Never the lesson body.
 * `bookmark` is optional so IDB v2 records without it still load.
 */
export interface StudyProgressRecord {
  readonly catalogId: string
  readonly sectionIds: readonly string[]
  readonly activeSectionIndex: number
  readonly completedSectionIds: readonly string[]
  readonly updatedAtIso: string
  readonly bookmark?: StudyBookmark | null
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
    ...(session.bookmark ? { bookmark: session.bookmark } : {}),
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
    bookmark: readProgressBookmark(record.bookmark, knownIds, record.catalogId),
  }
}

function readProgressBookmark(
  raw: unknown,
  knownIds: ReadonlySet<string>,
  catalogId: string,
): StudyBookmark | null {
  if (raw === undefined || raw === null) {
    return null
  }
  const normalized = normalizeStudyBookmark(raw)
  if (normalized && knownIds.has(normalized.sectionId)) {
    return normalized
  }
  console.warn('Dropped invalid study bookmark.', {
    catalogId,
    sectionId: normalized?.sectionId,
  })
  return null
}
