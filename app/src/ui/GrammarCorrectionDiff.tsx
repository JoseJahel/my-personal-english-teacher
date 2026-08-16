/**
 * Word-by-word grammar-correction diff (green = added, red = removed,
 * amber = substituted) instead of a flat "before/after" block.
 */

import { useMemo } from 'react'
import { diffEnglishWords } from '../ia/grammar-correction-diff'
import type { GrammarDiffToken } from '../ia/grammar-correction-diff'
import { explainDiffTokensInSpanish } from '../ia/grammar-correction-explanation'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface GrammarCorrectionDiffProps {
  readonly originalText: string
  readonly correctedText: string
}

export function GrammarCorrectionDiff({ originalText, correctedText }: GrammarCorrectionDiffProps) {
  const tokens = useMemo(
    () => diffEnglishWords(originalText, correctedText),
    [originalText, correctedText],
  )

  if (tokens.length === 0) {
    return null
  }

  const copy = homeScreenInterfaceTexts.grammarCorrectionDiff
  const explanations = explainDiffTokensInSpanish(tokens)

  return (
    <div>
      <p className="m-0 flex flex-wrap gap-x-1.5 gap-y-1 text-left leading-relaxed">
        {tokens.map((token, index) => (
          <DiffTokenSpan key={`${token.type}-${index}`} token={token} />
        ))}
      </p>
      <p className="mt-1.5 text-[11px] text-ink-400">{copy.hint}</p>
      {explanations.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-500">
          {explanations.map((sentence, index) => (
            <li key={index}>{sentence}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function DiffTokenSpan({ token }: { token: GrammarDiffToken }) {
  const copy = homeScreenInterfaceTexts.grammarCorrectionDiff

  switch (token.type) {
    case 'unchanged':
      return <span>{token.text}</span>
    case 'added':
      return (
        <span
          title={copy.legendAdded}
          className="inline-block rounded bg-sage-100 px-1 text-sage-900 ring-1 ring-sage-300"
        >
          {token.text}
        </span>
      )
    case 'removed':
      return (
        <span
          title={copy.legendRemoved}
          className="inline-block rounded bg-blush-500/15 px-1 text-ink-900 line-through ring-1 ring-blush-500/40"
        >
          {token.text}
        </span>
      )
    case 'substituted-old':
      return (
        <span
          title={copy.legendSubstituted}
          className="inline-block rounded bg-amber-100 px-1 text-amber-950 line-through ring-1 ring-amber-300"
        >
          {token.text}
        </span>
      )
    case 'substituted-new':
      return (
        <span
          title={copy.legendSubstituted}
          className="inline-block rounded bg-amber-100 px-1 text-amber-950 ring-1 ring-amber-300"
        >
          {token.text}
        </span>
      )
  }
}
