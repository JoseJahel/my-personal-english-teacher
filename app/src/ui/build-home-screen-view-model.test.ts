import { describe, expect, it } from 'vitest'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
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

describe('buildHomeScreenViewModel — pronunciation breakdown (issue #58)', () => {
  it('includes energy and formant scores in the Spanish detail line', () => {
    const pronunciationScore: PronunciationScoreResult = {
      score0to100: 84,
      mfccScore0to100: 88,
      pitchScore0to100: 76,
      energyScore0to100: 91,
      formantScore0to100: 70,
      mfccNormalizedDistance: 2,
      pitchNormalizedDistance: 3,
      energyNormalizedDistance: 0.4,
      formantLogHertzDistance: 0.2,
      userMfccFrameCount: 40,
      referenceMfccFrameCount: 42,
      dtwPathLength: 45,
      wordHighlights: [],
    }
    const viewModel = buildHomeScreenViewModel(
      viewModelInput({
        pronunciationStatus: 'done',
        pronunciationScore,
      }),
    )
    expect(viewModel.pronunciationDetailMessage).toBe(
      'MFCC 88.0 · pitch 76.0 · energía 91.0 · formantes 70.0 · frames usuario 40 / ref 42',
    )
  })
})
