import type { OrganizationAllowedActions } from './organization_authorization'

export * from './api'
export * from './organization_authorization'

/**
 * The authenticated user as shared with every Inertia page by the
 * inertia middleware (a small subset of the full User model).
 */
export interface AuthUser {
  id: number
  full_name: string
  email: string
}

/**
 * A tenant the user belongs to, including the user's role inside it
 * (from the `user_tenants` pivot). Shared with every page.
 */
export interface TenantSummary {
  id: number
  name: string
  slug: string
  is_active: boolean
  role: string | null
}

export type PlatformAccess = 'platform_admin' | 'platform_moderator'

export interface AuthSharedProps {
  user: AuthUser | null
  tenants: TenantSummary[]
  activeTenantId: number | null
  hasActiveOrganizationMembership: boolean
  platformAccess: PlatformAccess | null
  permissions: string[]
  /**
   * Portal actions aggregated across the viewer's active memberships in the
   * active operation (every action for platform administrators); null without
   * an active operation. Presentation only: each page is authorized again.
   */
  portalActions: OrganizationAllowedActions | null
}

export interface AppSharedProps {
  name: string
  url: string
  sourceUrl: string | null
  environment: 'development' | 'production' | 'test'
  demoPagesEnabled: boolean
}

// Extend shared props with our app-specific props (declaration merging)
declare module '@adonisjs/inertia/types' {
  export interface SharedProps {
    app?: AppSharedProps
    auth?: AuthSharedProps
    flash?: {
      success?: string
      error?: string
      warning?: string
      info?: string
    }
  }
}
