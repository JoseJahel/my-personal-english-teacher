/**
 * Microphone capture — minimal reliable path (Chrome / Windows).
 *
 * ⚠️ CAPTURE-INVARIANTS.md
 *
 * LIVE wave/level: AnalyserNode on MediaStreamSource (float samples each frame).
 * ASR: MediaRecorder on the SAME MediaStream only (no ScriptProcessor for live).
 *
 * Why no ScriptProcessor for visualization: it repeatedly produced a constant
 * “alive” oscillation that did not follow the real mic. Analyser + MediaRecorder
 * on a real OS stream is the path that must stay simple.
 */

import { buildCaptureDiagnostics } from './capture-diagnostics'
import type { CaptureDiagnostics } from './capture-diagnostics'
import {
  decodeRecordingBlobToMono,
  startMediaRecorderOnStream,
  stopMediaRecorderToBlob,
} from './media-recorder-utterance'
import {
  MicrophoneCaptureError,
  toMicrophoneCaptureError,
} from './microphone-capture-errors'
import { normalizePeakAmplitude } from './normalize-peak'
import { openRealMicrophoneStream } from './open-microphone-stream'
import { computePeakAmplitude, computeRootMeanSquareEnergy } from '../dsp/signal-energy'

export type { CaptureDiagnostics, CaptureAudioSource } from './capture-diagnostics'
export {
  MicrophoneCaptureError,
  type MicrophoneCaptureErrorReason,
} from './microphone-capture-errors'

const ANALYSER_FFT_SIZE = 2048
const KEEPALIVE_MS = 400

export interface CapturedMicrophoneAudio {
  readonly samples: Float32Array
  readonly sampleRate: number
  readonly diagnostics: CaptureDiagnostics
}

/** Live meters from the Analyser (same graph as the waveform). */
export interface LiveInputMeters {
  readonly rms: number
  readonly peak: number
  /** 0–1 level for the UI bar (peak, clamped). */
  readonly level01: number
}

export interface MicrophoneCaptureSession {
  readonly audioContext: AudioContext
  readonly analyserNode: AnalyserNode
  readonly deviceLabel: string
  readonly mediaStream: MediaStream
  /** Read current input meters (call from rAF). */
  readLiveMeters: () => LiveInputMeters
  stop: () => Promise<CapturedMicrophoneAudio>
  abort: () => void
}

async function ensureRunning(audioContext: AudioContext): Promise<void> {
  if (audioContext.state !== 'closed') {
    await audioContext.resume()
  }
}

/**
 * Opens a real OS mic. Must be called from a button click.
 *
 * INVARIANTS:
 * 1) Stream from openRealMicrophoneStream() only (never MediaStreamDestination as source).
 * 2) resume() after every await on the capture AudioContext.
 * 3) Never set { sampleRate } on the capture AudioContext.
 * 4) source → analyser → gain(0) → destination so Chromium pulls the graph.
 * 5) MediaRecorder on the same MediaStream for ASR.
 */
