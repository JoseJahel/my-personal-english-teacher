import { Fragment, type ReactNode } from 'react'
import type { MarkdownBlock, MarkdownInline } from '../study/parse-lesson-markdown'
import { parseMarkdownBlocks } from '../study/parse-lesson-markdown'

const HEADING_CLASS = {
  1: 'm-0 text-[1.05rem] font-bold tracking-tight text-ink-900',
  2: 'm-0 border-b border-sage-200 pb-1.5 pt-2 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-600',
  3: 'm-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-ink-600',
} as const

export function LessonMarkdown(props: { readonly source: string }) {
  const blocks = parseMarkdownBlocks(props.source)
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-900">
      {blocks.map((block, index) => (
        <LessonBlock key={index} block={block} />
      ))}
    </div>
  )
}

function LessonBlock(props: { readonly block: MarkdownBlock }) {
  const block = props.block
  if (block.type === 'heading') {
    const children = renderInlines(block.children)
    if (block.level === 1) {
      return <h1 className={HEADING_CLASS[1]}>{children}</h1>
    }
    if (block.level === 2) {
      return <h2 className={HEADING_CLASS[2]}>{children}</h2>
    }
    return <h3 className={HEADING_CLASS[3]}>{children}</h3>
  }
  if (block.type === 'paragraph') {
    return <p className="m-0">{renderInlines(block.children)}</p>
  }
  if (block.type === 'hr') {
    return <hr className="border-sage-200" />
  }
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-sage-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {block.headers.map((cell, index) => (
                <th
                  key={index}
                  className="border-b border-sage-200 bg-sage-50 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-600"
                >
                  {renderInlines(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={rowIndex === 0 ? 'px-3 py-2' : 'border-t border-sage-200 px-3 py-2'}
                  >
                    {renderInlines(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const ListTag = block.ordered ? 'ol' : 'ul'
  const listClass = block.ordered ? 'list-decimal' : 'list-disc'
  return (
    <ListTag className={`${listClass} m-0 space-y-1 pl-5`}>
      {block.items.map((item, index) => (
        <li key={index}>{renderInlines(item)}</li>
      ))}
    </ListTag>
  )
}

function renderInlines(nodes: readonly MarkdownInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return <Fragment key={index}>{node.value}</Fragment>
    }
    if (node.type === 'strong') {
      return (
        <strong key={index} className="font-semibold">
          {renderInlines(node.children)}
        </strong>
      )
    }
    return (
      <em key={index}>{renderInlines(node.children)}</em>
    )
  })
}
