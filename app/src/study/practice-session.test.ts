import { describe, expect, it } from 'vitest'
import {
  checkCompletarChoice,
  checkWrittenAnswer,
  createPracticeSession,
  currentPracticeIndex,
  goToNextPracticeItem,
  normalizePracticeAnswer,
  practiceAnswersMatch,
  rateVocabAndNext,
  revealPracticeItem,
  selectPracticeDirection,
  selectPracticeMode,
  selectPracticeTema,
} from './practice-session'

describe('practice session navigation', () => {
  it('starts hidden on the first item', () => {
    const session = createPracticeSession('vocab', 'besingular')
    expect(session).toEqual({
      mode: 'vocab',
      tema: 'besingular',
      index: 0,
      revealed: false,
      grade: null,
      direction: 'es-en',
      facing: 'es-en',
    })
  })

  it('freezes mixed facing until the item advances', () => {
    const mixed = selectPracticeDirection(createPracticeSession(), 'mixed', () => 0.1)
    expect(mixed.direction).toBe('mixed')
    expect(mixed.facing).toBe('es-en')
    expect(selectPracticeDirection(mixed, 'mixed', () => 0.9)).toBe(mixed)
    const next = goToNextPracticeItem(mixed, 1, () => 0.9)
    expect(next.index).toBe(1)
    expect(next.facing).toBe('en-es')
  })

  it('resets index when the mode or tema changes', () => {
    const moved = goToNextPracticeItem(createPracticeSession(), 3)
    expect(selectPracticeMode(moved, 'completar').index).toBe(0)
    expect(selectPracticeTema(moved, 'nouns').index).toBe(0)
    expect(selectPracticeMode(moved, 'vocab')).toBe(moved)
  })

  it('moves to the given index without wrapping', () => {
    const start = createPracticeSession()
    const second = goToNextPracticeItem(start, 1)
    expect(second.index).toBe(1)
    expect(goToNextPracticeItem(second, 0).index).toBe(0)
    expect(goToNextPracticeItem(start, -1)).toBe(start)
  })
})

describe('reveal and grade', () => {
  it('reveals a vocab card and then Sabía/No go to the given next item', () => {
    const hidden = createPracticeSession('vocab', 'besingular')
    expect(rateVocabAndNext(hidden, 1, true)).toBe(hidden)
    const shown = revealPracticeItem(hidden)
    expect(shown.revealed).toBe(true)
    expect(rateVocabAndNext(shown, 1, true).index).toBe(1)
    expect(rateVocabAndNext(shown, 1, false).revealed).toBe(false)
    expect(rateVocabAndNext(shown, -1, true)).toEqual({
      ...shown,
      revealed: false,
      grade: null,
    })
  })

  it('advances on a correct completar choice and shows the solution on a miss', () => {
    const session = createPracticeSession('completar', 'besingular')
    const miss = checkCompletarChoice(session, 0, 2, 1)
    expect(miss.grade).toBe('incorrect')
    expect(miss.revealed).toBe(true)
    expect(miss.index).toBe(0)
    const hit = checkCompletarChoice(session, 2, 2, 1)
    expect(hit.index).toBe(1)
    expect(hit.grade).toBeNull()
  })

  it('normalizes written answers: lower case, trim, strip final punctuation', () => {
    expect(normalizePracticeAnswer('  I\'m Helen.  ')).toBe("i'm helen")
    expect(practiceAnswersMatch('Nice to meet you!', 'Nice to meet you.')).toBe(true)
    expect(practiceAnswersMatch("I'm Helen", 'I am Helen')).toBe(false)
    const session = createPracticeSession('traducir', 'besingular')
    expect(checkWrittenAnswer(session, '   ', "I'm Helen.", 1)).toBe(session)
    const ok = checkWrittenAnswer(session, "I'm Helen!", "I'm Helen.", 1)
    expect(ok.index).toBe(1)
    const bad = checkWrittenAnswer(session, 'I Helen', "I'm Helen.", 1)
    expect(bad.grade).toBe('incorrect')
    expect(bad.revealed).toBe(true)
  })

  it('keeps index 0 when the mode has no items', () => {
    const session = createPracticeSession('transformar', 'classroom')
    expect(currentPracticeIndex(session, 0)).toBe(0)
    expect(goToNextPracticeItem(session, -1)).toBe(session)
    expect(rateVocabAndNext(revealPracticeItem(session), -1, true)).toEqual({
      ...session,
      revealed: false,
      grade: null,
    })
  })
})
