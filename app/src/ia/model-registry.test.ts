import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  asrModelCandidates,
  DEFAULT_ASR_CANDIDATE_ID,
  modelRegistry,
  resolveActiveAsrCandidateId,
} from './model-registry'
// Test-only cross-layer import: verifies the ui/ copy map stays in sync with
// the ia/ candidate ids. model-registry.ts itself never imports from ui/ —
// ia does not depend on ui in production code, only this test does.
import { homeScreenInterfaceTexts } from '../ui/interface-texts'

describe('asrModelCandidates', () => {
  it('registers the four evaluated candidates with a main revision', () => {
    expect(Object.keys(asrModelCandidates).sort()).toEqual(
      ['base-en', 'distil-small-en', 'small-en', 'tiny-en'].sort(),
    )
    expect(asrModelCandidates['tiny-en'].modelId).toBe('Xenova/whisper-tiny.en')
    expect(asrModelCandidates['base-en'].modelId).toBe('Xenova/whisper-base.en')
    expect(asrModelCandidates['distil-small-en'].modelId).toBe('onnx-community/distil-small.en')
    expect(asrModelCandidates['small-en'].modelId).toBe('Xenova/whisper-small.en')
    for (const candidate of Object.values(asrModelCandidates)) {
      expect(candidate.revision).toBe('main')
      expect(candidate.approxDownloadMb).toBeGreaterThan(0)
    }
  })
})

describe('asrCandidateDisplayNames (ui/interface-texts)', () => {
  it('covers exactly the four ASR candidate ids with non-empty Spanish copy', () => {
    const { asrCandidateDisplayNames } = homeScreenInterfaceTexts
    expect(Object.keys(asrCandidateDisplayNames).sort()).toEqual(
      Object.keys(asrModelCandidates).sort(),
    )
    for (const displayName of Object.values(asrCandidateDisplayNames)) {
      expect(displayName.length).toBeGreaterThan(0)
    }
  })
})

describe('DEFAULT_ASR_CANDIDATE_ID', () => {
  it('is small-en, chosen by the 2026-07-29 benchmark (best WER, 3.4s on WebGPU)', () => {
    expect(DEFAULT_ASR_CANDIDATE_ID).toBe('small-en')
  })
})

describe('modelRegistry.automaticSpeechRecognition', () => {
  it('derives from the default ASR candidate so existing consumers do not break', () => {
    expect(modelRegistry.automaticSpeechRecognition.huggingFaceModelId).toBe(
      'Xenova/whisper-small.en',
    )
    expect(modelRegistry.automaticSpeechRecognition.huggingFaceModelId).toBe(
      asrModelCandidates[DEFAULT_ASR_CANDIDATE_ID].modelId,
    )
    expect(modelRegistry.automaticSpeechRecognition.revision).toBe(
      asrModelCandidates[DEFAULT_ASR_CANDIDATE_ID].revision,
    )
  })
})

describe('resolveActiveAsrCandidateId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to the default candidate when VITE_ASR_MODEL is unset', () => {
    vi.stubEnv('VITE_ASR_MODEL', '')
    expect(resolveActiveAsrCandidateId()).toBe('small-en')
    expect(resolveActiveAsrCandidateId()).toBe(DEFAULT_ASR_CANDIDATE_ID)
  })

  it('honors a valid override', () => {
    vi.stubEnv('VITE_ASR_MODEL', 'small-en')
    expect(resolveActiveAsrCandidateId()).toBe('small-en')
  })

  it('ignores an invalid override and falls back to the default', () => {
    vi.stubEnv('VITE_ASR_MODEL', 'medium-en')
    expect(resolveActiveAsrCandidateId()).toBe(DEFAULT_ASR_CANDIDATE_ID)
  })
})
