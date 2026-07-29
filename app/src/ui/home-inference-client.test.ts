import { describe, expect, it } from 'vitest'
import { tutorGenerationStatusFromResult } from './home-inference-client'

describe('tutorGenerationStatusFromResult', () => {
  it('reports done-generated when the LLM reply was used', () => {
    expect(tutorGenerationStatusFromResult(false)).toBe('done-generated')
  })

  it('reports done-fallback when the scenario line was used', () => {
    expect(tutorGenerationStatusFromResult(true)).toBe('done-fallback')
  })
})
