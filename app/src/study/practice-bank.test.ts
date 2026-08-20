import { describe, expect, it } from 'vitest'
import { buildPracticeBank, itemsForMode } from './practice-bank'

const FIXTURE = `## Vocabulario

- **hello** — hola
- **goodbye** — adiós
- **please** — por favor
- **thanks** — gracias

## Frases modelo

- Hello, please.
- Goodbye and thanks.
`

describe('buildPracticeBank', () => {
  it('assembles vocab, translation, gaps and static transform drills', () => {
    const bank = buildPracticeBank([
      { id: 'fixture-1a', tema: 'besingular', bodyMarkdown: FIXTURE },
    ])
    expect(bank.vocab.map((item) => item.backEn)).toEqual([
      'hello',
      'goodbye',
      'please',
      'thanks',
    ])
    expect(bank.traducir[0]).toMatchObject({ promptEs: 'hola', answerEn: 'hello' })
    expect(bank.completar.length).toBeGreaterThan(0)
    expect(bank.completar[0]?.phrase).toContain('___')
    expect(bank.transformar.some((item) => item.tema === 'besingular')).toBe(true)
    expect(itemsForMode(bank, 'transformar', 'dates')).toEqual([])
    expect(itemsForMode(bank, 'vocab', 'besingular')).toHaveLength(4)
  })

  it('skips a lesson with an invalid tema and keeps the rest', () => {
    const bank = buildPracticeBank([
      { id: 'bad', tema: 'be_singular', bodyMarkdown: FIXTURE },
      { id: 'ok', tema: 'besingular', bodyMarkdown: FIXTURE },
    ])
    expect(bank.vocab.every((item) => item.tema === 'besingular')).toBe(true)
    expect(bank.vocab.length).toBeGreaterThan(0)
  })
})
