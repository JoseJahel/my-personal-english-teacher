/**
 * Waveform from AnalyserNode float time-domain data + live meters.
 * Auto-scales to recent peak so quiet mics still show motion when voice changes.
 */

export const WAVEFORM_BACKGROUND_COLOR = '#2e3b30'
export const WAVEFORM_LINE_COLOR = '#8fbf95'
export const WAVEFORM_CENTER_LINE_COLOR = '#4a5c4d'

export interface AnalyserWaveformOptions {
  onMeters?: (meters: { rms: number; peak: number; level01: number }) => void
}

export function clearWaveformCanvas(canvas: HTMLCanvasElement): void {
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) {
    return
  }
  canvasContext.fillStyle = WAVEFORM_BACKGROUND_COLOR
  canvasContext.fillRect(0, 0, canvas.width, canvas.height)
}

/**
 * Starts rAF loop: reads analyser float data, draws wave, reports meters.
 * `readMeters` must call analyser.getFloatTimeDomainData internally (or equivalent).
 */
export function startAnalyserWaveformAnimation(
  canvas: HTMLCanvasElement,
  analyserNode: AnalyserNode,
  options?: AnalyserWaveformOptions,
): () => void {
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) {
    return () => {}
  }

  const timeDomain = new Float32Array(analyserNode.fftSize)
  let animationFrameId: number | null = null
  let isCancelled = false
  /** Slow decay envelope for auto-scale (follows voice up, falls slowly). */
  let displayPeakEnvelope = 0.05

  const renderFrame = () => {
    if (isCancelled) {
      return
    }
    animationFrameId = requestAnimationFrame(renderFrame)

    analyserNode.getFloatTimeDomainData(timeDomain)

    let peak = 0
    let sumSquares = 0
    for (let i = 0; i < timeDomain.length; i += 1) {
      const sample = timeDomain[i]
      const absolute = Math.abs(sample)
      if (absolute > peak) {
        peak = absolute
      }
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / timeDomain.length)
    const level01 = Math.min(1, peak)

    // Envelope: rise fast with voice, fall slowly in silence.
    if (peak > displayPeakEnvelope) {
      displayPeakEnvelope = peak
    } else {
      displayPeakEnvelope = displayPeakEnvelope * 0.97 + peak * 0.03
    }
    const scale = 0.85 / Math.max(displayPeakEnvelope, 0.02)

    options?.onMeters?.({ rms, peak, level01 })

    canvasContext.fillStyle = WAVEFORM_BACKGROUND_COLOR
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)

    const midY = canvas.height / 2
    canvasContext.strokeStyle = WAVEFORM_CENTER_LINE_COLOR
    canvasContext.lineWidth = 1
    canvasContext.beginPath()
    canvasContext.moveTo(0, midY)
    canvasContext.lineTo(canvas.width, midY)
    canvasContext.stroke()

    canvasContext.strokeStyle = WAVEFORM_LINE_COLOR
    canvasContext.lineWidth = 2
    canvasContext.beginPath()
    const sliceWidth = canvas.width / timeDomain.length
    let x = 0
    for (let i = 0; i < timeDomain.length; i += 1) {
      const y = midY - timeDomain[i] * scale * midY
      if (i === 0) {
        canvasContext.moveTo(x, y)
      } else {
        canvasContext.lineTo(x, y)
      }
      x += sliceWidth
    }
    canvasContext.stroke()
  }

  renderFrame()

  return () => {
    isCancelled = true
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }
}
