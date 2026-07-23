import { describe, expect, it, vi } from 'vitest'
import {
  buildGrammarCorrectionInput,
  correctEnglishGrammar,
  grammarCorrectionMadeNoChanges,
} from './grammar-correction'
import type { Text2TextGenerationPipeline } from '@huggingface/transformers'

// Never load real ONNX weights in unit tests.
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
}))

describe('buildGrammarCorrectionInput', () => {
  it('prepends the prefix required by the model', () => {
    expect(buildGrammarCorrectionInput('He go to school')).toBe('grammar: He go to school')
  })

  it('trims surrounding whitespace before prepending the prefix', () => {
    expect(buildGrammarCorrectionInput('  She don`t like it   ')).toBe('grammar: She don`t like it')
  })

  it('returns only the prefix for an empty string', () => {
    expect(buildGrammarCorrectionInput('')).toBe('grammar: ')
  })

  it('returns only the prefix for a whitespace-only string', () => {
    expect(buildGrammarCorrectionInput('   ')).toBe('grammar: ')
  })
})

describe('correctEnglishGrammar', () => {
  it('extracts generated_text from the first pipeline result', async () => {
    const fakeCorrector = vi
      .fn()
      .mockResolvedValue([{ generated_text: 'He goes to school.' }]) as unknown as Text2TextGenerationPipeline

    const correctedText = await correctEnglishGrammar(fakeCorrector, 'He go to school')

    expect(correctedText).toBe('He goes to school.')
  })

  it('calls the pipeline with a prefixed input and a token limit', async () => {
    const fakeCorrectorMock = vi.fn().mockResolvedValue([{ generated_text: 'She likes it.' }])
    const fakeCorrector = fakeCorrectorMock as unknown as Text2TextGenerationPipeline

    await correctEnglishGrammar(fakeCorrector, 'She like it')

    expect(fakeCorrectorMock).toHaveBeenCalledWith(
      'grammar: She like it',
      expect.objectContaining({ max_new_tokens: expect.any(Number) }),
    )
  })

  it('returns an empty string when the pipeline yields no results', async () => {
    const fakeCorrector = vi.fn().mockResolvedValue([]) as unknown as Text2TextGenerationPipeline

    const correctedText = await correctEnglishGrammar(fakeCorrector, 'He go to school')

    expect(correctedText).toBe('')
  })
})

describe('grammarCorrectionMadeNoChanges', () => {
  it('returns true when both texts are identical', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school.', 'He goes to school.')).toBe(true)
  })

  it('returns true when texts differ only by case', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school.', 'he GOES to School.')).toBe(true)
  })

  it('returns true when texts differ only by spacing', () => {
    expect(grammarCorrectionMadeNoChanges('  He   goes to school.', 'He goes to school.')).toBe(
      true,
    )
  })

  it('returns true when texts differ only by trailing punctuation', () => {
    expect(grammarCorrectionMadeNoChanges('He goes to school', 'He goes to school.')).toBe(true)
    expect(grammarCorrectionMadeNoChanges('He goes to school?', 'He goes to school!')).toBe(true)
  })

  it('returns false when the corrector changed the content', () => {
    expect(grammarCorrectionMadeNoChanges('He go to school.', 'He goes to school.')).toBe(false)
  })
})
