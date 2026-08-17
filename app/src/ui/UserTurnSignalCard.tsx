/**
 * Collapsible per-turn signal summary under a user chat bubble (issue #79).
 */

import { homeScreenInterfaceTexts } from './interface-texts'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'
import {
  formatUserTurnSignalCardViewModel,
  type UserTurnSignalCard as UserTurnSignalCardModel,
} from './user-turn-signal-card'

export interface UserTurnSignalCardProps {
  readonly card: UserTurnSignalCardModel
  readonly canOpenSignals: boolean
  readonly onOpenSignals: () => void
}

export function UserTurnSignalCard({
  card,
  canOpenSignals,
  onOpenSignals,
}: UserTurnSignalCardProps) {
  const view = formatUserTurnSignalCardViewModel(card)
  const copy = homeScreenInterfaceTexts.practiceChat.signalCard

  return (
    <details
      className="mt-1.5 rounded-lg border border-sage-200 bg-atelier-elev text-left shadow-sm"
      data-testid={PRACTICE_SHELL_TEST_IDS.turnSignalCard}
      data-card-kind={card.kind}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-[0.72rem] font-semibold text-ink-900">
        {view.title}
      </summary>
      <div className="space-y-1.5 border-t border-sage-200 px-3 py-2 text-[0.72rem] leading-relaxed text-ink-600">
        <p className="m-0">{view.scoreLine}</p>
        <p className="m-0">{view.highlightLine}</p>
        <p className="m-0">{view.formantsLine}</p>
        {canOpenSignals ? (
          <div className="pt-0.5">
            <button
              type="button"
              data-testid={PRACTICE_SHELL_TEST_IDS.turnSignalCardOpenSignals}
              onClick={onOpenSignals}
              className="rounded-md border border-sage-200 bg-sage-50 px-2 py-1 text-[0.7rem] font-semibold text-sage-700 hover:border-sage-600"
            >
              {view.openSignalsLabel}
            </button>
            <p className="m-0 mt-1 text-[0.65rem] text-ink-400">{view.openSignalsHint}</p>
          </div>
        ) : (
          <p className="m-0 text-[0.65rem] text-ink-400">{copy.signalsUnavailable}</p>
        )}
      </div>
    </details>
  )
}
