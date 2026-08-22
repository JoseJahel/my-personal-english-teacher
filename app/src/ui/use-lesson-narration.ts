/**
 * Reads a lesson aloud, one English line at a time, using the local browser
 * voice (`speechSynthesis`).
 *
 * Why the OS voice and not the neural tutor voice: a lesson script is up to
 * 30 short lines, and Supertonic would have to synthesize each one through
 * the inference worker — which the study screen does not own, and which sits
 * behind the ~1 GB practice model downloads. The browser voice starts
 * instantly, needs no download, works offline, and already ships in this
 * project as the tutor's instant speech path (`play-browser-speech-synthesis`).
 *
 * Interruption is first-class: `stop()` aborts the current line and cancels
 * the rest of the script, and unmounting does the same, so a lesson left
 * half-read never keeps talking over the next screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { playEnglishWithBrowserSpeechSynthesis } from '../audio/play-browser-speech-synthesis'
import type { LessonSpeechLine } from '../study/lesson-speech-script'

export type LessonNarrationStatus = 'idle' | 'speaking'

export type SpeakLessonLine = (
  text: string,
  options?: { readonly signal?: AbortSignal },
) => Promise<{ readonly completed: boolean }>

export interface UseLessonNarrationOptions {
  /** Injectable for tests; defaults to the browser voice. */
  readonly speakLine?: SpeakLessonLine
}

export interface UseLessonNarrationResult {
  readonly status: LessonNarrationStatus
  /** Index of the line currently being spoken, or -1 while idle. */
  readonly spokenLineIndex: number
  readonly start: (lines: readonly LessonSpeechLine[]) => void
  readonly stop: () => void
}

export function useLessonNarration(
  options: UseLessonNarrationOptions = {},
): UseLessonNarrationResult {
  const speakLineRef = useRef<SpeakLessonLine>(
    options.speakLine ?? playEnglishWithBrowserSpeechSynthesis,
  )
  useEffect(() => {
    speakLineRef.current = options.speakLine ?? playEnglishWithBrowserSpeechSynthesis
  })

  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<LessonNarrationStatus>('idle')
  const [spokenLineIndex, setSpokenLineIndex] = useState(-1)

  /** Only the run that still owns the controller may reset shared state. */
  const settleToIdle = useCallback((controller: AbortController) => {
    if (abortRef.current !== controller) {
      return
    }
    abortRef.current = null
    setStatus('idle')
    setSpokenLineIndex(-1)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setSpokenLineIndex(-1)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const start = useCallback(
    (lines: readonly LessonSpeechLine[]) => {
      abortRef.current?.abort()
      abortRef.current = null
      if (lines.length === 0) {
        setStatus('idle')
        setSpokenLineIndex(-1)
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('speaking')
      setSpokenLineIndex(0)

      void (async () => {
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index]
          if (!line || controller.signal.aborted) {
            return
          }
          setSpokenLineIndex(index)
          try {
            const result = await speakLineRef.current(line.text, {
              signal: controller.signal,
            })
            if (!result.completed) {
              settleToIdle(controller)
              return
            }
          } catch (error: unknown) {
            console.warn('Lesson narration stopped on a failing line.', error)
            settleToIdle(controller)
            return
          }
        }
        settleToIdle(controller)
      })()
    },
    [settleToIdle],
  )

  return { status, spokenLineIndex, start, stop }
}
