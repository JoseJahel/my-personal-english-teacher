import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceForModelKey, resolvePreferredOnnxDevice } from './resolve-inference-device'

function stubGpu(requestAdapter: () => Promise<unknown | null>): void {
  ;(navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown | null> } }).gpu = {
    requestAdapter,
  }
}

function clearGpu(): void {
  delete (navigator as unknown as { gpu?: unknown }).gpu
}

describe('resolvePreferredOnnxDevice', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    clearGpu()
  })

  it('auto-detects wasm when there is no override and navigator.gpu is absent', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', '')
    clearGpu()
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })

  it('auto-detects webgpu when there is no override and an adapter is available', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', '')
    stubGpu(() => Promise.resolve({}))
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('webgpu')
  })

  it('auto-detects wasm when there is no override and requestAdapter resolves null', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', '')
    stubGpu(() => Promise.resolve(null))
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })

  it('resolves webgpu when overridden and an adapter is available', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'webgpu')
    stubGpu(() => Promise.resolve({}))
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('webgpu')
  })

  it('falls back to wasm when overridden but navigator.gpu is absent', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'webgpu')
    clearGpu()
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })

  it('falls back to wasm when overridden but requestAdapter resolves null', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'webgpu')
    stubGpu(() => Promise.resolve(null))
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })

  it('ignores an invalid override and falls back to auto-detection (wasm, no gpu)', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'cuda')
    clearGpu()
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })

  it('the wasm override wins over auto-detection even when gpu is available', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'wasm')
    stubGpu(() => Promise.resolve({}))
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })
})

describe('deviceForModelKey', () => {
  it('routes ASR to the preferred device when it is webgpu', () => {
    expect(deviceForModelKey('automaticSpeechRecognition', 'webgpu')).toBe('webgpu')
  })

  it('routes ASR to the preferred device when it is wasm', () => {
    expect(deviceForModelKey('automaticSpeechRecognition', 'wasm')).toBe('wasm')
  })

  it('pins grammar correction to wasm even when webgpu is preferred', () => {
    expect(deviceForModelKey('grammarCorrection', 'webgpu')).toBe('wasm')
  })

  it('pins text-to-speech to wasm even when webgpu is preferred', () => {
    expect(deviceForModelKey('textToSpeech', 'webgpu')).toBe('wasm')
  })

  it('pins the text-to-speech vocoder to wasm even when webgpu is preferred', () => {
    expect(deviceForModelKey('textToSpeechVocoder', 'webgpu')).toBe('wasm')
  })

  it('pins conversation suggestions (SmolLM2) to wasm even when webgpu is preferred', () => {
    expect(deviceForModelKey('conversationSuggestions', 'webgpu')).toBe('wasm')
  })
})
