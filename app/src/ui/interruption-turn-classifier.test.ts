import { describe, expect, it } from 'vitest'
import { classifyInterruptionTurn } from './interruption-turn-classifier'
import { buildSpokenProgress } from './spoken-progress'

function partialProgress(spokenRatio: number, fullText: string) {
  const totalDurationMs = 4000
  return buildSpokenProgress({
    utteranceId: 'utt-test',
    fullText,
    cutoffMs: Math.round(totalDurationMs * spokenRatio),
    totalDurationMs,
    completed: false,
  })
}

describe('classifyInterruptionTurn (issue #46)', () => {
  it('Case A: digression about a word in the fragment heard', () => {
    const spokenProgress = partialProgress(
      0.55,
      'Great, so for your main course would you like the salmon or the chicken?',
    )
    expect(spokenProgress.spokenText.toLowerCase()).toMatch(/main/)
    const kind = classifyInterruptionTurn({
      spokenProgress,
      userUtteranceEn: "wait, what does 'main course' mean?",
    })
    expect(kind).toBe('digression')
  })

  it('Case B: in-task answer to the fragment (coffee after drink offer)', () => {
    const spokenProgress = partialProgress(
      0.6,
      'Would you like something to drink, maybe a coffee or a tea?',
    )
    const kind = classifyInterruptionTurn({
      spokenProgress,
      userUtteranceEn: 'yes, a coffee please',
    })
    expect(kind).toBe('in_task_response')
  })

  it('Case C: early cutoff with noise / unclear user audio', () => {
    const spokenProgress = partialProgress(
      0.05,
      'Would you like something to drink, maybe a coffee or a tea?',
    )
    expect(classifyInterruptionTurn({ spokenProgress, userUtteranceEn: 'uh' })).toBe(
      'early_cutoff',
    )
  })

  it('does not use unspoken remainder nouns for digression vs task', () => {
    // User only heard up to "salmon or the—" — chicken was not spoken.
    const spokenProgress = partialProgress(
      0.5,
      'Would you like the salmon or the chicken with a side salad?',
    )
    // Answering with salmon (in fragment) is in-task.
    expect(
      classifyInterruptionTurn({
        spokenProgress,
        userUtteranceEn: 'the salmon please',
      }),
    ).toBe('in_task_response')
  })
})
