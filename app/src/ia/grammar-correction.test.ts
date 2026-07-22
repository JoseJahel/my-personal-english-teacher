import { describe, expect, it, vi } from 'vitest'
import {
  buildGrammarCorrectionInput,
  correctEnglishGrammar,
  grammarCorrectionMadeNoChanges,
} from './grammar-correction'
import type { Text2TextGenerationPipeline } from '@huggingface/transformers'

// El pipeline real descarga pesos ONNX de varios MB: nunca se carga en tests
// (ver la convención del proyecto en `ia/README.md`). `vi.mock` reemplaza
// `pipeline` por un doble de prueba antes de que `grammar-correction.ts` lo
// importe, así que `loadGrammarCorrector` nunca toca la red.
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
}))

describe('buildGrammarCorrectionInput', () => {
  it('antepone el prefijo que exige el modelo', () => {
    expect(buildGrammarCorrectionInput('He go to school')).toBe('grammar: He go to school')
  })

  it('recorta espacios sobrantes en los extremos antes de anteponer el prefijo', () => {
    expect(buildGrammarCorrectionInput('  She don`t like it   ')).toBe('grammar: She don`t like it')
  })

  it('devuelve solo el prefijo para una cadena vacía', () => {
    expect(buildGrammarCorrectionInput('')).toBe('grammar: ')
  })

  it('devuelve solo el prefijo para una cadena que es solo espacios', () => {
    expect(buildGrammarCorrectionInput('   ')).toBe('grammar: ')
  })
})

describe('correctEnglishGrammar', () => {
  it('extrae generated_text del primer resultado devuelto por el pipeline', async () => {
    const fakeCorrector = vi
      .fn()
      .mockResolvedValue([
        { generated_text: 'He goes to school.' },
      ]) as unknown as Text2TextGenerationPipeline

    const correctedText = await correctEnglishGrammar(fakeCorrector, 'He go to school')

    expect(correctedText).toBe('He goes to school.')
  })

  it('invoca al pipeline con la entrada prefijada y un límite de tokens razonable', async () => {
    const fakeCorrectorMock = vi.fn().mockResolvedValue([{ generated_text: 'She likes it.' }])
    const fakeCorrector = fakeCorrectorMock as unknown as Text2TextGenerationPipeline

    await correctEnglishGrammar(fakeCorrector, 'She like it')

    expect(fakeCorrectorMock).toHaveBeenCalledWith(
      'grammar: She like it',
      expect.objectContaining({ max_new_tokens: expect.any(Number) }),
    )
  })

  it('devuelve una cadena vacía si el pipeline no devuelve resultados', async () => {
    const fakeCorrector = vi.fn().mockResolvedValue([]) as unknown as Text2TextGenerationPipeline

    const correctedText = await correctEnglishGrammar(fakeCorrector, 'He go to school')

    expect(correctedText).toBe('')
  })
})

describe('grammarCorrectionMadeNoChanges', () => {
  it('devuelve true cuando ambos textos son idénticos', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school.', 'He goes to school.')).toBe(true)
  })

  it('devuelve true cuando solo difieren en mayúsculas/minúsculas', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school.', 'he GOES to School.')).toBe(true)
  })

  it('devuelve true cuando solo difieren en espacios repetidos o en los extremos', () => {
    expect(grammarCorrectionMadeNoChanges('  He   goes to school.', 'He goes to school.')).toBe(
      true,
    )
  })

  it('devuelve true cuando solo difieren en la puntuación final', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school', 'He goes to school.')).toBe(true)
    expect(grammarCorrectionMadeNoChanges('He goes to school?', 'He goes to school!')).toBe(true)
  })

  it('devuelve false cuando el corrector cambió el contenido del texto', () => {
    expect(grammarCorrectionMadeNoChanges('He go to school.', 'He goes to school.')).toBe(false)
  })
})
