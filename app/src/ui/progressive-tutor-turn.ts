import type { GenerateTutorReplyInput, TutorReplyResult } from '../ia/inference-client'
import type { TutorReplyHistoryTurn } from '../ia/inference-worker-protocol'
import type { PostInterruptionTutorResolution } from './interruption-resume-bridges'
import { isCurrentAttemptGeneration } from './practice-turn-signal-snapshot'
import { resolveTutorReplyWithFallback } from './tutor-reply-orchestration'

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
 * Issue #96: put the student bubble on screen first, then wait for SmolLM2.
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
  let tutorReplyText = input.fallbackReplyEn
  let usedFallback = true
  try {
    if (input.generateTutorReply) {
      const result = await resolveTutorReplyWithFallback({
        generateTutorReply: input.generateTutorReply,
        requestInput: {
          scenarioContextEn: input.scenarioContextEn,
          historyTurnsEn: [...input.historyTurnsEn],
          userUtteranceEn: input.userUtteranceEn,
          fallbackReplyEn: input.fallbackReplyEn,
        },
      })
      const interruption = input.interruptionResolution
      if (
        interruption &&
        (result.usedFallback ||
          interruption.classification === 'digression' ||
          interruption.classification === 'early_cutoff')
      ) {
        tutorReplyText = interruption.replyText
        usedFallback = true
      } else {
        tutorReplyText = result.tutorReplyText
        usedFallback = result.usedFallback
      }
    }
  } finally {
    input.markTutorGenerationInFlight(false)
  }
  return { tutorReplyText, usedFallback }
}
