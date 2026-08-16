/**
 * Attach a PCM-only worklet tap. Never used as the ASR source.
 */

const PCM_TAP_PROCESSOR_NAME = 'pcm-tap-processor'

export type PcmTapListener = (samples: Float32Array, sampleRateInHertz: number) => void

export async function startPcmTap(
  audioContext: AudioContext,
  sourceNode: AudioNode,
  onSamples: PcmTapListener,
): Promise<() => void> {
  if (typeof audioContext.audioWorklet?.addModule !== 'function') {
    return () => undefined
  }

  const processorUrl = new URL('./pcm-tap-processor.js', import.meta.url)
  await audioContext.audioWorklet.addModule(processorUrl)
  const workletNode = new AudioWorkletNode(audioContext, PCM_TAP_PROCESSOR_NAME)
  const handleMessage = (event: MessageEvent<Float32Array>) => {
    if (event.data instanceof Float32Array && event.data.length > 0) {
      onSamples(event.data, audioContext.sampleRate)
    }
  }
  workletNode.port.onmessage = handleMessage
  sourceNode.connect(workletNode)

  let stopped = false
  return () => {
    if (stopped) {
      return
    }
    stopped = true
    workletNode.port.onmessage = null
    try {
      sourceNode.disconnect(workletNode)
    } catch {
      // already disconnected with the capture graph
    }
    try {
      workletNode.disconnect()
    } catch {
      // no output connections
    }
  }
}
