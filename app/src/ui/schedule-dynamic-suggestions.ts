/**
 * After the structural tips are on screen, optionally upgrade them with SmolLM2.
 * Never blocks the tutor turn; stale generations are dropped.
 */

import {
  resolveDynamicCommunicationSuggestions,
  type CommunicationCoachingGenerationResult,
} from '../ia/communication-coaching-generation'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import type { InferenceClient } from '../ia/inference-client'

export function startDynamicSuggestionEnrichment(options: {
  readonly generateCommunicationCoaching: InferenceClient['generateCommunicationCoaching'] | undefined
  readonly structural: readonly CommunicationSuggestion[]
  readonly scenarioContextEn: string
  readonly lastTutorLineEn: string
  readonly userUtteranceEn: string
  readonly startedAtGeneration: number
  readonly readCurrentGeneration: () => number
  readonly setSuggestions: (tips: readonly CommunicationSuggestion[]) => void
}): void {
  const generate = options.generateCommunicationCoaching
  if (!generate) {
    return
  }

  void resolveDynamicCommunicationSuggestions({
    structural: options.structural,
    youSaidEn: options.userUtteranceEn,
    generateCoaching: async (): Promise<CommunicationCoachingGenerationResult> => {
      const coaching = await generate({
        scenarioContextEn: options.scenarioContextEn,
        lastTutorLineEn: options.lastTutorLineEn,
        userUtteranceEn: options.userUtteranceEn,
      })
      if (coaching.usedFallback || !coaching.tryThisEn.trim()) {
        return { draft: null, usedFallback: true }
      }
      return {
        draft: { tryThisEn: coaching.tryThisEn, whyEs: coaching.whyEs },
        usedFallback: false,
      }
    },
  }).then((tips) => {
    if (options.startedAtGeneration !== options.readCurrentGeneration()) {
      return
    }
    options.setSuggestions(tips)
  }).catch((error: unknown) => {
    console.warn('Dynamic suggestion enrichment failed.', error)
  })
}
