/**
 * Pick a single ONNX Runtime device before loading weights so we do not
 * download/init for WebGPU and then retry the whole pipeline on WASM.
 *
 * Default: **WASM**. WebGPU is faster when healthy, but on several student
 * machines it has produced silent garbage transcripts (token loops). Prefer
 * correct English over risky acceleration for the Avance 1 demo.
 *
 * Set `VITE_INFERENCE_DEVICE=webgpu` to opt into GPU when validating hardware.
 */

export type OnnxInferenceDevice = 'webgpu' | 'wasm'

function readDeviceOverride(): OnnxInferenceDevice | null {
  try {
    // Vite injects import.meta.env in the worker bundle as well. Read the
    // property directly (no cast) so Vite/Vitest keep this dynamic in dev/test
    // (Vitest, `vite dev`) instead of freezing it to a transform-time snapshot
    // — see resolve-inference-device.test.ts. Production builds always inline
    // VITE_* vars at build time; this only helps at dev/test time.
    const override = import.meta.env.VITE_INFERENCE_DEVICE
    if (override === 'webgpu' || override === 'wasm') {
      return override
    }
  } catch {
    // ignore
  }
  return null
}

/** Prefer WASM for reliability; WebGPU only via explicit override + adapter. */
export async function resolvePreferredOnnxDevice(): Promise<OnnxInferenceDevice> {
  const override = readDeviceOverride()
  if (override === 'wasm') {
    return 'wasm'
  }

  if (override === 'webgpu') {
    try {
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter: () => Promise<unknown | null> }
        }
      ).gpu
      if (!gpu) {
        return 'wasm'
      }
      const adapter = await gpu.requestAdapter()
      return adapter ? 'webgpu' : 'wasm'
    } catch {
      return 'wasm'
    }
  }

  return 'wasm'
}
