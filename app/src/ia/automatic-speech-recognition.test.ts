import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveAsrModelDescriptor } from './automatic-speech-recognition'
import { asrModelCandidates } from './model-registry'

describe('resolveAsrModelDescriptor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to the small-en candidate when no candidate or override is given', () => {
    vi.stubEnv('VITE_ASR_MODEL', '')
    expect(resolveAsrModelDescriptor()).toEqual(asrModelCandidates['small-en'])
  })

  it('uses the explicit candidate id when given, ignoring the env override', () => {
    vi.stubEnv('VITE_ASR_MODEL', 'small-en')
    expect(resolveAsrModelDescriptor('base-en')).toEqual(asrModelCandidates['base-en'])
  })

  it('falls back to the env override when no explicit candidate is given', () => {
    vi.stubEnv('VITE_ASR_MODEL', 'distil-small-en')
    expect(resolveAsrModelDescriptor()).toEqual(asrModelCandidates['distil-small-en'])
  })
})
