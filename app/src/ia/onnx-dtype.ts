/**
 * Pick ONNX weight precision per device.
 * WebGPU + q8 has produced token garbage / infinite loops in this project;
 * use full precision on GPU and quantized weights on WASM.
 */

import type { OnnxInferenceDevice } from './resolve-inference-device'

export type OnnxInferenceDtype = 'fp32' | 'q8'

export function onnxDtypeForDevice(device: OnnxInferenceDevice): OnnxInferenceDtype {
  return device === 'webgpu' ? 'fp32' : 'q8'
}
