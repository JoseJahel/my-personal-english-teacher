/**
 * Per-turn signal card data (issue #79). Metrics only — never PCM.
 * Built from the same by-value snapshot used for score/persist.
 */

import type { FormantTriple } from '../dsp/formant-estimation'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import { summarizeWordHighlights } from '../storage/practice-session-types'
import { formatFormantsSummaryMessage } from './home-session-helpers'
import { homeScreenInterfaceTexts } from './interface-texts'
import type { PronunciationScoreSkipReason } from './pronunciation-score-eligibility'

export type UserTurnSignalCardKind = 'scored' | 'deferred-to-drill' | 'not-evaluated'

export interface UserTurnSignalCard {
  readonly kind: UserTurnSignalCardKind
  readonly score0to100: number | null
  readonly goodWordCount: number
  readonly mediumWordCount: number
  readonly poorWordCount: number
  readonly wordHighlightSummary: string
  readonly formantF1InHertz: number | null
  readonly formantF2InHertz: number | null
  readonly formantF3InHertz: number | null
}

export interface UserTurnSignalCardViewModel {
  readonly title: string
  readonly scoreLine: string
  readonly highlightLine: string
  readonly formantsLine: string
  readonly openSignalsLabel: string
  readonly openSignalsHint: string
  readonly signalsUnavailableHint: string
}

export function createUserTurnSignalCard(input: {
  readonly pronunciation: PronunciationScoreResult | null
  readonly formants: FormantTriple | null
  readonly skipReason?: PronunciationScoreSkipReason | null
}): UserTurnSignalCard {
  const highlights = input.pronunciation?.wordHighlights ?? []
  const bands = countHighlightBands(highlights)
  return {
    kind: resolveSignalCardKind(input.pronunciation, input.skipReason),
    score0to100: input.pronunciation?.score0to100 ?? null,
    goodWordCount: bands.good,
    mediumWordCount: bands.medium,
    poorWordCount: bands.poor,
    wordHighlightSummary: summarizeWordHighlights(highlights),
    formantF1InHertz: input.formants?.f1InHertz ?? null,
    formantF2InHertz: input.formants?.f2InHertz ?? null,
    formantF3InHertz: input.formants?.f3InHertz ?? null,
  }
}

export function formatUserTurnSignalCardViewModel(
  card: UserTurnSignalCard,
): UserTurnSignalCardViewModel {
  const copy = homeScreenInterfaceTexts.practiceChat.signalCard
  const formantsLine =
    formatFormantsSummaryMessage({
      f1InHertz: card.formantF1InHertz,
      f2InHertz: card.formantF2InHertz,
      f3InHertz: card.formantF3InHertz,
    }) ?? copy.formantsUnavailable
  const hasHighlightCounts =
    card.goodWordCount + card.mediumWordCount + card.poorWordCount > 0

  return {
    title: copy.title,
    scoreLine: scoreLineFor(card, copy),
    highlightLine: hasHighlightCounts
      ? copy.highlights(card.goodWordCount, card.mediumWordCount, card.poorWordCount)
      : copy.highlightsEmpty,
    formantsLine,
    openSignalsLabel: copy.openSignals,
    openSignalsHint: copy.openSignalsHint,
    signalsUnavailableHint: copy.signalsUnavailable,
  }
}

export function attachUserTurnSignalCardToMessages<T extends { readonly id: string }>(
  messages: readonly T[],
  messageId: string,
  signalCard: UserTurnSignalCard,
): T[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, signalCard } : message,
  )
}

export function findLatestUserUtteranceId(
  messages: readonly { readonly id: string; readonly kind: string }[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.kind === 'user-utterance') {
      return message.id
    }
  }
  return null
}

function resolveSignalCardKind(
  pronunciation: PronunciationScoreResult | null,
  skipReason: PronunciationScoreSkipReason | null | undefined,
): UserTurnSignalCardKind {
  if (pronunciation) {
    return 'scored'
  }
  if (skipReason === 'conversation-deferred-to-drill') {
    return 'deferred-to-drill'
  }
  return 'not-evaluated'
}

function countHighlightBands(
  highlights: readonly { readonly band: string }[],
): { good: number; medium: number; poor: number } {
  let good = 0
  let medium = 0
  let poor = 0
  for (const highlight of highlights) {
    if (highlight.band === 'good') {
      good += 1
    } else if (highlight.band === 'medium') {
      medium += 1
    } else if (highlight.band === 'poor') {
      poor += 1
    }
  }
  return { good, medium, poor }
}

function scoreLineFor(
  card: UserTurnSignalCard,
  copy: (typeof homeScreenInterfaceTexts.practiceChat)['signalCard'],
): string {
  if (card.kind === 'scored' && card.score0to100 !== null) {
    return copy.scoreScored(card.score0to100)
  }
  if (card.kind === 'deferred-to-drill') {
    return copy.scoreDeferred
  }
  return copy.scoreNotEvaluated
}
