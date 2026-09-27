import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseManualText } from '~/components/manual/manual_text'
import { MANUAL_MEDIA_PATH, MANUAL_PDF_PATH } from '~/config/help'
import { MANUAL_CHAPTERS, manualAnchors, type ManualBlock } from '~/content/manual'
import { MANUAL_MEDIA } from '~/content/manual_media'

const publicDir = join(import.meta.dirname, '../../../public')
const mediaDir = join(publicDir, MANUAL_MEDIA_PATH)

const sections = MANUAL_CHAPTERS.flatMap((chapter) => chapter.sections)
const blocks: ManualBlock[] = sections.flatMap((section) => [...section.blocks])
const images = blocks.flatMap((block) => (block.kind === 'figures' ? [...block.images] : []))

/** Every piece of text the reader sees, marks included. */
const texts: string[] = [
  ...MANUAL_CHAPTERS.flatMap((chapter) => [chapter.title, chapter.summary, chapter.audience]),
  ...sections.map((section) => section.title),
  ...blocks.flatMap((block) => {
    switch (block.kind) {
      case 'paragraph':
        return [block.text]
      case 'steps':
      case 'list':
        return [...block.items]
      case 'note':
        return [block.title, block.text]
      case 'figures':
        return block.images.flatMap((image) => [image.alt, image.caption ?? ''])
    }
  }),
]

/** Site pages the manual may link to. */
const SITE_PATHS = new Set(['/app', '/termos', '/privacidade', '/cidades'])

describe('manual content', () => {
  it('gives every chapter and section a unique, stable anchor', () => {
    const anchors = manualAnchors()
    expect(new Set(anchors).size).toBe(anchors.length)
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z]+(-[a-z0-9]+)*$/)
    // The chapters the brief and the contextual help rely on.
    expect(MANUAL_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      'primeiros-passos',
      'visitante',
      'consumidor',
      'parceiro',
      'administracao',
      'app',
      'duvidas',
    ])
    expect(anchors).toContain('visitante-explorar')
  })

  it('keeps every section filled', () => {
    for (const section of sections) expect(section.blocks.length, section.id).toBeGreaterThan(0)
  })

  it('links only to its own anchors and to pages of the site', () => {
    const anchors = new Set(manualAnchors())
    const links = texts.flatMap((text) =>
      parseManualText(text).flatMap((part) => (part.kind === 'link' ? [part.href] : []))
    )

    expect(links.length).toBeGreaterThan(10)
    for (const href of links) {
      if (href.startsWith('#')) expect(anchors.has(href.slice(1)), href).toBe(true)
      else expect(SITE_PATHS.has(href), href).toBe(true)
    }
  })

  it('shows every screenshot with a file, a size and a description', () => {
    const ids = images.map((image) => image.id)
    expect(new Set(ids).size, 'each screenshot appears once').toBe(ids.length)

    for (const image of images) {
      expect(existsSync(join(publicDir, image.src)), image.src).toBe(true)
      expect(image.src).toMatch(/^\/manual-media\/[a-z0-9-]+\.webp$/)
      expect(image.width).toBeGreaterThan(0)
      expect(image.height).toBeGreaterThan(0)
      expect(image.alt.length, image.id).toBeGreaterThan(40)
    }
  })

  it('ships no screenshot the manual does not use', () => {
    const used = new Set(images.map((image) => image.id))
    const files = readdirSync(mediaDir).filter((file) => file.endsWith('.webp'))

    expect(Object.keys(MANUAL_MEDIA).sort()).toEqual([...used].sort())
    expect(files.map((file) => file.replace(/\.webp$/, '')).sort()).toEqual([...used].sort())
  })

  it('stays light enough to ship with the site', () => {
    const files = readdirSync(mediaDir)
    const imageBytes = files
      .filter((file) => file.endsWith('.webp'))
      .reduce((total, file) => total + statSync(join(mediaDir, file)).size, 0)

    expect(imageBytes).toBeLessThan(6 * 1024 * 1024)
    expect(statSync(join(publicDir, MANUAL_PDF_PATH)).size).toBeLessThan(10 * 1024 * 1024)
  })

  it('never prints an e-mail address or a password', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
      expect(text).not.toMatch(/senha\s*[:=]/i)
    }
  })

  it('warns that the beta runs on demonstration data with simulated payments', () => {
    const all = texts.join('\n')
    expect(all).toMatch(/fictícios/)
    expect(all).toMatch(/simulad/)
  })
})
