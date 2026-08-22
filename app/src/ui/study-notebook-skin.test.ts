// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Guard against a relapse into the old "notebook" skin: the Estudio stylesheet
// must be expressed with the Atelier tokens declared in src/index.css.
const css = readFileSync(new URL('./study-notebook.css', import.meta.url), 'utf-8')

const FORBIDDEN_HEX = [
  '#1a1a1a',
  '#2c4a6e',
  '#fdfcf7',
  '#8a8578',
  '#e3e0d4',
  '#2e7d32',
  '#e8f5e9',
  '#eef3f8',
  '#c5d4e4',
  '#fff7f9',
  '#fff0f4',
  '#c43d5c',
  '#d45f7a',
  '#c04462',
  '#9a304c',
  '#cc5570',
  '#b03a58',
  '#8a2a44',
  '#f7f5ef',
]

describe('study notebook skin', () => {
  it('does not declare the old notebook palette (non-regression guard)', () => {
    expect(css).not.toMatch(/--nb-/)
    for (const forbidden of FORBIDDEN_HEX) {
      expect(css.toLowerCase()).not.toContain(forbidden)
    }
  })

  it('has no hex color outside the Atelier tokens, except the deliberate pure-white surface', () => {
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    // `#fff` is the one literal the identity spec keeps outside the token
    // set: the pure-white "artefacto" card surface and text over a solid
    // accent (primary button, completed numeral) — see IDENTIDAD-VISUAL.md.
    expect(new Set(hexes.map((hex) => hex.toLowerCase()))).toEqual(new Set(['#fff']))
  })

  it('has no gradients, grid paper or hard offset shadows', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient/)
    expect(css).not.toMatch(/\d+px \d+px 0 rgba\(26/)
  })

  it('uses Atelier tokens and fonts', () => {
    expect(css).toMatch(/var\(--color-sage-600\)/)
    expect(css).toMatch(/var\(--color-ink-900\)/)
    expect(css).toMatch(/var\(--color-atelier-elev\)/)
    expect(css).toMatch(/font-family:\s*var\(--font-sans\)/)
    expect(css).toMatch(/font-family:\s*var\(--font-serif\)/)
    expect(css).not.toMatch(/'Instrument Serif'/)
  })

  it('scopes the sheet title heading to a direct child, so it cannot outrank the layered Tailwind utilities styling LessonMarkdown headings nested inside .reader-body', () => {
    expect(css).not.toMatch(/\.study-notebook \.sheet h2\s*\{/)
    expect(css).toMatch(/\.study-notebook \.sheet > h2\s*\{/)
  })
})
