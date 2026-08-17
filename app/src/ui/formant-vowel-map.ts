/**
 * Vowel-chart mapping for F1×F2 (issue #76).
 * Classical orientation: high F2 on the left, low F1 at the top.
 */

import type { PracticeTurnRecord } from '../storage/practice-session-types'
import { SIGNAL_CANVAS_BACKGROUND } from './utterance-signal-canvas'

export const VOWEL_MAP_F1_MIN_HZ = 200
export const VOWEL_MAP_F1_MAX_HZ = 1000
export const VOWEL_MAP_F2_MIN_HZ = 700
export const VOWEL_MAP_F2_MAX_HZ = 2600
export const VOWEL_MAP_HISTORY_LIMIT = 8

export interface FormantMapPoint {
  readonly f1InHertz: number
  readonly f2InHertz: number
}

export interface FormantMapHistoryPoint extends FormantMapPoint {
  readonly id: string
}

export interface FormantMapCanvasSize {
  readonly width: number
  readonly height: number
}

export const VOWEL_MAP_PADDING = {
  left: 36,
  right: 10,
  top: 12,
  bottom: 22,
} as const

export function formantTripleToMapPoint(
  formants: { readonly f1InHertz: number | null; readonly f2InHertz: number | null } | null,
): FormantMapPoint | null {
  if (!formants || formants.f1InHertz === null || formants.f2InHertz === null) {
    return null
  }
  if (!(formants.f1InHertz > 0) || !(formants.f2InHertz > 0)) {
    return null
  }
  return { f1InHertz: formants.f1InHertz, f2InHertz: formants.f2InHertz }
}

export function mapFormantHzToCanvasPoint(
  point: { readonly f1InHertz: number | null; readonly f2InHertz: number | null },
  canvas: FormantMapCanvasSize,
  padding = VOWEL_MAP_PADDING,
): { x: number; y: number } | null {
  const f1 = point.f1InHertz
  const f2 = point.f2InHertz
  if (f1 === null || f2 === null || !(f1 > 0) || !(f2 > 0)) {
    return null
  }
  const innerWidth = Math.max(1, canvas.width - padding.left - padding.right)
  const innerHeight = Math.max(1, canvas.height - padding.top - padding.bottom)
  const f2Span = VOWEL_MAP_F2_MAX_HZ - VOWEL_MAP_F2_MIN_HZ
  const f1Span = VOWEL_MAP_F1_MAX_HZ - VOWEL_MAP_F1_MIN_HZ
  const f2Unit = clamp01((f2 - VOWEL_MAP_F2_MIN_HZ) / f2Span)
  const f1Unit = clamp01((f1 - VOWEL_MAP_F1_MIN_HZ) / f1Span)
  return {
    x: padding.left + (1 - f2Unit) * innerWidth,
    y: padding.top + f1Unit * innerHeight,
  }
}

export function collectFormantMapHistory(
  turns: readonly PracticeTurnRecord[],
  options?: { readonly limit?: number },
): FormantMapHistoryPoint[] {
  const limit = options?.limit ?? VOWEL_MAP_HISTORY_LIMIT
  const collected: FormantMapHistoryPoint[] = []
  const newestFirst = [...turns].sort((left, right) =>
    right.createdAtIso.localeCompare(left.createdAtIso),
  )
  for (const record of newestFirst) {
    if (collected.length >= limit) {
      break
    }
    const f1 = record.formantF1InHertz
    const f2 = record.formantF2InHertz
    if (f1 === null || f2 === null || !(f1 > 0) || !(f2 > 0)) {
      continue
    }
    collected.push({ id: record.id, f1InHertz: f1, f2InHertz: f2 })
  }
  return collected
}

export function drawFormantVowelMapOnCanvas(
  canvas: HTMLCanvasElement,
  options: {
    readonly current: FormantMapPoint | null
    readonly history: readonly FormantMapPoint[]
  },
): void {
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  const size = { width: canvas.width, height: canvas.height }
  context.fillStyle = SIGNAL_CANVAS_BACKGROUND
  context.fillRect(0, 0, size.width, size.height)
  drawGrid(context, size)
  for (const historyPoint of options.history) {
    const mapped = mapFormantHzToCanvasPoint(historyPoint, size)
    if (!mapped) {
      continue
    }
    context.fillStyle = '#7f8c72'
    context.beginPath()
    context.arc(mapped.x, mapped.y, 3.5, 0, Math.PI * 2)
    context.fill()
  }
  if (options.current) {
    const mapped = mapFormantHzToCanvasPoint(options.current, size)
    if (mapped) {
      context.fillStyle = '#e8c36a'
      context.beginPath()
      context.arc(mapped.x, mapped.y, 5.5, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = '#f4efe4'
      context.lineWidth = 1.2
      context.stroke()
    }
  }
}

function drawGrid(context: CanvasRenderingContext2D, size: FormantMapCanvasSize): void {
  const pad = VOWEL_MAP_PADDING
  context.strokeStyle = '#3d4d40'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(pad.left, pad.top)
  context.lineTo(pad.left, size.height - pad.bottom)
  context.lineTo(size.width - pad.right, size.height - pad.bottom)
  context.stroke()
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}
