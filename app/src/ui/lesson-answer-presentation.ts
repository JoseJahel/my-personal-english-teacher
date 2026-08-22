/**
 * Turns a structured `LessonAnswer` into the Spanish lines the tutor panel
 * shows. Kept apart from the component so the wording is unit-testable, and
 * apart from `study/` so the domain never carries user-facing prose: all
 * Spanish text comes from `study-interface-texts`, which is the only place to
 * touch if the answers ever switch language.
 */
import type { LessonAnswer } from '../study/answer-lesson-question'
import { studyInterfaceTexts } from './study-interface-texts'

export interface PresentedAnswerLine {
  readonly text: string
  /** Model phrase from the lesson that uses the term, when there is one. */
  readonly exampleEn: string | null
}

export interface PresentedLessonAnswer {
  readonly lead: string
  readonly lines: readonly PresentedAnswerLine[]
}

export function presentLessonAnswer(answer: LessonAnswer): PresentedLessonAnswer {
  const copy = studyInterfaceTexts
  switch (answer.kind) {
    case 'vocabulary':
      return {
        lead: copy.answerVocabularyLead,
        lines: answer.matches.map((match) => ({
          text: copy.answerVocabularyLine(match.spanishTerm, match.englishTerm),
          exampleEn: match.examplePhraseEn,
        })),
      }
    case 'phrase':
      return {
        lead: copy.answerPhraseLead,
        lines: answer.phrasesEn.map((phrase) => ({ text: phrase, exampleEn: null })),
      }
    case 'overview':
      return {
        lead:
          answer.objetivo === null
            ? copy.answerOverviewFallbackLead
            : copy.answerOverviewLead(answer.objetivo),
        lines: answer.examplePhrasesEn.map((phrase) => ({
          text: phrase,
          exampleEn: null,
        })),
      }
    case 'unknown':
      return {
        lead: copy.answerUnknownLead,
        lines: answer.suggestedTermsEs.map((term) => ({ text: term, exampleEn: null })),
      }
  }
}
