import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseManualText } from '~/components/manual/manual_text'
import { MANUAL_MEDIA_PATH, MANUAL_PDF_PATH } from '~/config/help'
import {
  MANUAL_CHAPTERS,
  MANUAL_START_CARDS,
  manualAnchors,
  type ManualBlock,
  type ManualSection,
} from '~/content/manual'
import { MANUAL_MEDIA } from '~/content/manual_media'

const publicDir = join(import.meta.dirname, '../../../public')
const mediaDir = join(publicDir, MANUAL_MEDIA_PATH)

const sections: ManualSection[] = MANUAL_CHAPTERS.flatMap((chapter) => [...chapter.sections])
const blocks: ManualBlock[] = sections.flatMap((section) => [...section.blocks])
const images = blocks.flatMap((block) => (block.kind === 'figures' ? [...block.images] : []))

function blockTexts(block: ManualBlock): string[] {
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
    case 'table':
      return [block.caption, ...block.columns, ...block.rows.flat()]
  }
}

/** Every piece of text the reader sees, marks included. */
const texts: string[] = [
  ...MANUAL_CHAPTERS.flatMap((chapter) => [
    chapter.title,
    chapter.summary,
    chapter.audience,
    chapter.profiles,
  ]),
  ...MANUAL_START_CARDS.flatMap((card) => [card.title, card.text]),
  ...sections.flatMap((section) => [
    section.title,
    section.intro,
    ...(section.needs ?? []),
    section.result ?? '',
    ...(section.troubleshooting ?? []),
  ]),
  ...blocks.flatMap(blockTexts),
]

/** Site pages the manual may link to. */
const SITE_PATHS = new Set(['/app', '/termos', '/privacidade', '/cidades'])

/** The anchors the mobile app opens from its "Ajuda" entries (src/help/manual.ts there). */
const APP_HELP_ANCHORS = [
  'app-instalar',
  'app-explorar',
  'app-mapa',
  'app-lugar',
  'app-novidades',
  'app-concierge',
  'app-conta',
  'app-favoritos',
  'app-comprar',
  'app-carteira',
  'app-avaliar',
  'app-validar',
  'app-problemas',
]

/**
 * App tasks whose screens need a wallet with benefits or a partner account on the phone:
 * the homologation has no safe way to create them there, and the screens match the site's,
 * so the task points to the site's pictures.
 */
const SHOWN_ELSEWHERE: Record<string, string> = {
  'app-carteira': 'consumidor-apresentar',
  'app-validar': 'parceiro-validar',
}

