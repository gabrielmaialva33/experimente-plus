import env from '#start/env'
import NotFoundException from '#exceptions/not_found_exception'
import Tenant from '#modules/tenants/models/tenant'

export default class PublicOperationResolver {
  async resolve(hostname?: string | null): Promise<Tenant> {
    const configuredSlug = env.get('PUBLIC_TENANT_SLUG')?.trim().toLowerCase()
    const resolvedSlug = configuredSlug || this.resolveHostnameSlug(hostname)

    if (resolvedSlug) {
      const tenant = await Tenant.query()
        .where('slug', resolvedSlug)
        .where('is_active', true)
        .first()

      if (!tenant) {
        throw new NotFoundException('Public operation not found')
      }

      return tenant
    }

    const tenants = await Tenant.query().where('is_active', true).orderBy('id', 'asc').limit(2)

    if (tenants.length !== 1) {
      throw new NotFoundException('Public operation could not be resolved')
    }

    return tenants[0]
  }

  private resolveHostnameSlug(hostname?: string | null): string | null {
    if (!hostname) {
      return null
    }

    const normalizedHostname = hostname.trim().toLowerCase().replace(/:\d+$/, '')
    if (
      normalizedHostname === 'localhost' ||
      normalizedHostname === '127.0.0.1' ||
      normalizedHostname === '::1' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHostname)
    ) {
      return null
    }

    const parts = normalizedHostname.split('.').filter(Boolean)
    if (parts.length < 3 || parts[0] === 'www') {
      return null
    }

    return parts[0]
  }
}
