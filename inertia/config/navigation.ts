import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  ClipboardCheck,
  Compass,
  FileCheck2,
  FileLock2,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquareText,
  ScanLine,
  Settings,
  Store,
  TicketPercent,
  Upload,
  UserCog,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react'

export type NavigationSurface = 'public' | 'consumer' | 'portal' | 'backoffice'
export type NavigationPlacement = 'consumer-shell' | 'sidebar'
export type PublicNavigationPlacement = 'header' | 'mobile' | 'utility' | 'footer'

export interface PublicNavigationItem {
  label: string
  href: string
  icon: LucideIcon
  method?: 'post'
  requiresActiveTenant?: boolean
}

interface PublicNavigationTree {
  authenticated: readonly PublicNavigationItem[]
  guest: readonly PublicNavigationItem[]
}

interface PublicNavigationConfig {
  header: PublicNavigationTree
  mobile: PublicNavigationTree
  utility: PublicNavigationTree
  footer: readonly PublicNavigationItem[]
}

export interface NavigationAvailability {
  authenticated: boolean
  activeTenantId: number | null
}

export interface NavigationBreadcrumb {
  label: string
  href?: string
}

export interface RouteMetadata {
  id: string
  pattern: string
  surface: NavigationSurface
  title: string
  description: string
  breadcrumbs: readonly NavigationBreadcrumb[]
  /** Permission required by the page route; navigation visibility remains a client-side convenience. */
  capability?: string
  /** Allows a route to provide a surface fallback for descendants without dedicated metadata. */
  includeChildren?: boolean
}

export interface NavigationItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  surface: NavigationSurface
  section: string
  placements: readonly NavigationPlacement[]
  capability?: string
  /** The destination is guarded by tenant middleware and needs an active operation. */
  requiresActiveTenant?: boolean
  developmentOnly?: boolean
}

export const SURFACE_LABELS: Record<NavigationSurface, string> = {
  public: 'Descoberta',
  consumer: 'Experiência',
  portal: 'Portal do parceiro',
  backoffice: 'Operação',
}

export const PUBLIC_NAVIGATION: PublicNavigationConfig = {
  header: {
    authenticated: [
      { label: 'Explorar', href: '/cidades', icon: Compass },
      {
        label: 'Carteira',
        href: '/wallet',
        icon: TicketPercent,
        requiresActiveTenant: true,
      },
    ],
    guest: [{ label: 'Explorar', href: '/cidades', icon: Compass }],
  },
  mobile: {
    authenticated: [
      { label: 'Explorar', href: '/cidades', icon: Compass },
      {
        label: 'Carteira',
        href: '/wallet',
        icon: TicketPercent,
        requiresActiveTenant: true,
      },
      { label: 'Portal', href: '/portal', icon: Store, requiresActiveTenant: true },
      { label: 'Sair', href: '/logout', icon: LogOut, method: 'post' },
    ],
    guest: [
      { label: 'Explorar', href: '/cidades', icon: Compass },
      { label: 'Entrar', href: '/login', icon: LogIn },
      { label: 'Cadastrar negócio', href: '/register', icon: UserPlus },
    ],
  },
  utility: {
    authenticated: [
      { label: 'Portal', href: '/portal', icon: Store, requiresActiveTenant: true },
      { label: 'Sair', href: '/logout', icon: LogOut, method: 'post' },
    ],
    guest: [{ label: 'Entrar', href: '/login', icon: LogIn }],
  },
  footer: [
    { label: 'Explorar cidades', href: '/cidades', icon: Compass },
    { label: 'Termos de Uso', href: '/termos', icon: FileCheck2 },
    { label: 'Privacidade', href: '/privacidade', icon: FileLock2 },
  ],
}

/**
 * Experimente+ route vocabulary. Patterns use one segment per `:parameter` and are
 * resolved by specificity, so a receipt or benefit page wins over its parent surface.
 */