describe('manual content', () => {
  it('gives every chapter and section a unique, stable anchor', () => {
    const anchors = manualAnchors()
    expect(new Set(anchors).size).toBe(anchors.length)
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z]+(-[a-z0-9]+)*$/)
    expect(MANUAL_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      'primeiros-passos',
      'perfis',
      'resgate',
      'visitante',
      'consumidor',
      'parceiro',
      'administracao',
      'app-celular',
      'duvidas',
    ])
    expect(anchors).toContain('visitante-explorar')
  })

  it('never uses an anchor the page already gives to another element', () => {
    // `app` is the root element Inertia renders the page into: a link to it goes nowhere.
    for (const reserved of ['app', 'conteudo-principal', 'indice', 'sumario-celular']) {
      expect(manualAnchors(), reserved).not.toContain(reserved)
    }
  })

  it('tells the QR redemption from both sides, with every refusal explained', () => {
    const chapter = MANUAL_CHAPTERS.find((item) => item.id === 'resgate')!
    expect(chapter.sections.map((section) => section.id)).toEqual([
      'resgate-como-funciona',
      'consumidor-apresentar',
      'parceiro-validar',
      'resgate-recusas',
    ])
    const refusals = chapter.sections.at(-1)!.blocks.find((block) => block.kind === 'table')
    expect(refusals?.kind === 'table' && refusals.rows.map((row) => row[0])).toEqual([
      'O QR expirou (mais de 5 minutos)',
      'O QR já foi usado',
      'O benefício acabou, ou está fora do dia ou do horário',
      'A oferta ou a edição está pausada',
      'O benefício é de outro negócio',
      'Conta sem permissão para validar',
    ])
  })

  it('explains how a business gives, changes and accepts access to its team', () => {
    const anchors = new Set(manualAnchors())
    for (const anchor of [
      'parceiro-equipe-convidar',
      'parceiro-equipe-gerenciar',
      'parceiro-aceitar-convite',
    ]) {
      expect(anchors.has(anchor), anchor).toBe(true)
    }
    const all = texts.join('\n')
    expect(all).toContain('Para quem só valida no balcão, escolha **Editor**')
    expect(all).not.toMatch(/Ainda não há uma tela para convidar/)
  })

  it('keeps every anchor the mobile app opens', () => {
    const anchors = new Set(manualAnchors())
    for (const anchor of APP_HELP_ANCHORS) expect(anchors.has(anchor), anchor).toBe(true)
  })

  it('explains the access profiles at stable anchors, and the cards on top lead there', () => {
    const anchors = new Set(manualAnchors())
    for (const anchor of [
      'perfis',
      'perfil-visitante',
      'perfil-explorador',
      'perfil-parceiro',
      'perfil-equipe',
      'perfis-combinacoes',
    ]) {
      expect(anchors.has(anchor), anchor).toBe(true)
    }
    expect(MANUAL_START_CARDS.slice(0, 4).map((card) => card.href)).toEqual([
      '#perfil-visitante',
      '#perfil-explorador',
      '#perfil-parceiro',
      '#perfil-equipe',
    ])
    for (const card of MANUAL_START_CARDS) expect(anchors.has(card.href.slice(1))).toBe(true)
  })

  it('says whom every chapter is for', () => {
    for (const chapter of MANUAL_CHAPTERS) expect(chapter.profiles.length).toBeGreaterThan(3)
  })

  it('frames every task: what it is for, numbered steps and a picture', () => {
    for (const section of sections) {
      expect(section.intro.length, section.id).toBeGreaterThan(15)
      expect(section.blocks.length, section.id).toBeGreaterThan(0)
    }
    // A task is titled "Como …"; the other sections explain or answer.
    const tasks = sections.filter((section) => section.title.startsWith('Como '))
    expect(tasks.length).toBeGreaterThan(40)
    const hasFigure = (section: ManualSection) =>
      section.blocks.some((block) => block.kind === 'figures')
    for (const task of tasks) {
      expect(
        task.blocks.some((block) => block.kind === 'steps'),
        `${task.id} has numbered steps`
      ).toBe(true)
      const elsewhere = SHOWN_ELSEWHERE[task.id]
      if (!elsewhere) {
        expect(hasFigure(task), `${task.id} has a screenshot`).toBe(true)
        continue
      }
      // No picture of its own: it sends the reader to the same screen elsewhere.
      const target = sections.find((section) => section.id === elsewhere)
      expect(target && hasFigure(target), `${elsewhere} has a screenshot`).toBe(true)
      expect(task.blocks.flatMap(blockTexts).join(' ')).toContain(`](#${elsewhere})`)
    }
  })

  it('links only to its own anchors and to pages of the site', () => {
    const anchors = new Set(manualAnchors())
    const links = texts.flatMap((text) =>
      parseManualText(text).flatMap((part) => (part.kind === 'link' ? [part.href] : []))
    )

    expect(links.length).toBeGreaterThan(30)
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
      expect(image.caption?.length ?? 0, image.id).toBeGreaterThan(5)
    }
  })

  it('ships no screenshot the manual does not use', () => {
    const used = new Set(images.map((image) => image.id))
    const files = readdirSync(mediaDir).filter((file) => file.endsWith('.webp'))

    expect(Object.keys(MANUAL_MEDIA).sort()).toEqual([...used].sort())
    expect(files.map((file) => file.replace(/\.webp$/, '')).sort()).toEqual([...used].sort())
  })

  it('stays light enough to ship with the site', () => {
    const imageBytes = readdirSync(mediaDir)
      .filter((file) => file.endsWith('.webp'))
      .reduce((total, file) => total + statSync(join(mediaDir, file)).size, 0)

    expect(imageBytes).toBeLessThan(6 * 1024 * 1024)
    expect(statSync(join(publicDir, MANUAL_PDF_PATH)).size).toBeLessThan(10 * 1024 * 1024)
  })

  it('never prints an e-mail address, a password or a technical term', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
      expect(text).not.toMatch(/senha\s*[:=]/i)
      expect(text).not.toMatch(/\b(tenant|inertia|capability|projeção|backoffice|token)\b/i)
    }
  })

  it('warns that the beta runs on demonstration data with simulated payments', () => {
    const all = texts.join('\n')
    expect(all).toMatch(/fictícios/)
    expect(all).toMatch(/simulad/)
  })
})
