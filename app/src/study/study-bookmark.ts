import type { StudyBookmark, StudySection } from './study-types'

export const BOOKMARK_PLANT_LOCK_MS = 2000
export const BOOKMARK_RETRACT_LOCK_MS = 1800

/**
 * Drops an invalid bookmark object (the field, never the parent record).
 * Extra keys on the raw value are ignored.
 */
export function normalizeStudyBookmark(raw: unknown): StudyBookmark | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return null
  }
  const record = raw as Record<string, unknown>
  const sectionId = typeof record.sectionId === 'string' ? record.sectionId.trim() : ''
  if (sectionId.length === 0) {
    return null
  }
  const order = Number(record.order)
  const title = typeof record.title === 'string' ? record.title : ''
  const savedAtIso = typeof record.savedAtIso === 'string' ? record.savedAtIso : ''
  const titleEn = typeof record.titleEn === 'string' ? record.titleEn : undefined
  return {
    sectionId,
    title,
    order: Number.isFinite(order) && order >= 1 ? Math.floor(order) : 0,
    savedAtIso,
    ...(titleEn !== undefined ? { titleEn } : {}),
  }
}

export function bookmarkFromSection(
  section: StudySection,
  index1Based: number,
  nowIso: string,
): StudyBookmark | null {
  return normalizeStudyBookmark({
    sectionId: section.id,
    title: section.title,
    order: index1Based,
    savedAtIso: nowIso,
    ...(section.titleEn !== undefined ? { titleEn: section.titleEn } : {}),
  })
}

export function bookmarkIndex(
  sections: readonly Pick<StudySection, 'id'>[],
  bookmark: StudyBookmark | null,
): number {
  if (!bookmark) {
    return -1
  }
  return sections.findIndex((section) => section.id === bookmark.sectionId)
}

export function bookmarkNeedsMoveConfirm(
  current: StudyBookmark | null,
  nextSectionId: string,
): boolean {
  const normalized = normalizeStudyBookmark(current)
  if (!normalized || nextSectionId.length === 0) {
    return false
  }
  return normalized.sectionId !== nextSectionId
}

export function isBookmarkOnSection(current: StudyBookmark | null, sectionId: string): boolean {
  const normalized = normalizeStudyBookmark(current)
  return Boolean(normalized && sectionId.length > 0 && normalized.sectionId === sectionId)
}

export function continueBookmarkLabel(bookmark: StudyBookmark | null, baseLabel: string): string {
  const normalized = normalizeStudyBookmark(bookmark)
  if (!normalized) {
    return baseLabel
  }
  const title = normalized.title.trim()
  return title.length > 0 ? `${baseLabel} · ${title}` : baseLabel
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
