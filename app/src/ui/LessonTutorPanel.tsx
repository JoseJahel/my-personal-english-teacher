/**
 * "Pregúntale al profesor" panel inside the lesson reader.
 *
 * Answers come from `answerLessonQuestion`, which searches this lesson only,
 * so the reply is instant, offline, and can never invent vocabulary the course
 * does not teach. No inference worker and no model download are involved.
 */
import { useState } from 'react'
import {
  answerLessonQuestion,
  type LessonQuestionSource,
} from '../study/answer-lesson-question'
import {
  presentLessonAnswer,
  type PresentedLessonAnswer,
} from './lesson-answer-presentation'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

interface LessonTutorTurn {
  readonly id: number
  readonly question: string
  readonly answer: PresentedLessonAnswer
}

export function LessonTutorPanel(props: { readonly lesson: LessonQuestionSource }) {
  const copy = studyInterfaceTexts
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<readonly LessonTutorTurn[]>([])

  const ask = () => {
    const question = draft.trim()
    if (question.length === 0) {
      return
    }
    const answer = presentLessonAnswer(answerLessonQuestion(question, props.lesson))
    setTurns((current) => [...current, { id: current.length, question, answer }])
    setDraft('')
  }

  return (
    <section className="sheet" data-testid={STUDY_TEST_IDS.askTutorPanel}>
      <h2>{copy.askTutorTitle}</h2>
      <p className="nota-info">{copy.askTutorHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          aria-label={copy.askTutorTitle}
          placeholder={copy.askTutorPlaceholder}
          data-testid={STUDY_TEST_IDS.askTutorInput}
          className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ask()
            }
          }}
        />
        <button
          type="button"
          className="btn chico"
          data-testid={STUDY_TEST_IDS.askTutorSend}
          onClick={ask}
        >
          {copy.askTutorSendLabel}
        </button>
      </div>
      <ol className="mt-4 list-none space-y-4 p-0">
        {turns.map((turn) => (
          <li key={turn.id} data-testid={STUDY_TEST_IDS.askTutorAnswer}>
            <p className="m-0 font-semibold text-ink-900">{turn.question}</p>
            <p className="m-0 mt-1 text-ink-600">{turn.answer.lead}</p>
            <ul className="mt-1">
              {turn.answer.lines.map((line, index) => (
                <li key={`${turn.id}-${index}`}>
                  {line.text}
                  {line.exampleEn === null ? null : (
                    <span className="nota-info block">
                      {copy.answerExampleLabel} {line.exampleEn}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
