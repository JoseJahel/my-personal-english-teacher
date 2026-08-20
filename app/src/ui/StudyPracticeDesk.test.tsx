import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PracticeBank } from '../study/study-types'
import { StudyPracticeDesk } from './StudyPracticeDesk'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

const BANK: PracticeBank = {
  vocab: [
    { id: 'v1', tema: 'besingular', kind: 'vocab', frontEs: 'hola', backEn: 'hello' },
    { id: 'v2', tema: 'besingular', kind: 'vocab', frontEs: 'adiós', backEn: 'goodbye' },
  ],
  completar: [
    {
      id: 'c1',
      tema: 'besingular',
      kind: 'completar',
      phrase: '___ , please.',
      options: ['hello', 'table', 'window'],
      correctIndex: 0,
    },
    {
      id: 'c2',
      tema: 'besingular',
      kind: 'completar',
      phrase: '___ and thanks.',
      options: ['Goodbye', 'Bag', 'Door'],
      correctIndex: 0,
    },
  ],
  traducir: [
    { id: 't1', tema: 'besingular', kind: 'traducir', promptEs: 'hola', answerEn: 'hello' },
    { id: 't2', tema: 'besingular', kind: 'traducir', promptEs: 'gracias', answerEn: 'thanks' },
  ],
  transformar: [
    {
      id: 'f1',
      tema: 'besingular',
      kind: 'transformar',
      prompt: 'Contracción',
      stimulus: 'I am Helen.',
      answer: "I'm Helen.",
      options: ["I'm Helen.", 'I am Helen.', "I's Helen."],
    },
    {
      id: 'f2',
      tema: 'besingular',
      kind: 'transformar',
      prompt: 'Pregunta',
      stimulus: "You're Tom.",
      answer: 'Are you Tom?',
      options: ['Are you Tom?', 'You are Tom?', 'Is you Tom?'],
    },
  ],
}

function fillInput(host: HTMLElement, value: string): void {
  const input = host.querySelector(
    `[data-testid="${STUDY_TEST_IDS.practiceTranslateInput}"]`,
  ) as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function renderDesk(
  root: ReturnType<typeof createRoot>,
  overrides: {
    tema?: string | null
    lessonTema?: string | null
    bank?: PracticeBank
    onTemaChange?: (tema: string | null) => void
    onBackToLesson?: () => void
  } = {},
): void {
  root.render(
    <StudyPracticeDesk
      bank={overrides.bank ?? BANK}
      tema={overrides.tema === undefined ? 'besingular' : overrides.tema}
      lessonTema={overrides.lessonTema === undefined ? 'besingular' : overrides.lessonTema}
      onTemaChange={overrides.onTemaChange ?? (() => undefined)}
      onBackToLesson={overrides.onBackToLesson ?? (() => undefined)}
    />,
  )
}

describe('StudyPracticeDesk', () => {
  let root: ReturnType<typeof createRoot> | null = null
  let host: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host.remove()
    root = null
  })

  it('shows four mode tabs and the Spanish face of a vocab card', () => {
    act(() => {
      renderDesk(root!)
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeVocab}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTraducir}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTransformar}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toBe(
      'hola',
    )
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardBack}"]`)?.className).toContain(
      'hidden',
    )
  })

  it('flips the card and Sabía/No advance to the next prompt', () => {
    act(() => {
      renderDesk(root!)
    })
    const knew = host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceKnew}"]`) as HTMLButtonElement
    expect(knew.disabled).toBe(true)
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCard}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardBack}"]`)?.textContent).toBe(
      'hello',
    )
    expect(knew.disabled).toBe(false)
    act(() => {
      knew.click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toBe(
      'adiós',
    )
  })

  it('advances completar on a hit and shows the solution on a miss', () => {
    act(() => {
      renderDesk(root!)
    })
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`) as HTMLButtonElement).click()
    })
    const options = () =>
      [...host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.practiceOption}"]`)] as HTMLButtonElement[]
    expect(host.textContent).toContain('___ , please.')
    act(() => {
      options()[1]!.click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceSolution}"]`)?.textContent).toContain(
      'hello',
    )
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceNext}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain('___ and thanks.')
    act(() => {
      options()[0]!.click()
    })
    expect(host.textContent).toContain('___ , please.')
  })

  it('checks a translation after normalizing case, trim and final punctuation', () => {
    act(() => {
      renderDesk(root!)
    })
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTraducir}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain('hola')
    act(() => {
      fillInput(host, '  Hello!  ')
    })
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCheck}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain('gracias')
  })

  it('lets the learner pick a transform form and reports an empty mode honestly', () => {
    act(() => {
      renderDesk(root!)
    })
    act(() => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTransformar}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.textContent).toContain('I am Helen.')
    const options = [
      ...host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.practiceOption}"]`),
    ] as HTMLButtonElement[]
    const correct = options.find((button) => button.textContent === "I'm Helen.")
    act(() => {
      correct?.click()
    })
    expect(host.textContent).toContain("You're Tom.")

    act(() => {
      renderDesk(root!, { tema: 'dates', lessonTema: 'dates' })
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceEmpty}"]`)?.textContent).toContain(
      studyInterfaceTexts.emptyModeLead,
    )
  })
})
