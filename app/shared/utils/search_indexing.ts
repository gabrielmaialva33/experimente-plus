import { deploymentEnvironment } from '#shared/utils/deployment_environment'

/** The value every response carries where search engines must not index or follow. */
export const NOINDEX_ROBOTS_TAG = 'noindex, nofollow'

/**
 * Prefixes no crawler should visit in production: the tracked outbound
 * redirects, the API and every area that needs a session or a one-time link.
 * The public catalog, the legal pages, the app page and the manual stay open.
 */
export const ROBOTS_DISALLOWED_PATHS = [
  '/go/',
  '/api/',
  '/portal',
  '/backoffice',
  '/wallet',
  '/carteira',
  '/settings',
  '/dashboard',
  '/organizations',
  '/organization-invitations',
  '/users',
  '/roles',
  '/permissions',
  '/files',
  '/tenant',
  '/login',
  '/logout',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verificar-email',
  '/docs',
] as const

/**
 * Only production may be indexed. Homologation is internet-facing and shows
 * fictitious "— demonstração" places; development is never public. A missing
 * DEPLOYMENT_ENV is production, as everywhere else.
 */
export function searchIndexingAllowed(deployment?: string): boolean {
  return deploymentEnvironment(deployment) === 'production'
}

/** The body of `/robots.txt` for the current deployment. */
export function robotsTxt(indexable: boolean): string {
  const rules = indexable
    ? ROBOTS_DISALLOWED_PATHS.map((path) => `Disallow: ${path}`)
    : ['Disallow: /']

  return ['User-agent: *', ...rules, ''].join('\n')
}
