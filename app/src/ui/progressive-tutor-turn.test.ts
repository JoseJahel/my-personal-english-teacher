import { describe, expect, it } from 'vitest'
import {
  publishUserUtteranceThenResolveTutor,
  resolvePracticeTutorReply,
} from './progressive-tutor-turn'

describe('publishUserUtteranceThenResolveTutor', () => {
  it('publishes the user utterance before the tutor promise settles', async () => {
    const events: string[] = []
    let releaseTutor: ((text: string) => void) | undefined
    const tutorPromise = new Promise<string>((resolve) => {
      releaseTutor = resolve
    })

    const pending = publishUserUtteranceThenResolveTutor({
      publishUserUtterance: () => {
        events.push('user')
      },
      resolveTutorReply: () => tutorPromise,
      startedAtGeneration: 3,
      readCurrentGeneration: () => 3,
    })

    expect(events).toEqual(['user'])

    releaseTutor?.('Sure, a table for two.')
    const outcome = await pending
    expect(outcome).toEqual({
      applied: true,
      result: 'Sure, a table for two.',
    })
  })

  it('does not apply a stale tutor reply after a newer utterance starts', async () => {
    let currentGeneration = 1
    const outcome = await publishUserUtteranceThenResolveTutor({
      publishUserUtterance: () => {
        currentGeneration = 2
      },
      resolveTutorReply: async () => 'late reply',
      startedAtGeneration: 1,
      readCurrentGeneration: () => currentGeneration,
    })

    expect(outcome).toEqual({ applied: false, result: 'late reply' })
  })
})

describe('resolvePracticeTutorReply', () => {
  it('uses the scenario fallback when no inference client is available', async () => {
    const inFlight: boolean[] = []
    const outcome = await resolvePracticeTutorReply({
      generateTutorReply: undefined,
      markTutorGenerationInFlight: (value) => {
        inFlight.push(value)
      },
      scenarioContextEn: 'restaurant',
      historyTurnsEn: [],
      userUtteranceEn: 'water please',
      fallbackReplyEn: 'Still or sparkling water?',
      interruptionResolution: null,
    })

    expect(outcome).toEqual({
      tutorReplyText: 'Still or sparkling water?',
      usedFallback: false,
    })
    expect(inFlight).toEqual([true, false])
  })

  it('returns the scripted line immediately without waiting for SmolLM2', async () => {
    const generateTutorReply = (): Promise<never> => new Promise(() => {})
    const startedAt = Date.now()
    const outcome = await resolvePracticeTutorReply({
      generateTutorReply,
      markTutorGenerationInFlight: () => {},
      scenarioContextEn: 'restaurant',
      historyTurnsEn: [],
      userUtteranceEn: 'water please',
      fallbackReplyEn: 'Certainly — water. Would you like a main dish with that?',
      interruptionResolution: null,
    })

    expect(Date.now() - startedAt).toBeLessThan(50)
    expect(outcome).toEqual({
      tutorReplyText: 'Certainly — water. Would you like a main dish with that?',
      usedFallback: false,
    })
  })
})
