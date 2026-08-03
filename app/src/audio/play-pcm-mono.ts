/**
 * Play mono PCM samples through Web Audio (main thread only).
 * Used for TTS playback; not part of the capture path.
 */

/**
 * Decode-free playback: write samples into an AudioBuffer and start a source.
 * Resolves when playback ends (or immediately for empty audio).
 * Prefer calling after a user gesture so AudioContext can resume.
 */
export async function playMonoPcmSamples(
  samples: Float32Array,
  sampleRateInHertz: number,
  options?: {
    readonly audioContext?: AudioContext
  },
): Promise<void> {
  if (samples.length === 0 || sampleRateInHertz <= 0) {
    return
  }

  const ownsContext = !options?.audioContext
  const audioContext = options?.audioContext ?? new AudioContext()

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const audioBuffer = audioContext.createBuffer(1, samples.length, sampleRateInHertz)
    // copyToChannel requires a plain Float32Array matching the buffer length.
    const channelData = new Float32Array(samples.length)
    channelData.set(samples)
    audioBuffer.copyToChannel(channelData, 0)

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)

    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve()
      try {
        source.start(0)
      } catch (error) {
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
