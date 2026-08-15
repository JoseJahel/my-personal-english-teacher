import type { GenerateTutorReplyInput, TutorReplyResult } from '../ia/inference-client'
import type { TutorReplyHistoryTurn } from '../ia/inference-worker-protocol'
import type { PostInterruptionTutorResolution } from './interruption-resume-bridges'
import { isCurrentAttemptGeneration } from './practice-turn-signal-snapshot'

export interface PublishUserThenResolveTutorInput<T> {
  readonly publishUserUtterance: () => void
  readonly resolveTutorReply: () => Promise<T>
  readonly startedAtGeneration: number
  readonly readCurrentGeneration: () => number
}

export type PublishUserThenResolveTutorResult<T> =
  | { readonly applied: true; readonly result: T }
  | { readonly applied: false; readonly result: T }

/**
 * Issue #96: put the student bubble on screen first, then the tutor line.
 * A newer utterance (generation bump) discards a late tutor reply.
 */
export async function publishUserUtteranceThenResolveTutor<T>(
  input: PublishUserThenResolveTutorInput<T>,
): Promise<PublishUserThenResolveTutorResult<T>> {
  input.publishUserUtterance()
  const result = await input.resolveTutorReply()
  if (
    !isCurrentAttemptGeneration(input.startedAtGeneration, input.readCurrentGeneration())
  ) {
    return { applied: false, result }
  }
  return { applied: true, result }
}

export interface PracticeTutorReplyResolution {
  readonly tutorReplyText: string
  readonly usedFallback: boolean
}

export interface ResolvePracticeTutorReplyInput {
  readonly generateTutorReply:
    | ((input: GenerateTutorReplyInput) => Promise<TutorReplyResult>)
    | undefined
  readonly markTutorGenerationInFlight: (inFlight: boolean) => void
  readonly scenarioContextEn: string
  readonly historyTurnsEn: readonly TutorReplyHistoryTurn[]
  readonly userUtteranceEn: string
  readonly fallbackReplyEn: string
  readonly interruptionResolution: PostInterruptionTutorResolution | null
}

export async function resolvePracticeTutorReply(
  input: ResolvePracticeTutorReplyInput,
): Promise<PracticeTutorReplyResolution> {
  input.markTutorGenerationInFlight(true)
  try {
    if (input.interruptionResolution) {
      return {
        tutorReplyText: input.interruptionResolution.replyText,
        usedFallback: false,
      }
    }
    // Instant path: the contextual script is the product reply. SmolLM2 must
    // not sit on the 10 s timeout before the tutor speaks.
    return {
      tutorReplyText: input.fallbackReplyEn,
      usedFallback: false,
    }
  } finally {
    input.markTutorGenerationInFlight(false)
  }
}
