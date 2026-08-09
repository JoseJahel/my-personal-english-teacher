/**
 * Deterministic post-barge-in tutor bridges (issue #46, layer 5).
 * Pure: no LLM. Uses classification + spoken_progress fragment only.
 */

import {
  classifyInterruptionTurn,
  type InterruptionTurnKind,
} from './interruption-turn-classifier'
import type { PracticeScenario } from './practice-scenarios'
import {
  isEarlyCutoffSpokenProgress,
  remainingUnspokenText,
  type SpokenProgress,
} from './spoken-progress'
import { pickContextualTutorReply } from './tutor-reply-engine'

export interface ResolvePostInterruptionTutorReplyInput {
  readonly scenario: PracticeScenario
  readonly spokenProgress: SpokenProgress
  readonly userUtteranceEn: string
  readonly userTurnIndex: number
  /** Optional precomputed kind (tests); otherwise classified here. */
  readonly classification?: InterruptionTurnKind
}

export interface PostInterruptionTutorResolution {
  readonly classification: InterruptionTurnKind
  /** English line for the tutor (fallback / bridge). */
  readonly replyText: string
  /**
   * When true, the scene step may advance (Case B answered the fragment).
   * When false, keep pending_from_cutoff until the tutor finishes cleanly.
   */
  readonly advanceScene: boolean
  /** Clear session pending spoken_progress after this resolution. */
  readonly clearPendingCutoff: boolean
  /**
   * System-context note for SmolLM2: what was said, what was heard, cutoff.
   * Empty when there was no useful interruption context.
   */
  readonly llmContextNoteEn: string
}

/**
 * Resolve how the tutor should continue after the learner interrupted TTS.
 *
 * - Case A (digression): short answer + deterministic resume of the unfinished ask.
 * - Case B (in-task on fragment): contextual reply; advance scene; do not repeat full list.
 * - Case C (early cutoff): reformulate the full tutor line; do not advance.
 * - Unclear: ask to repeat without advancing.
 */
export function resolvePostInterruptionTutorReply(
  input: ResolvePostInterruptionTutorReplyInput,
): PostInterruptionTutorResolution {
  const classification =
    input.classification ??
    classifyInterruptionTurn({
      spokenProgress: input.spokenProgress,
      userUtteranceEn: input.userUtteranceEn,
    })

  const llmContextNoteEn = buildLlmContextNote(input.spokenProgress, classification)
  const remainder = remainingUnspokenText(input.spokenProgress)
  const spokenFragment = input.spokenProgress.spokenText.trim()

  switch (classification) {
    case 'digression': {
      const digressionAnswer = answerDigressionBriefly(
        input.userUtteranceEn,
        spokenFragment,
        input.scenario,
      )
      const resumeAsk =
        remainder.length > 0
          ? remainder
          : spokenFragment.length > 0
            ? spokenFragment
            : input.spokenProgress.fullText
      const replyText = `${digressionAnswer} Going back: ${ensureQuestionShape(resumeAsk)}`
      return {
        classification,
        replyText,
        advanceScene: false,
        clearPendingCutoff: false,
        llmContextNoteEn,
      }
    }
    case 'in_task_response': {
      // Answer from the fragment only — never force the unspoken half of the list.
      const contextual = pickContextualTutorReply({
        scenario: input.scenario,
        userUtteranceEn: input.userUtteranceEn,
        userTurnIndex: input.userTurnIndex,
      })
      return {
        classification,
        replyText: contextual,
        advanceScene: true,
        clearPendingCutoff: true,
        llmContextNoteEn,
      }
    }
    case 'early_cutoff': {
      const full = input.spokenProgress.fullText.trim()
      const replyText =
        full.length > 0
          ? `Sorry, let me say that again. ${full}`
          : pickContextualTutorReply({
              scenario: input.scenario,
              userUtteranceEn: input.userUtteranceEn,
              userTurnIndex: input.userTurnIndex,
            })
      return {
        classification,
        replyText,
        advanceScene: false,
        clearPendingCutoff: false,
        llmContextNoteEn,
      }
    }
    case 'unclear':
    default: {
      return {
        classification: 'unclear',
        replyText: clarifyAfterInterruption(input.scenario, spokenFragment),
        advanceScene: false,
        clearPendingCutoff: isEarlyCutoffSpokenProgress(input.spokenProgress),
        llmContextNoteEn,
      }
    }
  }
}

function buildLlmContextNote(
  progress: SpokenProgress,
  classification: InterruptionTurnKind,
): string {
  if (progress.completed) {
    return ''
  }
  return [
    'BARGE-IN CONTEXT (mid-utterance interruption):',
    `You were saying: "${progress.fullText}"`,
    `The learner only heard: "${progress.spokenText}" (cutoff at ${progress.cutoffMs} ms, token index ${progress.cutoffTokenIndex}).`,
    `Classification of their reply: ${classification}.`,
    'Do not assume they heard the full sentence. Do not restart the whole scene.',
  ].join(' ')
}

function answerDigressionBriefly(
  userUtteranceEn: string,
  spokenFragment: string,
  scenario: PracticeScenario,
): string {
  const normalized = userUtteranceEn.toLowerCase()
  const termMatch =
    normalized.match(/what does ['"]?([a-z][a-z\s-]{1,40}?)['"]? mean/) ??
    normalized.match(/what is (?:a |an |the )?([a-z][a-z\s-]{1,40}?)\??$/)

  if (termMatch?.[1]) {
    const term = termMatch[1].trim()
    if (/main course/.test(term)) {
      return `'Main course' means the main dish of the meal — the biggest plate, not a side or drink.`
    }
    if (/boarding pass/.test(term)) {
      return `A 'boarding pass' is the ticket document that lets you board the plane.`
    }
    return `'${term}' is a useful phrase in this situation; I can explain more if you want.`
  }

  if (/\b(wait|sorry|hold on)\b/.test(normalized)) {
    return 'No problem — take your time.'
  }

  if (spokenFragment.length > 0) {
    return 'Good question. Happy to clarify that.'
  }

  switch (scenario.id) {
    case 'restaurant':
      return 'Of course — happy to explain.'
    case 'airport':
      return 'Sure — happy to clarify that for your flight.'
    case 'job-interview':
      return 'Of course — happy to clarify.'
    default:
      return 'Of course — happy to clarify.'
  }
}

function ensureQuestionShape(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 'Shall we continue?'
  }
  if (/[?!.]$/.test(trimmed)) {
    return trimmed
  }
  return `${trimmed}?`
}

function clarifyAfterInterruption(scenario: PracticeScenario, spokenFragment: string): string {
  if (spokenFragment.length > 0) {
    return `Sorry, I did not catch your reply to: "${spokenFragment}". Could you say that again?`
  }
  switch (scenario.id) {
    case 'restaurant':
      return 'Sorry, I did not catch that. What would you like to order?'
    case 'airport':
      return 'Sorry, I did not catch that. How can I help with your flight?'
    case 'job-interview':
      return 'Sorry, I did not catch that. Could you please say that again?'
    default:
      return 'Sorry, I did not catch that. Could you please say it again?'
  }
}
