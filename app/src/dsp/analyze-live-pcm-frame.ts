/**
 * One live hop of STFT + YIN using the same domain functions as post-stop views.
 */

import { estimatePitchWithYin } from './pitch-detection-yin'
import { computeLogMagnitudeSpectrogram } from './spectrogram'

export interface LivePcmFrameAnalysis {
  readonly logMagnitudeColumn: Float32Array | null
  readonly fftSize: number
  readonly pitchFrequencyInHertz: number | null
  readonly analysisDurationMs: number
}

export function analyzeLivePcmFrame(
  samples: Float32Array,
  sampleRateInHertz: number,
): LivePcmFrameAnalysis {
  const startedMs = performance.now()
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return {
      logMagnitudeColumn: null,
      fftSize: 0,
      pitchFrequencyInHertz: null,
      analysisDurationMs: performance.now() - startedMs,
    }
  }

  const spectrogram = computeLogMagnitudeSpectrogram(samples, sampleRateInHertz, {
    maximumFrequencyInHertz: 8000,
  })
  const logMagnitudeColumn = spectrogram.frames[0] ?? null
  const pitch = estimatePitchWithYin(samples, sampleRateInHertz)

  return {
    logMagnitudeColumn,
    fftSize: spectrogram.fftSize,
    pitchFrequencyInHertz: pitch.frequencyInHertz,
    analysisDurationMs: performance.now() - startedMs,
  }
}
