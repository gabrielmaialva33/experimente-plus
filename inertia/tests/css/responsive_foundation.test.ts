import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(resolve(process.cwd(), 'inertia/css/app.css'), 'utf8')

/** The body of the first block whose prelude starts with `prelude`, braces balanced. */
function blockAfter(source: string, prelude: string) {
  const start = source.indexOf(prelude)
  if (start === -1) throw new Error(`CSS block not found: ${prelude}`)
  const opening = source.indexOf('{', start + prelude.length - 1)
  let depth = 0
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(opening + 1, index)
  }
  throw new Error(`CSS block not closed: ${prelude}`)
}

/** Whether `offset` sits inside an `@layer` block of the stylesheet. */
function insideLayer(source: string, offset: number) {
  let depth = 0
  const layerDepths: number[] = []
  for (let index = 0; index < offset; index += 1) {
    if (source.startsWith('@layer', index)) layerDepths.push(depth)
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (layerDepths.at(-1) === depth) layerDepths.pop()
    }
  }
  return layerDepths.length > 0
}

describe('responsive foundation', () => {
  it('keeps every text field at 16px on phones and touch screens, so iOS never zooms in', () => {
    const prelude = '@media (max-width: 47.999rem), (pointer: coarse) {'
    const block = blockAfter(appCss, prelude)

    // Unlayered: a layered `text-sm` utility cannot win over it.
    expect(insideLayer(appCss, appCss.indexOf(prelude))).toBe(false)
    expect(block).toMatch(/input:not\(/)
    expect(block).toMatch(/\bselect,/)
    expect(block).toMatch(/\btextarea\s*\{/)
    expect(block).toContain('font-size: max(1rem, 16px);')
    // Controls without text keep their own size.
    for (const type of ['checkbox', 'radio', 'range', 'file', 'hidden']) {
      expect(block).toContain(`[type='${type}']`)
    }
  })

  it('breaks a long partner word inside its card, lowering the card min-content width', () => {
    const textBlocks = blockAfter(
      appCss,
      '  :where(h1, h2, h3, h4, p, dd, dt, figcaption, blockquote) {'
    )
    // `break-word` wraps the line but still sizes a grid or flex card to the whole word.
    expect(textBlocks).toContain('overflow-wrap: anywhere;')

    // Items and cells hold pills and links: inherited, `anywhere` squeezed them letter by
    // letter in a tight row, so they keep `break-word`.
    expect(blockAfter(appCss, '  :where(li, td, th) {')).toContain('overflow-wrap: break-word;')
  })

  it("contains a native select's label, so a long option cannot widen a WebKit page", () => {
    expect(blockAfter(appCss, '  select {')).toContain('contain: paint;')
  })

  it('answers a touch in a 44 px square around a small control without resizing it', () => {
    const utility = blockAfter(appCss, '@utility touch-hitbox {')

    expect(utility).toContain('position: relative;')
    const hitArea = blockAfter(utility, '&::after {')
    expect(hitArea).toContain('width: max(100%, 2.75rem);')
    expect(hitArea).toContain('height: max(100%, 2.75rem);')
    expect(hitArea).toContain('transform: translate(-50%, -50%);')
  })

  it('keeps a faint brand tap flash, the only touch feedback where hover never applies', () => {
    expect(blockAfter(appCss, '  html {')).toContain(
      '-webkit-tap-highlight-color: color-mix(in oklab, var(--primary) 16%, transparent);'
    )
  })
})
