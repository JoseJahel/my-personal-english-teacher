import { describe, expect, it } from 'vitest'
import {
  convertIntegerToEnglishWords,
  normalizeEnglishTextForSpeech,
} from './speech-text-normalization'

describe('convertIntegerToEnglishWords', () => {
  it('converts small numbers', () => {
    expect(convertIntegerToEnglishWords(0)).toBe('zero')
    expect(convertIntegerToEnglishWords(7)).toBe('seven')
    expect(convertIntegerToEnglishWords(12)).toBe('twelve')
    expect(convertIntegerToEnglishWords(19)).toBe('nineteen')
  })

  it('converts tens and compound numbers with a hyphen', () => {
    expect(convertIntegerToEnglishWords(20)).toBe('twenty')
    expect(convertIntegerToEnglishWords(30)).toBe('thirty')
    expect(convertIntegerToEnglishWords(22)).toBe('twenty-two')
    expect(convertIntegerToEnglishWords(99)).toBe('ninety-nine')
  })

  it('converts hundreds', () => {
    expect(convertIntegerToEnglishWords(100)).toBe('one hundred')
    expect(convertIntegerToEnglishWords(120)).toBe('one hundred twenty')
    expect(convertIntegerToEnglishWords(999)).toBe('nine hundred ninety-nine')
  })

  it('returns null outside the documented 0-999 range', () => {
    expect(convertIntegerToEnglishWords(1000)).toBeNull()
    expect(convertIntegerToEnglishWords(-1)).toBeNull()
    expect(convertIntegerToEnglishWords(3.5)).toBeNull()
  })
})

describe('normalizeEnglishTextForSpeech', () => {
  it('expands a simple standalone integer', () => {
    expect(normalizeEnglishTextForSpeech('Gate 12 is ready')).toBe('Gate twelve is ready')
  })

  it('expands a dollar price', () => {
    expect(normalizeEnglishTextForSpeech('That will be $5')).toBe('That will be five dollars')
  })

  it('expands a dollar price with cents', () => {
    expect(normalizeEnglishTextForSpeech('Total: $5.50')).toBe(
      'Total: five dollars and fifty cents',
    )
  })

  it('expands a single-letter + digits code', () => {
    expect(normalizeEnglishTextForSpeech('Your gate is B12')).toBe('Your gate is B twelve')
  })

  it('expands a clock time with minutes', () => {
    expect(normalizeEnglishTextForSpeech('Boarding starts at 3:30 p.m.')).toBe(
      'Boarding starts at three thirty p m',
    )
  })

  it("expands a clock time on the hour as o'clock", () => {
    expect(normalizeEnglishTextForSpeech('The flight leaves at 9:00am')).toBe(
      "The flight leaves at nine o'clock a m",
    )
  })

  it('combines multiple patterns in the same sentence', () => {
    expect(normalizeEnglishTextForSpeech('Gate B12 boards at 3:30 p.m., ticket is $12')).toBe(
      'Gate B twelve boards at three thirty p m, ticket is twelve dollars',
    )
  })

  it('leaves text with no numbers unchanged', () => {
    expect(normalizeEnglishTextForSpeech('Hello, how can I help you today?')).toBe(
      'Hello, how can I help you today?',
    )
  })

  it('leaves numbers outside the documented range unchanged', () => {
    expect(normalizeEnglishTextForSpeech('Flight AA1234 is delayed')).toBe(
      'Flight AA1234 is delayed',
    )
  })
})
