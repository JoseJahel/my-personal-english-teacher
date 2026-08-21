import { describe, expect, it, vi } from 'vitest'
import { startDynamicSuggestionEnrichment } from './schedule-dynamic-suggestions'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'

const structural: readonly CommunicationSuggestion[] = [
  {
    type: 'naturalidad',
    text: 'Estructural',
    youSaidEn: 'Who is the manager?',
    tryThisEn: "Sorry, I didn't catch the manager's name.",
  },
]

describe('startDynamicSuggestionEnrichment', () => {
  it('does nothing when the coaching client is missing', () => {
    const setSuggestions = vi.fn()
    startDynamicSuggestionEnrichment({
      generateCommunicationCoaching: undefined,
      structural,
      scenarioContextEn: 'restaurant',
      lastTutorLineEn: 'Hello',
      userUtteranceEn: 'Who is the manager?',
      startedAtGeneration: 1,
      readCurrentGeneration: () => 1,
      setSuggestions,
    })
    expect(setSuggestions).not.toHaveBeenCalled()
  })

  it('upgrades structural tips when the model returns a draft', async () => {
    const setSuggestions = vi.fn()
    startDynamicSuggestionEnrichment({
      generateCommunicationCoaching: async () => ({
        tryThisEn: "Sorry, I did not catch the manager's name.",
        whyEs: 'Más suave pedir el nombre.',
        usedFallback: false,
      }),
      structural,
      scenarioContextEn: 'restaurant',
      lastTutorLineEn: 'Hello',
      userUtteranceEn: 'Who is the manager?',
      startedAtGeneration: 1,
      readCurrentGeneration: () => 1,
      setSuggestions,
    })
    await vi.waitFor(() => {
      expect(setSuggestions).toHaveBeenCalled()
    })
    const tips = setSuggestions.mock.calls[0]?.[0] as CommunicationSuggestion[]
    expect(tips[0]?.tryThisEn).toMatch(/manager/i)
    expect(tips[0]?.text).toMatch(/suave/)
  })
})
