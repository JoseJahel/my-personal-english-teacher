import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomeScreenProps } from './HomeScreen'
import {
  MOCK_RESTAURANT_GRAMMAR_EN,
  MOCK_RESTAURANT_TRANSCRIPT_EN,
  MOCK_RESTAURANT_TUTOR_REPLY_EN,
  createMockHomeSessionPorts,
} from './mock-home-session-ports'
import { useHomeScreenSession } from './use-home-screen-session'

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for mock practice turn.')
    }
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 15)
      })
    })
  }
}

describe('useHomeScreenSession with injected mocks', () => {
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      createBuffer() {
        return { copyToChannel() {}, length: 1 }
      }
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {
            queueMicrotask(() => {
              this.onended?.()
            })
          },
          stop() {},
          onended: null as (() => void) | null,
        }
      }
      resume() {
        return Promise.resolve()
      }
      close() {
        return Promise.resolve()
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    root = null
    vi.unstubAllGlobals()
  })

  it('advances chat through a restaurant turn in under 1 s without transformers', async () => {
    const startedAt = Date.now()
    const probe: { current: HomeScreenProps | null } = { current: null }
    const ports = createMockHomeSessionPorts()

    function Probe() {
      probe.current = useHomeScreenSession(ports)
      return null
    }

    const host = document.createElement('div')
    root = createRoot(host)
    await act(async () => {
      root?.render(<Probe />)
    })

    expect(probe.current).not.toBeNull()
    await act(async () => {
      probe.current?.onStartMicrophone()
    })
    await waitFor(() => probe.current?.isListening === true)

    await act(async () => {
      probe.current?.onStopMicrophone()
    })
    await waitFor(() =>
      Boolean(
        probe.current?.chatMessages.some(
          (message) =>
            message.role === 'user' && message.text.includes('glass of water'),
        ),
      ),
    )
    await waitFor(() =>
      Boolean(
        probe.current?.chatMessages.some(
          (message) => message.role === 'tutor' && /water/i.test(message.text),
        ),
      ),
    )
    await waitFor(() => probe.current?.correctedGrammarText === MOCK_RESTAURANT_GRAMMAR_EN)

    const session = probe.current
    if (!session) {
      throw new Error('Home session probe did not mount.')
    }
    expect(session.transcribedText).toBe(MOCK_RESTAURANT_TRANSCRIPT_EN)
    expect(session.correctedGrammarText).toBe(MOCK_RESTAURANT_GRAMMAR_EN)
    expect(session.pronunciationScore0to100).toBeNull()
    expect(session.pronunciationStatusMessage).toMatch(/Repetir/)
    await waitFor(() =>
      Boolean(
        probe.current?.chatMessages.some(
          (message) =>
            message.kind === 'user-utterance' &&
            message.signalCard?.kind === 'deferred-to-drill',
        ),
      ),
    )
    const userTurn = probe.current?.chatMessages.find(
      (message) => message.kind === 'user-utterance',
    )
    expect(userTurn?.signalCard).toMatchObject({
      kind: 'deferred-to-drill',
      score0to100: null,
    })
    expect(userTurn?.signalCard).not.toHaveProperty('samples')
    expect(Date.now() - startedAt).toBeLessThan(1000)
    expect(MOCK_RESTAURANT_TUTOR_REPLY_EN).toMatch(/drink/)
  })
})
