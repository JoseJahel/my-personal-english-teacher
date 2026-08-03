import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveAsrCandidateIdForMessage } from './inference-worker'
import { DEFAULT_ASR_CANDIDATE_ID } from './model-registry'

describe('resolveAsrCandidateIdForMessage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps the existing contract: no candidate + no override = the default', () => {
    vi.stubEnv('VITE_ASR_MODEL', '')
    expect(resolveAsrCandidateIdForMessage({})).toBe(DEFAULT_ASR_CANDIDATE_ID)
  })

  it('honors an explicit candidate from a benchmark request', () => {
    vi.stubEnv('VITE_ASR_MODEL', '')
    expect(resolveAsrCandidateIdForMessage({ asrCandidateId: 'small-en' })).toBe('small-en')
  })

  it('falls back to the active env-resolved candidate when the message omits it', () => {
    vi.stubEnv('VITE_ASR_MODEL', 'base-en')
    expect(resolveAsrCandidateIdForMessage({})).toBe('base-en')
  })
})
