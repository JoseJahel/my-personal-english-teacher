/**
 * Rule-based communication suggestions (RF-14): a panel separate from the
 * tutor's chat bubble, showing 1–3 offline tips after a successful turn.
 */

import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface CommunicationSuggestionsPanelProps {
  readonly suggestions: readonly CommunicationSuggestion[]
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  vocabulario: 'bg-sage-100 text-sage-800',
  fluidez: 'bg-blush-500/15 text-blush-600',
  naturalidad: 'bg-ink-900/5 text-ink-600',
}

export function CommunicationSuggestionsPanel({
  suggestions,
}: CommunicationSuggestionsPanelProps) {
  const copy = homeScreenInterfaceTexts.communicationSuggestions

  if (suggestions.length === 0) {
    return null
  }

  return (
    <section className="text-left" aria-label={copy.panelTitle}>
      <h3 className="text-sm font-semibold text-ink-900">{copy.panelTitle}</h3>
      <p className="mt-1 text-xs text-ink-400">{copy.panelHint}</p>
      <ul className="mt-3 space-y-2">
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.type}-${index}`}
            className="rounded-lg bg-sage-50 px-3 py-2 text-sm text-ink-900"
          >
            <span
              className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                TYPE_BADGE_STYLES[suggestion.type] ?? 'bg-sage-100 text-sage-800'
              }`}
            >
              {copy.typeLabels[suggestion.type]}
            </span>
            {suggestion.textEn}
          </li>
        ))}
      </ul>
    </section>
  )
}
