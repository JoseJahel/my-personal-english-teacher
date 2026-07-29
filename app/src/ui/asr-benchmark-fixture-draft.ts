import { homeScreenInterfaceTexts } from './interface-texts'

/**
 * Validation for a benchmark fixture draft before it is persisted: the reference
 * text typed by the developer plus the just-recorded audio (sample count + rate).
 * Kept separate from the storage layer so the UI can validate synchronously
 * before touching IndexedDB.
 */

/** Why a benchmark fixture draft was rejected. */
export type BenchmarkFixtureDraftInvalidReason =
  'missing-reference-text' | 'empty-recording' | 'too-short' | 'too-long'

/** Result of validating a benchmark fixture draft. */
export type BenchmarkFixtureDraftValidationResult =
  | { readonly isValid: true }
  | { readonly isValid: false; readonly reason: BenchmarkFixtureDraftInvalidReason }

const MIN_FIXTURE_DURATION_SECONDS = 0.5
const MAX_FIXTURE_DURATION_SECONDS = 30

/**
 * Validates a benchmark fixture draft made of a reference text and a recorded
 * clip described by its sample count and sample rate.
 *
 * Check order: blank reference text → empty recording → too short → too long → valid.
 */
export function validateBenchmarkFixtureDraft(
  referenceTextEn: string,
  sampleCount: number,
  sampleRateInHertz: number,
): BenchmarkFixtureDraftValidationResult {
  if (referenceTextEn.trim().length === 0) {
    return { isValid: false, reason: 'missing-reference-text' }
  }

  if (sampleCount <= 0 || sampleRateInHertz <= 0) {
    return { isValid: false, reason: 'empty-recording' }
  }

  const durationSeconds = sampleCount / sampleRateInHertz

  if (durationSeconds < MIN_FIXTURE_DURATION_SECONDS) {
    return { isValid: false, reason: 'too-short' }
  }

  if (durationSeconds > MAX_FIXTURE_DURATION_SECONDS) {
    return { isValid: false, reason: 'too-long' }
  }

  return { isValid: true }
}

/** Maps a benchmark fixture draft invalid reason to its Spanish user-facing copy. */
export function benchmarkFixtureDraftErrorMessageFor(
  reason: BenchmarkFixtureDraftInvalidReason,
): string {
  const messages = homeScreenInterfaceTexts.asrBenchmark.fixtureDraftErrorMessages

  switch (reason) {
    case 'missing-reference-text':
      return messages.missingReferenceText
    case 'empty-recording':
      return messages.emptyRecording
    case 'too-short':
      return messages.tooShort
    case 'too-long':
      return messages.tooLong
  }
}
