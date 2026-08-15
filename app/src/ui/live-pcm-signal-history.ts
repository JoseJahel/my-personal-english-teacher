/**
 * Rolling live STFT columns + YIN samples for the existing signal canvases.
 */

import type { YinPitchContourFrame } from '../dsp/pitch-detection-yin'
import type { SpectrogramResult } from '../dsp/spectrogram'

export const LIVE_SIGNAL_HISTORY_COLUMN_COUNT = 80

export interface LivePcmSignalHistory {
  readonly columns: Float32Array[]
  readonly pitchFrames: YinPitchContourFrame[]
  fftSize: number
  sampleRateInHertz: number
}

export function createLivePcmSignalHistory(): LivePcmSignalHistory {
  return {
    columns: [],
    pitchFrames: [],
    fftSize: 0,
    sampleRateInHertz: 0,
  }
}

export function appendLivePcmSignalColumn(
  history: LivePcmSignalHistory,
  input: {
    readonly logMagnitudeColumn: Float32Array
    readonly pitchFrequencyInHertz: number | null
    readonly fftSize: number
    readonly sampleRateInHertz: number
  },
): void {
  history.fftSize = input.fftSize
  history.sampleRateInHertz = input.sampleRateInHertz
  history.columns.push(input.logMagnitudeColumn)
  history.pitchFrames.push({
    frameIndex: history.pitchFrames.length,
    timeInSeconds: history.pitchFrames.length * 0.01,
    frequencyInHertz: input.pitchFrequencyInHertz,
    probability: input.pitchFrequencyInHertz === null ? 1 : 0,
  })
  while (history.columns.length > LIVE_SIGNAL_HISTORY_COLUMN_COUNT) {
    history.columns.shift()
  }
  while (history.pitchFrames.length > LIVE_SIGNAL_HISTORY_COLUMN_COUNT) {
    history.pitchFrames.shift()
  }
}

export function liveHistoryToSpectrogram(history: LivePcmSignalHistory): SpectrogramResult | null {
  if (history.columns.length === 0 || history.sampleRateInHertz <= 0) {
    return null
  }
  const binCount = history.columns[0]!.length
  return {
    frames: history.columns,
    sampleRateInHertz: history.sampleRateInHertz,
    fftSize: history.fftSize,
    hopLengthInSamples: Math.max(1, Math.floor(0.01 * history.sampleRateInHertz)),
    binCount,
    maximumFrequencyInHertz: Math.min(8000, history.sampleRateInHertz / 2),
  }
}
