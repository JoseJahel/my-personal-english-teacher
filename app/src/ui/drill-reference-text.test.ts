import { describe, expect, it } from 'vitest'
import { resolveDrillReferenceText } from './drill-reference-text'

describe('resolveDrillReferenceText', () => {
  it('marks a normal tutor line as available and trims it', () => {
    const result = resolveDrillReferenceText('  Welcome! What would you like to order?  ')
    expect(result.isAvailable).toBe(true)
    expect(result.referenceTextEn).toBe('Welcome! What would you like to order?')
  })

  it('marks an empty string as unavailable', () => {
    const result = resolveDrillReferenceText('')
    expect(result.isAvailable).toBe(false)
    expect(result.referenceTextEn).toBe('')
  })

  it('marks a whitespace-only string as unavailable', () => {
    const result = resolveDrillReferenceText('   \n\t  ')
    expect(result.isAvailable).toBe(false)
    expect(result.referenceTextEn).toBe('')
  })

  it('keeps punctuation and casing from the tutor line untouched', () => {
    const result = resolveDrillReferenceText('Certainly — coffee. Would you like a main dish?')
    expect(result.referenceTextEn).toBe('Certainly — coffee. Would you like a main dish?')
  })
})
