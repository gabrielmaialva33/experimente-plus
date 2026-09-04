import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import type { NextFn } from '@adonisjs/core/types/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationPolicyService, {
  type PlatformAccess,
} from '#modules/organizations/services/organization_policy_service'
import PermissionService from '#modules/permissions/services/permission_service'
import { resolveActiveTenantId } from '#shared/utils/active_tenant'
import { findApplicationSetCookies } from '#shared/utils/public_response_cookies'
import env from '#start/env'

type SharedUser = {
  id: number
  full_name: string
  email: string
}

type SharedTenant = {
  id: number
  name: string
  slug: string
  is_active: boolean
  role: string | null
}

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  private readonly personalizedPages = new WeakSet<HttpContext>()

  async share(ctx: HttpContext) {
    const auth = await this.resolveAuth(ctx)
    const environment = env.get('NODE_ENV')
    const errors = {
      ...this.getValidationErrors(ctx),
      ...(ctx.session?.flashMessages.get('errors') ?? {}),
    }
    const flash = {
      success: ctx.session?.flashMessages.get('success') ?? null,
      error: ctx.session?.flashMessages.get('error') ?? null,
    }

    if (
      auth.user ||
      Object.keys(errors).length > 0 ||
      flash.success !== null ||
      flash.error !== null
    ) {
      this.personalizedPages.add(ctx)
    }

    return {
      app: {
        name: env.get('APP_NAME', 'Experimente+'),
        url: env.get('APP_URL', `http://${env.get('HOST')}:${env.get('PORT')}`),
        sourceUrl: env.get('APP_SOURCE_URL') ?? null,
        environment,
        demoPagesEnabled: env.get('DEMO_PAGES_ENABLED', environment === 'development'),
      },
      // Validation errors (inputErrorsBag) merged with the errors controllers
      // flash manually via `session.flash('errors', {...})` — e.g. `general`
      // on sign-in, `submission` on portal submit and `moderation` when the
      // PublicationGate blocks an approval. The base middleware only reads
      // the validation bag, so manual flashes would never reach the client.
      errors,
      flash,
      auth,
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    try {
      return await next()
    } catch (error) {
      if (this.isInertiaRequest(ctx) || this.isPublicCacheCandidate(ctx)) {
        this.preventCaching(ctx)
      }

      throw error
    } finally {
      this.dispose(ctx)
    }
  }

  dispose(ctx: HttpContext) {
    if (!ctx.response.isPending) {
      return
    }

    const varyBeforeDispose = ctx.response.getHeader('Vary')

    super.dispose(ctx)

    // @adonisjs/inertia currently sets Vary with `header`, replacing cache
    // dimensions already declared by the route. Rebuild it through Adonis'
    // merge-aware API so Host, X-Inertia and compression variants survive.
    const varyFields = [varyBeforeDispose, ctx.response.getHeader('Vary')]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .flatMap((value) => String(value ?? '').split(','))
      .map((field) => field.trim())
      .filter(Boolean)

    if (varyFields.length > 0) {
      ctx.response.removeHeader('Vary')
      ctx.response.vary(varyFields)
    }

    const isInertiaRequest = this.isInertiaRequest(ctx)
    const isPersonalizedPage = this.personalizedPages.has(ctx)
    const isPublicCacheCandidate = this.isPublicCacheCandidate(ctx)

    // Inertia page objects can be partial, personalized, or replaced with a
    // version-mismatch response during super.dispose. Shared authenticated
    // props also make the initial HTML private. Only a successful anonymous
    // HTML representation may retain the controller's public cache policy.
    if (
      isInertiaRequest ||
      isPersonalizedPage ||
      (isPublicCacheCandidate && ctx.response.getStatus() !== 200)
    ) {
      this.preventCaching(ctx)
      return
    }

    if (isPublicCacheCandidate) {
      this.removeInfrastructureCookiesFromPublicResponse(ctx)
    }
  }

  private isInertiaRequest(ctx: HttpContext): boolean {
    return ctx.inertia.requestInfo().isInertiaRequest
  }

  private isPublicCacheCandidate(ctx: HttpContext): boolean {
    return String(ctx.response.getHeader('Cache-Control') ?? '')
      .split(',')
      .some((directive) => directive.trim().toLowerCase() === 'public')
  }

  private preventCaching(ctx: HttpContext): void {
    ctx.response.header('Cache-Control', 'private, no-store')
  }

  private removeInfrastructureCookiesFromPublicResponse(ctx: HttpContext): void {
    const setCookie = ctx.response.getHeader('Set-Cookie')
    if (setCookie === undefined) {
      return
    }

    const applicationCookies = findApplicationSetCookies(setCookie, {
      session: env.get('SESSION_COOKIE_NAME', 'experimente-plus-session'),
      csrf: 'XSRF-TOKEN',
      // The cookie store persists the encrypted values in a second cookie
      // whose exact name is the current Session.sessionId. Other stores do not.
      sessionData: env.get('SESSION_DRIVER') === 'cookie' ? ctx.session.sessionId : undefined,
    })

    if (applicationCookies.length > 0) {
      this.preventCaching(ctx)
      return
    }

    // Session and Shield create fresh session/CSRF cookies even for an anonymous
    // GET. With the cookie store, session data is a third encrypted cookie named
    // after the current session id. The public catalog HTML does not embed the
    // token or expose a mutation form, so none may enter a shared cache entry.
    // The next non-cacheable page/Inertia response issues a fresh set.
    ctx.response.removeHeader('Set-Cookie')
  }

  private async resolveAuth(ctx: HttpContext): Promise<{
    user: SharedUser | null
    tenants: SharedTenant[]
    activeTenantId: number | null
    hasActiveOrganizationMembership: boolean
    platformAccess: PlatformAccess | null
    permissions: string[]
  }> {
    const empty = {
      user: null,
      tenants: [] as SharedTenant[],
      activeTenantId: null,
      hasActiveOrganizationMembership: false,
      platformAccess: null,
      permissions: [] as string[],
    }

    if (!ctx.auth) {
      return empty
    }

    const guard = ctx.auth.use('jwt')
    const isAuthenticated = await guard.check()
    const user = guard.user
    if (!isAuthenticated || !user) {
      return empty
    }

    const tenantRecords = await user
      .related('tenants')
      .query()
      .where('tenants.is_active', true)
      .orderBy('tenants.id', 'asc')

    const tenants: SharedTenant[] = tenantRecords.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      is_active: tenant.is_active,
      role: (tenant.$extras.pivot_role as string | undefined) ?? null,
    }))

    const claimedTenantId = guard.tokenPayload?.tenantId
    const activeTenantId = resolveActiveTenantId(tenants, claimedTenantId)

    const [permissionService, organizationPolicy] = await Promise.all([
      app.container.make(PermissionService),
      app.container.make(OrganizationPolicyService),
    ])
    const [permissions, platformAccess] = await Promise.all([
      permissionService.getEffectivePermissionNames(user.id),
      organizationPolicy.resolvePlatformAccess(user),
    ])
    const activeOrganizationMembership =
      activeTenantId === null
        ? null
        : await OrganizationMember.query()
            .where('tenant_id', activeTenantId)
            .where('user_id', user.id)
            .where('status', 'active')
            .select('id')
            .first()

    return {
      user: { id: user.id, full_name: user.full_name, email: user.email },
      tenants,
      activeTenantId,
      hasActiveOrganizationMembership: activeOrganizationMembership !== null,
      platformAccess,
      permissions,
    }
  }
}
