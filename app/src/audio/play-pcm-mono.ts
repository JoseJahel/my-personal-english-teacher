/**
 * Play mono PCM samples through Web Audio (main thread only).
 * Used for TTS playback; not part of the capture path.
 */

export interface PlayMonoPcmResult {
  /**
   * True when playback reached its natural end via `onended` without being
   * interrupted through `options.signal`.
   */
  readonly completed: boolean
  /**
   * Milliseconds of audio actually heard before playback ended or was cut
   * off, measured on the AudioContext's own clock (not main-thread time).
   * Feeds `spoken_progress.cutoff_ms` for barge-in handling (see #46) so
   * callers know how much of an utterance the user actually heard.
   */
  readonly cutoffMs: number
}

/**
 * Decode-free playback: write samples into an AudioBuffer and start a source.
 * Resolves when playback ends naturally, or is interrupted via
 * `options.signal` (barge-in / mid-utterance interruption).
 * Prefer calling after a user gesture so AudioContext can resume.
 */
export async function playMonoPcmSamples(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: {
    readonly audioContext?: AudioContext
    /** Abort mid-playback (e.g. user barge-in). Reports a partial cutoffMs. */
    readonly signal?: AbortSignal
  },
): Promise<PlayMonoPcmResult> {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return { completed: true, cutoffMs: 0 }
  }
  if (options?.signal?.aborted) {
    return { completed: false, cutoffMs: 0 }
  }
  const durationMs = (samples.length / sampleRateInHertz) * 1000
  const ownsContext = !options?.audioContext
  const audioContext = options?.audioContext ?? new AudioContext()
  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    const audioBuffer = audioContext.createBuffer(1, samples.length, sampleRateInHertz)
    const channelData = new Float32Array(samples.length)
    channelData.set(samples)
    audioBuffer.copyToChannel(channelData, 0)
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)

    const startedAtAudioTime = audioContext.currentTime
    let completed = true

    return await new Promise<PlayMonoPcmResult>((resolve, reject) => {
      const signal = options?.signal
      const handleAbort = (): void => {
        completed = false
        try {
          source.stop()
        } catch {
          // Already stopped or ended; the onended handler still resolves.
        }
      }
      source.onended = () => {
        signal?.removeEventListener('abort', handleAbort)
        const elapsedMs = (audioContext.currentTime - startedAtAudioTime) * 1000
        const cutoffMs = Math.round(Math.max(0, Math.min(elapsedMs, durationMs)))
        resolve({ completed, cutoffMs })
      }
      if (signal) {
        if (signal.aborted) {
          handleAbort()
        } else {
          signal.addEventListener('abort', handleAbort, { once: true })
        }
      }
      try {
        source.start(0)
      } catch (error) {
        signal?.removeEventListener('abort', handleAbort)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  } finally {
    if (ownsContext) {
      await audioContext.close().catch(() => {
        // ignore close failures after playback
      })
    }
  }
}
