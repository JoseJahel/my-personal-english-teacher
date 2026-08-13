/**
 * Drill panel: repeat the tutor's last line and get scored against it.
 * Visually and functionally separate from the conversation flow (RF-10).
 */

import type { DrillUiStatus } from './home-screen-status'
import { drillStatusMessageFor } from './home-screen-status'
import { PronunciationWordHighlights } from './PronunciationWordHighlights'
import type { WordPronunciationHighlight } from '../dsp/word-pronunciation-highlights'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface DrillPanelProps {
  readonly lastTutorLineEn: string
  readonly drillStatus: DrillUiStatus
  readonly drillScore0to100: number | null
  readonly drillWordHighlights: readonly WordPronunciationHighlight[]
  readonly isDrillListening: boolean
  readonly onStartDrill: () => void
  readonly onStopDrill: () => void
}

export function DrillPanel({
  lastTutorLineEn,
  drillStatus,
  drillScore0to100,
  drillWordHighlights,
  isDrillListening,
  onStartDrill,
  onStopDrill,
}: DrillPanelProps) {
  const copy = homeScreenInterfaceTexts.drill
  const hasTutorLine = lastTutorLineEn.trim().length > 0
  const isBusy = drillStatus === 'listening' || drillStatus === 'scoring'

  return (
    <section className="text-left" aria-label={copy.panelTitle}>
      <h3 className="text-sm font-semibold text-ink-900">{copy.panelTitle}</h3>
      <p className="mt-1 text-xs text-ink-400">{copy.panelHint}</p>

      {hasTutorLine ? (
        <p className="mt-2 rounded-md bg-sage-50 px-3 py-2 text-sm font-mono text-ink-900">
          {lastTutorLineEn}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-400">{copy.noTutorLineMessage}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        {isDrillListening ? (
          <button
            type="button"
            onClick={onStopDrill}
            className="rounded-lg bg-blush-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blush-600"
          >
            {copy.stopButtonLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartDrill}
            disabled={!hasTutorLine || drillStatus === 'scoring'}
            className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
          >
            {isBusy ? copy.listeningButtonLabel : copy.repeatButtonLabel}
          </button>
        )}
        <p className="text-xs text-ink-600">
          {drillStatusMessageFor(drillStatus, drillScore0to100)}
        </p>
      </div>
      <PronunciationWordHighlights highlights={drillWordHighlights} />
    </section>
  )
}
