import { describe, expect, it } from 'vitest'
import { resolveBilingualSides, resolvePracticeFacing } from './practice-direction'
import type { TraducirPracticeItem, VocabPracticeItem } from './study-types'

const VOCAB: VocabPracticeItem = {
  id: 'v1',
  tema: 'besingular',
  kind: 'vocab',
  frontEs: 'hola',
  backEn: 'hello',
}

const TRADUCIR: TraducirPracticeItem = {
  id: 't1',
  tema: 'besingular',
  kind: 'traducir',
  promptEs: 'hola',
  answerEn: 'hello',
}

describe('resolvePracticeFacing', () => {
  it('returns the fixed direction as facing', () => {
    expect(resolvePracticeFacing('es-en')).toBe('es-en')
    expect(resolvePracticeFacing('en-es')).toBe('en-es')
  })

  it('picks mixed from the injected random draw', () => {
    expect(resolvePracticeFacing('mixed', () => 0.1)).toBe('es-en')
    expect(resolvePracticeFacing('mixed', () => 0.9)).toBe('en-es')
  })
})

describe('resolveBilingualSides', () => {
  it('swaps vocab and traducir pairs for each facing', () => {
    expect(resolveBilingualSides(VOCAB, 'es-en')).toEqual({ stimulus: 'hola', expected: 'hello' })
    expect(resolveBilingualSides(VOCAB, 'en-es')).toEqual({ stimulus: 'hello', expected: 'hola' })
    expect(resolveBilingualSides(TRADUCIR, 'es-en')).toEqual({ stimulus: 'hola', expected: 'hello' })
    expect(resolveBilingualSides(TRADUCIR, 'en-es')).toEqual({ stimulus: 'hello', expected: 'hola' })
  })
})
