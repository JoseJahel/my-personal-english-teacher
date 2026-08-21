import { describe, expect, it } from 'vitest'
import {
  clearSessionBookmark,
  createStudySession,
  goToNextSection,
  goToPreviousSection,
  markSectionCompleted,
  selectSection,
  setSessionBookmark,
  studyProgress01,
} from './study-session'

const SECTION_COUNT = 3

describe('createStudySession', () => {
  it('starts at the first section with nothing completed', () => {
    const session = createStudySession('doc-1')
    expect(session.documentId).toBe('doc-1')
    expect(session.activeSectionIndex).toBe(0)
    expect(session.completedSectionIds).toEqual([])
    expect(session.bookmark).toBeNull()
    expect(studyProgress01(session, SECTION_COUNT)).toBe(0)
  })
})

describe('setSessionBookmark / clearSessionBookmark', () => {
  it('spreads the session so completed ids are kept', () => {
    const started = markSectionCompleted(createStudySession('doc-1'), 'a')
    const bookmark = {
      sectionId: 'b',
      title: 'B',
      order: 2,
      savedAtIso: '2026-08-21T00:00:00.000Z',
    }
    const planted = setSessionBookmark(started, bookmark)
    expect(planted.completedSectionIds).toEqual(['a'])
    expect(planted.bookmark).toEqual(bookmark)
    expect(planted.activeSectionIndex).toBe(0)
    const cleared = clearSessionBookmark(planted)
    expect(cleared.completedSectionIds).toEqual(['a'])
    expect(cleared.bookmark).toBeNull()
  })
})

describe('selectSection', () => {
  it('moves to a valid index', () => {
    const session = selectSection(createStudySession('doc-1'), 2, SECTION_COUNT)
    expect(session.activeSectionIndex).toBe(2)
  })

  it('is a no-op for out-of-range indexes (no silent clamp)', () => {
    const session = createStudySession('doc-1')
    expect(selectSection(session, -1, SECTION_COUNT)).toBe(session)
    expect(selectSection(session, 3, SECTION_COUNT)).toBe(session)
    expect(selectSection(session, 1.5, SECTION_COUNT)).toBe(session)
    expect(selectSection(session, 0, 0)).toBe(session)
  })
})

describe('goToNextSection / goToPreviousSection', () => {
  it('advances and then returns to the previous section', () => {
    const start = createStudySession('doc-1')
    const next = goToNextSection(start, SECTION_COUNT)
    expect(next.activeSectionIndex).toBe(1)
    expect(goToPreviousSection(next).activeSectionIndex).toBe(0)
  })

  it('stays on the last section instead of wrapping', () => {
    const last = selectSection(createStudySession('doc-1'), 2, SECTION_COUNT)
    expect(goToNextSection(last, SECTION_COUNT)).toBe(last)
  })

  it('stays on the first section instead of wrapping', () => {
    const start = createStudySession('doc-1')
    expect(goToPreviousSection(start)).toBe(start)
  })
})

describe('markSectionCompleted / studyProgress01', () => {
  it('records unique ids and reports a 0–1 ratio', () => {
    const start = createStudySession('doc-1')
    const one = markSectionCompleted(start, 'a')
    const two = markSectionCompleted(one, 'b')
    expect(markSectionCompleted(two, 'a')).toBe(two)
    expect(studyProgress01(one, SECTION_COUNT)).toBeCloseTo(1 / 3)
    expect(studyProgress01(two, SECTION_COUNT)).toBeCloseTo(2 / 3)
    const done = markSectionCompleted(markSectionCompleted(two, 'c'), 'extra')
    expect(studyProgress01(done, SECTION_COUNT)).toBe(1)
  })

  it('is 0 when there are no sections', () => {
    expect(studyProgress01(createStudySession('doc-1'), 0)).toBe(0)
  })
})
