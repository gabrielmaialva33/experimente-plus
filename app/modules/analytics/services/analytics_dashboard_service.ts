import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsDashboardRepository from '#modules/analytics/repositories/analytics_dashboard_repository'
import AnalyticsPolicyService from '#modules/analytics/services/analytics_policy_service'
import type User from '#modules/users/models/user'

interface NormalizedRange {
  from: string
  to: string
}

@inject()
export default class AnalyticsDashboardService {
  constructor(
    private repository: AnalyticsDashboardRepository,
    private policy: AnalyticsPolicyService
  ) {}

  async organizationDashboard(
    tenantId: number,
    organizationId: number,
    actor: User,
    query: IAnalytics.DateRangeQuery
  ): Promise<IAnalytics.OrganizationDashboard> {
    if (!(await this.repository.organizationExists(tenantId, organizationId))) {
      throw new NotFoundException('Organization analytics not found')
    }

    await this.policy.requireOrganizationRead(tenantId, organizationId, actor)

    if (
      query.establishment_id !== undefined &&
      !(await this.repository.establishmentBelongsToOrganization(
        tenantId,
        organizationId,
        query.establishment_id
      ))
    ) {
      throw new NotFoundException('Establishment analytics not found')
    }

    const range = this.normalizeRange(query.from, query.to)
    const dashboard = await this.repository.organizationDashboard(tenantId, organizationId, {
      ...range,
      establishmentId: query.establishment_id,
    })

    return {
      organization_id: organizationId,
      from: range.from,
      to: range.to,
      totals: dashboard.totals,
      timeseries: dashboard.series,
      establishments: dashboard.establishments,
    }
  }

  async searchTerms(
    tenantId: number,
    actor: User,
    query: IAnalytics.AdminSearchQuery
  ): Promise<IAnalytics.SearchTermsPage> {
    await this.policy.requirePlatformSearchRead(actor)

    if (
      query.city_id !== undefined &&
      !(await this.repository.cityExists(tenantId, query.city_id))
    ) {
      throw new NotFoundException('Analytics city not found')
    }

    const range = this.normalizeRange(query.from, query.to)

    return this.repository.searchTerms(tenantId, {
      ...range,
      cityId: query.city_id,
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    })
  }

  private normalizeRange(from?: string, to?: string): NormalizedRange {
    const today = DateTime.utc().startOf('day')
    const normalizedTo = to ? DateTime.fromISO(to, { zone: 'utc' }) : today
    const normalizedFrom = from
      ? DateTime.fromISO(from, { zone: 'utc' })
      : normalizedTo.minus({ days: 29 })

    if (!normalizedFrom.isValid || !normalizedTo.isValid) {
      throw new BadRequestException('Analytics dates must use the YYYY-MM-DD format')
    }

    const fromDay = normalizedFrom.startOf('day')
    const toDay = normalizedTo.startOf('day')

    if (fromDay > toDay) {
      throw new BadRequestException('Analytics from date must not be after the to date')
    }

    if (toDay.diff(fromDay, 'days').days > 365) {
      throw new BadRequestException('Analytics date ranges may span at most 366 days')
    }

    if (toDay > today) {
      throw new BadRequestException('Analytics date ranges cannot include future dates')
    }

    return {
      from: fromDay.toISODate()!,
      to: toDay.toISODate()!,
    }
  }
}