export const ROUTE_METADATA: readonly RouteMetadata[] = [
  {
    id: 'public-privacy',
    pattern: '/privacidade',
    surface: 'public',
    title: 'Política de Privacidade',
    description: 'Como o Experimente+ trata dados pessoais e sinais de descoberta.',
    breadcrumbs: [{ label: 'Privacidade' }],
  },
  {
    id: 'public-terms',
    pattern: '/termos',
    surface: 'public',
    title: 'Termos de Uso',
    description: 'Regras para usar o catálogo, a conta e os benefícios do Experimente+.',
    breadcrumbs: [{ label: 'Termos de Uso' }],
  },
  {
    id: 'public-establishment',
    pattern: '/cidades/:citySlug/estabelecimentos/:establishmentSlug',
    surface: 'public',
    title: 'Estabelecimento',
    description: 'Informações públicas, contatos e serviços deste estabelecimento.',
    breadcrumbs: [{ label: 'Cidades', href: '/cidades' }, { label: 'Estabelecimento' }],
  },
  {
    id: 'public-category',
    pattern: '/cidades/:citySlug/categorias/:categorySlug',
    surface: 'public',
    title: 'Categoria',
    description: 'Estabelecimentos publicados nesta categoria e cidade.',
    breadcrumbs: [{ label: 'Cidades', href: '/cidades' }, { label: 'Categoria' }],
  },
  {
    id: 'public-categories',
    pattern: '/cidades/:citySlug/categorias',
    surface: 'public',
    title: 'Categorias da cidade',
    description: 'Formas de explorar os estabelecimentos e serviços desta cidade.',
    breadcrumbs: [{ label: 'Cidades', href: '/cidades' }, { label: 'Categorias' }],
  },
  {
    id: 'public-city',
    pattern: '/cidades/:citySlug',
    surface: 'public',
    title: 'Descobrir na cidade',
    description: 'Estabelecimentos e serviços locais publicados nesta cidade.',
    breadcrumbs: [{ label: 'Cidades', href: '/cidades' }, { label: 'Cidade' }],
  },
  {
    id: 'public-cities',
    pattern: '/cidades',
    surface: 'public',
    title: 'Cidades',
    description: 'Escolha uma cidade para descobrir estabelecimentos e serviços locais.',
    breadcrumbs: [{ label: 'Cidades' }],
  },
  {
    id: 'public-home',
    pattern: '/',
    surface: 'public',
    title: 'Descoberta local',
    description: 'Explore cidades, categorias e estabelecimentos da região.',
    breadcrumbs: [{ label: 'Início' }],
  },
  {
    id: 'consumer-presentation',
    pattern: '/wallet/accesses/:accessId/offers/:offerId/use',
    surface: 'consumer',
    title: 'Usar benefício',
    description: 'Gere uma apresentação temporária para confirmar a utilização.',
    breadcrumbs: [{ label: 'Carteira', href: '/wallet' }, { label: 'Apresentação' }],
  },
  {
    id: 'consumer-receipt',
    pattern: '/wallet/redemptions/:receiptCode',
    surface: 'consumer',
    title: 'Comprovante de utilização',
    description: 'Registro permanente de uma utilização confirmada.',
    breadcrumbs: [
      { label: 'Carteira', href: '/wallet' },
      { label: 'Utilizações', href: '/wallet/history' },
      { label: 'Comprovante' },
    ],
  },
  {
    id: 'consumer-history',
    pattern: '/wallet/history',
    surface: 'consumer',
    title: 'Utilizações',
    description: 'Histórico de benefícios utilizados e seus comprovantes.',
    breadcrumbs: [{ label: 'Carteira', href: '/wallet' }, { label: 'Utilizações' }],
  },
  {
    id: 'consumer-wallet',
    pattern: '/wallet',
    surface: 'consumer',
    title: 'Carteira',
    description: 'Acessos, edições e benefícios disponíveis para sua conta.',
    breadcrumbs: [{ label: 'Carteira' }],
  },
  {
    id: 'portal-receipt',
    pattern: '/portal/redemptions/:receiptCode',
    surface: 'portal',
    title: 'Comprovante de utilização',
    description: 'Dados da utilização confirmada e do comprovante emitido.',
    capability: 'benefit_offers.read',
    breadcrumbs: [
      { label: 'Portal', href: '/portal' },
      { label: 'Utilizações validadas', href: '/portal/redemptions' },
      { label: 'Comprovante' },
    ],
  },
  {
    id: 'portal-redemption-validation',
    pattern: '/portal/redemptions/validate',
    surface: 'portal',
    title: 'Validar benefício',
    description: 'Confira a apresentação antes de confirmar a utilização do benefício.',
    capability: 'benefit_offers.update',
    breadcrumbs: [
      { label: 'Portal', href: '/portal' },
      { label: 'Utilizações validadas', href: '/portal/redemptions' },
      { label: 'Validar benefício' },
    ],
  },
  {
    id: 'portal-redemptions',
    pattern: '/portal/redemptions',
    surface: 'portal',
    title: 'Utilizações validadas',
    description: 'Confirmações de benefícios realizadas pelas unidades da organização.',
    capability: 'benefit_offers.read',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Utilizações validadas' }],
  },
  {
    id: 'portal-establishment-benefits',
    pattern: '/portal/establishments/:establishmentId/benefits',
    surface: 'portal',
    title: 'Benefícios da unidade',
    description: 'Ofertas da unidade em cada edição disponível.',
    capability: 'benefit_offers.list',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Benefícios' }],
  },
  {
    id: 'portal-establishment-new',
    pattern: '/portal/organizations/:organizationId/establishments/new',
    surface: 'portal',
    title: 'Nova unidade',
    description: 'Crie a unidade pública vinculada a esta organização.',
    capability: 'establishments.create',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Nova unidade' }],
  },
  {
    id: 'portal-establishment',
    pattern: '/portal/establishments/:establishmentId',
    surface: 'portal',
    title: 'Editor da unidade',
    description: 'Conteúdo público, completude e publicação desta unidade.',
    capability: 'establishments.read',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Unidade' }],
  },
  {
    id: 'portal-organization-new',
    pattern: '/portal/organizations/new',
    surface: 'portal',
    title: 'Nova organização',
    description: 'Cadastre o responsável legal ou comercial pelas unidades.',
    capability: 'organizations.create',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Nova organização' }],
  },
  {
    id: 'portal-organization',
    pattern: '/portal/organizations/:organizationId',
    surface: 'portal',
    title: 'Organização',
    description: 'Dados da organização, equipe e unidades vinculadas.',
    capability: 'organizations.read',
    breadcrumbs: [{ label: 'Portal', href: '/portal' }, { label: 'Organização' }],
  },
  {
    id: 'portal-home',
    pattern: '/portal',
    surface: 'portal',
    title: 'Visão geral',
    description: 'Organizações, unidades e próximos passos do piloto.',
    breadcrumbs: [{ label: 'Portal' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-moderation-review',
    pattern: '/backoffice/moderation/:revisionId',
    surface: 'backoffice',
    title: 'Revisão de conteúdo',
    description: 'Conteúdo submetido e decisão de moderação desta unidade.',
    capability: 'establishments.read',
    breadcrumbs: [{ label: 'Moderação', href: '/backoffice/moderation' }, { label: 'Revisão' }],
  },
  {
    id: 'backoffice-moderation',
    pattern: '/backoffice/moderation',
    surface: 'backoffice',
    title: 'Fila de moderação',
    description: 'Revisões de unidades aguardando análise da operação.',
    capability: 'establishments.list',
    breadcrumbs: [{ label: 'Moderação' }],
  },
  {
    id: 'backoffice-benefits',
    pattern: '/backoffice/benefits',
    surface: 'backoffice',
    title: 'Edições e benefícios',
    description: 'Edições comerciais, ofertas vinculadas e publicação.',
    capability: 'benefit_editions.create',
    breadcrumbs: [{ label: 'Edições e benefícios' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-accesses',
    pattern: '/backoffice/accesses',
    surface: 'backoffice',
    title: 'Acessos a edições',
    description: 'Concessões e revogações de acesso às edições publicadas.',
    capability: 'benefit_accesses.list',
    breadcrumbs: [{ label: 'Acessos' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-feedback',
    pattern: '/backoffice/feedback',
    surface: 'backoffice',
    title: 'Feedback do piloto',
    description: 'Observações privadas enviadas durante a operação do piloto.',
    capability: 'pilot_feedback.list',
    breadcrumbs: [{ label: 'Feedback do piloto' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-dashboard',
    pattern: '/dashboard',
    surface: 'backoffice',
    title: 'Painel operacional',
    description: 'Indicadores administrativos da operação ativa.',
    capability: 'dashboard.read',
    breadcrumbs: [{ label: 'Painel operacional' }],
  },
  {
    id: 'backoffice-users',
    pattern: '/users',
    surface: 'backoffice',
    title: 'Usuários',
    description: 'Contas e vínculos administrativos da plataforma.',
    capability: 'users.list',
    breadcrumbs: [{ label: 'Usuários' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-roles',
    pattern: '/roles',
    surface: 'backoffice',
    title: 'Papéis',
    description: 'Papéis globais da plataforma e suas capacidades.',
    capability: 'roles.list',
    breadcrumbs: [{ label: 'Papéis' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-permissions',
    pattern: '/permissions',
    surface: 'backoffice',
    title: 'Permissões',
    description: 'Capacidades globais disponíveis para os papéis da plataforma.',
    capability: 'permissions.list',
    breadcrumbs: [{ label: 'Permissões' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-files',
    pattern: '/files',
    surface: 'backoffice',
    title: 'Arquivos',
    description: 'Arquivos administrativos disponíveis na operação.',
    capability: 'files.list',
    breadcrumbs: [{ label: 'Arquivos' }],
    includeChildren: true,
  },
  {
    id: 'backoffice-settings',
    pattern: '/settings',
    surface: 'backoffice',
    title: 'Configurações',
    description: 'Configurações administrativas da conta e da operação.',
    breadcrumbs: [{ label: 'Configurações' }],
    includeChildren: true,
  },
]

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: 'consumer-explore',
    label: 'Explorar',
    href: '/cidades',
    icon: Compass,
    surface: 'consumer',
    section: 'Descoberta',
    placements: ['consumer-shell', 'sidebar'],
  },
  {
    id: 'consumer-wallet',
    label: 'Carteira',
    href: '/wallet',
    icon: WalletCards,
    surface: 'consumer',
    section: 'Descoberta',
    placements: ['consumer-shell', 'sidebar'],
    requiresActiveTenant: true,
  },
  {
    id: 'portal-home',
    label: 'Visão geral do Portal',
    href: '/portal',
    icon: Building2,
    surface: 'portal',
    section: 'Portal do parceiro',
    placements: ['sidebar'],
  },
  {
    id: 'portal-redemptions',
    label: 'Utilizações validadas',
    href: '/portal/redemptions',
    icon: ScanLine,
    surface: 'portal',
    section: 'Portal do parceiro',
    placements: ['sidebar'],
    capability: 'benefit_offers.read',
  },
  {
    id: 'backoffice-dashboard',
    label: 'Painel operacional',
    href: '/dashboard',
    icon: LayoutDashboard,
    surface: 'backoffice',
    section: 'Operação',
    placements: ['sidebar'],
    capability: 'dashboard.read',
  },
  {
    id: 'backoffice-moderation',
    label: 'Fila de moderação',
    href: '/backoffice/moderation',
    icon: ClipboardCheck,
    surface: 'backoffice',
    section: 'Operação',
    placements: ['sidebar'],
    capability: 'establishments.list',
  },
  {
    id: 'backoffice-benefits',
    label: 'Edições e benefícios',
    href: '/backoffice/benefits',
    icon: TicketPercent,
    surface: 'backoffice',
    section: 'Operação',
    placements: ['sidebar'],
    capability: 'benefit_editions.create',
  },
  {
    id: 'backoffice-accesses',
    label: 'Acessos a edições',
    href: '/backoffice/accesses',
    icon: KeyRound,
    surface: 'backoffice',
    section: 'Operação',
    placements: ['sidebar'],
    capability: 'benefit_accesses.list',
  },
  {
    id: 'backoffice-feedback',
    label: 'Feedback do piloto',
    href: '/backoffice/feedback',
    icon: MessageSquareText,
    surface: 'backoffice',
    section: 'Operação',
    placements: ['sidebar'],
    capability: 'pilot_feedback.list',
  },
  {
    id: 'backoffice-users',
    label: 'Usuários',
    href: '/users',
    icon: Users,
    surface: 'backoffice',
    section: 'Administração',
    placements: ['sidebar'],
    capability: 'users.list',
  },
  {
    id: 'backoffice-roles',
    label: 'Papéis',
    href: '/roles',
    icon: UserCog,
    surface: 'backoffice',
    section: 'Administração',
    placements: ['sidebar'],
    capability: 'roles.list',
  },
  {
    id: 'backoffice-permissions',
    label: 'Permissões',
    href: '/permissions',
    icon: KeyRound,
    surface: 'backoffice',
    section: 'Administração',
    placements: ['sidebar'],
    capability: 'permissions.list',
  },
  {
    id: 'backoffice-files',
    label: 'Arquivos',
    href: '/files',
    icon: Upload,
    surface: 'backoffice',
    section: 'Administração',
    placements: ['sidebar'],
    capability: 'files.list',
  },
  {
    id: 'backoffice-settings',
    label: 'Configurações',
    href: '/settings',
    icon: Settings,
    surface: 'backoffice',
    section: 'Sistema',
    placements: ['sidebar'],
  },
]

function normalizePath(url: string): string {
  const pathname = (url.split(/[?#]/, 1)[0] || '/').replace(/\/+$/, '')
  return pathname || '/'
}

function pathSegments(path: string): string[] {
  return normalizePath(path).split('/').filter(Boolean)
}

function metadataMatchScore(pathname: string, metadata: RouteMetadata): number | null {
  const currentSegments = pathSegments(pathname)
  const patternSegments = pathSegments(metadata.pattern)

  if (
    currentSegments.length < patternSegments.length ||
    (!metadata.includeChildren && currentSegments.length !== patternSegments.length)
  ) {
    return null
  }

  const staticSegments = patternSegments.filter((segment) => !segment.startsWith(':')).length
  const matches = patternSegments.every(
    (patternSegment, index) =>
      patternSegment.startsWith(':') || patternSegment === currentSegments[index]
  )
  if (!matches) return null

  const exactBonus = currentSegments.length === patternSegments.length ? 1 : 0
  return patternSegments.length * 100 + staticSegments * 10 + exactBonus
}

export function resolveRouteMetadata(
  url: string,
  surface?: NavigationSurface
): RouteMetadata | null {
  const pathname = normalizePath(url)

  return (
    ROUTE_METADATA.filter((metadata) => !surface || metadata.surface === surface)
      .map((metadata) => ({ metadata, score: metadataMatchScore(pathname, metadata) }))
      .filter((match): match is { metadata: RouteMetadata; score: number } => match.score !== null)
      .sort((left, right) => right.score - left.score)[0]?.metadata ?? null
  )
}

export function navigationItemsForSurface(
  surface: NavigationSurface,
  placement?: NavigationPlacement,
  availability?: Pick<NavigationAvailability, 'activeTenantId'>
): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    (item) =>
      item.surface === surface &&
      (!placement || item.placements.includes(placement)) &&
      (!availability || !item.requiresActiveTenant || availability.activeTenantId !== null)
  )
}

export function publicNavigationItemsFor(
  placement: Exclude<PublicNavigationPlacement, 'footer'>,
  availability: NavigationAvailability
): PublicNavigationItem[] {
  const audience = availability.authenticated ? 'authenticated' : 'guest'

  return PUBLIC_NAVIGATION[placement][audience].filter(
    (item) => !item.requiresActiveTenant || availability.activeTenantId !== null
  )
}

export function isNavigationHrefActive(url: string, href: string): boolean {
  const pathname = normalizePath(url)
  const target = normalizePath(href)
  if (target === '/') return pathname === '/'
  return pathname === target || pathname.startsWith(`${target}/`)
}

export function matchNavigationItem(
  url: string,
  items: readonly NavigationItem[] = NAVIGATION_ITEMS
): NavigationItem | null {
  return (
    items
      .filter((item) => isNavigationHrefActive(url, item.href))
      .sort((left, right) => pathSegments(right.href).length - pathSegments(left.href).length)[0] ??
    null
  )
}

export function isNavigationItemActive(
  url: string,
  item: NavigationItem,
  items: readonly NavigationItem[] = NAVIGATION_ITEMS
): boolean {
  return matchNavigationItem(url, items)?.id === item.id
}
