/**
 * Curated practice scenarios for hybrid conversation (Avance 2).
 * Multi-turn tutor scripts keep dialogue coherent and instant (no LLM wait).
 * English practice content lives here; Spanish UI labels live in interface-texts.
 */

export type PracticeScenarioId = 'restaurant' | 'airport' | 'job-interview'

export interface PracticeScenario {
  readonly id: PracticeScenarioId
  /** Opening tutor line in English (spoken practice language). */
  readonly tutorOpeningLineEn: string
  /** Short English goal the learner can aim for in the first turn. */
  readonly firstTurnHintEn: string
  /**
   * Ordered tutor follow-ups after each successful user utterance (0-based).
   * Last line repeats if the learner keeps talking past the script.
   */
  readonly tutorFollowUpLinesEn: readonly string[]
  /**
   * Legacy single fallback (same as first scripted follow-up) for storage/API compat.
   */
  readonly tutorFollowUpPlaceholderEn: string
  /** System-style constraint if an LLM is used for optional paraphrase. */
  readonly generationContextEn: string
}

export const practiceScenarios: readonly PracticeScenario[] = [
  {
    id: 'restaurant',
    tutorOpeningLineEn:
      'Welcome! I am your waiter. What would you like to order today?',
    firstTurnHintEn: 'Order a drink or a main dish politely.',
    tutorFollowUpLinesEn: [
      'Great choice. Would you like something to drink with that?',
      'Perfect. Would you like any side dishes or sauces?',
      'I will bring that shortly. Do you need anything else right now?',
      'Thank you. Enjoy your meal, and call me if you need help.',
    ],
    tutorFollowUpPlaceholderEn:
      'Great choice. Would you like something to drink with that?',
    generationContextEn:
      'Role-play: restaurant waiter. Keep replies short, polite, and on-topic (menu, orders, bill).',
  },
  {
    id: 'airport',
    tutorOpeningLineEn:
      'Hello, I work at the airline desk. How can I help you with your flight today?',
    firstTurnHintEn: 'Ask about your gate, boarding time, or luggage.',
    tutorFollowUpLinesEn: [
      'Of course. May I see your boarding pass, please?',
      'Your gate is B12, and boarding starts in about twenty minutes.',
      'Checked bags are at carousel three. Do you need any other help?',
      'You are all set. Have a safe flight!',
    ],
    tutorFollowUpPlaceholderEn: 'Of course. May I see your boarding pass, please?',
    generationContextEn:
      'Role-play: airport airline desk. Keep replies short and practical (gates, delays, baggage).',
  },
  {
    id: 'job-interview',
    tutorOpeningLineEn:
      'Good morning. Thank you for coming. Please introduce yourself briefly.',
    firstTurnHintEn: 'Say your name, background, and why you want the job.',
    tutorFollowUpLinesEn: [
      'Thank you. Why are you interested in this role?',
      'That is helpful. Can you describe a challenge you solved recently?',
      'Good example. How do you usually work in a team?',
      'Thanks for sharing. Do you have any questions for us?',
    ],
    tutorFollowUpPlaceholderEn: 'Thank you. Why are you interested in this role?',
    generationContextEn:
      'Role-play: job interviewer. Keep replies professional and ask one clear follow-up at a time.',
  },
] as const

export function getPracticeScenarioById(
  scenarioId: PracticeScenarioId,
): PracticeScenario {
  const scenario = practiceScenarios.find((entry) => entry.id === scenarioId)
  if (!scenario) {
    throw new Error(`Unknown practice scenario: ${scenarioId}`)
  }
  return scenario
}

export function listPracticeScenarioIds(): readonly PracticeScenarioId[] {
  return practiceScenarios.map((scenario) => scenario.id)
}

/**
 * Pick the curated tutor line for this user turn index (0 = first reply after user speaks).
 */
export function pickCuratedTutorFollowUp(
  scenario: PracticeScenario,
  userTurnIndex: number,
): string {
  const lines = scenario.tutorFollowUpLinesEn
  if (lines.length === 0) {
    return scenario.tutorFollowUpPlaceholderEn
  }
  const safeIndex = Math.max(0, Math.min(userTurnIndex, lines.length - 1))
  return lines[safeIndex] ?? scenario.tutorFollowUpPlaceholderEn
}
