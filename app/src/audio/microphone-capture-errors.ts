/**
 * First-class errors for microphone capture.
 * UI maps `reason` and can show `message` for unknown failures.
 */

export type MicrophoneCaptureErrorReason = 'permission-denied' | 'unknown'

export class MicrophoneCaptureError extends Error {
  readonly reason: MicrophoneCaptureErrorReason

  constructor(reason: MicrophoneCaptureErrorReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MicrophoneCaptureError'
    this.reason = reason
  }
}

export function toMicrophoneCaptureError(error: unknown): MicrophoneCaptureError {
  if (error instanceof MicrophoneCaptureError) {
    return error
  }

  const isPermissionError =
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')

  if (isPermissionError) {
    return new MicrophoneCaptureError(
      'permission-denied',
      'Microphone permission denied by the user or blocked by browser policy.',
      { cause: error },
    )
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return new MicrophoneCaptureError(
      'unknown',
      'No microphone device was found. Connect a mic or choose an input in Windows sound settings.',
      { cause: error },
    )
  }

  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return new MicrophoneCaptureError(
      'unknown',
      'The microphone is already in use by another application, or the driver failed.',
      { cause: error },
    )
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new MicrophoneCaptureError('unknown', error.message, { cause: error })
  }

  return new MicrophoneCaptureError(
    'unknown',
    'Unexpected failure while opening the microphone.',
    { cause: error },
  )
}
