import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MANUAL_PATH, MANUAL_PDF_PATH, PAGE_HELP_ANCHORS, pageHelp } from '~/config/help'
import { manualAnchors } from '~/content/manual'

const pagesDir = join(import.meta.dirname, '../../pages')

function pageComponents(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return pageComponents(path)
    return entry.name.endsWith('.tsx') ? [relative(pagesDir, path).replace(/\.tsx$/, '')] : []
  })
}

/** The pages drawn with a help menu: the personal area, the portal and the back office. */
const AUTHENTICATED_AREA_PAGES = pageComponents(pagesDir).filter(
  (component) =>
    /^(portal|backoffice|users|roles|permissions|files|analytics|wallet)\//.test(component) ||
    component === 'dashboard' ||
    component === 'settings/index'
)

describe('contextual help', () => {
  it('points every page with a help menu to a section of the manual', () => {
    const anchors = new Set(manualAnchors())

    expect(AUTHENTICATED_AREA_PAGES.length).toBeGreaterThan(30)
    for (const component of AUTHENTICATED_AREA_PAGES) {
      expect(PAGE_HELP_ANCHORS, component).toHaveProperty([component])
      expect(anchors.has(PAGE_HELP_ANCHORS[component]), component).toBe(true)
    }
  })

  it('maps no page that does not exist and no anchor the manual lacks', () => {
    const pages = new Set(pageComponents(pagesDir))
    const anchors = new Set(manualAnchors())

    for (const [component, anchor] of Object.entries(PAGE_HELP_ANCHORS)) {
      expect(pages.has(component), component).toBe(true)
      expect(anchors.has(anchor), anchor).toBe(true)
    }
  })

  it('opens the section of the page, or the chapter of its area as a fallback', () => {
    expect(pageHelp('portal/reviews/index', 'portal')).toEqual({
      anchor: 'parceiro-avaliacoes',
      href: '/manual#parceiro-avaliacoes',
      specific: true,
    })
    expect(pageHelp('backoffice/moderation/show', 'backoffice').href).toBe(
      '/manual#administracao-dados-de-lugares'
    )
    expect(pageHelp('portal/organizations/new', 'portal').href).toBe('/manual#parceiro-cadastrar')
    expect(pageHelp('settings/index', 'backoffice').href).toBe('/manual#consumidor-conta')
    expect(pageHelp('ui_demo', 'backoffice')).toEqual({
      anchor: 'administracao',
      href: '/manual#administracao',
      specific: false,
    })
    expect(pageHelp(undefined, 'portal').href).toBe('/manual#parceiro')
  })

  it('opens the wallet tasks from the personal area and the team task from Equipe', () => {
    expect(pageHelp('wallet/present', 'consumer').href).toBe('/manual#consumidor-apresentar')
    expect(pageHelp('wallet/redemptions', 'consumer').href).toBe('/manual#consumidor-utilizacoes')
    expect(pageHelp('portal/organizations/team', 'portal').href).toBe(
      '/manual#parceiro-equipe-convidar'
    )
  })

  it('opens the new-business and simulated-payment tasks from their back-office pages', () => {
    expect(pageHelp('backoffice/organizations/index', 'backoffice').href).toBe(
      '/manual#administracao-organizacoes'
    )
    expect(pageHelp('backoffice/organizations/show', 'backoffice')).toEqual({
      anchor: 'administracao-organizacoes',
      href: '/manual#administracao-organizacoes',
      specific: true,
    })
    expect(pageHelp('backoffice/purchases/index', 'backoffice').href).toBe(
      '/manual#administracao-pagamento-simulado'
    )
  })

  it('reads the purpose written in the address before the page', () => {
    expect(
      pageHelp('portal/establishments/index', 'portal', '/portal/establishments?para=desempenho')
        .href
    ).toBe('/manual#parceiro-desempenho')
    expect(
      pageHelp('portal/establishments/index', 'portal', '/portal/establishments?page=2').href
    ).toBe('/manual#parceiro-lugares')
    expect(pageHelp('portal/establishments/index', 'portal', '/portal/establishments').href).toBe(
      '/manual#parceiro-lugares'
    )
  })

  it('serves the manual and its PDF from fixed paths', () => {
    expect(MANUAL_PATH).toBe('/manual')
    expect(MANUAL_PDF_PATH).toBe('/manual-media/manual-experimente-plus.pdf')
  })
})
