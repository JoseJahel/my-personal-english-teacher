import { describe, expect, it } from 'vitest'
import {
  answerLessonQuestion,
  type LessonQuestionSource,
} from './answer-lesson-question'

const LESSON: LessonQuestionSource = {
  lessonId: 'l04',
  tema: 'nationality',
  objetivo: 'Decir de donde eres y preguntar la nacionalidad.',
  bodyMarkdown: [
    '## Vocabulario',
    '- **American** - estadounidense',
    '- **on holiday / on business** - de vacaciones / de trabajo',
    '- **free day** - dia libre',
    '',
    '## Frases modelo',
    '- Richard: Are you American?',
    "- Jessica: No, we aren't. We're from Canada.",
    "- Jim: No, we aren't, we're on business.",
    '',
  ].join('\n'),
}

describe('answerLessonQuestion', () => {
  it('answers a Spanish question with the English term and a phrase that uses it', () => {
    const answer = answerLessonQuestion('\u00bfComo se dice estadounidense?', LESSON)

    expect(answer.kind).toBe('vocabulary')
    if (answer.kind !== 'vocabulary') return
    expect(answer.matches[0]?.englishTerm).toBe('American')
    expect(answer.matches[0]?.spanishTerm).toBe('estadounidense')
    expect(answer.matches[0]?.examplePhraseEn).toBe('Are you American?')
  })

  it('ignores accents so the learner does not have to type them', () => {
    const withAccents = answerLessonQuestion('\u00bfC\u00f3mo se dice d\u00eda libre?', LESSON)
    const withoutAccents = answerLessonQuestion('como se dice dia libre', LESSON)

    expect(withAccents).toEqual(withoutAccents)
    expect(withAccents.kind).toBe('vocabulary')
  })

  it('looks the term up in the other direction when asked in English', () => {
    const answer = answerLessonQuestion('what does American mean?', LESSON)

    expect(answer.kind).toBe('vocabulary')
    if (answer.kind !== 'vocabulary') return
    expect(answer.matches[0]?.spanishTerm).toBe('estadounidense')
  })

  it('matches a multi-word term listed with alternatives', () => {
    const answer = answerLessonQuestion('que significa on business', LESSON)

    expect(answer.kind).toBe('vocabulary')
    if (answer.kind !== 'vocabulary') return
    expect(answer.matches[0]?.englishTerm).toBe('on holiday / on business')
  })

  it('summarises the lesson when asked what it is about', () => {
    const answer = answerLessonQuestion('\u00bfDe qu\u00e9 trata esta lecci\u00f3n?', LESSON)

    expect(answer.kind).toBe('overview')
    if (answer.kind !== 'overview') return
    expect(answer.objetivo).toBe('Decir de donde eres y preguntar la nacionalidad.')
    expect(answer.examplePhrasesEn.length).toBeGreaterThan(0)
  })

  it('falls back to model phrases when the word only appears in the dialogue', () => {
    const answer = answerLessonQuestion('que quiere decir Canada', LESSON)

    expect(answer.kind).toBe('phrase')
    if (answer.kind !== 'phrase') return
    expect(answer.phrasesEn[0]).toContain('Canada')
  })

  it('admits when the lesson does not cover the question and suggests what it does', () => {
    const answer = answerLessonQuestion('como se dice dinosaurio', LESSON)

    expect(answer.kind).toBe('unknown')
    if (answer.kind !== 'unknown') return
    expect(answer.suggestedTermsEs).toContain('estadounidense')
  })

  it('does not guess from filler words alone', () => {
    expect(answerLessonQuestion('como se dice', LESSON).kind).toBe('unknown')
    expect(answerLessonQuestion('   ', LESSON).kind).toBe('unknown')
  })
})
