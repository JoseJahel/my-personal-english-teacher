import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PracticeSrsCard } from '../study/practice-srs'
import type { PracticeBank } from '../study/study-types'
import type { StudyPracticeSrsStore } from '../storage/study-document-store'
import { StudyPracticeDesk } from './StudyPracticeDesk'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

function memorySrsStore(): StudyPracticeSrsStore {
  const cards = new Map<string, PracticeSrsCard>()
  return {
    getCard: async (itemId) => cards.get(itemId) ?? null,
    putCard: async (card) => {
      cards.set(card.itemId, card)
    },
    getAllCards: async () => [...cards.values()],
    close: () => undefined,
  }
}

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

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function renderDesk(
  root: ReturnType<typeof createRoot>,
  overrides: {
    tema?: string | null
    lessonTema?: string | null
    bank?: PracticeBank
    onTemaChange?: (tema: string | null) => void
    onBackToLesson?: () => void
    createSrsStore?: () => Promise<StudyPracticeSrsStore>
    nowMs?: () => number
    random?: () => number
  } = {},
): void {
  root.render(
    <StudyPracticeDesk
      bank={overrides.bank ?? BANK}
      tema={overrides.tema === undefined ? 'besingular' : overrides.tema}
      lessonTema={overrides.lessonTema === undefined ? 'besingular' : overrides.lessonTema}
      onTemaChange={overrides.onTemaChange ?? (() => undefined)}
      onBackToLesson={overrides.onBackToLesson ?? (() => undefined)}
      createSrsStore={overrides.createSrsStore ?? (async () => memorySrsStore())}
      nowMs={overrides.nowMs}
      random={overrides.random}
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

  it('shows four mode tabs and the Spanish face of a vocab card', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
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

  it('flips the card and Sabía/No advance to the next prompt', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
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
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCard}"]`) as HTMLButtonElement).click()
    })
    act(() => {
      knew.click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceEmpty}"]`)?.textContent).toContain(
      studyInterfaceTexts.srsCaughtUpLead,
    )
  })

  it('still shows the item in EN → ES after ES → EN is caught up', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
    const knew = () => host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceKnew}"]`) as HTMLButtonElement
    const flip = () =>
      (host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCard}"]`) as HTMLButtonElement).click()
    act(() => {
      flip()
    })
    act(() => {
      knew().click()
    })
    act(() => {
      flip()
    })
    act(() => {
      knew().click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceEmpty}"]`)).not.toBeNull()
    act(() => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionEnEs}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceEmpty}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toMatch(
      /hello|goodbye/,
    )
  })

  it('advances completar on a hit and shows the solution on a miss', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
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
    expect(host.textContent).toContain(studyInterfaceTexts.srsCaughtUpLead)
    expect(host.textContent).not.toContain('___ , please.')
  })

  it('does not show the same completar item immediately after a miss when another is due', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain('___ , please.')
    act(() => {
      ;([...host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.practiceOption}"]`)] as HTMLButtonElement[])[1]!.click()
    })
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceNext}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain('___ and thanks.')
    expect(host.textContent).not.toContain('___ , please.')
  })

  it('can bring a missed item back after more than a minute', async () => {
    let now = 1_000
    const store = memorySrsStore()
    const createSrsStore = async () => store
    act(() => {
      renderDesk(root!, { nowMs: () => now, createSrsStore })
    })
    await flush()
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`) as HTMLButtonElement).click()
    })
    act(() => {
      ;([...host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.practiceOption}"]`)] as HTMLButtonElement[])[1]!.click()
    })
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceNext}"]`) as HTMLButtonElement).click()
    })
    act(() => {
      ;([...host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.practiceOption}"]`)] as HTMLButtonElement[])[0]!.click()
    })
    expect(host.textContent).toContain(studyInterfaceTexts.srsCaughtUpLead)
    now += 61_000
    act(() => {
      renderDesk(root!, { nowMs: () => now, createSrsStore })
    })
    await flush()
    expect(host.textContent).toContain('___ , please.')
  })

  it('checks a translation after normalizing case, trim and final punctuation', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
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

  it('lets the learner pick a transform form and reports an empty mode honestly', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
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
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceEmpty}"]`)?.textContent).toContain(
      studyInterfaceTexts.emptyModeLead,
    )
  })

  it('shows EN → ES on a vocab card and hides direction chips in Completar', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionEsEn}"]`)).not.toBeNull()
    act(() => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionEnEs}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toBe(
      'hello',
    )
    expect(host.textContent).toContain(studyInterfaceTexts.flipHintToEs)
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionEsEn}"]`)).toBeNull()
  })

  it('swaps traducir stimulus and prompt when the direction changes', async () => {
    act(() => {
      renderDesk(root!)
    })
    await flush()
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTraducir}"]`) as HTMLButtonElement).click()
    })
    expect(host.textContent).toContain(studyInterfaceTexts.translatePrompt)
    expect(host.querySelector('.practice-estimulo')?.textContent).toBe('hola')
    act(() => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionEnEs}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.textContent).toContain(studyInterfaceTexts.translatePromptToEs)
    expect(host.querySelector('.practice-estimulo')?.textContent).toBe('hello')
  })

  it('keeps mixed facing frozen across a flip and re-render', async () => {
    const random = () => 0.1
    act(() => {
      renderDesk(root!, { random })
    })
    await flush()
    act(() => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDirectionMixed}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toBe(
      'hola',
    )
    act(() => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCard}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardBack}"]`)?.textContent).toBe(
      'hello',
    )
    act(() => {
      renderDesk(root!, { random })
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardBack}"]`)?.textContent).toBe(
      'hello',
    )
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCardFront}"]`)?.textContent).toBe(
      'hola',
    )
  })
})
