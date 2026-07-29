/**
 * Pure orchestration for hybrid tutor replies: SmolLM2 (via InferenceClient)
 * first, scenario regex as the fallback. Extracted out of the home-screen
 * hook so the timeout/fallback branching is unit-testable without React or
 * a live worker.
 */

import type { GenerateTutorReplyInput, TutorReplyResult } from '../ia/inference-client'

/** Matches the 10 s cap from the design doc (section 2 — hybrid conversation). */
export const TUTOR_REPLY_TIMEOUT_MS = 10_000

export interface ResolveTutorReplyInput {
  readonly generateTutorReply: (input: GenerateTutorReplyInput) => Promise<TutorReplyResult>
  readonly requestInput: GenerateTutorReplyInput
  readonly timeoutMs?: number
}

/**
 * Runs the LLM tutor reply against a timeout. Falls back to the scenario
 * regex line (`requestInput.fallbackReplyEn`) whenever the LLM times out,
 * rejects, or the worker itself already reports `usedFallback` (implausible
 * output). `usedFallback` in the result returned here is always truthful.
 */
export async function resolveTutorReplyWithFallback(
  input: ResolveTutorReplyInput,
): Promise<TutorReplyResult> {
  const timeoutMs = input.timeoutMs ?? TUTOR_REPLY_TIMEOUT_MS
  const fallbackResult: TutorReplyResult = {
    tutorReplyText: input.requestInput.fallbackReplyEn.trim(),
    usedFallback: true,
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<TutorReplyResult>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallbackResult), timeoutMs)
  })

  try {
    return await Promise.race([input.generateTutorReply(input.requestInput), timeoutPromise])
  } catch {
    return fallbackResult
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