export async function startMicrophoneCapture(): Promise<MicrophoneCaptureSession> {
  let opened
  try {
    opened = await openRealMicrophoneStream()
  } catch (error) {
    throw toMicrophoneCaptureError(error)
  }

  const { mediaStream, deviceLabel, release: releaseOpenedStream } = opened
  const microphoneTrack = mediaStream.getAudioTracks()[0]
  if (!microphoneTrack) {
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()
    throw new MicrophoneCaptureError('unknown', 'Opened stream has no audio track.')
  }
  microphoneTrack.enabled = true

  // INVARIANT (3): no sampleRate option.
  const audioContext = new AudioContext()
  try {
    await ensureRunning(audioContext)
  } catch (error) {
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined)
    }
    throw new MicrophoneCaptureError(
      'unknown',
      'AudioContext could not start. Click the page and try again.',
      { cause: error },
    )
  }

  const sourceNode = audioContext.createMediaStreamSource(mediaStream)
  const analyserNode = audioContext.createAnalyser()
  analyserNode.fftSize = ANALYSER_FFT_SIZE
  analyserNode.smoothingTimeConstant = 0
  analyserNode.minDecibels = -100
  analyserNode.maxDecibels = -10

  // INVARIANT (4): must reach destination or some builds never process the source.
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0
  sourceNode.connect(analyserNode)
  analyserNode.connect(silentGain)
  silentGain.connect(audioContext.destination)

  await ensureRunning(audioContext)
  if (audioContext.state !== 'running') {
    sourceNode.disconnect()
    analyserNode.disconnect()
    silentGain.disconnect()
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()
    await audioContext.close().catch(() => undefined)
    throw new MicrophoneCaptureError(
      'unknown',
      'AudioContext stayed suspended after mic permission.',
    )
  }

  let startedRecorder: ReturnType<typeof startMediaRecorderOnStream>
  try {
    startedRecorder = startMediaRecorderOnStream(mediaStream)
  } catch (error) {
    sourceNode.disconnect()
    analyserNode.disconnect()
    silentGain.disconnect()
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()
    await audioContext.close().catch(() => undefined)
    throw error
  }

  const { mediaRecorder, mimeType, recordedChunks } = startedRecorder
  let isStopped = false
  let isAborted = false

  const timeDomainFloat = new Float32Array(analyserNode.fftSize)

  const keepAliveId = window.setInterval(() => {
    if (isStopped || isAborted) {
      return
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    if (microphoneTrack.readyState === 'live' && !microphoneTrack.enabled) {
      microphoneTrack.enabled = true
    }
  }, KEEPALIVE_MS)

  function readLiveMeters(): LiveInputMeters {
    analyserNode.getFloatTimeDomainData(timeDomainFloat)
    const rms = computeRootMeanSquareEnergy(timeDomainFloat)
    const peak = computePeakAmplitude(timeDomainFloat)
    return {
      rms,
      peak,
      level01: Math.min(1, peak),
    }
  }

  function disconnectGraph(): void {
    try {
      sourceNode.disconnect()
      analyserNode.disconnect()
      silentGain.disconnect()
    } catch {
      // already disconnected
    }
  }

  function abort(): void {
    if (isStopped || isAborted) {
      return
    }
    isAborted = true
    isStopped = true
    window.clearInterval(keepAliveId)
    try {
      if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
        mediaRecorder.stop()
      }
    } catch {
      // ignore
    }
    disconnectGraph()
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()
    if (audioContext.state !== 'closed') {
      void audioContext.close()
    }
  }

  async function stop(): Promise<CapturedMicrophoneAudio> {
    if (isAborted || isStopped) {
      const empty = new Float32Array(0)
      return {
        samples: empty,
        sampleRate: audioContext.sampleRate || 48000,
        diagnostics: buildCaptureDiagnostics({
          samples: empty,
          sampleRate: 48000,
          deviceLabel,
          source: 'none',
          mediaRecorderBlobBytes: 0,
          trackReadyState: microphoneTrack.readyState,
          trackMuted: microphoneTrack.muted,
          audioContextState: audioContext.state,
        }),
      }
    }
    isStopped = true
    window.clearInterval(keepAliveId)

    const recordingBlob = await stopMediaRecorderToBlob(mediaRecorder, recordedChunks, mimeType)
    const trackReadyState = microphoneTrack.readyState
    const trackMuted = microphoneTrack.muted
    const contextState = audioContext.state
    disconnectGraph()
    mediaStream.getTracks().forEach((t) => t.stop())
    releaseOpenedStream()

    let samples = new Float32Array(0)
    let sampleRate = audioContext.sampleRate || 48000
    let source: 'media-recorder' | 'none' = 'none'

    if (recordingBlob.size > 0) {
      try {
        const decodeContext = new AudioContext()
        await ensureRunning(decodeContext)
        const decoded = await decodeRecordingBlobToMono(decodeContext, recordingBlob)
        const copied = new Float32Array(decoded.samples.length)
        copied.set(decoded.samples)
        const normalized = normalizePeakAmplitude(copied, 0.65)
        samples = new Float32Array(normalized.length)
        samples.set(normalized)
        sampleRate = decoded.sampleRate
        source = 'media-recorder'
        await decodeContext.close().catch(() => undefined)
      } catch {
        samples = new Float32Array(0)
        source = 'none'
      }
    }

    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined)
    }

    return {
      samples,
      sampleRate,
      diagnostics: buildCaptureDiagnostics({
        samples,
        sampleRate,
        deviceLabel,
        source,
        mediaRecorderBlobBytes: recordingBlob.size,
        trackReadyState,
        trackMuted,
        audioContextState: contextState,
      }),
    }
  }

  return {
    audioContext,
    analyserNode,
    deviceLabel,
    mediaStream,
    readLiveMeters,
    stop,
    abort,
  }
}
