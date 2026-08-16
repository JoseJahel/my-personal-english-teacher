/**
 * Injectable ports for the home session (issue #98).
 * Production adapters wrap the existing InferenceClient + microphone capture.
 */

import {
  startMicrophoneCapture,
  type MicrophoneCaptureSession,
} from '../audio/microphone-capture'
import {
  createInferenceClient,
  type InferenceClient,
} from '../ia/inference-client'

/** Same contract the worker client already exposes. */
export type InferencePort = InferenceClient

export type SpeechCaptureSession = MicrophoneCaptureSession

export interface HomeSessionPorts {
  readonly createInferenceClient: () => InferencePort
  readonly startSpeechCapture: () => Promise<SpeechCaptureSession>
}

export const PRODUCTION_HOME_SESSION_PORTS: HomeSessionPorts = {
  createInferenceClient,
  startSpeechCapture: startMicrophoneCapture,
}
