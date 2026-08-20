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
    })
  })

  it('resets index when the mode or tema changes', () => {
    const moved = goToNextPracticeItem(createPracticeSession(), 3)
    expect(selectPracticeMode(moved, 'completar').index).toBe(0)
    expect(selectPracticeTema(moved, 'nouns').index).toBe(0)
    expect(selectPracticeMode(moved, 'vocab')).toBe(moved)
  })

  it('advances and wraps with next', () => {
    const start = createPracticeSession()
    const second = goToNextPracticeItem(start, 2)
    expect(second.index).toBe(1)
    expect(goToNextPracticeItem(second, 2).index).toBe(0)
    expect(goToNextPracticeItem(start, 0)).toBe(start)
  })
})

describe('reveal and grade', () => {
  it('reveals a vocab card and then Sabía/No go to the next item', () => {
    const hidden = createPracticeSession('vocab', 'besingular')
    expect(rateVocabAndNext(hidden, 2)).toBe(hidden)
    const shown = revealPracticeItem(hidden)
    expect(shown.revealed).toBe(true)
    expect(rateVocabAndNext(shown, 2).index).toBe(1)
    expect(rateVocabAndNext(shown, 2).revealed).toBe(false)
  })

  it('advances on a correct completar choice and shows the solution on a miss', () => {
    const session = createPracticeSession('completar', 'besingular')
    const miss = checkCompletarChoice(session, 0, 2, 3)
    expect(miss.grade).toBe('incorrect')
    expect(miss.revealed).toBe(true)
    expect(miss.index).toBe(0)
    const hit = checkCompletarChoice(session, 2, 2, 3)
    expect(hit.index).toBe(1)
    expect(hit.grade).toBeNull()
  })

  it('normalizes written answers: lower case, trim, strip final punctuation', () => {
    expect(normalizePracticeAnswer('  I\'m Helen.  ')).toBe("i'm helen")
    expect(practiceAnswersMatch('Nice to meet you!', 'Nice to meet you.')).toBe(true)
    expect(practiceAnswersMatch("I'm Helen", 'I am Helen')).toBe(false)
    const session = createPracticeSession('traducir', 'besingular')
    expect(checkWrittenAnswer(session, '   ', "I'm Helen.", 2)).toBe(session)
    const ok = checkWrittenAnswer(session, "I'm Helen!", "I'm Helen.", 2)
    expect(ok.index).toBe(1)
    const bad = checkWrittenAnswer(session, 'I Helen', "I'm Helen.", 2)
    expect(bad.grade).toBe('incorrect')
    expect(bad.revealed).toBe(true)
  })

  it('keeps index 0 when the mode has no items', () => {
    const session = createPracticeSession('transformar', 'classroom')
    expect(currentPracticeIndex(session, 0)).toBe(0)
    expect(goToNextPracticeItem(session, 0)).toBe(session)
    expect(rateVocabAndNext(revealPracticeItem(session), 0)).toEqual({
      ...session,
      revealed: true,
    })
  })
})
