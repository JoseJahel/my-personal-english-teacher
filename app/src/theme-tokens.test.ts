// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cssContent = readFileSync(new URL('./index.css', import.meta.url), 'utf-8')
const themeBlockContent = cssContent.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? ''

// This is a literal freeze-guard against accidental palette edits, not a redundant
// restatement of index.css: CSS custom properties cannot be imported and checked by
// value in TS, so matching the raw text is the only mechanical way to catch drift.
describe('theme tokens (index.css @theme block)', () => {
  it.each([
    ['--color-sage-50', '#f7f6f2'],
    ['--color-sage-100', '#e2ede2'],
    ['--color-sage-200', '#e5e3db'],
    ['--color-sage-300', '#d9e2da'],
    ['--color-sage-400', '#8fbf95'],
    ['--color-sage-600', '#5c8a63'],
    ['--color-sage-700', '#4a7350'],
    ['--color-sage-800', '#3c5c3f'],
    ['--color-sage-900', '#2e3b30'],
    ['--color-sage-950', '#232c26'],
    ['--color-sage-track', '#4a5c4d'],
    ['--color-ink-900', '#3a3a35'],
    ['--color-ink-600', '#5c5c51'],
    ['--color-ink-400', '#8a8a7f'],
    ['--color-blush-500', '#cf7a70'],
    ['--color-blush-600', '#bb6459'],
  ])('defines token %s as %s', (tokenName, hexValue) => {
    const pattern = new RegExp(`${tokenName}:\\s*${hexValue}\\s*;`, 'i')
    expect(themeBlockContent).toMatch(pattern)
  })

  it('has a non-empty @theme block', () => {
    expect(themeBlockContent.trim()).not.toBe('')
  })
})
