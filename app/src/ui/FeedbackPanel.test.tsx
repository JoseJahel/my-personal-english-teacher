import { createRef } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackPanel, type FeedbackPanelProps } from './FeedbackPanel'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

const emptyCanvasRef = createRef<HTMLCanvasElement | null>()

function panelProps(overrides: Partial<FeedbackPanelProps> = {}): FeedbackPanelProps {
  return {
    isOpen: true,
    activeTab: 'suggest',
    hasTurnResults: false,
    transcribedText: '',
    correctedGrammarText: '',
    grammarCorrectionMadeNoChangesToTranscription: false,
    pronunciationScore0to100: null,
    pronunciationStatusMessage: '',
    pronunciationDetailMessage: null,
    pronunciationMfccScore0to100: null,
    pronunciationPitchScore0to100: null,
    pronunciationWordHighlights: [],
    formantsSummaryMessage: null,
    medianFormants: null,
    practiceHistoryTurns: [],
    spectrogramCanvasRef: emptyCanvasRef,
    pitchTrackCanvasRef: emptyCanvasRef,
    hasCompletedCapture: false,
    microphoneStatusMessage: '',
    transcriptionStatusMessage: '',
    grammarCorrectionStatusMessage: '',
    tutorGenerationStatusMessage: '',
    speechSynthesisStatusMessage: '',
    pronunciationPipelineStatusMessage: '',
    captureDiagnosticsMessage: null,
    environmentDiagnosticsMessage: null,
    liveRms: 0,
    livePeak: 0,
    isListening: false,
    isStarting: false,
    communicationSuggestions: [],
    onClose: () => undefined,
    onSelectTab: () => undefined,
    ...overrides,
  }
}

describe('FeedbackPanel suggestions tab', () => {
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

  it('shows the empty suggestions copy before the first turn', () => {
    act(() => {
      root?.render(<FeedbackPanel {...panelProps()} />)
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsEmpty}"]`)).not.toBeNull()
    expect(host.textContent).not.toMatch(/issue #60/)
  })

  it('renders the turn suggestions instead of the old placeholder', () => {
    const onSelectTab = vi.fn()
    act(() => {
      root?.render(
        <FeedbackPanel
          {...panelProps({
            hasTurnResults: true,
            transcribedText: 'I would like a glass of water please',
            communicationSuggestions: [
              {
                type: 'naturalidad',
                text: 'Pediste agua de forma educada.',
                youSaidEn: 'I would like a glass of water please',
                tryThisEn: 'Could I have a glass of water, please?',
              },
            ],
            onSelectTab,
          })}
        />,
      )
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.suggestionsPanel}"]`)).not.toBeNull()
    expect(host.textContent).toContain('Could I have a glass of water, please?')
    expect(host.textContent).not.toMatch(/siguiente paso de producto/)
  })
})
