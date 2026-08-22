import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LessonMarkdown } from './LessonMarkdown'

describe('LessonMarkdown', () => {
  let host: HTMLDivElement | null = null
  afterEach(() => {
    host?.remove()
    host = null
  })

  function render(source: string) {
    host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<LessonMarkdown source={source} />))
    return host
  }

  it('renders section headings as uppercase labels', () => {
    const el = render('## Qué vas a aprender\n\nTexto.')
    const h2 = el.querySelector('h2')
    expect(h2?.className).toContain('uppercase')
    expect(h2?.className).not.toContain('font-serif')
  })

  it('wraps tables in a rounded bordered container without cell borders', () => {
    const el = render('| A | B |\n|---|---|\n| 1 | 2 |')
    const wrapper = el.querySelector('table')?.parentElement
    expect(wrapper?.className).toContain('rounded-lg')
    expect(el.querySelector('td')?.className).not.toContain('border-sage-200 px-2')
    expect(el.querySelector('th')?.className).toContain('uppercase')
  })
})
