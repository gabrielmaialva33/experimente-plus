import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import CatalogSearchRepository from '#modules/catalog/repositories/catalog_search_repository'
import CatalogCacheService from '#modules/catalog/services/catalog_cache_service'
import CityRepository from '#modules/geography/repositories/city_repository'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentRepository, {
  type CityAgendaRow,
} from '#modules/partner_content/repositories/partner_content_repository'
import { cityDayWindow } from '#modules/partner_content/services/city_day_window'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

/**
 * The agenda of a city — the discovery surface of ADR-0028 §5.
 *
 * Three chronological bands, and nothing else. There is no ranking, no score and
 * no paid placement here, because no accepted decision defines prominence for
 * partner content: inventing one in a service would be inventing a contract. So
 * "Acontecendo hoje" and "Em breve" are ordered by when the event starts,
 * "Novidades" by when the experience was published, and ties break on the
 * establishment slug and then the identifier so the same data always produces the
 * same page.
 *
 * Cost is fixed: one statement per band plus one batched media read per kind.
 * Never a query per establishment — that is what made the establishment page do
 * six sequential round trips, and a city band would multiply it by the number of
 * units in the city.
 */

/** Deliberately small: a band is a glance, not a catalogue. */
export const CITY_AGENDA_LIMITS = {
  happening_today: 12,
  upcoming: 12,
  new_experiences: 8,
} as const

@inject()
export default class CityAgendaService {
  constructor(
    private operationResolver: PublicOperationResolver,
    private cityRepository: CityRepository,
    private catalogRepository: CatalogSearchRepository,
    private cacheService: CatalogCacheService,
    private contentRepository: PartnerContentRepository,
    private mediaService: PartnerContentMediaService
  ) {}

  /** Public discovery: the operation comes from the hostname (ADR-0003). */
  async forCity(
    hostname: string | null,
    citySlug: string
  ): Promise<IPartnerContent.CityAgendaResponse> {
    const tenant = await this.operationResolver.resolve(hostname)
    const city = await this.cityRepository.findBySlugForTenant(tenant.id, citySlug)

    if (!city || !city.is_active || !city.region?.is_active) {
      throw new NotFoundException('City not found')
    }

    // One city per request means one timezone per request. The local day is
    // resolved here, once, and everything below compares absolute instants.
    const window = cityDayWindow(DateTime.utc(), city.timezone)
    const projectionVersion = await this.catalogRepository.getProjectionVersion(tenant.id)
    const cacheKey = this.cacheService.key([
      'city-agenda',
      tenant.id,
      projectionVersion,
      city.slug,
      window.local_date,
    ])

    return this.cacheService.remember(cacheKey, 60, async () => {
      // Keep the reads serial: Lucid may bind these to a transaction-bound pg
      // connection, which cannot carry concurrent queries.
      const happeningTodayRows = await this.contentRepository.listCityAgendaHappeningToday(
        tenant.id,
        city.id,
        window,
        CITY_AGENDA_LIMITS.happening_today
      )
      const upcomingRows = await this.contentRepository.listCityAgendaUpcoming(
        tenant.id,
        city.id,
        window,
        CITY_AGENDA_LIMITS.upcoming
      )
      const newExperienceRows = await this.contentRepository.listCityAgendaNewExperiences(
        tenant.id,
        city.id,
        CITY_AGENDA_LIMITS.new_experiences
      )

      // One media read per kind, for both event bands at once.
      const eventCovers = await this.covers('event', tenant.id, [
        ...happeningTodayRows,
        ...upcomingRows,
      ])
      const experienceCovers = await this.covers('experience', tenant.id, newExperienceRows)

      return {
        city: {
          slug: city.slug,
          name: city.name,
          state_code: city.state_code,
          timezone: window.timezone,
        },
        local_date: window.local_date,
        happening_today: this.eventItems(happeningTodayRows, eventCovers),
        upcoming: this.eventItems(upcomingRows, eventCovers),
        new_experiences: this.experienceItems(newExperienceRows, experienceCovers),
      }
    })
  }

