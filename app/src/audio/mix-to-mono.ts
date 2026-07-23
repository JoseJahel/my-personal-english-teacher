/**
 * Mix multi-channel PCM to mono by averaging channels (pure helper).
 */

/** Minimal shape compatible with Web Audio AudioBuffer for tests without DOM. */
export interface ChannelAudioBuffer {
  readonly numberOfChannels: number
  readonly length: number
  getChannelData: (channelIndex: number) => Float32Array
}

/** Returns a copy of channel 0 when mono; otherwise the average of all channels. */
export function mixAudioBufferChannelsToMono(audioBuffer: ChannelAudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels <= 0 || audioBuffer.length === 0) {
    return new Float32Array(0)
  }

  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice()
  }

  const sampleCount = audioBuffer.length
  const monoSamples = new Float32Array(sampleCount)
  const channelCount = audioBuffer.numberOfChannels

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelSamples = audioBuffer.getChannelData(channelIndex)
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      monoSamples[sampleIndex] += channelSamples[sampleIndex]
    }
  }

  const inverseChannelCount = 1 / channelCount
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    monoSamples[sampleIndex] *= inverseChannelCount
  }

  return monoSamples
}
