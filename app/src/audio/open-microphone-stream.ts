/**
 * Open a microphone the same way Teams/Discord do: getUserMedia({ audio: true }).
 *
 * Extra recovery only when the page has a patched getUserMedia (e.g. Playwright
 * test mocks that invent "Microphone (Functional Test Array)").
 */

import { MicrophoneCaptureError, toMicrophoneCaptureError } from './microphone-capture-errors'

export interface OpenedMicrophoneStream {
  readonly mediaStream: MediaStream
  readonly deviceLabel: string
  readonly deviceId: string
  readonly release: () => void
  /** True when we had to bypass a non-native getUserMedia on the page. */
  readonly usedNativeRecovery: boolean
}

export function isSyntheticTrackLabel(label: string): boolean {
  return (
    /MediaStreamAudioDestinationNode/i.test(label) || /Functional Test Array/i.test(label)
  )
}

export function isGetUserMediaNative(): boolean {
  try {
    return Function.prototype.toString
      .call(navigator.mediaDevices.getUserMedia)
      .includes('[native code]')
  } catch {
    return false
  }
}

type GumFn = (constraints: MediaStreamConstraints) => Promise<MediaStream>

/** Resolve the most native getUserMedia available (page → prototype → iframe). */
function resolveGetUserMediaCandidates(): Array<{ name: string; fn: GumFn; release: () => void }> {
  const candidates: Array<{ name: string; fn: GumFn; release: () => void }> = []

  // 1) Whatever is on the page (normal Chrome path — same as Teams/Discord).
  candidates.push({
    name: 'page',
    fn: (c) => navigator.mediaDevices.getUserMedia(c),
    release: () => {},
  })

  // 2) Prototype method (survives instance-level Playwright mocks).
  try {
    const proto = Object.getPrototypeOf(navigator.mediaDevices) as MediaDevices | null
    if (proto && typeof proto.getUserMedia === 'function') {
      const protoFn = proto.getUserMedia.bind(navigator.mediaDevices)
      const pageFn = navigator.mediaDevices.getUserMedia
      if (protoFn !== pageFn) {
        candidates.push({
          name: 'prototype',
          fn: (c) => protoFn(c),
          release: () => {},
        })
      }
    }
  } catch {
    // ignore
  }

  // 3) Hidden iframe (another chance at an unpatched MediaDevices).
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('allow', 'microphone')
    iframe.style.cssText =
      'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:0;top:0'
    iframe.src = 'about:blank'
    document.documentElement.appendChild(iframe)
    const frameMd = iframe.contentWindow?.navigator?.mediaDevices
    if (frameMd && typeof frameMd.getUserMedia === 'function') {
      candidates.push({
        name: 'iframe',
        fn: (c) => frameMd.getUserMedia(c),
        release: () => {
          try {
            iframe.remove()
          } catch {
            // ignore
          }
        },
      })
    } else {
      iframe.remove()
    }
  } catch {
    // ignore
  }

  return candidates
}

function acceptStream(
  mediaStream: MediaStream,
  release: () => void,
  usedNativeRecovery: boolean,
): OpenedMicrophoneStream | null {
  const track = mediaStream.getAudioTracks()[0]
  if (!track) {
    mediaStream.getTracks().forEach((t) => t.stop())
    return null
  }
  track.enabled = true
  const label = track.label?.trim() || 'Microphone'
  // Reject only known fake labels from Web Audio / our test mock.
  if (isSyntheticTrackLabel(label)) {
    mediaStream.getTracks().forEach((t) => t.stop())
    return null
  }
  return {
    mediaStream,
    deviceLabel: label,
    deviceId: track.getSettings().deviceId || '',
    release,
    usedNativeRecovery,
  }
}

/**
 * Opens a mic stream. Primary path is identical to typical web apps:
 * getUserMedia({ audio: true }). Recovery paths only run if that is patched
 * or returns a known synthetic stream.
 */
export async function openRealMicrophoneStream(): Promise<OpenedMicrophoneStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneCaptureError(
      'unknown',
      'Este navegador no expone navigator.mediaDevices.getUserMedia.',
    )
  }

  const candidates = resolveGetUserMediaCandidates()
  const errors: string[] = []

  // Constraint sets: simplest first (Discord/Teams style), then voice-oriented.
  const constraintSets: MediaStreamConstraints[] = [
    { audio: true, video: false },
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    },
  ]

  for (const candidate of candidates) {
    for (const constraints of constraintSets) {
      try {
        const stream = await candidate.fn(constraints)
        const opened = acceptStream(
          stream,
          candidate.release,
          candidate.name !== 'page' || !isGetUserMediaNative(),
        )
        if (opened) {
          // Drop other candidates' iframes if unused.
          for (const other of candidates) {
            if (other !== candidate) {
              other.release()
            }
          }
          return opened
        }
        errors.push(`${candidate.name}: stream sintético o sin pista de audio`)
      } catch (error) {
        // Permission errors should surface immediately on the primary page path.
        if (
          candidate.name === 'page' &&
          error instanceof DOMException &&
          (error.name === 'NotAllowedError' || error.name === 'SecurityError')
        ) {
          for (const other of candidates) {
            other.release()
          }
          throw toMicrophoneCaptureError(error)
        }
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${candidate.name}: ${message}`)
      }
    }
  }

  for (const candidate of candidates) {
    candidate.release()
  }

  let deviceSummary = 'No se pudo listar dispositivos.'
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices.filter((d) => d.kind === 'audioinput')
    if (inputs.length === 0) {
      deviceSummary = 'No hay dispositivos audioinput listados.'
    } else {
      deviceSummary = `Dispositivos: ${inputs.map((d) => d.label || d.deviceId).join(' | ')}.`
    }
  } catch {
    // keep default deviceSummary
  }

  const gumNative = isGetUserMediaNative() ? 'sí' : 'no (parcheado)'
  throw new MicrophoneCaptureError(
    'unknown',
    `No se pudo abrir un micrófono real. getUserMedia nativo: ${gumNative}. ${deviceSummary} Intentos: ${errors.join('; ')}. Si ves "Functional Test Array", cierra TODAS las ventanas de Chrome y abre Chrome desde el menú de Windows (no la ventana de pruebas automáticas).`,
  )
}
