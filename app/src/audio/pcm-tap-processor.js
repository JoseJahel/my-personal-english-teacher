/**
 * AudioWorklet: copy input PCM to the main thread. No FFT, no ASR.
 */
class PcmTapProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice())
    }
    return true
  }
}

registerProcessor('pcm-tap-processor', PcmTapProcessor)
