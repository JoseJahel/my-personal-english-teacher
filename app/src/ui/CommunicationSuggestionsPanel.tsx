/**
 * Coaching cards for the last user turn: quote what they said, show a rewrite.
 */

import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import { homeScreenInterfaceTexts } from './interface-texts'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

export interface CommunicationSuggestionsPanelProps {
  readonly suggestions: readonly CommunicationSuggestion[]
  /** Feedback-tab empty copy. Inline chat hides the panel when there is nothing. */
  readonly showEmptyState?: boolean
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  vocabulario: 'bg-sage-100 text-sage-800',
  fluidez: 'bg-blush-500/15 text-blush-600',
  naturalidad: 'bg-ink-900/5 text-ink-600',
}

export function CommunicationSuggestionsPanel({
  suggestions,
  showEmptyState = false,
}: CommunicationSuggestionsPanelProps) {
  const copy = homeScreenInterfaceTexts.communicationSuggestions

  if (suggestions.length === 0) {
    if (!showEmptyState) {
      return null
    }
    return (
      <section
        className="text-left"
        aria-label={copy.panelTitle}
        data-testid={PRACTICE_SHELL_TEST_IDS.suggestionsEmpty}
      >
        <h3 className="text-sm font-semibold text-ink-900">{copy.panelTitle}</h3>
        <p className="mt-2 text-[0.82rem] leading-snug text-ink-600">{copy.emptyHint}</p>
      </section>
    )
  }

  return (
    <section
      className="text-left"
      aria-label={copy.panelTitle}
      data-testid={PRACTICE_SHELL_TEST_IDS.suggestionsPanel}
    >
      <h3 className="text-sm font-semibold text-ink-900">{copy.panelTitle}</h3>
      <p className="mt-1 text-xs text-ink-400">{copy.panelHint}</p>
      <ul className="mt-3 space-y-3">
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.type}-${index}`}
            className="rounded-lg bg-sage-50 px-3 py-2.5 text-sm text-ink-900"
          >
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                TYPE_BADGE_STYLES[suggestion.type] ?? 'bg-sage-100 text-sage-800'
              }`}
            >
              {copy.typeLabels[suggestion.type]}
            </span>
            <p className="mt-2 text-[0.62rem] font-semibold tracking-[0.08em] text-ink-400 uppercase">
              {copy.youSaidLabel}
            </p>
            <p className="mt-0.5 font-serif text-[0.95rem] text-ink-900">«{suggestion.youSaidEn}»</p>
            {suggestion.tryThisEn ? (
              <>
                <p className="mt-2 text-[0.62rem] font-semibold tracking-[0.08em] text-sage-700 uppercase">
                  {copy.tryThisLabel}
                </p>
                <p className="mt-0.5 font-serif text-[0.95rem] text-sage-800">
                  «{suggestion.tryThisEn}»
                </p>
              </>
            ) : null}
            <p className="mt-2 text-[0.8rem] leading-snug text-ink-600">{suggestion.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
