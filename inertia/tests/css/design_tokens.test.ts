import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
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

  it('keeps overlays flat', () => {
    for (const component of ['dialog', 'sheet', 'popover', 'dropdown-menu', 'select', 'tooltip']) {
      const source = projectFile(`inertia/components/ui/${component}.tsx`)
      expect(source).not.toMatch(/backdrop-filter|backdrop-blur|shadow-(?:md|lg|xl|2xl)|gradient/)
      expect(source).toContain('shadow-overlay')
    }
  })

  it('keeps every canonical color in sRGB', () => {
    for (const selector of [':root', '.dark']) {
      const block = blockFor(selector)
      for (const match of block.matchAll(/--([\w-]+):\s*(oklch\([^;]+\));/g)) {
        const token = match[1]
        const color = colorToken(block, token)
        for (const channel of linearRgb(color)) {
          expect(channel, `${selector}/${token}`).toBeGreaterThanOrEqual(-0.00001)
          expect(channel, `${selector}/${token}`).toBeLessThanOrEqual(1.00001)
        }
      }
      expect(
        contrastRatio(colorToken(block, 'surface-context'), colorToken(block, 'context-foreground'))
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('preserves the brand while separating the single action color from the chrome and from low-chroma surfaces', () => {
    const block = blockFor(':root')
    for (const [token, hex] of [
      ['background', '#f8f5ef'],
      ['card', '#ffffff'],
      ['popover', '#ffffff'],
      ['foreground', '#151319'],
      ['primary', '#5e39ed'],
      ['cta', '#5e39ed'],
      ['primary-soft', '#e8e0ff'],
      ['chrome', '#2c145c'],
      ['muted', '#ede8df'],
    ])
      expect(hexColor(colorToken(block, token))).toBe(hex)
    // The brand has one action color: conversion keeps its role and shares the violet, in
    // both themes; what the action stands apart from is the structural chrome.
    for (const selector of [':root', '.dark']) {
      const theme = blockFor(selector)
      for (const role of ['', '-hover', '-foreground', '-soft', '-accent']) {
        expect(colorToken(theme, `cta${role}`)).toEqual(colorToken(theme, `primary${role}`))
      }
      expect(colorToken(theme, 'primary')[0] - colorToken(theme, 'chrome')[0]).toBeGreaterThan(0.2)
    }
    expect(hexColor(colorToken(blockFor('.dark'), 'primary'))).toBe('#b49dff')
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

  it('separates neutral roles from each other and anchors subtle fills against the paper', () => {
    const block = blockFor(':root')
    // Neutral fills stay quiet and share the warm hue of the off-white paper.
    const paperHue = colorToken(block, 'surface-base')[2]
    for (const role of ['content-absent', 'temporal-emphasis', 'status-neutral']) {
      const [, c, h] = colorToken(block, role)
      expect(c).toBeLessThanOrEqual(0.02)
      expect(Math.abs(h - paperHue)).toBeLessThanOrEqual(10)
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
      // Muted in light; in dark muted sits below the card and neutral status keeps the raised surface.
      expect(colorToken(block, 'status-neutral')).toEqual(
        colorToken(block, selector === ':root' ? 'muted' : 'surface-raised')
      )
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
    // An idle choice reserves no blank slot for its check: the label stays centred.
    expect(choiceStyles).toMatch(/& \.choice-marker \{\s*display: none;/)
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

  it('lets the server-rendered page title come before the generic fallback', () => {
    // Browsers and crawlers read the first <title>; the page's own must win before hydration.
    expect(inertiaLayout.indexOf('@inertiaHead()')).toBeGreaterThan(-1)
    expect(inertiaLayout.indexOf('<title inertia>')).toBeGreaterThan(
      inertiaLayout.indexOf('@inertiaHead()')
    )
  })

  it('keeps the browser chrome and loaded font aligned with the product brand', () => {
    expect(inertiaLayout).toContain('<meta name="theme-color" content="#2c145c" />')
    expect(inertiaLayout).toContain('plus-jakarta-sans:400,500,600,700')
    expect(inertiaLayout).not.toContain('instrument-sans')
    expect(tailwindCss.match(/--font-sans:\s*([^;]+);/)?.[1].trim()).toMatch(/^'Plus Jakarta Sans'/)
    expect(appCss).toContain('font-family: var(--font-sans)')
    // The page-loading bar is navigation feedback: the `primary` role, never `cta`.
    expect(projectFile('inertia/app/app.tsx')).toContain("progress: { color: 'var(--primary)' }")
  })

  it.each(['verify_email_html', 'password_reset_html'])(
    'sends the %s email in the brand violet with a pill action',
    (template) => {
      const email = projectFile(`resources/views/emails/${template}.edge`)
      expect(email).toContain('background: #5e39ed')
      expect(email).not.toMatch(/#13467c|Instrument Sans/)
      expect(email).toContain('border-radius: 999px')
      expect(email).toContain('border-radius: 20px')
      expect(email).not.toMatch(/#2563eb|#f4f4f5|#71717a/)
    }
  )

  it('loads the display face up to its heaviest weight and exposes it apart from the text face', () => {
    // Fredoka stops at 700: an 800 would be drawn by the browser, not by the face.
    expect(inertiaLayout).toContain('fredoka:600,700')
    const display = tailwindCss.match(/--font-display:\s*([^;]+);/)?.[1] ?? ''
    expect(display.trim().startsWith("'Fredoka', 'Plus Jakarta Sans'")).toBe(true)
    expect(display).toContain('ui-sans-serif')
    expect(tailwindCss).toContain('--radius-card: 1.25rem')
    expect(tailwindCss).toContain('--color-border-subtle: var(--border-subtle)')
    expect(tailwindCss).toContain('--color-chrome: var(--chrome)')
  })

  it('keeps the display face within its weights and away from tabular numbers', () => {
    // Fredoka stops at 700 and has no tabular figures: prices, counters and dates use the text face.
    const offenders = readdirSync(resolve(process.cwd(), 'inertia'), { recursive: true })
      .map(String)
      .filter((path) => path.endsWith('.tsx') && !path.startsWith('tests'))
      .flatMap((path) =>
        projectFile(join('inertia', path))
          .split('\n')
          .filter((line) => /\bfont-display\b/.test(line))
          .filter((line) => /\b(?:font-extrabold|font-black|tabular-nums)\b/.test(line))
          .map((line) => `${path}: ${line.trim()}`)
      )
    expect(offenders).toEqual([])
  })

  it.each([':root', '.dark'])(
    '%s reads every state badge and the conversion action: strong text on its own fill',
    (selector) => {
      const block = blockFor(selector)
      for (const [fill, text] of [
        ['success-soft', 'success-accent'],
        ['warning-soft', 'warning-accent'],
        ['info-soft', 'info-accent'],
        ['cta-soft', 'cta-accent'],
        ['primary-soft', 'primary-accent'],
        ['muted', 'muted-foreground'],
        ['cta', 'cta-foreground'],
        ['primary', 'primary-foreground'],
      ]) {
        expect(
          contrastRatio(colorToken(block, fill), colorToken(block, text)),
          `${text}/${fill}`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  )

  it.each([':root', '.dark'])(
    '%s keeps the authenticated chrome readable and its active item unmistakable',
    (selector) => {
      const block = blockFor(selector)
      for (const [fill, text] of [
        ['chrome', 'chrome-foreground'],
        ['chrome', 'chrome-muted'],
        ['chrome-hover', 'chrome-foreground'],
        ['chrome-hover', 'chrome-muted'],
        ['chrome-active', 'chrome-active-foreground'],
      ]) {
        expect(
          contrastRatio(colorToken(block, fill), colorToken(block, text)),
          `${text}/${fill}`
        ).toBeGreaterThanOrEqual(4.5)
      }
      expect(
        contrastRatio(colorToken(block, 'chrome-active'), colorToken(block, 'chrome'))
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrastRatio(colorToken(block, 'chrome'), colorToken(block, 'background'))
      ).toBeGreaterThanOrEqual(1.15)
    }
  )

  it.each([':root', '.dark'])(
    '%s keeps the card outline decorative: visible, lighter than an interactive boundary',
    (selector) => {
      const block = blockFor(selector)
      for (const surface of ['background', 'card']) {
        const subtle = contrastRatio(colorToken(block, 'border-subtle'), colorToken(block, surface))
        expect(subtle, `border-subtle/${surface}`).toBeGreaterThanOrEqual(1.1)
        expect(subtle).toBeLessThan(
          contrastRatio(colorToken(block, 'border'), colorToken(block, surface))
        )
      }
    }
  )

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
