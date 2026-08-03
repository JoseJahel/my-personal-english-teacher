/**
 * Per-turn acoustic snapshot for pronunciation scoring and IndexedDB persist.
 * Capture by value at end of usable utterance so later turns cannot overwrite
 * the PCM/formants used by an in-flight score/persist pipeline.
 */

import type { FormantTriple } from '../dsp/formant-estimation'

export interface UserTurnSignalSnapshot {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
  readonly formants: FormantTriple | null
}

/**
 * Deep-enough copy of utterance signals owned by one practice turn.
 * `samples` is sliced; formants are cloned as a plain triple when present.
 */
export function createUserTurnSignalSnapshot(
  samples: Float32Array,
  sampleRateInHertz: number,
  formants: FormantTriple | null,
): UserTurnSignalSnapshot {
  return {
    samples: samples.slice(),
    sampleRateInHertz,
    formants: cloneFormantTriple(formants),
  }
}

export function cloneFormantTriple(formants: FormantTriple | null): FormantTriple | null {
  if (!formants) {
    return null
  }
  return {
    f1InHertz: formants.f1InHertz,
    f2InHertz: formants.f2InHertz,
    f3InHertz: formants.f3InHertz,
  }
}

/**
 * Whether an async scoring attempt may still update UI / return a result.
 * Generation is bumped when a newer utterance starts scoring (or supersedes).
 */
export function isCurrentAttemptGeneration(
  attemptGeneration: number,
  currentGeneration: number,
): boolean {
  return attemptGeneration === currentGeneration
}
