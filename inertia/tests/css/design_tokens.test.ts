import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const appCss = projectFile('inertia/css/app.css')
const tailwindCss = projectFile('inertia/css/tailwind.config.css')
const inertiaLayout = projectFile('resources/views/inertia_layout.edge')

function blockFor(selector: string) {
  const selectorStart = appCss.indexOf(`${selector} {`)

  if (selectorStart === -1) throw new Error(`CSS block not found: ${selector}`)

  const openingBrace = appCss.indexOf('{', selectorStart)

  if (openingBrace === -1) throw new Error(`CSS block not found: ${selector}`)

  const bodyStart = openingBrace + 1
  let depth = 1

  for (let index = bodyStart; index < appCss.length; index += 1) {
    if (appCss[index] === '{') depth += 1
    if (appCss[index] === '}') depth -= 1
    if (depth === 0) return appCss.slice(bodyStart, index)
  }

  throw new Error(`CSS block not found: ${selector}`)
}

function hslToken(block: string, token: string): [number, number, number] {
  const value = block.match(new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`))

  if (!value) throw new Error(`HSL token not found: ${token}`)

  return [Number(value[1]), Number(value[2]), Number(value[3])]
}

function hslToRgb([hue, saturation, lightness]: [number, number, number]) {
  const saturationRatio = saturation / 100
  const lightnessRatio = lightness / 100
  const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = lightnessRatio - chroma / 2
  const channels =
    hue < 60
      ? [chroma, secondary, 0]
      : hue < 120
        ? [secondary, chroma, 0]
        : hue < 180
          ? [0, chroma, secondary]
          : hue < 240
            ? [0, secondary, chroma]
            : hue < 300
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]

  return channels.map((channel) => channel + match)
}

function relativeLuminance(hsl: [number, number, number]) {
  const [red, green, blue] = hslToRgb(hsl).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first: [number, number, number], second: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))

  return (lighter + 0.05) / (darker + 0.05)
}

describe('flat foundation token contract', () => {
  it('fails clearly when a requested CSS selector is missing', () => {
    expect(() => blockFor('.missing-foundation-selector')).toThrowError(
      'CSS block not found: .missing-foundation-selector'
    )
  })

  it.each([
    [':root', 'primary'],
    [':root', 'cta'],
    [':root', 'destructive'],
    [':root', 'success'],
    [':root', 'warning'],
    [':root', 'info'],
    ['.dark', 'primary'],
    ['.dark', 'cta'],
    ['.dark', 'destructive'],
    ['.dark', 'success'],
    ['.dark', 'warning'],
    ['.dark', 'info'],
  ])('%s %s foreground meets WCAG AA for normal text', (selector, token) => {
    const block = blockFor(selector)

    expect(
      contrastRatio(hslToken(block, token), hslToken(block, `${token}-foreground`))
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    [':root', 'background', 'foreground'],
    [':root', 'card', 'card-foreground'],
    ['.dark', 'background', 'foreground'],
    ['.dark', 'card', 'card-foreground'],
  ])('%s %s/%s base pair meets WCAG AA', (selector, background, foreground) => {
    const block = blockFor(selector)

    expect(
      contrastRatio(hslToken(block, background), hslToken(block, foreground))
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    [':root', 'cta-accent', 'cta-foreground'],
    [':root', 'cta-soft', 'cta-accent'],
    ['.dark', 'cta-accent', 'cta-foreground'],
    ['.dark', 'cta-soft', 'cta-accent'],
  ])('%s %s/%s CTA interaction pair meets WCAG AA', (selector, background, foreground) => {
    const block = blockFor(selector)

    expect(
      contrastRatio(hslToken(block, background), hslToken(block, foreground))
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    [':root', 'background'],
    [':root', 'card'],
    ['.dark', 'background'],
    ['.dark', 'card'],
  ])('%s input boundary has 3:1 contrast against %s', (selector, surface) => {
    const block = blockFor(selector)

    expect(
      contrastRatio(hslToken(block, 'input'), hslToken(block, surface))
    ).toBeGreaterThanOrEqual(3)
  })

  it.each([
    [':root', 'background'],
    [':root', 'card'],
    ['.dark', 'background'],
    ['.dark', 'card'],
  ])('%s keeps decorative borders quieter than controls on %s', (selector, surface) => {
    const block = blockFor(selector)
    const surfaceColor = hslToken(block, surface)

    expect(contrastRatio(hslToken(block, 'border'), surfaceColor)).toBeLessThan(3)
    expect(contrastRatio(hslToken(block, 'input'), surfaceColor)).toBeGreaterThan(
      contrastRatio(hslToken(block, 'border'), surfaceColor)
    )
  })

  it('exposes one HSL-based Tailwind foundation for color, radius and elevation', () => {
    expect(`${appCss}\n${tailwindCss}`).not.toContain('oklch(')
    expect(tailwindCss).toContain('@theme inline')
    expect(tailwindCss).toContain('--font-sans:')
    expect(tailwindCss).not.toMatch(/--text-(?:caption|body|title|display)/)
    expect(tailwindCss).not.toContain('--spacing-control')
    expect(tailwindCss).toContain('--radius-lg: var(--radius)')
    expect(tailwindCss).toContain('--shadow-overlay: var(--elevation-overlay)')
    expect(tailwindCss).toContain('@custom-variant dark')
    expect(appCss).toContain('@utility app-container')
  })

  it('keeps the browser chrome and loaded font aligned with the product brand', () => {
    expect(inertiaLayout).toContain('<meta name="theme-color" content="#13467c" />')
    expect(inertiaLayout).toContain('instrument-sans:400,500,600,700')
    expect(appCss).toContain('font-family: var(--font-sans)')
  })

  it.each([
    'icon-gradient-primary',
    'tech-gradient-primary',
    'floating-card-1',
    'bg-grid-white',
    'text-gradient',
    'backdrop-blur-2xl',
    'bg-grid-pattern',
  ])('does not restore the unused %s utility', (utility) => {
    expect(appCss).not.toContain(`.${utility}`)
  })
})
