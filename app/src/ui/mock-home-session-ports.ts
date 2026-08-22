/**
 * Deterministic restaurant doubles for #98 / #70. No transformers, no getUserMedia.
 */

import type { CaptureDiagnostics } from '../audio/capture-diagnostics'
import type {
  InferenceClient,
  ModelReadyListener,
  SynthesizedSpeechResult,
  TutorReplyResult,
} from '../ia/inference-client'
import type { ModelReadyMessage } from '../ia/inference-worker-protocol'
import type { HomeSessionPorts, SpeechCaptureSession } from './home-session-ports'

export const MOCK_RESTAURANT_TRANSCRIPT_EN = 'I would like a glass of water please'
export const MOCK_RESTAURANT_GRAMMAR_EN = 'I would like a glass of water, please.'
export const MOCK_RESTAURANT_TUTOR_REPLY_EN =
  'Great choice. Would you like something to drink with that?'
export const MOCK_RESTAURANT_DEVICE_LABEL = 'Micrófono de ensayo (restaurante)'

const MOCK_SAMPLE_RATE_HZ = 16000

export function createUsableMockSpeechPcm(): Float32Array {
  const sampleCount = Math.round(0.4 * MOCK_SAMPLE_RATE_HZ)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = 0.22 * Math.sin((2 * Math.PI * 180 * index) / MOCK_SAMPLE_RATE_HZ)
  }
  return samples
}

export function createMockInferencePort(): InferenceClient {
  const readyListeners = new Set<ModelReadyListener>()

  const notifyReady = (modelKey: ModelReadyMessage['modelKey']): void => {
    const message: ModelReadyMessage = { type: 'model-ready', modelKey }
    for (const listener of readyListeners) {
      listener(message)
    }
  }

  return {
    async transcribe(): Promise<string> {
      return MOCK_RESTAURANT_TRANSCRIPT_EN
    },
    async correctGrammar(): Promise<string> {
      return MOCK_RESTAURANT_GRAMMAR_EN
    },
    async synthesizeSpeech(): Promise<SynthesizedSpeechResult> {
      return {
        samples: createUsableMockSpeechPcm().slice(0, 800),
        sampleRateInHertz: MOCK_SAMPLE_RATE_HZ,
      }
    },
    async generateTutorReply(): Promise<TutorReplyResult> {
      return { tutorReplyText: MOCK_RESTAURANT_TUTOR_REPLY_EN, usedFallback: false }
    },
    async generateCommunicationCoaching() {
      return { tryThisEn: '', whyEs: '', usedFallback: true }
    },
    async preloadModels(): Promise<void> {
      notifyReady('automaticSpeechRecognition')
      notifyReady('grammarCorrection')
      notifyReady('textToSpeech')
    },
    async preloadConversationModel(): Promise<void> {
      notifyReady('conversationSuggestions')
    },
    subscribeToModelLoadingProgress(): () => void {
      return () => {}
    },
    subscribeToModelReady(listener: ModelReadyListener): () => void {
      readyListeners.add(listener)
      return () => {
        readyListeners.delete(listener)
      }
    },
    dispose(): void {
      readyListeners.clear()
    },
  }
}

export async function startMockSpeechCapture(): Promise<SpeechCaptureSession> {
  const samples = createUsableMockSpeechPcm()
  const diagnostics: CaptureDiagnostics = {
    sampleCount: samples.length,
    durationSeconds: samples.length / MOCK_SAMPLE_RATE_HZ,
    rmsEnergy: 0.15,
    peakAmplitude: 0.22,
    deviceLabel: MOCK_RESTAURANT_DEVICE_LABEL,
    source: 'media-recorder',
    mediaRecorderBlobBytes: samples.length * 2,
    trackReadyState: 'live',
    trackMuted: false,
    audioContextState: 'running',
  }
  const stubAnalyser = {
    fftSize: 2048,
    getFloatTimeDomainData(buffer: Float32Array): void {
      const phase = (performance.now() / 1000) * Math.PI * 2 * 3
      for (let index = 0; index < buffer.length; index += 1) {
        buffer[index] =
          0.18 * Math.sin(phase + (index / buffer.length) * Math.PI * 2)
      }
    },
  } as AnalyserNode

  return {
    audioContext: {} as AudioContext,
    analyserNode: stubAnalyser,
    sourceNode: {} as MediaStreamAudioSourceNode,
    liveAnalysisSourceNode: null,
    deviceLabel: MOCK_RESTAURANT_DEVICE_LABEL,
    mediaStream: { getTracks: () => [] } as unknown as MediaStream,
    readLiveMeters: () => {
      const phase = (performance.now() / 1000) * Math.PI * 2 * 3
      const peak = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(phase))
      return { rms: peak * 0.6, peak, level01: peak }
    },
    stop: async () => ({ samples, sampleRate: MOCK_SAMPLE_RATE_HZ, diagnostics }),
    abort: () => {},
  }
}

export function createMockHomeSessionPorts(): HomeSessionPorts {
  return {
    createInferenceClient: createMockInferencePort,
    startSpeechCapture: startMockSpeechCapture,
  }
}
