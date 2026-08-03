/**
 * Compute spectrogram + pitch + formants from a mono utterance and paint canvases.
 */

import {
  computeMedianFormants,
  extractFormantContour,
  type FormantTriple,
} from '../dsp/formant-estimation'
import { extractPitchContourWithYin } from '../dsp/pitch-detection-yin'
import { computeLogMagnitudeSpectrogram } from '../dsp/spectrogram'
import {
  clearSignalCanvas,
  drawPitchContourOnCanvas,
  drawSpectrogramOnCanvas,
} from './utterance-signal-canvas'

export function updateUtteranceSignalViews(options: {
  readonly samples: Float32Array
  readonly sampleRateInHertz: number
  readonly spectrogramCanvas: HTMLCanvasElement | null
  readonly pitchTrackCanvas: HTMLCanvasElement | null
}): FormantTriple | null {
  const { samples, sampleRateInHertz, spectrogramCanvas, pitchTrackCanvas } = options

  if (spectrogramCanvas) {
    if (samples.length === 0 || sampleRateInHertz <= 0) {
      clearSignalCanvas(spectrogramCanvas)
    } else {
      const spectrogram = computeLogMagnitudeSpectrogram(samples, sampleRateInHertz, {
        maximumFrequencyInHertz: 8000,
      })
      drawSpectrogramOnCanvas(spectrogramCanvas, spectrogram)
    }
  }

  if (pitchTrackCanvas) {
    if (samples.length === 0 || sampleRateInHertz <= 0) {
      clearSignalCanvas(pitchTrackCanvas)
    } else {
      const contour = extractPitchContourWithYin(samples, sampleRateInHertz)
      drawPitchContourOnCanvas(pitchTrackCanvas, contour, {
        minimumFrequencyInHertz: 70,
        maximumFrequencyInHertz: 400,
      })
    }
  }

  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return null
  }
  const formantContour = extractFormantContour(samples, sampleRateInHertz)
  return computeMedianFormants(formantContour)
}

export function clearUtteranceSignalViews(options: {
  readonly spectrogramCanvas: HTMLCanvasElement | null
  readonly pitchTrackCanvas: HTMLCanvasElement | null
}): void {
  if (options.spectrogramCanvas) {
    clearSignalCanvas(options.spectrogramCanvas)
  }
  if (options.pitchTrackCanvas) {
    clearSignalCanvas(options.pitchTrackCanvas)
  }
}
