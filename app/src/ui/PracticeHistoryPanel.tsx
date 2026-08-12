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
    <div className="mt-3 rounded-xl border border-sage-200 bg-atelier-elev px-4 py-3">
      <p className="text-xs font-semibold text-sage-700">{copy.trendSectionLabel}</p>
      <div className="mt-2 flex h-20 items-end gap-1">
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

function computeHistoryStats(turns: readonly PracticeTurnRecord[]) {
  const scores = turns
    .map((turn) => turn.pronunciationScore0to100)
    .filter((score): score is number => score !== null)
  const average =
    scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length
  const goodCount = scores.filter((score) => score >= 80).length
  return { turnCount: turns.length, average, goodCount }
}

export function PracticeHistoryPanel({ turns, statusMessage }: PracticeHistoryPanelProps) {
  const copy = homeScreenInterfaceTexts.practiceHistory
  const stats = computeHistoryStats(turns)
  return (
    <section className="text-left" aria-label={copy.sectionAriaLabel}>
      <p className="mt-1 text-xs text-ink-400">{statusMessage}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-sage-200 bg-atelier-elev px-3 py-3">
          <span className="block text-[0.65rem] tracking-wide text-ink-400 uppercase">
            Turnos
          </span>
          <strong className="font-serif text-2xl font-medium text-sage-600">
            {stats.turnCount}
          </strong>
        </div>
        <div className="rounded-xl border border-sage-200 bg-atelier-elev px-3 py-3">
          <span className="block text-[0.65rem] tracking-wide text-ink-400 uppercase">
            Media
          </span>
          <strong className="font-serif text-2xl font-medium text-sage-600">
            {stats.average === null ? '—' : stats.average.toFixed(0)}
          </strong>
        </div>
        <div className="rounded-xl border border-sage-200 bg-atelier-elev px-3 py-3">
          <span className="block text-[0.65rem] tracking-wide text-ink-400 uppercase">
            ≥ 80
          </span>
          <strong className="font-serif text-2xl font-medium text-sage-600">
            {stats.goodCount}
          </strong>
        </div>
      </div>
      {turns.length === 0 ? (
        <p className="mt-4 rounded-xl bg-sage-50 px-4 py-3 text-sm text-ink-400 ring-1 ring-sage-200">
          {copy.emptyState}
        </p>
      ) : (
        <>
          <PronunciationTrendChart turns={turns} />
          <ol className="mt-4 max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto">
            {turns.map((turn) => (
              <li
                key={turn.id}
                className="rounded-xl border border-sage-200 bg-atelier-elev px-4 py-3 text-sm text-ink-600 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-sage-700">
                    {copy.scenarioLabel(turn.scenarioId)}
                  </span>
                  <span className="text-xs text-ink-400">
                    {copy.formatTime(turn.createdAtIso)}
                  </span>
                </div>
                <p className="mt-1.5 text-ink-900">
                  <span className="font-semibold text-ink-400">{copy.youLabel}: </span>
                  <span className="font-mono text-[0.85rem]">
                    {turn.correctedText || turn.transcribedText}
                  </span>
                </p>
                {turn.tutorReplyText ? (
                  <p className="mt-1 text-ink-900">
                    <span className="font-semibold text-sage-700">{copy.tutorLabel}: </span>
                    <span className="font-mono text-[0.85rem]">{turn.tutorReplyText}</span>
                  </p>
                ) : null}
                <p className="mt-1.5 text-xs text-ink-400">
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
