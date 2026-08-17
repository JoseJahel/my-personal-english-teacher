/**
 * Live STFT + YIN on worklet PCM. Does not replace MediaRecorder ASR.
 */

import { startPcmTap } from '../audio/start-pcm-tap'
import { analyzeLivePcmFrame } from '../dsp/analyze-live-pcm-frame'
import {
  createPcmFrameAccumulator,
  livePcmFrameLengthInSamples,
  livePcmHopLengthInSamples,
} from '../dsp/pcm-frame-accumulator'
import {
  appendLivePcmSignalColumn,
  createLivePcmSignalHistory,
  liveHistoryToSpectrogram,
} from './live-pcm-signal-history'
import { drawPitchContourOnCanvas, drawSpectrogramOnCanvas } from './utterance-signal-canvas'

export const LIVE_SIGNAL_DRAW_INTERVAL_MS = 50

function canAttachLivePcmTap(
  audioContext: AudioContext,
  sourceNode: AudioNode | null,
): sourceNode is AudioNode {
  return (
    sourceNode !== null &&
    typeof sourceNode.connect === 'function' &&
    typeof audioContext.audioWorklet?.addModule === 'function'
  )
}

export async function startLivePcmSignalViews(options: {
  readonly audioContext: AudioContext
  readonly sourceNode: AudioNode | null
  readonly spectrogramCanvas: HTMLCanvasElement | null
  readonly pitchTrackCanvas: HTMLCanvasElement | null
}): Promise<() => void> {
  const { audioContext, sourceNode, spectrogramCanvas, pitchTrackCanvas } = options
  if (!canAttachLivePcmTap(audioContext, sourceNode)) {
    return () => undefined
  }
  const sampleRate = audioContext.sampleRate
  const accumulator = createPcmFrameAccumulator({
    frameLengthInSamples: livePcmFrameLengthInSamples(sampleRate),
    hopLengthInSamples: livePcmHopLengthInSamples(sampleRate),
  })
  const history = createLivePcmSignalHistory()

  let lastDrawMs = 0
  const stopTap = await startPcmTap(audioContext, sourceNode, (chunk) => {
    const frames = accumulator.push(chunk)
    for (const frame of frames) {
      const analysis = analyzeLivePcmFrame(frame, sampleRate)
      if (!analysis.logMagnitudeColumn) {
        continue
      }
      appendLivePcmSignalColumn(history, {
        logMagnitudeColumn: analysis.logMagnitudeColumn,
        pitchFrequencyInHertz: analysis.pitchFrequencyInHertz,
        fftSize: analysis.fftSize,
        sampleRateInHertz: sampleRate,
      })
    }
    if (frames.length === 0) {
      return
    }
    const nowMs = performance.now()
    if (nowMs - lastDrawMs < LIVE_SIGNAL_DRAW_INTERVAL_MS) {
      return
    }
    lastDrawMs = nowMs
    const spectrogram = liveHistoryToSpectrogram(history)
    if (spectrogram && spectrogramCanvas) {
      drawSpectrogramOnCanvas(spectrogramCanvas, spectrogram)
    }
    if (pitchTrackCanvas) {
      drawPitchContourOnCanvas(pitchTrackCanvas, history.pitchFrames, {
        minimumFrequencyInHertz: 70,
        maximumFrequencyInHertz: 400,
      })
    }
  })

  return stopTap
}
