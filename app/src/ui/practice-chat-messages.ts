/**
 * Pure helpers for practice-chat messages (no React).
 * Avance 2: scenario intro + user ASR/grammar + SmolLM2 (or fallback) tutor replies.
 */

import type { TutorReplyHistoryTurn } from '../ia/inference-worker-protocol'
import type { PracticeScenario } from './practice-scenarios'
import type { UserTurnSignalCard } from './user-turn-signal-card'

export type PracticeChatMessageRole = 'tutor' | 'user'

export type PracticeChatMessageKind =
  | 'scenario-intro'
  | 'user-utterance'
  | 'tutor-reply'
  | 'tutor-fallback'

export interface PracticeChatMessage {
  readonly id: string
  readonly role: PracticeChatMessageRole
  readonly kind: PracticeChatMessageKind
  /** Primary text shown in the bubble (English practice content). */
  readonly text: string
  /** Present when grammar correction differs from ASR text. */
  readonly correctedText?: string
  /** Metrics-only card for this user turn (issue #79). Never includes PCM. */
  readonly signalCard?: UserTurnSignalCard
}

export function createScenarioIntroMessage(
  scenario: PracticeScenario,
  messageId: string,
): PracticeChatMessage {
  return {
    id: messageId,
    role: 'tutor',
    kind: 'scenario-intro',
    text: scenario.tutorOpeningLineEn,
  }
}

export function createUserUtteranceMessage(
  transcribedText: string,
  correctedGrammarText: string,
  messageId: string,
  extras?: { readonly signalCard?: UserTurnSignalCard },
): PracticeChatMessage {
  const trimmedTranscript = transcribedText.trim()
  const trimmedCorrected = correctedGrammarText.trim()
  const grammarChanged =
    trimmedCorrected.length > 0 &&
    trimmedCorrected.localeCompare(trimmedTranscript, undefined, {
      sensitivity: 'accent',
    }) !== 0

  return {
    id: messageId,
    role: 'user',
    kind: 'user-utterance',
    text: trimmedTranscript,
    ...(grammarChanged ? { correctedText: trimmedCorrected } : {}),
    ...(extras?.signalCard ? { signalCard: extras.signalCard } : {}),
  }
}

/** SmolLM2-generated (or soft-fallback) tutor line after a user utterance. */
export function createTutorReplyMessage(
  tutorReplyText: string,
  messageId: string,
  usedFallback: boolean,
): PracticeChatMessage {
  return {
    id: messageId,
    role: 'tutor',
    kind: usedFallback ? 'tutor-fallback' : 'tutor-reply',
    text: tutorReplyText.trim(),
  }
}

/** @deprecated Prefer createTutorReplyMessage; kept for tests of static scenario lines. */
export function createTutorPlaceholderFollowUpMessage(
  scenario: PracticeScenario,
  messageId: string,
): PracticeChatMessage {
  return createTutorReplyMessage(scenario.tutorFollowUpPlaceholderEn, messageId, true)
}

export function buildInitialChatMessagesForScenario(
  scenario: PracticeScenario,
  introMessageId: string,
): PracticeChatMessage[] {
  return [createScenarioIntroMessage(scenario, introMessageId)]
}

/** Last tutor line in the chat (for SmolLM2 context), or empty. */
export function findLastTutorLineText(
  messages: readonly PracticeChatMessage[],
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'tutor') {
      return message.text
    }
  }
  return ''
}

const MAX_TUTOR_REPLY_HISTORY_TURNS = 4

/**
 * Last N chat turns (tutor + student), oldest first — SmolLM2's short-term
 * memory window. Shape matches `historyTurnsEn` on the inference protocol.
 */
export function buildRecentHistoryTurnsEn(
  messages: readonly PracticeChatMessage[],
  maxTurns: number = MAX_TUTOR_REPLY_HISTORY_TURNS,
): TutorReplyHistoryTurn[] {
  const turns: TutorReplyHistoryTurn[] = []
  for (const message of messages) {
    if (message.role === 'tutor') {
      turns.push({ speaker: 'tutor', textEn: message.text })
    } else {
      turns.push({ speaker: 'student', textEn: message.correctedText ?? message.text })
    }
  }
  return turns.slice(-maxTurns)
}
