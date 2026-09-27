import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectFile = (path: string) => resolve(process.cwd(), path)
const read = (path: string) => readFileSync(projectFile(path), 'utf8')

const manifest = JSON.parse(read('public/manifest.webmanifest'))
const layout = read('resources/views/inertia_layout.edge')
const offlinePage = read('public/offline.html')

/** Width, height and whether the PNG carries an alpha channel, from its IHDR chunk. */
function png(path: string) {
  const bytes = readFileSync(projectFile(`public${path}`))
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
  const colorType = bytes[25]
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    alpha: colorType === 4 || colorType === 6,
  }
}

/** Width and height of a WebP file, from its VP8 or VP8X header. */
function webp(path: string) {
  const bytes = readFileSync(projectFile(`public${path}`))
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP')
  const chunk = bytes.subarray(12, 16).toString('latin1')
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 }
  }
  expect(chunk).toBe('VP8 ')
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
}

describe('web app manifest', () => {
  it('describes an installable, standalone Experimente+ in Portuguese', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Experimente+',
      short_name: 'Experimente+',
      lang: 'pt-BR',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    })
    expect(manifest.description).toMatch(/norte do Paraná/)
  })

  it('uses the brand navy and the light canvas, matching the page chrome', () => {
    expect(manifest.theme_color).toBe('#13467c')
    expect(layout).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`)
    // --surface-base in inertia/css/app.css, oklch(0.969 0.003 247.9) in sRGB.
    expect(manifest.background_color).toBe('#f3f5f7')
  })

  it('ships 192 and 512 icons, plus maskable ones, at their declared sizes', () => {
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[]
    for (const [size, purpose] of [
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]) {
      expect(icons).toContainEqual(expect.objectContaining({ sizes: size, purpose }))
    }
    for (const icon of icons) {
      const { width, height } = png(icon.src)
      expect(`${width}x${height}`).toBe(icon.sizes)
    }
    // A maskable icon is cropped to a circle or squircle: it must be opaque to the edge.
    for (const icon of icons.filter(({ purpose }) => purpose === 'maskable')) {
      expect(png(icon.src).alpha).toBe(false)
    }
  })

  it('shows light, data-free screenshots Chrome accepts for its richer install dialog', () => {
    const screenshots = manifest.screenshots as {
      src: string
      sizes: string
      form_factor: string
      label: string
    }[]
    expect(screenshots.map((screenshot) => screenshot.form_factor).sort()).toEqual([
      'narrow',
      'wide',
    ])
    for (const screenshot of screenshots) {
      const { width, height } = webp(screenshot.src)
      expect(`${width}x${height}`).toBe(screenshot.sizes)
      // Chrome ignores a screenshot longer than 2.3 times its short side.
      expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(2.3)
      expect(readFileSync(projectFile(`public${screenshot.src}`)).length).toBeLessThan(100_000)
      expect(screenshot.label).not.toBe('')
    }
  })

  it('offers Explorar and Carteira as shortcuts', () => {
    expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
      '/cidades',
      '/wallet',
    ])
    for (const shortcut of manifest.shortcuts) {
      const [icon] = shortcut.icons
      const { width, height } = png(icon.src)
      expect(`${width}x${height}`).toBe(icon.sizes)
    }
  })
})

describe('page head for installation', () => {
  it('reaches the screen edges so the bars can clear the notch and the home indicator', () => {
    expect(layout).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
    )
    expect(layout).toContain('pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]')
  })

  it('links the manifest and gives iOS its icon, title and status bar', () => {
    expect(layout).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(layout).toContain(
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />'
    )
    expect(layout).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
    expect(layout).toContain('<meta name="mobile-web-app-capable" content="yes" />')
    expect(layout).toContain('<meta name="apple-mobile-web-app-title" content="Experimente+" />')
    // "default" keeps the status bar out of the page, in the theme color.
    expect(layout).toContain(
      '<meta name="apple-mobile-web-app-status-bar-style" content="default" />'
    )
  })

  it('gives iOS an opaque 180 px icon, since it fills transparency with black', () => {
    expect(png('/apple-touch-icon.png')).toEqual({ width: 180, height: 180, alpha: false })
  })

  it('declares the dark chrome color before the navy fallback, since the first match wins', () => {
    const dark = layout.indexOf(
      '<meta name="theme-color" content="#172641" media="(prefers-color-scheme: dark)" />'
    )
    expect(dark).toBeGreaterThan(-1)
    expect(dark).toBeLessThan(layout.indexOf('<meta name="theme-color" content="#13467c" />'))
  })
})

describe('offline page', () => {
  it('says "Sem conexão" in Portuguese and offers to try again', () => {
    expect(offlinePage).toContain('<html lang="pt-BR">')
    expect(offlinePage).toContain('<title>Sem conexão — Experimente+</title>')
    expect(offlinePage).toMatch(/<h1[^>]*>Sem conexão<\/h1>/)
    expect(offlinePage).toContain('Tentar de novo')
    expect(offlinePage).toContain('role="status"')
  })

  it('stands alone, since it answers at whatever address failed to load', () => {
    expect(offlinePage).not.toMatch(/<(?:link|script|img)[^>]+(?:href|src)=/)
    expect(offlinePage).not.toMatch(/url\(/)
  })

  it('follows the light and dark themes, and the one chosen in the app', () => {
    expect(offlinePage).toContain('@media (prefers-color-scheme: dark)')
    expect(offlinePage).toContain(':root.dark')
    expect(offlinePage).toContain("localStorage.getItem('theme')")
    expect(offlinePage).toContain('viewport-fit=cover')
  })
})
