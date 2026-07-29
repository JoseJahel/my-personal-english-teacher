/**
 * Pick a single ONNX Runtime device before loading weights so we do not
 * download/init for WebGPU and then retry the whole pipeline on WASM.
 *
 * Default: **auto-detect**. Decision from the 2026-07-29 benchmark on the
 * reference machine: whisper-small.en (see model-registry.ts DEFAULT_ASR_
 * CANDIDATE_ID) is the new ASR default, and it only meets the latency bar on
 * WebGPU (3.4 s/utterance fp32) — on WASM it is 11 s/utterance, not viable.
 * So with no override we probe for a healthy WebGPU adapter and use it when
 * present, falling back to WASM otherwise (dtype stays fp32-only on WebGPU
 * via onnx-dtype.ts, unchanged). The worker's WebGPU-load-failure → WASM
 * retry (inference-worker.ts) remains the safety net for adapters that lie
 * about capability.
 *
 * Set `VITE_INFERENCE_DEVICE=wasm` to force WASM (e.g. known-bad adapter) or
 * `VITE_INFERENCE_DEVICE=webgpu` to force the WebGPU probe explicitly; either
 * override wins over auto-detection.
 */

import type { ModelRegistryKey } from './model-registry'

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

/** Resolves 'webgpu' only when navigator.gpu exists and yields a real adapter. */
async function detectWebGpuAdapter(): Promise<OnnxInferenceDevice> {
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

/**
 * Forced override wins (`wasm` short-circuits, `webgpu` still probes for a
 * real adapter). No override (or an invalid value) auto-detects WebGPU.
 */
export async function resolvePreferredOnnxDevice(): Promise<OnnxInferenceDevice> {
  const override = readDeviceOverride()
  if (override === 'wasm') {
    return 'wasm'
  }

  return detectWebGpuAdapter()
}

/**
 * Per-pipeline device policy. Only ASR is validated on WebGPU (2026-07-29
 * bench, see model-registry.ts DEFAULT_ASR_CANDIDATE_ID); grammar T5,
 * TTS/vocoder, and SmolLM2 are validated on WASM and stay there regardless
 * of the worker's shared WebGPU auto-detect result. This also stops a
 * WebGPU failure in one of those pipelines from contaminating the shared
 * device pin that ASR reads (see inference-worker.ts getPreferredDevice).
 */
export function deviceForModelKey(
  modelKey: ModelRegistryKey,
  preferredAsrDevice: OnnxInferenceDevice,
): OnnxInferenceDevice {
  return modelKey === 'automaticSpeechRecognition' ? preferredAsrDevice : 'wasm'
}
