import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import { CommunicationSuggestionsPanel } from './CommunicationSuggestionsPanel'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

const SAMPLE_SUGGESTIONS: readonly CommunicationSuggestion[] = [
  {
    type: 'naturalidad',
    text: 'Pediste agua de forma educada. En el mostrador también se oye esta variante.',
    youSaidEn: 'I would like a glass of water please',
    tryThisEn: 'Could I have a glass of water, please?',
  },
]

describe('CommunicationSuggestionsPanel', () => {
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

  it('renders typed tips after a turn', () => {
    act(() => {
      root?.render(<CommunicationSuggestionsPanel suggestions={SAMPLE_SUGGESTIONS} />)
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsPanel}"]`)).not.toBeNull()
    expect(host.textContent).toContain('Could I have a glass of water, please?')
    expect(host.textContent).toContain('I would like a glass of water please')
    expect(host.textContent).toContain('Naturalidad')
    expect(host.textContent).toContain('Tú dijiste')
    expect(host.textContent).toContain('Prueba esto')
  })

  it('hides the inline card when there are no suggestions', () => {
    act(() => {
      root?.render(<CommunicationSuggestionsPanel suggestions={[]} />)
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsPanel}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsEmpty}"]`)).toBeNull()
  })

  it('shows the feedback-tab empty copy when asked', () => {
    act(() => {
      root?.render(<CommunicationSuggestionsPanel suggestions={[]} showEmptyState />)
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsEmpty}"]`)).not.toBeNull()
    expect(host.textContent).toMatch(/Cuando completes un turno/)
  })
})
