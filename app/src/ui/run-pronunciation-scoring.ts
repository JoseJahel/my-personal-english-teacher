/**
 * Orchestrates pronunciation scoring for a practice turn (main thread).
 * Resamples user audio, synthesizes TTS reference, runs pure DSP score.
 */

import { resampleAudioSamples } from '../audio/audio-resampler'
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

  const targetRate = synthesized.sampleRateInHertz
  const userAtReferenceRate = resampleAudioSamples(
    options.userSamples,
    options.userSampleRateInHertz,
    targetRate,
  )

  return scorePronunciationFromMonoPcm(
    userAtReferenceRate,
    synthesized.samples,
    targetRate,
    { referenceTextForHighlights: referenceText },
  )
}
