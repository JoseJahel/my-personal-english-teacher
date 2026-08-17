/**
 * Clone the mic stream for live DSP. The Analyser keeps the original
 * MediaStreamSource; a worklet on that same node zeroes the Analyser on
 * Windows Realtek arrays (issue #59 / CAPTURE-INVARIANTS).
 */

export function cloneMediaStreamForAnalysis(mediaStream: MediaStream): MediaStream | null {
  if (typeof mediaStream.clone !== 'function') {
    return null
  }
  try {
    const cloned = mediaStream.clone()
    if (cloned.getAudioTracks().length === 0) {
      stopClonedMediaStream(cloned)
      return null
    }
    return cloned
  } catch {
    return null
  }
}

export function stopClonedMediaStream(stream: MediaStream | null): void {
  if (!stream) {
    return
  }
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // already ended
    }
  }
}
