import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePreferredOnnxDevice } from './resolve-inference-device'

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

  it('defaults to wasm when there is no override', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', '')
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

  it('ignores an invalid override and falls back to wasm', async () => {
    vi.stubEnv('VITE_INFERENCE_DEVICE', 'cuda')
    await expect(resolvePreferredOnnxDevice()).resolves.toBe('wasm')
  })
})
