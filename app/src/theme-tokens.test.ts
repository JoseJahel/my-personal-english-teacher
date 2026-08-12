// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cssContent = readFileSync(new URL('./index.css', import.meta.url), 'utf-8')
const themeBlockContent = cssContent.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? ''

// Freeze-guard against accidental Atelier palette edits (issue #81).
// CSS custom properties cannot be imported by value in TS, so we match raw text.
describe('theme tokens (index.css @theme block — Atelier)', () => {
  it.each([
    ['--color-sage-50', '#f4f2ec'],
    ['--color-sage-100', '#e7efe8'],
    ['--color-sage-200', '#e2dfd6'],
    ['--color-sage-300', '#d4d0c4'],
    ['--color-sage-400', '#8fbf95'],
    ['--color-sage-600', '#4a6b50'],
    ['--color-sage-700', '#3d5a42'],
    ['--color-sage-800', '#2c322c'],
    ['--color-sage-900', '#2c322c'],
    ['--color-sage-950', '#1e221e'],
    ['--color-sage-track', '#4a5c4d'],
    ['--color-ink-900', '#2c322c'],
    ['--color-ink-600', '#6a7068'],
    ['--color-ink-400', '#8a9088'],
    ['--color-blush-500', '#c45c48'],
    ['--color-blush-600', '#b04f3c'],
    ['--color-ivory-50', '#f4f2ec'],
    ['--color-atelier-elev', '#fbfaf7'],
    ['--color-atelier-ok', '#3d7a4a'],
  ])('defines token %s as %s', (tokenName, hexValue) => {
    const pattern = new RegExp(`${tokenName}:\\s*${hexValue}\\s*;`, 'i')
    expect(themeBlockContent).toMatch(pattern)
  })

  it('has a non-empty @theme block', () => {
    expect(themeBlockContent.trim()).not.toBe('')
  })
})
