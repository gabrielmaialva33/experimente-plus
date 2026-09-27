import type { NavigationSurface } from '~/config/navigation'

export const MANUAL_PATH = '/manual'
/** Screenshots and the PDF, served from `public/manual-media/`. */
export const MANUAL_MEDIA_PATH = '/manual-media'
export const MANUAL_PDF_FILE = 'manual-experimente-plus.pdf'
export const MANUAL_PDF_PATH = `${MANUAL_MEDIA_PATH}/${MANUAL_PDF_FILE}`

/**
 * Where "Ajuda desta página" leads from each portal and back-office page, keyed by
 * the Inertia component (`usePage().component`, the path under `inertia/pages`).
 * Every anchor is a section id of the manual; a test keeps the two in step.
 */
export const PAGE_HELP_ANCHORS: Readonly<Record<string, string>> = {
  // Partner portal
  'portal/index': 'parceiro-visao-geral',
  'portal/organizations/show': 'parceiro-lugares',
  'portal/organizations/new': 'parceiro-lugares',
  'portal/establishments/index': 'parceiro-lugares',
  'portal/establishments/new': 'parceiro-editar-lugar',
  'portal/establishments/edit': 'parceiro-editar-lugar',
  'portal/establishments/benefits': 'parceiro-beneficios',
  'portal/content/index': 'parceiro-conteudo',
  'portal/reviews/index': 'parceiro-avaliacoes',
  'portal/redemptions/validate': 'parceiro-validar',
  'portal/redemptions/index': 'parceiro-utilizacoes',
  'portal/redemptions/receipt': 'parceiro-utilizacoes',
  'analytics/organization': 'parceiro-desempenho',

  // Operation (back office)
  'backoffice/today/index': 'administracao-hoje',
  'dashboard': 'administracao-painel',
  'files/index': 'administracao-painel',
  'backoffice/moderation/index': 'administracao-dados-de-lugares',
  'backoffice/moderation/show': 'administracao-dados-de-lugares',
  'backoffice/content/index': 'administracao-conteudo',
  'backoffice/reports/index': 'administracao-denuncias',
  'backoffice/feedback/index': 'administracao-feedback',
  'backoffice/review_policy/index': 'administracao-regras',
  'backoffice/concierge/index': 'administracao-concierge',
  'backoffice/benefits/index': 'administracao-edicoes',
  'backoffice/benefits/accesses': 'administracao-acessos',
  'users/index': 'administracao-pessoas',
  'users/create': 'administracao-pessoas',
  'users/edit': 'administracao-pessoas',
  'roles/index': 'administracao-pessoas',
  'permissions/index': 'administracao-pessoas',
  'backoffice/taxonomy/index': 'administracao-catalogo',
  'backoffice/geography/index': 'administracao-catalogo',
}

/** A page without its own section opens the chapter of its area. */
const SURFACE_CHAPTERS: Readonly<Record<NavigationSurface, string>> = {
  public: 'visitante',
  consumer: 'consumidor',
  portal: 'parceiro',
  backoffice: 'administracao',
}

export interface PageHelp {
  anchor: string
  href: string
  /** True when the anchor is the page's own section, not its area's chapter. */
  specific: boolean
}

export function pageHelp(component: string | undefined, surface: NavigationSurface): PageHelp {
  const own = component ? PAGE_HELP_ANCHORS[component] : undefined
  const anchor = own ?? SURFACE_CHAPTERS[surface]
  return { anchor, href: `${MANUAL_PATH}#${anchor}`, specific: Boolean(own) }
}
