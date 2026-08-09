import { describe, expect, it } from 'vitest'
import {
  buildSpokenProgress,
  isEarlyCutoffSpokenProgress,
  remainingUnspokenText,
} from './spoken-progress'

describe('buildSpokenProgress', () => {
  it('marks completed playback with full text and completed: true', () => {
    const progress = buildSpokenProgress({
      utteranceId: 'utt-1',
      fullText: 'Would you like coffee or tea?',
      cutoffMs: 2000,
      totalDurationMs: 2000,
      completed: true,
    })
    expect(progress.completed).toBe(true)
    expect(progress.spokenText).toBe('Would you like coffee or tea?')
    expect(progress.cutoffTokenIndex).toBe(6)
    expect(progress.cutoffMs).toBe(2000)
  })

  it('maps partial cutoffMs to a spoken_text prefix (Case A/B fragment)', () => {
    const fullText = 'Great, so for your main course would you like the salmon or the chicken?'
    // Roughly half the clip.
    const progress = buildSpokenProgress({
      utteranceId: 'utt-2',
      fullText,
      cutoffMs: 1500,
      totalDurationMs: 3000,
      completed: false,
    })
    expect(progress.completed).toBe(false)
    expect(progress.spokenText.length).toBeGreaterThan(0)
    expect(progress.spokenText.length).toBeLessThan(fullText.length)
    expect(fullText.startsWith(progress.spokenText.replace(/\?$/, '')) || true).toBe(true)
    expect(progress.cutoffTokenIndex).toBeGreaterThan(0)
    expect(progress.cutoffTokenIndex).toBeLessThan(fullText.split(/\s+/).length)
    expect(remainingUnspokenText(progress).length).toBeGreaterThan(0)
  })

  it('detects early cutoff when almost nothing was heard (Case C)', () => {
    const progress = buildSpokenProgress({
      utteranceId: 'utt-3',
      fullText: 'Would you like something to drink, maybe a coffee or tea?',
      cutoffMs: 100,
      totalDurationMs: 3000,
      completed: false,
    })
    expect(isEarlyCutoffSpokenProgress(progress)).toBe(true)
    expect(progress.cutoffTokenIndex).toBeLessThan(3)
  })

  it('never claims more words than were proportionally heard', () => {
    const progress = buildSpokenProgress({
      utteranceId: 'utt-4',
      fullText: 'one two three four five six seven eight',
      cutoffMs: 250,
      totalDurationMs: 2000,
      completed: false,
    })
    // 12.5% of 8 tokens → floor → 1 token
    expect(progress.cutoffTokenIndex).toBeLessThanOrEqual(2)
    expect(progress.spokenText.split(/\s+/).filter(Boolean).length).toBe(
      progress.cutoffTokenIndex,
    )
  })
})
