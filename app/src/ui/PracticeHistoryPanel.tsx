/**
 * Recent practice turns loaded from IndexedDB (no audio).
 */

import type { PracticeTurnRecord } from '../storage/practice-session-types'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface PracticeHistoryPanelProps {
  readonly turns: readonly PracticeTurnRecord[]
  readonly statusMessage: string
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
      )}
    </section>
  )
}
