/**
 * Pure helpers for the home practice session (no React).
 */

import { homeScreenInterfaceTexts } from './interface-texts'
import type { FormantTriple } from '../dsp/formant-estimation'
import type {
  PronunciationUiStatus,
  SpeechSynthesisUiStatus,
  TranscriptionUiStatus,
  TutorGenerationUiStatus,
} from './home-screen-status'
import {
  buildInitialChatMessagesForScenario,
  type PracticeChatMessage,
} from './practice-chat-messages'
import { getPracticeScenarioById, type PracticeScenarioId } from './practice-scenarios'

export const DEFAULT_SCENARIO_ID: PracticeScenarioId = 'restaurant'

// WASM synthesis measures ~8 s; 5x margin so a genuinely slow-but-alive
// device is never mistaken for a hung one, while a wedged WebGPU/audio
// driver promise still gets released instead of blocking the mic forever
// (speechSynthesisStatus stuck in 'loading-model'/'synthesizing'/'playing').
export const SPEECH_SYNTHESIS_TIMEOUT_MS = 45_000

export function nextChatMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Phrase used for tutor intent matching.
 * Prefer grammar output when it keeps the same rough content; keep raw ASR when
 * the corrector empties or heavily rewrites short speech (common with quiet mics).
 */
export function pickBestIntentPhrase(rawTranscript: string, correctedText: string): string {
  const raw = rawTranscript.trim()
  const corrected = correctedText.trim()
  if (!corrected) {
    return raw
  }
  if (!raw) {
    return corrected
  }
  const rawWords = raw.toLowerCase().match(/[a-z0-9']+/g) ?? []
  const correctedWords = corrected.toLowerCase().match(/[a-z0-9']+/g) ?? []
  if (rawWords.length === 0) {
    return corrected
  }
  // Corrector invented a long essay from a short ASR line — trust ASR for intents.
  if (rawWords.length <= 6 && correctedWords.length >= rawWords.length * 3) {
    return raw
  }
  return corrected
}

export function formatFormantsSummaryMessage(formants: FormantTriple | null): string | null {
  if (!formants) {
    return null
  }
  if (formants.f1InHertz === null && formants.f2InHertz === null && formants.f3InHertz === null) {
    return null
  }
  const formatHz = (value: number | null) =>
    value === null || !Number.isFinite(value) ? '—' : Math.round(value).toString()
  return homeScreenInterfaceTexts.formantsSummary(
    formatHz(formants.f1InHertz),
    formatHz(formants.f2InHertz),
    formatHz(formants.f3InHertz),
  )
}

export function resolvePrimaryActivityMessage(input: {
  isTutorSpeaking: boolean
  isStarting: boolean
  isListening: boolean
  isPreparingModels: boolean
  microphoneStatusMessage: string
  tutorGenerationStatus: TutorGenerationUiStatus
  pronunciationStatus: PronunciationUiStatus
  speechSynthesisStatus: SpeechSynthesisUiStatus
  transcriptionStatus: TranscriptionUiStatus
}): string {
  if (input.isStarting) {
    return homeScreenInterfaceTexts.microphoneStatusMessages.starting
  }
  if (input.isListening) {
    return homeScreenInterfaceTexts.microphoneStatusMessages.listening
  }
  if (input.transcriptionStatus === 'transcribing') {
    return homeScreenInterfaceTexts.transcriptionStatusMessages.transcribing
  }
  if (input.transcriptionStatus === 'loading-model') {
    return homeScreenInterfaceTexts.modelsWarmingUpMessage
  }
  if (
    input.tutorGenerationStatus === 'loading-model' ||
    input.tutorGenerationStatus === 'generating'
  ) {
    return homeScreenInterfaceTexts.tutorGeneration.statusGenerating
  }
  if (input.pronunciationStatus === 'scoring') {
    return homeScreenInterfaceTexts.pronunciationStatusMessages.scoring
  }
  if (
    input.speechSynthesisStatus === 'loading-model' ||
    input.speechSynthesisStatus === 'synthesizing' ||
    input.speechSynthesisStatus === 'playing'
  ) {
    return homeScreenInterfaceTexts.speechSynthesisStatusMessages.playing
  }
  if (input.isPreparingModels) {
    return homeScreenInterfaceTexts.modelsWarmingUpMessage
  }
  return input.microphoneStatusMessage
}

export function initialChatMessages(scenarioId: PracticeScenarioId): PracticeChatMessage[] {
  return buildInitialChatMessagesForScenario(
    getPracticeScenarioById(scenarioId),
    nextChatMessageId('intro'),
  )
}