  /**
   * The approved cover of each item, batched.
   *
   * `publicForContents` already filters to approved media and orders it
   * cover-first, so the first row of each group is the cover — or the first
   * approved image when the partner never marked one.
   */
  private async covers(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    rows: readonly CityAgendaRow[]
  ): Promise<Map<number, IPartnerContent.DiscoveryCover>> {
    const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id))

    if (ids.length === 0) return new Map()

    const media = await this.mediaService.publicForContents(kind, tenantId, ids)
    const covers = new Map<number, IPartnerContent.DiscoveryCover>()

    for (const [contentId, entries] of media) {
      const first = entries[0]
      if (!first) continue

      covers.set(contentId, {
        url: first.asset.url,
        alt_text: first.alt_text,
        width: first.asset.width,
        height: first.asset.height,
      })
    }

    return covers
  }

  private eventItems(
    rows: readonly CityAgendaRow[],
    covers: Map<number, IPartnerContent.DiscoveryCover>
  ): IPartnerContent.CityAgendaEventItem[] {
    return rows.flatMap((row) => {
      const identity = this.identity(row)
      const startsAt = this.instant(row.starts_at)
      const endsAt = this.instant(row.ends_at)

      if (!identity || !startsAt || !endsAt) return []

      return [
        {
          id: identity.id,
          kind: 'event' as const,
          title: identity.title,
          description: this.text(row.description),
          starts_at: startsAt,
          ends_at: endsAt,
          cover: covers.get(identity.id) ?? null,
          establishment: identity.establishment,
          city_slug: identity.city_slug,
        },
      ]
    })
  }

  private experienceItems(
    rows: readonly CityAgendaRow[],
    covers: Map<number, IPartnerContent.DiscoveryCover>
  ): IPartnerContent.CityAgendaExperienceItem[] {
    return rows.flatMap((row) => {
      const identity = this.identity(row)
      const publishedAt = this.instant(row.published_at)

      if (!identity || !publishedAt) return []

      return [
        {
          id: identity.id,
          kind: 'experience' as const,
          title: identity.title,
          description: this.text(row.description),
          published_at: publishedAt,
          cover: covers.get(identity.id) ?? null,
          establishment: identity.establishment,
          city_slug: identity.city_slug,
        },
      ]
    })
  }

  /**
   * What every band item needs to exist at all: an identifier, a title from the
   * snapshot and the slug pair the public link is built from. A row missing any
   * of them is dropped instead of rendered as a card that leads nowhere.
   */
  private identity(row: CityAgendaRow): {
    id: number
    title: string
    establishment: IPartnerContent.DiscoveryEstablishment
    city_slug: string
  } | null {
    const id = Number(row.id)
    const title = this.text(row.title)
    const slug = this.text(row.establishment_slug)
    const name = this.text(row.establishment_name)
    const citySlug = this.text(row.city_slug)

    if (!Number.isInteger(id) || id <= 0 || !title || !slug || !name || !citySlug) {
      return null
    }

    return { id, title, establishment: { slug, name }, city_slug: citySlug }
  }

  private text(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  /**
   * `timestamptz` comes back as a driver `Date` and, depending on the path, as a
   * string. Both are re-emitted as a UTC instant so the payload is identical
   * whatever the connection's session zone is — the SSR markup and the hydrated
   * page have to agree exactly.
   */
  private instant(value: string | Date | null): string | null {
    if (value instanceof Date) {
      const fromDate = DateTime.fromJSDate(value, { zone: 'utc' })
      return fromDate.isValid ? fromDate.toISO() : null
    }

    const raw = this.text(value)
    if (!raw) return null

    const parsed = DateTime.fromISO(raw, { zone: 'utc' })
    if (parsed.isValid) return parsed.toISO()

    const fromSql = DateTime.fromSQL(raw, { zone: 'utc' })
    return fromSql.isValid ? fromSql.toISO() : null
  }
}
