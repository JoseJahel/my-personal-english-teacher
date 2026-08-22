/**
 * Orchestrates pronunciation scoring for a practice turn (main thread).
 * User PCM and TTS reference share `prepareSpeechPcmForModels` (issue #73)
 * so the score does not compare two different preprocess paths. Both are
 * resampled to WHISPER_SAMPLE_RATE_IN_HERTZ regardless of what rate the
 * TTS engine emits (see targetRate below).
 */

import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'
import { prepareSpeechPcmForModels } from '../audio/prepare-speech-pcm'
import type { SynthesizedSpeechResult } from '../ia/inference-client'
import {
  scorePronunciationFromMonoPcm,
  type PronunciationScoreResult,
} from '../dsp/pronunciation-score'

export async function runPronunciationScoringForUtterance(options: {
  readonly userSamples: Float32Array
  readonly userSampleRateInHertz: number
  /** Phrase the user should match (usually grammar-corrected transcript). */
  readonly referenceEnglishText: string
  readonly synthesizeSpeech: (englishText: string) => Promise<SynthesizedSpeechResult>
}): Promise<PronunciationScoreResult | null> {
  const referenceText = options.referenceEnglishText.trim()
  if (
    options.userSamples.length === 0 ||
    options.userSampleRateInHertz <= 0 ||
    referenceText.length === 0
  ) {
    return null
  }

  const synthesized = await options.synthesizeSpeech(referenceText)
  if (synthesized.samples.length === 0 || synthesized.sampleRateInHertz <= 0) {
    return null
  }

  // Fixed at 16 kHz, not inherited from the synthesizer: the MFCC/DTW
  // calibration constants (see pronunciation-score.ts) were tuned for a
  // 16 kHz mel filterbank + bandpass regime. Letting targetRate follow
  // whatever rate the TTS engine emits (e.g. 44.1 kHz) would shift the
  // MFCC coefficients out of that calibrated regime.
  const targetRate = WHISPER_SAMPLE_RATE_IN_HERTZ
  const userPrepared = prepareSpeechPcmForModels(
    options.userSamples,
    options.userSampleRateInHertz,
    targetRate,
  )
  const referencePrepared = prepareSpeechPcmForModels(
    synthesized.samples,
    synthesized.sampleRateInHertz,
    targetRate,
  )

  return scorePronunciationFromMonoPcm(
    userPrepared,
    referencePrepared,
    targetRate,
    { referenceTextForHighlights: referenceText },
  )
}
