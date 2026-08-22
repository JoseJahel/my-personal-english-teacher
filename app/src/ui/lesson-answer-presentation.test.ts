import { describe, expect, it } from 'vitest'
import type { LessonAnswer } from '../study/answer-lesson-question'
import { presentLessonAnswer } from './lesson-answer-presentation'
import { studyInterfaceTexts } from './study-interface-texts'

describe('presentLessonAnswer', () => {
  it('shows the Spanish term next to the English one and keeps the example', () => {
    const answer: LessonAnswer = {
      kind: 'vocabulary',
      matches: [
        {
          englishTerm: 'American',
          spanishTerm: 'estadounidense',
          examplePhraseEn: 'Are you American?',
        },
      ],
    }

    const presented = presentLessonAnswer(answer)

    expect(presented.lead).toBe(studyInterfaceTexts.answerVocabularyLead)
    expect(presented.lines[0]?.text).toContain('estadounidense')
    expect(presented.lines[0]?.text).toContain('American')
    expect(presented.lines[0]?.exampleEn).toBe('Are you American?')
  })

  it('lists the matching model phrases with no example of their own', () => {
    const answer: LessonAnswer = {
      kind: 'phrase',
      phrasesEn: ["We're from Canada."],
    }

    const presented = presentLessonAnswer(answer)

    expect(presented.lead).toBe(studyInterfaceTexts.answerPhraseLead)
    expect(presented.lines).toEqual([{ text: "We're from Canada.", exampleEn: null }])
  })

  it('leads an overview with the lesson objective when the lesson has one', () => {
    const answer: LessonAnswer = {
      kind: 'overview',
      objetivo: 'Decir de donde eres.',
      examplePhrasesEn: ['Are you American?'],
    }

    expect(presentLessonAnswer(answer).lead).toContain('Decir de donde eres.')
  })

  it('falls back to a generic lead when the lesson has no objective', () => {
    const answer: LessonAnswer = {
      kind: 'overview',
      objetivo: null,
      examplePhrasesEn: [],
    }

    expect(presentLessonAnswer(answer).lead).toBe(
      studyInterfaceTexts.answerOverviewFallbackLead,
    )
  })

  it('offers what the lesson does cover when it cannot answer', () => {
    const answer: LessonAnswer = {
      kind: 'unknown',
      suggestedTermsEs: ['estadounidense', 'dia libre'],
    }

    const presented = presentLessonAnswer(answer)

    expect(presented.lead).toBe(studyInterfaceTexts.answerUnknownLead)
    expect(presented.lines.map((line) => line.text)).toEqual([
      'estadounidense',
      'dia libre',
    ])
  })
})
