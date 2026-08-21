import { describe, expect, it } from 'vitest'
import {
  bookmarkFromSection,
  bookmarkIndex,
  bookmarkNeedsMoveConfirm,
  continueBookmarkLabel,
  isBookmarkOnSection,
  normalizeStudyBookmark,
} from './study-bookmark'
import type { StudySection } from './study-types'

const SECTION: StudySection = {
  id: 'file-1a',
  title: '1A · Encantado',
  titleEn: 'Nice to meet you',
  bodyText: 'hola',
}

describe('normalizeStudyBookmark', () => {
  it('returns null for missing or non-object values', () => {
    expect(normalizeStudyBookmark(null)).toBeNull()
    expect(normalizeStudyBookmark(undefined)).toBeNull()
    expect(normalizeStudyBookmark('x')).toBeNull()
    expect(normalizeStudyBookmark({ title: 'A' })).toBeNull()
    expect(normalizeStudyBookmark({ sectionId: '   ' })).toBeNull()
  })

  it('keeps known fields and ignores extras', () => {
    const bookmark = normalizeStudyBookmark({
      sectionId: ' file-1a ',
      title: '1A',
      titleEn: 'Hi',
      order: 2.8,
      savedAtIso: '2026-08-21T00:00:00.000Z',
      extra: true,
      leccionId: 'nope',
    })
    expect(bookmark).toEqual({
      sectionId: 'file-1a',
      title: '1A',
      titleEn: 'Hi',
      order: 2,
      savedAtIso: '2026-08-21T00:00:00.000Z',
    })
    expect(bookmark).not.toHaveProperty('extra')
    expect(bookmark).not.toHaveProperty('leccionId')
  })

  it('falls back when order or title types are invalid', () => {
    expect(
      normalizeStudyBookmark({
        sectionId: 'a',
        title: 9,
        order: 'nope',
        savedAtIso: 1,
      }),
    ).toEqual({
      sectionId: 'a',
      title: '',
      order: 0,
      savedAtIso: '',
    })
  })
})

describe('bookmarkFromSection / bookmarkIndex', () => {
  it('snapshots the section at a 1-based catalog index', () => {
    const bookmark = bookmarkFromSection(SECTION, 1, '2026-08-21T00:00:00.000Z')
    expect(bookmark).toMatchObject({
      sectionId: 'file-1a',
      title: '1A · Encantado',
      titleEn: 'Nice to meet you',
      order: 1,
      savedAtIso: '2026-08-21T00:00:00.000Z',
    })
    expect(bookmarkIndex([SECTION, { id: 'b' }], bookmark)).toBe(0)
    expect(bookmarkIndex([SECTION], normalizeStudyBookmark({ sectionId: 'missing' }))).toBe(-1)
  })
})

describe('bookmarkNeedsMoveConfirm / isBookmarkOnSection', () => {
  it('confirms only when moving to a different section', () => {
    const bookmark = bookmarkFromSection(SECTION, 1, 't')
    expect(bookmarkNeedsMoveConfirm(null, 'file-1a')).toBe(false)
    expect(bookmarkNeedsMoveConfirm(bookmark, 'file-1a')).toBe(false)
    expect(bookmarkNeedsMoveConfirm(bookmark, 'file-1b')).toBe(true)
    expect(bookmarkNeedsMoveConfirm(bookmark, '')).toBe(false)
    expect(isBookmarkOnSection(bookmark, 'file-1a')).toBe(true)
    expect(isBookmarkOnSection(bookmark, 'file-1b')).toBe(false)
    expect(isBookmarkOnSection(null, 'file-1a')).toBe(false)
  })
})

describe('continueBookmarkLabel', () => {
  it('appends the Spanish title when present', () => {
    const base = 'Continúa desde donde lo dejaste'
    expect(continueBookmarkLabel(null, base)).toBe(base)
    expect(continueBookmarkLabel(bookmarkFromSection(SECTION, 1, 't'), base)).toBe(
      `${base} · 1A · Encantado`,
    )
  })
})
