import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrollBehavior } from '~/lib/motion'

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scrollBehavior', () => {
  it('scrolls smoothly by default', () => {
    prefersReducedMotion(false)
    expect(scrollBehavior()).toBe('smooth')
  })

  it('jumps instead of gliding when the visitor asks for reduced motion', () => {
    prefersReducedMotion(true)
    expect(scrollBehavior()).toBe('auto')
  })
})
