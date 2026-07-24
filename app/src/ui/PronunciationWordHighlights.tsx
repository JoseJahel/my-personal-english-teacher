/**
 * Colored word chips for pronunciation feedback (good / medium / poor).
 */

import type { WordPronunciationHighlight } from '../dsp/word-pronunciation-highlights'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface PronunciationWordHighlightsProps {
  readonly highlights: readonly WordPronunciationHighlight[]
}

export function PronunciationWordHighlights({ highlights }: PronunciationWordHighlightsProps) {
  if (highlights.length === 0) {
    return null
  }

  const copy = homeScreenInterfaceTexts.pronunciationWordHighlights

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">{copy.title}</p>
      <p className="mb-2 text-[11px] text-slate-500">{copy.hint}</p>
      <p className="flex flex-wrap gap-1.5 text-left font-mono text-sm leading-relaxed">
        {highlights.map((highlight, index) => (
          <span
            key={`${highlight.word}-${index}`}
            title={copy.wordTooltip(highlight.score0to100, highlight.band)}
            className={`inline-block rounded px-1.5 py-0.5 ${bandClassName(highlight.band)}`}
          >
            {highlight.word}
          </span>
        ))}
      </p>
      <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <li>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-green-500" />
          {copy.legendGood}
        </li>
        <li>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />
          {copy.legendMedium}
        </li>
        <li>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-400" />
          {copy.legendPoor}
        </li>
      </ul>
    </div>
  )
}

function bandClassName(band: WordPronunciationHighlight['band']): string {
  switch (band) {
    case 'good':
      return 'bg-green-100 text-green-900 ring-1 ring-green-300'
    case 'medium':
      return 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
    case 'poor':
      return 'bg-red-100 text-red-900 ring-1 ring-red-300'
  }
}
