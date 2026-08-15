/**
 * Whether a practice turn may receive a 0–100 pronunciation score (issue #75).
 * Unusable speech must never be shown as “poor pronunciation”.
 */

import { conversationPronunciationScoreIsEnabled } from '../dsp/speaker-bias-invariants'
import { hasUsableSpeechEnergy } from '../dsp/signal-energy'
import { isDegenerateTranscript, isNonSpeechTranscript } from '../ia/transcription-text'
import type { PronunciationUiStatus } from './home-screen-status'

export type PronunciationScoreSkipReason =
  | 'empty-audio'
  | 'low-energy'
  | 'non-speech-transcript'
  | 'degenerate-transcript'
  | 'empty-reference-text'
  | 'conversation-deferred-to-drill'

export type PronunciationScoreEligibility =
  | { readonly shouldScore: true }
  | { readonly shouldScore: false; readonly reason: PronunciationScoreSkipReason }

export function resolvePronunciationScoreEligibility(input: {
  readonly userSampleCount: number
  readonly hasUsableSpeechEnergy: boolean
  readonly transcribedText: string
  readonly referenceEnglishText: string
  readonly audioDurationSeconds?: number
  /**
   * Conversation path only. Drill must omit this so #95 can keep 0–100 there.
   * Default true = apply the published speaker-bias policy.
   */
  readonly applyConversationSpeakerBiasPolicy?: boolean
}): PronunciationScoreEligibility {
  if (input.userSampleCount <= 0) {
    return { shouldScore: false, reason: 'empty-audio' }
  }
  if (!input.hasUsableSpeechEnergy) {
    return { shouldScore: false, reason: 'low-energy' }
  }

  const transcribedText = input.transcribedText.trim()
  const referenceEnglishText = input.referenceEnglishText.trim()
  if (transcribedText.length === 0 || referenceEnglishText.length === 0) {
    return { shouldScore: false, reason: 'empty-reference-text' }
  }
  if (isNonSpeechTranscript(transcribedText) || isNonSpeechTranscript(referenceEnglishText)) {
    return { shouldScore: false, reason: 'non-speech-transcript' }
  }
  if (
    isDegenerateTranscript(transcribedText, input.audioDurationSeconds) ||
    isDegenerateTranscript(referenceEnglishText, input.audioDurationSeconds)
  ) {
    return { shouldScore: false, reason: 'degenerate-transcript' }
  }

  if (
    (input.applyConversationSpeakerBiasPolicy ?? true) &&
    !conversationPronunciationScoreIsEnabled()
  ) {
    return { shouldScore: false, reason: 'conversation-deferred-to-drill' }
  }

  return { shouldScore: true }
}

export function resolvePronunciationScoreEligibilityFromCapture(input: {
  readonly samples: Float32Array | null | undefined
  readonly sampleRateInHertz: number
  readonly transcribedText: string
  readonly referenceEnglishText: string
  readonly applyConversationSpeakerBiasPolicy?: boolean
}): PronunciationScoreEligibility {
  const samples = input.samples
  return resolvePronunciationScoreEligibility({
    userSampleCount: samples?.length ?? 0,
    hasUsableSpeechEnergy: samples
      ? hasUsableSpeechEnergy(samples, input.sampleRateInHertz)
      : false,
    transcribedText: input.transcribedText,
    referenceEnglishText: input.referenceEnglishText,
    audioDurationSeconds: samples ? samples.length / input.sampleRateInHertz : undefined,
    applyConversationSpeakerBiasPolicy: input.applyConversationSpeakerBiasPolicy,
  })
}

export function resolveConversationPronunciationSkipStatus(
  eligibility: PronunciationScoreEligibility,
): PronunciationUiStatus {
  if (eligibility.shouldScore) {
    return 'unavailable'
  }
  if (eligibility.reason === 'conversation-deferred-to-drill') {
    return 'deferred-to-drill'
  }
  return 'not-evaluated'
}
