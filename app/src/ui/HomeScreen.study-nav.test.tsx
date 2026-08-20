import { createRef, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HomeScreen, type HomeScreenProps } from './HomeScreen'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'
import { STUDY_TEST_IDS } from './study-interface-texts'

const emptyCanvasRef = createRef<HTMLCanvasElement | null>()

function dummyHomeScreenProps(): HomeScreenProps {
  return {
    canvasRef: emptyCanvasRef,
    spectrogramCanvasRef: emptyCanvasRef,
    pitchTrackCanvasRef: emptyCanvasRef,
    isStarting: false,
    isListening: false,
    isTutorSpeaking: false,
    hasCompletedCapture: false,
    liveInputLevel01: 0,
    liveRms: 0,
    livePeak: 0,
    activeMicrophoneLabel: '',
    environmentDiagnosticsMessage: null,
    microphoneStatusMessage: '',
    transcriptionStatusMessage: '',
    transcribedText: '',
    captureDiagnosticsMessage: null,
    grammarCorrectionStatusMessage: '',
    correctedGrammarText: '',
    grammarCorrectionMadeNoChangesToTranscription: false,
    speechSynthesisStatusMessage: '',
    tutorGenerationStatusMessage: '',
    isTutorPreparingConversationModel: false,
    isTutorComposingReply: false,
    pronunciationStatusMessage: '',
    pronunciationDetailMessage: null,
    pronunciationScore0to100: null,
    pronunciationMfccScore0to100: null,
    pronunciationPitchScore0to100: null,
    pronunciationWordHighlights: [],
    formantsSummaryMessage: null,
    medianFormants: null,
    practiceHistoryTurns: [],
    practiceHistoryStatusMessage: '',
    primaryActivityMessage: '',
    isPreparingModels: false,
    offlineReadinessMessage: '',
    offlineReadiness: 'none-cached',
    selectedScenarioId: 'restaurant',
    chatMessages: [],
    communicationSuggestions: [],
    lastTutorLineEn: '',
    drillStatus: 'idle',
    drillScore0to100: null,
    drillWordHighlights: [],
    isDrillListening: false,
    onStartDrill: () => undefined,
    onStopDrill: () => undefined,
    firstTurnHintEn: '',
    onSelectScenario: () => undefined,
    onStartMicrophone: () => undefined,
    onStopMicrophone: () => undefined,
  }
}

describe('HomeScreen study navigation', () => {
  let root: ReturnType<typeof createRoot> | null = null
  let host: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.location.hash = ''
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
    window.location.hash = ''
  })

  it('embeds StudyScreen beside the rail and returns to practice from the rail', async () => {
    await act(async () => {
      root?.render(<HomeScreen {...dummyHomeScreenProps()} />)
    })
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.rail}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.center}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).toBeNull()

    await act(async () => {
      ;(
        host.querySelector(
          `[data-testid="${PRACTICE_SHELL_TEST_IDS.railNavStudy}"]`,
        ) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.rail}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.center}"]`)).toBeNull()
    expect(window.location.hash).toBe('#estudio')

    await act(async () => {
      ;(
        host.querySelector(
          `[data-testid="${PRACTICE_SHELL_TEST_IDS.railNavPractice}"]`,
        ) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.center}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.rail}"]`)).not.toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('opens study inside the shell when the initial hash is #estudio', async () => {
    window.location.hash = 'estudio'
    await act(async () => {
      root?.render(<HomeScreen {...dummyHomeScreenProps()} />)
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.rail}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${PRACTICE_SHELL_TEST_IDS.center}"]`)).toBeNull()
  })
})
