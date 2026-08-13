import { describe, expect, it } from 'vitest'
import {
  pronunciationStatusMessageFor,
  type PronunciationUiStatus,
} from './home-screen-status'
import { homeScreenInterfaceTexts } from './interface-texts'
import {
  resolvePronunciationScoreEligibility,
  resolvePronunciationScoreEligibilityFromCapture,
} from './pronunciation-score-eligibility'

const usableSpeech = {
  userSampleCount: 16_000,
  hasUsableSpeechEnergy: true,
  transcribedText: 'I would like a glass of water please',
  referenceEnglishText: 'I would like a glass of water, please.',
  audioDurationSeconds: 2,
} as const

describe('resolvePronunciationScoreEligibility', () => {
  it('allows scoring a real English utterance with usable energy', () => {
    expect(resolvePronunciationScoreEligibility(usableSpeech)).toEqual({ shouldScore: true })
  })

  it('refuses an empty recording so silence cannot become a poor score', () => {
    expect(
      resolvePronunciationScoreEligibility({
        ...usableSpeech,
        userSampleCount: 0,
        hasUsableSpeechEnergy: false,
      }),
    ).toEqual({ shouldScore: false, reason: 'empty-audio' })
  })

  it('refuses low-energy captures that never reached Whisper as speech', () => {
    expect(
      resolvePronunciationScoreEligibility({
        ...usableSpeech,
        hasUsableSpeechEnergy: false,
      }),
    ).toEqual({ shouldScore: false, reason: 'low-energy' })
  })

  it('refuses Whisper non-speech tags such as [Music]', () => {
    expect(
      resolvePronunciationScoreEligibility({
        ...usableSpeech,
        transcribedText: '[Music]',
        referenceEnglishText: '[Music]',
      }),
    ).toEqual({ shouldScore: false, reason: 'non-speech-transcript' })
  })

  it('refuses degenerate ASR loops so they cannot be scored as pronunciation', () => {
    const loop = Array.from({ length: 40 }, () => 'biasesVIDEO').join(' ')
    expect(
      resolvePronunciationScoreEligibility({
        ...usableSpeech,
        transcribedText: loop,
        referenceEnglishText: loop,
        audioDurationSeconds: 3,
      }),
    ).toEqual({ shouldScore: false, reason: 'degenerate-transcript' })
  })

  it('refuses an empty reference phrase even if energy looked usable', () => {
    expect(
      resolvePronunciationScoreEligibility({
        ...usableSpeech,
        transcribedText: '   ',
        referenceEnglishText: '   ',
      }),
    ).toEqual({ shouldScore: false, reason: 'empty-reference-text' })
  })

  it('maps a missing capture snapshot to empty-audio without scoring', () => {
    expect(
      resolvePronunciationScoreEligibilityFromCapture({
        samples: null,
        sampleRateInHertz: 16_000,
        transcribedText: usableSpeech.transcribedText,
        referenceEnglishText: usableSpeech.referenceEnglishText,
      }),
    ).toEqual({ shouldScore: false, reason: 'empty-audio' })
  })
})

describe('pronunciationStatusMessageFor not-evaluated', () => {
  it('uses honest Spanish copy that is not a 0-100 poor-score verdict', () => {
    const status: PronunciationUiStatus = 'not-evaluated'
    const message = pronunciationStatusMessageFor(status, 12)
    expect(message).toBe(homeScreenInterfaceTexts.pronunciationStatusMessages.notEvaluated)
    expect(message.toLowerCase()).toMatch(/no se evalu/)
    expect(message).not.toMatch(/12/)
    expect(message).not.toMatch(/\/ 100/)
  })
})
