import { describe, expect, it } from 'vitest'
import {
  buildHomeScreenViewModel,
  type HomeScreenViewModelInput,
} from './build-home-screen-view-model'

function viewModelInput(
  overrides: Partial<HomeScreenViewModelInput> = {},
): HomeScreenViewModelInput {
  return {
    microphoneStatus: 'idle',
    microphoneErrorDetail: null,
    transcriptionStatus: 'done',
    modelLoadingProgressPercent: 100,
    transcriptionErrorReason: null,
    noAudioReason: null,
    grammarCorrectionStatus: 'done',
    grammarModelLoadingProgressPercent: 100,
    grammarCorrectionErrorReason: null,
    speechSynthesisStatus: 'idle',
    speechModelLoadingProgressPercent: 0,
    speechSynthesisErrorReason: null,
    tutorGenerationStatus: 'idle',
    tutorModelLoadingProgressPercent: 0,
    pronunciationStatus: 'idle',
    pronunciationScore: null,
    transcribedText: 'i want water',
    correctedGrammarText: 'I want water.',
    captureDiagnostics: null,
    medianFormants: null,
    isStarting: false,
    isListening: false,
    ...overrides,
  }
}

describe('buildHomeScreenViewModel — issue #96 half-duplex lock', () => {
  it('does not treat SmolLM2 generation as the tutor speaking (mic stays free)', () => {
    const viewModel = buildHomeScreenViewModel(
      viewModelInput({ tutorGenerationStatus: 'generating' }),
    )

    expect(viewModel.isTutorSpeaking).toBe(false)
    expect(viewModel.isTutorComposingReply).toBe(true)
  })

  it('still locks the mic while SpeechT5 is playing', () => {
    const viewModel = buildHomeScreenViewModel(
      viewModelInput({ speechSynthesisStatus: 'playing' }),
    )

    expect(viewModel.isTutorSpeaking).toBe(true)
  })
})
