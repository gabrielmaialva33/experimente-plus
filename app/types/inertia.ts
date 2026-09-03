/**
 * Inertia page registry.
 *
 * Inertia v4 types inertia.render(page, props) against this interface. Each
 * key is a page component (relative to `inertia/pages`) and the value describes
 * the props passed from the controller. Pages without page-specific props use
 * an empty object.
 */
import type { FileListResult } from '#modules/files/services/list_files_service'
import type { DashboardStats } from '#modules/web/services/get_dashboard_stats_service'
import type { WebRole } from '#modules/web/services/list_roles_with_permissions_service'
import type { WebPermission } from '#modules/web/services/list_all_permissions_service'

type SettingsProfile = {
  id: number
  full_name: string
  email: string
  username: string | null
}

declare module '@adonisjs/inertia/types' {
  interface InertiaPages {
    // Auth
    'auth/login': Record<string, never>
    'auth/register': Record<string, never>
    'auth/forgot_password': Record<string, never>
    'auth/reset_password': { token: string }

    // Legal
    'legal/terms': Record<string, never>
    'legal/privacy': Record<string, never>

    // Root / misc
    'home': Record<string, never>
    'ui_demo': Record<string, never>
    'data_grid_demo': Record<string, never>
    'dashboard': { stats: DashboardStats }
    'analytics/organization': { dashboard: Record<string, any> }

    // Partner portal
    'portal/index': Record<string, any>
    'portal/organizations/new': Record<string, never>
    'portal/organizations/show': Record<string, any>
    'portal/establishments/new': Record<string, any>
    'portal/establishments/edit': Record<string, any>
    'portal/establishments/benefits': Record<string, any>
    'portal/redemptions/index': Record<string, any>
    'portal/redemptions/validate': Record<string, any>
    'portal/redemptions/receipt': Record<string, any>

    // Backoffice
    'backoffice/moderation/index': Record<string, any>
    'backoffice/moderation/show': Record<string, any>
    'backoffice/feedback/index': Record<string, any>
    'backoffice/benefits/index': Record<string, any>
    'backoffice/benefits/accesses': Record<string, any>

    // Consumer
    'wallet/index': Record<string, any>
    'wallet/redemptions': Record<string, any>
    'wallet/receipt': Record<string, any>
    'wallet/present': Record<string, any>

    // Catalog
    'catalog/cities': { catalog: any }
    'catalog/categories': {
      catalog: any
      city_slug: string | null
    }
    'catalog/establishments': {
      catalog: any
      city_slug: string | null
      filter_categories: any
    }
    'catalog/category': {
      catalog: any
      city_slug: string | null
      category_slug: string | null
      city: any
      category: any
    }
    'catalog/establishment': {
      catalog: any
      city_slug: string | null
    }

    // Files
    'files/index': { files: FileListResult }

    // Roles
    'roles/index': { roles: WebRole[] }

    // Permissions
    'permissions/index': { permissions: WebPermission[] }

    // Settings
    'settings/index': { profile: SettingsProfile }

    // Users
    'users/index': {
      users: Record<string, any>
      search: string
      sortBy: string
      direction: string
    }
    'users/create': Record<string, never>
    'users/edit': {
      user: Record<string, any> | null
    }

    // Error pages
    'errors/not_found': {
      error: Record<string, any>
    }
    'errors/server_error': {
      error: Record<string, any>
    }
  }
}
