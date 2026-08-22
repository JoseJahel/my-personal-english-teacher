import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LessonQuestionSource } from '../study/answer-lesson-question'
import { LessonTutorPanel } from './LessonTutorPanel'
import { STUDY_TEST_IDS } from './study-interface-texts'

const LESSON: LessonQuestionSource = {
  lessonId: 'l04',
  tema: 'nationality',
  objetivo: 'Decir de donde eres.',
  bodyMarkdown: [
    '## Vocabulario',
    '- **American** - estadounidense',
    '',
    '## Frases modelo',
    '- Richard: Are you American?',
    '',
  ].join('\n'),
}

let container: HTMLElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function query<T extends Element>(testId: string): T | null {
  return container?.querySelector<T>(`[data-testid="${testId}"]`) ?? null
}

function typeQuestion(text: string): void {
  const input = query<HTMLInputElement>(STUDY_TEST_IDS.askTutorInput)
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  act(() => {
    valueSetter?.call(input, text)
    input?.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function clickAsk(): void {
  act(() => {
    query(STUDY_TEST_IDS.askTutorSend)?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
  })
}

describe('LessonTutorPanel', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root?.render(<LessonTutorPanel lesson={LESSON} />)
    })
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    container?.remove()
    root = null
    container = null
  })

  it('answers a question from the lesson vocabulary', () => {
    typeQuestion('como se dice estadounidense')
    clickAsk()

    const answer = query(STUDY_TEST_IDS.askTutorAnswer)
    expect(answer?.textContent).toContain('estadounidense')
    expect(answer?.textContent).toContain('American')
    expect(answer?.textContent).toContain('Are you American?')
  })

  it('clears the box and keeps earlier questions in the thread', () => {
    typeQuestion('como se dice estadounidense')
    clickAsk()
    typeQuestion('de que trata esta leccion')
    clickAsk()

    expect(query<HTMLInputElement>(STUDY_TEST_IDS.askTutorInput)?.value).toBe('')
    expect(container?.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.askTutorAnswer}"]`))
      .toHaveLength(2)
  })

  it('says so plainly when the lesson does not cover the question', () => {
    typeQuestion('como se dice dinosaurio')
    clickAsk()

    expect(query(STUDY_TEST_IDS.askTutorAnswer)?.textContent).toContain('estadounidense')
  })

  it('ignores an empty question', () => {
    clickAsk()

    expect(query(STUDY_TEST_IDS.askTutorAnswer)).toBeNull()
  })
})
