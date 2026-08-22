import { describe, expect, it } from 'vitest'
import {
  buildLessonSpeechScript,
  MAXIMUM_SPOKEN_MODEL_PHRASES,
  MAXIMUM_SPOKEN_VOCABULARY_TERMS,
} from './lesson-speech-script'

// Spanish characters are written as escapes so this file stays pure ASCII.
const SPANISH_LINE = '- \u00bfC\u00f3mo est\u00e1s?'

const LESSON_BODY = [
  '## Objetivo',
  'Saludar y presentarse.',
  '',
  '## Vocabulario',
  '- **hello** - hola',
  '- **holiday / vacation** - vacaciones',
  '',
  '## Frases modelo',
  '- Anna: Hello, my name is Anna.',
  '- Nice to meet you.',
  SPANISH_LINE,
  '',
].join('\n')

describe('buildLessonSpeechScript', () => {
  it('reads model phrases first and vocabulary after', () => {
    const script = buildLessonSpeechScript(LESSON_BODY, 'l01', 'besingular')

    expect(script.map((line) => line.text)).toEqual([
      'Hello, my name is Anna.',
      'Nice to meet you.',
      'hello',
      'holiday',
    ])
    expect(script.map((line) => line.kind)).toEqual(['phrase', 'phrase', 'vocab', 'vocab'])
  })

  it('never queues a Spanish line for an English voice', () => {
    const script = buildLessonSpeechScript(LESSON_BODY, 'l01', 'besingular')

    expect(script.some((line) => /[\u00c0-\u017f\u00bf\u00a1]/.test(line.text))).toBe(false)
  })

  it('speaks only the model phrases when the lesson has no tema', () => {
    const script = buildLessonSpeechScript(LESSON_BODY, 'l01')

    expect(script.every((line) => line.kind === 'phrase')).toBe(true)
    expect(script).toHaveLength(2)
  })

  it('says a term listed in both sections only once', () => {
    const body = [
      '## Vocabulario',
      '- **Good morning** - buenos dias',
      '',
      '## Frases modelo',
      '- good morning',
      '',
    ].join('\n')

    const script = buildLessonSpeechScript(body, 'l02', 'besingular')

    expect(script).toHaveLength(1)
  })

  it('caps the script so a long lesson does not read forever', () => {
    const body = [
      '## Frases modelo',
      ...Array.from({ length: 40 }, (_unused, index) => `- Phrase number ${index}.`),
      '',
    ].join('\n')

    const script = buildLessonSpeechScript(body, 'l03')

    expect(script).toHaveLength(MAXIMUM_SPOKEN_MODEL_PHRASES)
  })

  it('returns an empty script for a lesson with no English content', () => {
    expect(buildLessonSpeechScript('## Objetivo\nSolo texto.', 'l04', 'besingular')).toEqual([])
  })
  it('still reads the vocabulary after a dialogue long enough to fill its own budget', () => {
    const body = [
      '## Vocabulario',
      '- **nationality** - nacionalidad',
      '- **German** - aleman',
      '- **Polish** - polaco',
      '',
      '## Frases modelo',
      ...Array.from({ length: 40 }, (_unused, index) => `- Dialogue line ${index}.`),
      '',
    ].join('\n')

    const script = buildLessonSpeechScript(body, 'l05', 'besingular')
    const vocab = script.filter((line) => line.kind === 'vocab')

    expect(script.filter((line) => line.kind === 'phrase')).toHaveLength(
      MAXIMUM_SPOKEN_MODEL_PHRASES,
    )
    expect(vocab.map((line) => line.text)).toEqual(['nationality', 'German', 'Polish'])
    expect(vocab.length).toBeLessThanOrEqual(MAXIMUM_SPOKEN_VOCABULARY_TERMS)
  })
})
