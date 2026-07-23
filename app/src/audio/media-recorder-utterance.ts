/**
 * MediaRecorder helpers: record a MediaStream utterance and decode to mono PCM.
 */

import { mixAudioBufferChannelsToMono } from './mix-to-mono'
import { MicrophoneCaptureError } from './microphone-capture-errors'

export function pickMediaRecorderMimeType(): string {
  const mimeTypeCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mimeType of mimeTypeCandidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return ''
}

export interface StartedMediaRecorder {
  readonly mediaRecorder: MediaRecorder
  readonly mimeType: string
  readonly recordedChunks: Blob[]
}

/** Creates and starts MediaRecorder with a short timeslice for reliable short clips. */
export function startMediaRecorderOnStream(mediaStream: MediaStream): StartedMediaRecorder {
  if (typeof MediaRecorder === 'undefined') {
    throw new MicrophoneCaptureError(
      'unknown',
      'This browser does not support MediaRecorder, which is required to capture speech.',
    )
  }

  const mimeType = pickMediaRecorderMimeType()
  let mediaRecorder: MediaRecorder
  try {
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream)
  } catch (error) {
    throw new MicrophoneCaptureError(
      'unknown',
      'Failed to create MediaRecorder for the microphone stream.',
      { cause: error },
    )
  }

  const recordedChunks: Blob[] = []
  mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data)
    }
  })

  try {
    mediaRecorder.start(100)
  } catch (error) {
    throw new MicrophoneCaptureError(
      'unknown',
      'Failed to start MediaRecorder for the microphone stream.',
      { cause: error },
    )
  }

  return { mediaRecorder, mimeType, recordedChunks }
}

/** Stops the recorder and returns the concatenated blob. */
export function stopMediaRecorderToBlob(
  mediaRecorder: MediaRecorder,
  recordedChunks: Blob[],
  mimeType: string,
): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    const finish = () => {
      const blobType = mediaRecorder.mimeType || mimeType || 'audio/webm'
      resolve(new Blob(recordedChunks, { type: blobType }))
    }

    if (mediaRecorder.state === 'inactive') {
      finish()
      return
    }

    mediaRecorder.addEventListener('stop', finish, { once: true })
    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData()
      }
      mediaRecorder.stop()
    } catch {
      finish()
    }
  })
}

/** Decodes a recording blob to mono PCM via the given AudioContext. */
export async function decodeRecordingBlobToMono(
  audioContext: AudioContext,
  recordingBlob: Blob,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (recordingBlob.size === 0) {
    return { samples: new Float32Array(0), sampleRate: audioContext.sampleRate || 48000 }
  }

  if (audioContext.state !== 'closed') {
    await audioContext.resume()
  }
  const arrayBuffer = await recordingBlob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
  return {
    samples: mixAudioBufferChannelsToMono(audioBuffer),
    sampleRate: audioBuffer.sampleRate,
  }
}
