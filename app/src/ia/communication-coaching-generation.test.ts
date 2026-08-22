import { describe, expect, it } from 'vitest'
import {
  buildCoachingChatMessages,
  isAcceptableCoachingDraft,
  mergeCoachingIntoSuggestions,
  parseCoachingOutput,
  resolveDynamicCommunicationSuggestions,
} from './communication-coaching-generation'
import type { CommunicationSuggestion } from './communication-suggestions'

const structural: readonly CommunicationSuggestion[] = [
  {
    type: 'naturalidad',
    text: 'Fallback estructural',
    youSaidEn: 'Hello, who are you?',
    tryThisEn: "Sorry, I didn't catch your name.",
  },
]

describe('parseCoachingOutput', () => {
  it('reads TRY and WHY lines from a messy model dump', () => {
    const draft = parseCoachingOutput(
      'TRY: Sorry, I did not catch your name.\nWHY: En persona es más suave pedir el nombre.',
    )
    expect(draft?.tryThisEn).toBe('Sorry, I did not catch your name.')
    expect(draft?.whyEs).toMatch(/nombre/)
  })

  it('returns null when TRY is missing', () => {
    expect(parseCoachingOutput('WHY: algo')).toBeNull()
  })
})

describe('isAcceptableCoachingDraft', () => {
  it('rejects Could you tell me glued onto the original sentence', () => {
    expect(
      isAcceptableCoachingDraft(
        {
          tryThisEn: 'Could you tell me Hello, who are you?',
          whyEs: 'Más educado.',
        },
        'Hello, who are you?',
      ),
    ).toBe(false)
  })

  it('rejects a WHY that repeats the TRY line', () => {
    expect(
      isAcceptableCoachingDraft(
        {
          tryThisEn: 'Sorry, I did not catch your name.',
          whyEs: 'Más natural: Sorry, I did not catch your name.',
        },
        'Hello, who are you?',
      ),
    ).toBe(false)
  })

  it('accepts a rewrite that keeps a content word from the student', () => {
    expect(
      isAcceptableCoachingDraft(
        {
          tryThisEn: 'Sorry, I did not catch your name.',
          whyEs: 'En persona es más suave pedir el nombre.',
        },
        'Hello, who are you?',
      ),
    ).toBe(true)
  })
})

describe('buildCoachingChatMessages', () => {
  it('includes the live student line and tutor line, not a canned example', () => {
    const messages = buildCoachingChatMessages({
      scenarioContextEn: 'Role-play: restaurant waiter.',
      lastTutorLineEn: 'Welcome! I am your waiter.',
      userUtteranceEn: 'Hello, who are you?',
    })
    const user = messages.find((message) => message.role === 'user')
    expect(user?.content).toContain('Hello, who are you?')
    expect(user?.content).toContain('Welcome! I am your waiter.')
  })
})

describe('mergeCoachingIntoSuggestions', () => {
  it('replaces the generic naturalness card with the model draft', () => {
    const merged = mergeCoachingIntoSuggestions(
      structural,
      {
        tryThisEn: 'Sorry, I did not catch your name.',
        whyEs: 'En persona es más suave pedir el nombre.',
      },
      'Hello, who are you?',
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.tryThisEn).toBe('Sorry, I did not catch your name.')
    expect(merged[0]?.text).not.toContain('Sorry, I did not catch your name.')
  })
})

describe('resolveDynamicCommunicationSuggestions', () => {
  it('keeps the structural tips when the model falls back', async () => {
    const result = await resolveDynamicCommunicationSuggestions({
      structural,
      youSaidEn: 'Hello, who are you?',
      generateCoaching: async () => ({ draft: null, usedFallback: true }),
    })
    expect(result).toBe(structural)
  })

  it('returns structural tips when coaching times out', async () => {
    const result = await resolveDynamicCommunicationSuggestions({
      structural,
      youSaidEn: 'Hello, who are you?',
      timeoutMs: 20,
      generateCoaching: () => new Promise(() => {}),
    })
    expect(result).toBe(structural)
  })

  it('upgrades to the model draft when it is valid', async () => {
    const result = await resolveDynamicCommunicationSuggestions({
      structural,
      youSaidEn: 'Hello, who are you?',
      generateCoaching: async () => ({
        draft: {
          tryThisEn: 'Sorry, I did not catch your name.',
          whyEs: 'En persona es más suave pedir el nombre.',
        },
        usedFallback: false,
      }),
    })
    expect(result[0]?.text).toMatch(/suave/)
  })
})

describe('isAcceptableCoachingDraft content overlap', () => {
  it('rejects a rewrite about a different topic', () => {
    expect(
      isAcceptableCoachingDraft(
        {
          tryThisEn: 'Could I have a coffee, please?',
          whyEs: 'Más educado.',
        },
        'Hello, who are you?',
      ),
    ).toBe(false)
  })
})
