import { describe, expect, it } from 'vitest'
import { resolvePostInterruptionTutorReply } from './interruption-resume-bridges'
import { getPracticeScenarioById } from './practice-scenarios'
import { buildSpokenProgress } from './spoken-progress'

const restaurant = getPracticeScenarioById('restaurant')

function progressAtRatio(fullText: string, ratio: number) {
  return buildSpokenProgress({
    utteranceId: 'utt-bridge',
    fullText,
    cutoffMs: Math.round(4000 * ratio),
    totalDurationMs: 4000,
    completed: false,
  })
}

describe('resolvePostInterruptionTutorReply (issue #46)', () => {
  it('Case A: digression then deterministic resume from cutoff (no scene advance)', () => {
    const spokenProgress = progressAtRatio(
      'Great, so for your main course would you like the salmon or the chicken?',
      0.5,
    )
    const result = resolvePostInterruptionTutorReply({
      scenario: restaurant,
      spokenProgress,
      userUtteranceEn: "wait, what does 'main course' mean?",
      userTurnIndex: 1,
    })
    expect(result.classification).toBe('digression')
    expect(result.advanceScene).toBe(false)
    expect(result.clearPendingCutoff).toBe(false)
    expect(result.replyText.toLowerCase()).toMatch(/main course|dish/)
    expect(result.replyText.toLowerCase()).toMatch(/going back/)
    expect(result.llmContextNoteEn).toMatch(/BARGE-IN/)
    expect(result.llmContextNoteEn).toMatch(/only heard/i)
  })

  it('Case B: in-task fragment answer advances scene and clears pending', () => {
    const spokenProgress = progressAtRatio(
      'Would you like something to drink, maybe a coffee or a tea?',
      0.55,
    )
    const result = resolvePostInterruptionTutorReply({
      scenario: restaurant,
      spokenProgress,
      userUtteranceEn: 'yes, a coffee please',
      userTurnIndex: 1,
    })
    expect(result.classification).toBe('in_task_response')
    expect(result.advanceScene).toBe(true)
    expect(result.clearPendingCutoff).toBe(true)
    expect(result.replyText.toLowerCase()).toMatch(/coffee|drink|main|certainly|great/)
    // Must not restart the full drink list as if nothing was ordered.
    expect(result.replyText.toLowerCase()).not.toMatch(
      /would you like something to drink, maybe a coffee or a tea/,
    )
  })

  it('Case C: early cutoff reformulates the full tutor line without advancing', () => {
    const fullText = 'Would you like something to drink, maybe a coffee or a tea?'
    const spokenProgress = progressAtRatio(fullText, 0.04)
    const result = resolvePostInterruptionTutorReply({
      scenario: restaurant,
      spokenProgress,
      userUtteranceEn: 'mm',
      userTurnIndex: 0,
    })
    expect(result.classification).toBe('early_cutoff')
    expect(result.advanceScene).toBe(false)
    expect(result.replyText).toContain(fullText)
    expect(result.replyText.toLowerCase()).toMatch(/say that again|sorry/)
  })

  it('injects cutoff metadata for LLM system context', () => {
    const spokenProgress = progressAtRatio(
      'Would you like coffee or tea with that order?',
      0.4,
    )
    const result = resolvePostInterruptionTutorReply({
      scenario: restaurant,
      spokenProgress,
      userUtteranceEn: 'tea please',
      userTurnIndex: 1,
    })
    expect(result.llmContextNoteEn).toContain(`${spokenProgress.cutoffMs}`)
    expect(result.llmContextNoteEn).toContain(spokenProgress.spokenText)
  })
})
