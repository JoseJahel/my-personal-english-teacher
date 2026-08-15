/**
 * Deterministic HomeScreen props for DEV shell preview and Playwright (#81).
 * No microphone, models, or IndexedDB required.
 */

import { createRef } from 'react'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import type { HomeScreenProps } from './HomeScreen'
import type { PracticeChatMessage } from './practice-chat-messages'

export type ShellPreviewVariant = 'idle' | 'filled' | 'listening' | 'composing'

export function resolveShellPreviewVariant(hash: string): ShellPreviewVariant | null {
  switch (hash) {
    case '#shell-preview':
    case '#shell-preview-idle':
      return 'idle'
    case '#shell-preview-filled':
      return 'filled'
    case '#shell-preview-listening':
      return 'listening'
    case '#shell-preview-composing':
      return 'composing'
    default:
      return null
  }
}

const emptyCanvasRef = createRef<HTMLCanvasElement | null>()

const sampleMessages: readonly PracticeChatMessage[] = [
  {
    id: 'tutor-open',
    role: 'tutor',
    kind: 'scenario-intro',
    text: 'Welcome! I am your waiter. What would you like to order today?',
  },
  {
    id: 'user-1',
    role: 'user',
    kind: 'user-utterance',
    text: 'I would like a glass of water please',
    correctedText: 'I would like a glass of water, please.',
  },
  {
    id: 'tutor-2',
    role: 'tutor',
    kind: 'tutor-reply',
    text: 'Great choice. Would you like something to drink with that?',
  },
]

const sampleHistory: readonly PracticeTurnRecord[] = [
  {
    id: 'turn-1',
    sessionId: 'session-preview',
    scenarioId: 'restaurant',
    createdAtIso: '2026-08-12T12:00:00.000Z',
    transcribedText: 'I would like a glass of water please',
    correctedText: 'I would like a glass of water, please.',
    tutorReplyText: 'Great choice. Would you like something to drink with that?',
    tutorUsedFallback: false,
    pronunciationScore0to100: 78,
    mfccScore0to100: 81,
    pitchScore0to100: 74,
    formantF1InHertz: 520,
    formantF2InHertz: 1420,
    formantF3InHertz: 2480,
    wordHighlightSummary: 'glass:poor',
    spokenProgress: null,
  },
]

function baseProps(): HomeScreenProps {
  return {
    canvasRef: emptyCanvasRef,
    spectrogramCanvasRef: emptyCanvasRef,
    pitchTrackCanvasRef: emptyCanvasRef,
    isStarting: false,
    isListening: false,
    isTutorSpeaking: false,
    hasCompletedCapture: true,
    liveInputLevel01: 0,
    liveRms: 0,
    livePeak: 0,
    activeMicrophoneLabel: '',
    environmentDiagnosticsMessage: null,
    microphoneStatusMessage: 'Esperando interacción...',
    transcriptionStatusMessage: 'Transcripción lista.',
    transcribedText: '',
    captureDiagnosticsMessage: null,
    grammarCorrectionStatusMessage: 'Corrección lista.',
    correctedGrammarText: '',
    grammarCorrectionMadeNoChangesToTranscription: false,
    speechSynthesisStatusMessage: 'Reproducción de la voz del tutor lista.',
    tutorGenerationStatusMessage: 'Respuesta del tutor lista (generada por IA).',
    isTutorPreparingConversationModel: false,
    isTutorComposingReply: false,
    pronunciationStatusMessage: 'Tras hablar, se compara tu audio con una referencia.',
    pronunciationDetailMessage: null,
    pronunciationScore0to100: null,
    pronunciationMfccScore0to100: null,
    pronunciationPitchScore0to100: null,
    pronunciationWordHighlights: [],
    formantsSummaryMessage: null,
    practiceHistoryTurns: sampleHistory,
    practiceHistoryStatusMessage: 'Progreso guardado solo en este dispositivo (sin audio crudo).',
    primaryActivityMessage: 'Listo',
    isPreparingModels: false,
    offlineReadinessMessage: 'Todos los modelos están guardados en este navegador.',
    offlineReadiness: 'fully-cached',
    selectedScenarioId: 'restaurant',
    chatMessages: sampleMessages.slice(0, 1),
    firstTurnHintEn: 'Order a drink or a main dish politely.',
    communicationSuggestions: [],
    lastTutorLineEn: 'Welcome! I am your waiter. What would you like to order today?',
    drillStatus: 'idle',
    drillScore0to100: null,
    isDrillListening: false,
    onStartDrill: () => undefined,
    drillWordHighlights: [],
    onStopDrill: () => undefined,
    onSelectScenario: () => undefined,
    onStartMicrophone: () => undefined,
    onStopMicrophone: () => undefined,
  }
}

/** Empty panel / first load shell. */
export function createShellPreviewIdleProps(): HomeScreenProps {
  return baseProps()
}

/** Panel filled with a completed turn (for visual regression). */
export function createShellPreviewFilledProps(): HomeScreenProps {
  return {
    ...baseProps(),
    chatMessages: sampleMessages,
    transcribedText: 'I would like a glass of water please',
    correctedGrammarText: 'I would like a glass of water, please.',
    pronunciationScore0to100: 78,
    pronunciationMfccScore0to100: 81,
    pronunciationPitchScore0to100: 74,
    pronunciationStatusMessage: 'Puntuación de pronunciación: 78.0 / 100.',
    pronunciationDetailMessage: 'MFCC 81.0 · pitch 74.0 · frames usuario 40 / ref 42',
    formantsSummaryMessage: 'F1 ≈ 520 Hz · F2 ≈ 1420 Hz · F3 ≈ 2480 Hz',
    pronunciationWordHighlights: [
      { word: 'I', score0to100: 90, band: 'good', meanLocalDistance: 0.1 },
      { word: 'would', score0to100: 88, band: 'good', meanLocalDistance: 0.12 },
      { word: 'like', score0to100: 70, band: 'medium', meanLocalDistance: 0.3 },
      { word: 'glass', score0to100: 45, band: 'poor', meanLocalDistance: 0.55 },
      { word: 'water', score0to100: 72, band: 'medium', meanLocalDistance: 0.28 },
      { word: 'please', score0to100: 91, band: 'good', meanLocalDistance: 0.09 },
    ],
  }
}

/**
 * Issue #96: student bubble + grammar are on screen, tutor is still typing,
 * Hablar stays enabled (half-duplex lock is TTS-only).
 */
export function createShellPreviewComposingProps(): HomeScreenProps {
  return {
    ...baseProps(),
    chatMessages: sampleMessages.slice(0, 2),
    transcribedText: 'I would like a glass of water please',
    correctedGrammarText: 'I would like a glass of water, please.',
    isTutorComposingReply: true,
    isTutorSpeaking: false,
    tutorGenerationStatusMessage: 'El tutor está escribiendo…',
    primaryActivityMessage: 'El tutor está escribiendo…',
  }
}

/** Listening mic state for composer visual checks. */
export function createShellPreviewListeningProps(): HomeScreenProps {
  return {
    ...baseProps(),
    isListening: true,
    liveInputLevel01: 0.42,
    liveRms: 0.08,
    livePeak: 0.35,
    activeMicrophoneLabel: 'Micrófono de preview',
    primaryActivityMessage: 'Escuchando…',
    microphoneStatusMessage: 'Escuchando…',
  }
}
