/**
 * Draw post-utterance spectrogram and pitch contour on canvas elements.
 * Presentation only; DSP lives in `dsp/spectrogram` and `dsp/pitch-detection-yin`.
 */

import {
  computeSpectrogramValueRange,
  type SpectrogramResult,
} from '../dsp/spectrogram'
import type { YinPitchContourFrame } from '../dsp/pitch-detection-yin'

export const SIGNAL_CANVAS_BACKGROUND = '#1e1e1e'
export const PITCH_TRACK_LINE_COLOR = '#5dade2'
export const PITCH_TRACK_GRID_COLOR = '#333333'
export const PITCH_TRACK_UNVOICED_COLOR = '#444444'

/** Clear a signal canvas to the shared dark background. */
export function clearSignalCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.fillStyle = SIGNAL_CANVAS_BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
}

/**
 * Draw a log-magnitude spectrogram (time → x, frequency → y, low bins at bottom).
 * Empty spectrogram → dark clear.
 */
export function drawSpectrogramOnCanvas(
  canvas: HTMLCanvasElement,
  spectrogram: SpectrogramResult,
): void {
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.fillStyle = SIGNAL_CANVAS_BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)

  if (spectrogram.frames.length === 0 || spectrogram.binCount === 0) {
    return
  }

  const valueRange = computeSpectrogramValueRange(spectrogram)
  if (!valueRange) {
    return
  }
  const span = Math.max(1e-6, valueRange.maximum - valueRange.minimum)
  const frameCount = spectrogram.frames.length
  const binCount = spectrogram.binCount
  const cellWidth = canvas.width / frameCount
  const cellHeight = canvas.height / binCount

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frame = spectrogram.frames[frameIndex]!
    for (let bin = 0; bin < binCount; bin += 1) {
      const normalized = ((frame[bin] ?? valueRange.minimum) - valueRange.minimum) / span
      context.fillStyle = spectrogramHeatColor(normalized)
      // Low frequencies at the bottom (standard spectrogram orientation).
      const y = canvas.height - (bin + 1) * cellHeight
      context.fillRect(frameIndex * cellWidth, y, Math.ceil(cellWidth) + 0.5, Math.ceil(cellHeight) + 0.5)
    }
  }
}

/**
 * Draw a pitch contour (Hz vs time). Unvoiced frames are skipped (gaps).
 * `minimumFrequencyInHertz` / `maximumFrequencyInHertz` set the vertical scale.
 */
export function drawPitchContourOnCanvas(
  canvas: HTMLCanvasElement,
  contour: readonly YinPitchContourFrame[],
  options?: {
    readonly minimumFrequencyInHertz?: number
    readonly maximumFrequencyInHertz?: number
  },
): void {
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.fillStyle = SIGNAL_CANVAS_BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)

  const minimumFrequencyInHertz = options?.minimumFrequencyInHertz ?? 70
  const maximumFrequencyInHertz = options?.maximumFrequencyInHertz ?? 400
  const frequencySpan = Math.max(1, maximumFrequencyInHertz - minimumFrequencyInHertz)

  // Horizontal guide lines at min / mid / max.
  context.strokeStyle = PITCH_TRACK_GRID_COLOR
  context.lineWidth = 1
  for (const fraction of [0, 0.5, 1]) {
    const y = canvas.height - fraction * canvas.height
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(canvas.width, y)
    context.stroke()
  }

  if (contour.length === 0) {
    return
  }

  const lastTime =
    contour[contour.length - 1]?.timeInSeconds ??
    contour.length * 0.01
  const timeSpan = Math.max(lastTime, 1e-3)

  context.strokeStyle = PITCH_TRACK_LINE_COLOR
  context.lineWidth = 2
  context.beginPath()
  let hasOpenSegment = false

  for (const frame of contour) {
    const frequency = frame.frequencyInHertz
    if (frequency === null || !Number.isFinite(frequency)) {
      hasOpenSegment = false
      continue
    }
    const x = (frame.timeInSeconds / timeSpan) * canvas.width
    const clamped =
      (Math.min(maximumFrequencyInHertz, Math.max(minimumFrequencyInHertz, frequency)) -
        minimumFrequencyInHertz) /
      frequencySpan
    const y = canvas.height - clamped * canvas.height
    if (!hasOpenSegment) {
      context.moveTo(x, y)
      hasOpenSegment = true
    } else {
      context.lineTo(x, y)
    }
  }
  context.stroke()

  // Unvoiced markers as subtle ticks along the bottom.
  context.fillStyle = PITCH_TRACK_UNVOICED_COLOR
  for (const frame of contour) {
    if (frame.frequencyInHertz !== null) {
      continue
    }
    const x = (frame.timeInSeconds / timeSpan) * canvas.width
    context.fillRect(x, canvas.height - 4, 2, 4)
  }
}

/** Map 0–1 intensity to a simple heat palette (dark → blue → cyan → yellow → white). */
export function spectrogramHeatColor(intensity01: number): string {
  const t = Math.min(1, Math.max(0, intensity01))
  if (t < 0.25) {
    const u = t / 0.25
    return rgbCss(0, 0, Math.round(40 + u * 120))
  }
  if (t < 0.5) {
    const u = (t - 0.25) / 0.25
    return rgbCss(0, Math.round(u * 200), 180)
  }
  if (t < 0.75) {
    const u = (t - 0.5) / 0.25
    return rgbCss(Math.round(u * 255), 220, Math.round(180 * (1 - u)))
  }
  const u = (t - 0.75) / 0.25
  return rgbCss(255, Math.round(220 + u * 35), Math.round(u * 255))
}

function rgbCss(red: number, green: number, blue: number): string {
  return `rgb(${red}, ${green}, ${blue})`
}
