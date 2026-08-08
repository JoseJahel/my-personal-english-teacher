/**
 * Recent practice turns loaded from IndexedDB (no audio).
 */

import type { PracticeTurnRecord } from '../storage/practice-session-types'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface PracticeHistoryPanelProps {
  readonly turns: readonly PracticeTurnRecord[]
  readonly statusMessage: string
}

function computeAverageScore(turns: readonly PracticeTurnRecord[]): number | null {
  const scores = turns
    .map((turn) => turn.pronunciationScore0to100)
    .filter((score): score is number => score !== null)
  if (scores.length === 0) {
    return null
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function PronunciationTrendChart({ turns }: { readonly turns: readonly PracticeTurnRecord[] }) {
  const copy = homeScreenInterfaceTexts.practiceHistory
  // Oldest first, so the bars read left-to-right as progress over time.
  const chronologicalTurns = [...turns].reverse()
  const scoredTurns = chronologicalTurns.filter(
    (turn) => turn.pronunciationScore0to100 !== null,
  )

  if (scoredTurns.length === 0) {
    return null
  }

  return (
    <div className="mt-3 rounded-md border border-sage-200 bg-sage-50 px-3 py-2">
      <p className="text-xs font-semibold text-sage-800">{copy.trendSectionLabel}</p>
      <div className="mt-2 flex h-16 items-end gap-1">
        {scoredTurns.map((turn, index) => {
          const score = turn.pronunciationScore0to100 as number
          const heightPercent = Math.min(100, Math.max(4, score))
          return (
            <div
              key={turn.id}
              title={copy.trendBarTooltip(index + 1, score)}
              className="flex-1 rounded-t bg-sage-600"
              style={{ height: `${heightPercent}%` }}
            />
          )
        })}
      </div>
      <p className="mt-2 text-xs text-ink-600">
        {copy.averageScoreLabel(computeAverageScore(scoredTurns))}
      </p>
    </div>
  )
}

export function PracticeHistoryPanel({ turns, statusMessage }: PracticeHistoryPanelProps) {
  const copy = homeScreenInterfaceTexts.practiceHistory
  return (
    <section className="text-left" aria-label={copy.sectionAriaLabel}>
      <p className="mt-1 text-xs text-ink-400">{statusMessage}</p>
      {turns.length === 0 ? (
        <p className="mt-3 rounded-md bg-sage-50 px-3 py-2 text-xs text-ink-400">
          {copy.emptyState}
        </p>
      ) : (
        <>
          <PronunciationTrendChart turns={turns} />
          <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {turns.map((turn) => (
              <li
                key={turn.id}
                className="rounded-md border border-sage-200 bg-white px-3 py-2 text-xs text-ink-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-sage-800">
                    {copy.scenarioLabel(turn.scenarioId)}
                  </span>
                  <span className="text-ink-400">
                    {copy.formatTime(turn.createdAtIso)}
                  </span>
                </div>
                <p className="mt-1 text-ink-900">
                  <span className="font-semibold text-ink-400">{copy.youLabel}: </span>
                  <span className="font-mono">{turn.correctedText || turn.transcribedText}</span>
                </p>
                {turn.tutorReplyText ? (
                  <p className="mt-1 text-ink-900">
                    <span className="font-semibold text-sage-800">{copy.tutorLabel}: </span>
                    <span className="font-mono">{turn.tutorReplyText}</span>
                  </p>
                ) : null}
                <p className="mt-1 text-ink-400">
                  {copy.scoreLabel(turn.pronunciationScore0to100)}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
