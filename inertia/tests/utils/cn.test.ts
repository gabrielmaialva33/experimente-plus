import { describe, expect, it } from 'vitest'

import { cn as canonicalCn } from '~/lib/utils'
import { cn as legacyCn } from '~/utils/cn'

describe.each([
  ['canonical cn', canonicalCn],
  ['legacy cn', legacyCn],
])('%s Tailwind conflict resolution', (_name, cn) => {
  it('keeps a standard text size alongside a semantic foreground color', () => {
    expect(cn('text-sm', 'text-muted-foreground')).toBe('text-sm text-muted-foreground')
    expect(cn('text-foreground', 'text-xs')).toBe('text-foreground text-xs')
  })

  it('applies predictable last-class-wins semantics to standard sizes', () => {
    expect(cn('h-9', 'h-10')).toBe('h-10')
    expect(cn('min-h-9', 'min-h-11')).toBe('min-h-11')
    expect(cn('size-7', 'size-10')).toBe('size-10')
  })
})
