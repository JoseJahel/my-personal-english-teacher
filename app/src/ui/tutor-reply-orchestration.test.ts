import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TutorReplyResult } from '../ia/inference-client'
import { resolveTutorReplyWithFallback, TUTOR_REPLY_TIMEOUT_MS } from './tutor-reply-orchestration'

const baseRequestInput = {
  scenarioContextEn: 'Role-play: restaurant waiter.',
  historyTurnsEn: [],
  userUtteranceEn: 'I would like a coffee.',
  fallbackReplyEn: 'Sure, anything else?',
}

describe('resolveTutorReplyWithFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the LLM reply when it resolves in time and is plausible', async () => {
    const llmResult: TutorReplyResult = { tutorReplyText: 'Great choice!', usedFallback: false }
    const generateTutorReply = vi.fn().mockResolvedValue(llmResult)

    const result = await resolveTutorReplyWithFallback({
      generateTutorReply,
      requestInput: baseRequestInput,
    })

    expect(result).toEqual(llmResult)
  })

  it('passes through the worker fallback when the LLM output was implausible', async () => {
    const workerFallback: TutorReplyResult = {
      tutorReplyText: baseRequestInput.fallbackReplyEn,
      usedFallback: true,
    }
    const generateTutorReply = vi.fn().mockResolvedValue(workerFallback)

    const result = await resolveTutorReplyWithFallback({
      generateTutorReply,
      requestInput: baseRequestInput,
    })

    expect(result).toEqual(workerFallback)
  })

  it('falls back to the regex reply when the LLM exceeds the timeout', async () => {
    const generateTutorReply = vi.fn(() => new Promise<TutorReplyResult>(() => {}))

    const pending = resolveTutorReplyWithFallback({
      generateTutorReply,
      requestInput: baseRequestInput,
    })

    await vi.advanceTimersByTimeAsync(TUTOR_REPLY_TIMEOUT_MS)
    const result = await pending

    expect(result).toEqual({
      tutorReplyText: baseRequestInput.fallbackReplyEn,
      usedFallback: true,
    })
  })

  it('falls back to the regex reply when the LLM call rejects', async () => {
    const generateTutorReply = vi.fn().mockRejectedValue(new Error('worker down'))

    const result = await resolveTutorReplyWithFallback({
      generateTutorReply,
      requestInput: baseRequestInput,
    })

    expect(result).toEqual({
      tutorReplyText: baseRequestInput.fallbackReplyEn,
      usedFallback: true,
    })
  })

  it('honors a custom timeout for tests/tuning', async () => {
    const generateTutorReply = vi.fn(() => new Promise<TutorReplyResult>(() => {}))

    const pending = resolveTutorReplyWithFallback({
      generateTutorReply,
      requestInput: baseRequestInput,
      timeoutMs: 2000,
    })

    await vi.advanceTimersByTimeAsync(2000)
    const result = await pending

    expect(result.usedFallback).toBe(true)
  })
})
