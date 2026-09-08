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

type Oklch = [number, number, number]

function colorToken(block: string, token: string): Oklch {
  const value = block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]
  if (!value) throw new Error(`Color token not found: ${token}`)
  const alias = value.match(/^var\(--([\w-]+)\)$/)
  if (alias) return colorToken(block, alias[1])
  const channels = value.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/)
  if (!channels) throw new Error(`OKLCH token expected: ${token}`)
  return [Number(channels[1]), Number(channels[2]), Number(channels[3])]
}

// OKLab -> linear sRGB (CSS Color 4 / Ottosson, D65). Do not clamp before gamut tests.
function linearRgb([lightness, chroma, hue]: Oklch) {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function relativeLuminance(color: Oklch) {
  const [red, green, blue] = linearRgb(color)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function hexColor(color: Oklch) {
  return (
    '#' +
    linearRgb(color)
      .map((channel) => {
        const srgb = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
        return Math.round(Math.max(0, Math.min(1, srgb)) * 255)
          .toString(16)
          .padStart(2, '0')
      })
      .join('')
  )
}

function contrastRatio(first: [number, number, number], second: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))

  return (lighter + 0.05) / (darker + 0.05)
}

describe('flat foundation token contract', () => {
  const surfaces = [
    'surface-context',
    'background',
    'card',
    'popover',
    'muted',
    'secondary',
    'primary-soft',
    'cta-soft',
    'success-soft',
    'warning-soft',
    'info-soft',
    'destructive-soft',
  ]

  it.each([':root', '.dark'])(
    '%s keeps all normal content and supporting text readable on every foundation surface',
    (selector) => {
      const block = blockFor(selector)
      for (const surface of surfaces) {
        for (const foreground of ['foreground', 'muted-foreground']) {
          expect(
            contrastRatio(colorToken(block, foreground), colorToken(block, surface)),
            `${foreground}/${surface}`
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
      for (const surface of ['background', 'card', 'popover']) {
        for (const foreground of [
          'primary',
          'primary-accent',
          'cta-accent',
          'success-accent',
          'warning-accent',
          'info-accent',
          'destructive-accent',
        ]) {
          expect(
            contrastRatio(colorToken(block, foreground), colorToken(block, surface)),
            `${foreground}/${surface}`
          ).toBeGreaterThanOrEqual(4.5)
        }
        for (const boundary of ['input', 'ring']) {
          expect(
            contrastRatio(colorToken(block, boundary), colorToken(block, surface))
          ).toBeGreaterThanOrEqual(3)
        }
      }
      for (const [fill, text] of [
        ['primary-hover', 'primary-foreground'],
        ['destructive-hover', 'destructive-foreground'],
        ['cta-hover', 'cta-foreground'],
        ['secondary', 'secondary-foreground'],
        ['accent', 'accent-foreground'],
        ['popover', 'popover-foreground'],
      ]) {
        expect(
          contrastRatio(colorToken(block, fill), colorToken(block, text)),
          `${fill}/${text}`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  )

  it('defines three opaque elevation steps with distinct purpose and perceptible dark separation', () => {
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      for (const [role, surface] of [
        ['background', 'surface-base'],
        ['card', 'surface-raised'],
        ['popover', 'surface-overlay'],
      ]) {
        expect(block).toContain(`--${role}: var(--${surface});`)
      }
      expect(block).toContain('--elevation-raised: none;')
      expect(block).toContain('--elevation-overlay: 0 2px 0 var(--border);')
    }
    const block = blockFor('.dark')
    const steps = ['surface-base', 'surface-raised', 'surface-overlay'].map((token) =>
      colorToken(block, token)
    )
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i][0] - steps[i - 1][0]).toBeGreaterThanOrEqual(0.05)
      expect(steps[i][1]).toBeGreaterThan(steps[i - 1][1])
      expect(contrastRatio(steps[i], steps[i - 1])).toBeGreaterThanOrEqual(1.15)
    }
    expect(blockFor(':root')).toContain('--radius: 0.75rem;')
    expect(tailwindCss).toContain('--radius-md: calc(var(--radius) - 4px)')
    expect(tailwindCss).toContain('--radius-sm: calc(var(--radius) - 8px)')
  })

  it('keeps overlays flat and the app handoff values synchronized', () => {
    for (const component of ['dialog', 'sheet', 'popover', 'dropdown-menu', 'select', 'tooltip']) {
      const source = projectFile(`inertia/components/ui/${component}.tsx`)
      expect(source).not.toMatch(/backdrop-filter|backdrop-blur|shadow-(?:md|lg|xl|2xl)|gradient/)
      expect(source).toContain('shadow-overlay')
    }
    const doc = projectFile('docs/design/catalog_tokens.md')
    expect(doc).toContain('hover `--cta-hover`')
    expect(doc).not.toContain('hover `--cta-accent`')
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      for (const token of [
        'surface-base',
        'surface-raised',
        'surface-overlay',
        'foreground',
        'muted-foreground',
        'primary',
        'cta',
        'success-soft',
        'warning-soft',
        'info-soft',
      ]) {
        const [l, c, h] = colorToken(block, token)
        expect(doc).toContain(`oklch(${l} ${c} ${h})`)
      }
    }
  })

  it('keeps every canonical color in sRGB and documents both exact and mobile values', () => {
    const doc = projectFile('docs/design/catalog_tokens.md')
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      for (const match of block.matchAll(/--([\w-]+):\s*(oklch\([^;]+\));/g)) {
        const token = match[1]
        const color = colorToken(block, token)
        for (const channel of linearRgb(color)) {
          expect(channel, `${selector}/${token}`).toBeGreaterThanOrEqual(-0.00001)
          expect(channel, `${selector}/${token}`).toBeLessThanOrEqual(1.00001)
        }
        const row = doc.split('\n').find((line) => line.startsWith(`| \`--${token}\``))
        expect(row, `${selector}/${token}`).toContain(match[2])
        expect(row).toContain(hexColor(color))
      }
      expect(
        contrastRatio(colorToken(block, 'surface-context'), colorToken(block, 'context-foreground'))
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('preserves the brand while separating a luminous conversion accent from low-chroma surfaces', () => {
    const block = blockFor(':root')
    for (const [token, hex] of [
      ['background', '#f3f5f7'],
      ['card', '#ffffff'],
      ['popover', '#ffffff'],
      ['primary', '#13467c'],
      ['cta', '#e2661a'],
      ['muted', '#e8ecf1'],
    ])
      expect(hexColor(colorToken(block, token))).toBe(hex)
    expect(colorToken(block, 'cta')[0] - colorToken(block, 'primary')[0]).toBeGreaterThan(0.25)
    expect(colorToken(block, 'surface-base')[1]).toBeLessThan(0.015)
    expect(colorToken(block, 'surface-context')).toEqual(colorToken(block, 'background'))
    expect(colorToken(block, 'cta')[1]).toBeGreaterThan(colorToken(block, 'surface-context')[1] * 4)
  })

  it('keeps a single page paper instead of restoring editorial background bands', () => {
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      expect(colorToken(block, 'surface-context')).toEqual(colorToken(block, 'background'))
      expect(colorToken(block, 'context-foreground')).toEqual(colorToken(block, 'foreground'))
    }
    for (const path of [
      'inertia/pages/home.tsx',
      'inertia/components/public/public_header.tsx',
      'inertia/components/public/public_footer.tsx',
      'inertia/components/catalog/catalog_shell.tsx',
      'inertia/components/consumer/consumer_shell.tsx',
    ]) {
      const source = projectFile(path)
      const bands = [...source.matchAll(/<(?:section|header|footer)\b[^>]*className="([^"]+)"/g)]
      expect(bands.length, path).toBeGreaterThan(0)
      for (const band of bands) {
        const fills = band[1].split(/\s+/).filter((name) => /(?:^|:)bg-/.test(name))
        expect(
          fills.every((name) => name === 'bg-background'),
          path
        ).toBe(true)
      }
    }
  })

  it('separates cool roles from each other and anchors subtle fills against the paper', () => {
    const block = blockFor(':root')
    for (const role of ['content-absent', 'temporal-emphasis', 'status-neutral']) {
      const [, c, h] = colorToken(block, role)
      expect(c).toBeLessThanOrEqual(0.01)
      expect(h).toBeGreaterThanOrEqual(245)
      expect(h).toBeLessThanOrEqual(265)
    }
    for (const edge of ['content-absent-border', 'temporal-emphasis-border']) {
      expect(
        contrastRatio(colorToken(block, edge), colorToken(block, 'background'))
      ).toBeGreaterThanOrEqual(3)
    }
    expect(projectFile('inertia/components/catalog/catalog_image_fallback.tsx')).toContain(
      'border-dashed'
    )
    const hours = projectFile('inertia/components/catalog/catalog_weekly_hours.tsx')
    expect(hours).toContain('border-l-4')
    expect(hours).toContain('Hoje')
  })

  it('keeps absence, temporal emphasis and neutral operational status perceptually distinct', () => {
    function lab([l, c, h]: Oklch) {
      return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
    }
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      const roles = ['content-absent', 'temporal-emphasis', 'status-neutral']
      for (let i = 0; i < roles.length; i++) {
        const role = roles[i]
        expect(
          contrastRatio(colorToken(block, role), colorToken(block, `${role}-foreground`))
        ).toBeGreaterThanOrEqual(4.5)
        for (let j = i + 1; j < roles.length; j++) {
          const a = lab(colorToken(block, role))
          const b = lab(colorToken(block, roles[j]))
          // Project separation floor, not a WCAG threshold or a claim of universal perception.
          expect(Math.hypot(...a.map((channel, k) => channel - b[k]))).toBeGreaterThan(0.04)
        }
      }
      expect(colorToken(block, 'status-neutral')).toEqual(colorToken(block, 'muted'))
      for (const [bg, fg] of [
        ['choice-background', 'choice-foreground'],
        ['choice-selected', 'choice-selected-foreground'],
        ['action-secondary', 'action-secondary-foreground'],
      ]) {
        expect(contrastRatio(colorToken(block, bg), colorToken(block, fg))).toBeGreaterThanOrEqual(
          4.5
        )
      }
      for (const bg of ['choice-background', 'choice-selected']) {
        expect(
          contrastRatio(colorToken(block, bg), colorToken(block, 'choice-border'))
        ).toBeGreaterThanOrEqual(3)
      }
      expect(
        contrastRatio(
          colorToken(block, 'temporal-emphasis'),
          colorToken(block, 'temporal-emphasis-border')
        )
      ).toBeGreaterThanOrEqual(3)
    }
    const choiceStyles = appCss.slice(appCss.indexOf('@utility choice-control'))
    expect(choiceStyles).toContain('[data-state=')
    expect(choiceStyles).toContain('[data-selected=')
    expect(choiceStyles).toContain('.choice-marker')
    expect(choiceStyles).not.toMatch(/underline|shadow/)
  })

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
      contrastRatio(colorToken(block, token), colorToken(block, `${token}-foreground`))
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
      contrastRatio(colorToken(block, background), colorToken(block, foreground))
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    [':root', 'cta-hover', 'cta-foreground'],
    [':root', 'cta-soft', 'cta-accent'],
    ['.dark', 'cta-hover', 'cta-foreground'],
    ['.dark', 'cta-soft', 'cta-accent'],
    [':root', 'success-soft', 'success-accent'],
    [':root', 'warning-soft', 'warning-accent'],
    [':root', 'info-soft', 'info-accent'],
    [':root', 'muted', 'muted-foreground'],
    ['.dark', 'success-soft', 'success-accent'],
    ['.dark', 'warning-soft', 'warning-accent'],
    ['.dark', 'info-soft', 'info-accent'],
    ['.dark', 'muted', 'muted-foreground'],
  ])('%s %s/%s interaction or status pair meets WCAG AA', (selector, background, foreground) => {
    const block = blockFor(selector)

    expect(
      contrastRatio(colorToken(block, background), colorToken(block, foreground))
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
      contrastRatio(colorToken(block, 'input'), colorToken(block, surface))
    ).toBeGreaterThanOrEqual(3)
  })

  it.each([
    [':root', 'background'],
    [':root', 'card'],
    ['.dark', 'background'],
    ['.dark', 'card'],
  ])('%s keeps decorative borders quieter than controls on %s', (selector, surface) => {
    const block = blockFor(selector)
    const surfaceColor = colorToken(block, surface)

    expect(contrastRatio(colorToken(block, 'border'), surfaceColor)).toBeLessThan(3)
    expect(contrastRatio(colorToken(block, 'input'), surfaceColor)).toBeGreaterThan(
      contrastRatio(colorToken(block, 'border'), surfaceColor)
    )
  })

  it('exposes complete OKLCH colors to Tailwind without legacy HSL wrappers', () => {
    expect(appCss).toContain('oklch(')
    expect(`${appCss}\n${tailwindCss}`).not.toContain('hsl(var(')
    expect(tailwindCss).toContain('--color-primary: var(--primary)')
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
