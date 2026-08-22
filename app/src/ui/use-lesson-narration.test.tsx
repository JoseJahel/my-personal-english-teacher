import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LessonSpeechLine } from '../study/lesson-speech-script'
import {
  useLessonNarration,
  type SpeakLessonLine,
  type UseLessonNarrationResult,
} from './use-lesson-narration'

const LINES: readonly LessonSpeechLine[] = [
  { id: 'a', text: 'Hello.', kind: 'phrase' },
  { id: 'b', text: 'Nice to meet you.', kind: 'phrase' },
]

interface NarrationView {
  readonly root: ReturnType<typeof createRoot>
  readonly container: HTMLElement
  readonly captured: { current: UseLessonNarrationResult | null }
}

const mountedViews: NarrationView[] = []

function renderNarration(speakLine: SpeakLessonLine): NarrationView {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const captured: { current: UseLessonNarrationResult | null } = { current: null }

  function Harness() {
    captured.current = useLessonNarration({ speakLine })
    return null
  }

  act(() => {
    root.render(<Harness />)
  })
  const view: NarrationView = { root, container, captured }
  mountedViews.push(view)
  return view
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for the lesson narration.')
    }
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
    })
  }
}

describe('useLessonNarration', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    for (const view of mountedViews.splice(0)) {
      act(() => {
        view.root.unmount()
      })
      view.container.remove()
    }
  })

  it('speaks every line in order and then returns to idle', async () => {
    const spoken: string[] = []
    const view = renderNarration(async (text) => {
      spoken.push(text)
      return { completed: true }
    })

    await act(async () => {
      view.captured.current?.start(LINES)
    })
    await waitFor(() => view.captured.current?.status === 'idle')

    expect(spoken).toEqual(['Hello.', 'Nice to meet you.'])
    expect(view.captured.current?.spokenLineIndex).toBe(-1)
  })

  it('reports the line it is on while speaking', async () => {
    const gate: { release: (() => void) | null } = { release: null }
    const view = renderNarration(async () => {
      await new Promise<void>((resolve) => {
        gate.release = resolve
      })
      return { completed: true }
    })

    await act(async () => {
      view.captured.current?.start(LINES)
    })

    expect(view.captured.current?.status).toBe('speaking')
    expect(view.captured.current?.spokenLineIndex).toBe(0)

    await act(async () => {
      view.captured.current?.stop()
      gate.release?.()
    })
  })

  it('stops at the current line when the reader is interrupted', async () => {
    const spoken: string[] = []
    const gate: { release: (() => void) | null } = { release: null }
    const view = renderNarration(async (text, speakOptions) => {
      spoken.push(text)
      await new Promise<void>((resolve) => {
        gate.release = resolve
      })
      return { completed: !speakOptions?.signal?.aborted }
    })

    await act(async () => {
      view.captured.current?.start(LINES)
    })
    await waitFor(() => spoken.length === 1)

    await act(async () => {
      view.captured.current?.stop()
      gate.release?.()
    })

    expect(spoken).toEqual(['Hello.'])
    expect(view.captured.current?.status).toBe('idle')
    expect(view.captured.current?.spokenLineIndex).toBe(-1)
  })

  it('gives up instead of hanging when a line fails to speak', async () => {
    const view = renderNarration(async () => {
      throw new Error('voice unavailable')
    })

    await act(async () => {
      view.captured.current?.start(LINES)
    })
    await waitFor(() => view.captured.current?.status === 'idle')

    expect(view.captured.current?.spokenLineIndex).toBe(-1)
  })

  it('stays idle when the lesson has nothing speakable', async () => {
    const spoken: string[] = []
    const view = renderNarration(async (text) => {
      spoken.push(text)
      return { completed: true }
    })

    await act(async () => {
      view.captured.current?.start([])
    })

    expect(spoken).toEqual([])
    expect(view.captured.current?.status).toBe('idle')
  })
})
