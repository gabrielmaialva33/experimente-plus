import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EffectiveCategoryAttributesService from '#modules/establishments/services/effective_category_attributes_service'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import City from '#modules/geography/models/city'
import Organization from '#modules/organizations/models/organization'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentCompletenessService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private effectiveAttributesService: EffectiveCategoryAttributesService
  ) {}

  async check(
    tenantId: number,
    establishmentId: number,
    actor: User,
    revisionIdOverride?: number,
    client?: TransactionClientContract
  ): Promise<IEstablishment.CompletenessResult> {
    const establishment = await this.accessService.getReadable(tenantId, establishmentId, actor)
    const openRevision = revisionIdOverride
      ? null
      : await this.revisionRepository.findOpenForEstablishment(tenantId, establishment.id)
    const revisionId = revisionIdOverride ?? openRevision?.id ?? establishment.published_revision_id
    if (!revisionId) {
      throw new NotFoundException('Establishment revision not found')
    }

    const revision = await this.revisionRepository.findAggregate(tenantId, revisionId, client)
    if (!revision || revision.establishment_id !== establishment.id) {
      throw new NotFoundException('Establishment revision not found')
    }

    const blocking: IEstablishment.CompletenessIssue[] = []
    const warnings: IEstablishment.CompletenessIssue[] = []
    let score = 0

    const organizationQuery = client ? Organization.query({ client }) : Organization.query()
    organizationQuery.where('tenant_id', tenantId).where('id', establishment.organization_id)
    if (client) {
      organizationQuery.forUpdate()
    }
    const organization = await organizationQuery.first()
    if (organization?.status === 'active') {
      score += 15
    } else {
      blocking.push(
        this.issue(
          'organization_not_active',
          'organization_id',
          'The organization must be active before submission'
        )
      )
    }

    if (revision.public_name?.trim() && (revision.short_description || revision.description)) {
      score += 15
    } else {
      blocking.push(
        this.issue(
          'public_identity_missing',
          'public_name',
          'Public name and a description are required'
        )
      )
    }

    const city = revision.city_id
      ? await City.query()
          .where('tenant_id', tenantId)
          .where('id', revision.city_id)
          .where('is_active', true)
          .first()
      : null
    if (!city) {
      blocking.push(this.issue('city_inactive', 'city_id', 'An active city is required'))
    }

    const address = revision.address
    const hasAddress = Boolean(
      address?.street?.trim() &&
      address.district?.trim() &&
      (address.without_number || address.number?.trim())
    )
    if (hasAddress && city) {
      score += 10
    } else {
      blocking.push(
        this.issue('address_missing', 'address', 'Street, district and number are required')
      )
    }
    const hasLatitude = address?.latitude !== null && address?.latitude !== undefined
    const hasLongitude = address?.longitude !== null && address?.longitude !== undefined
    if (hasLatitude && hasLongitude) {
      score += 10
    } else {
      blocking.push(
        this.issue('coordinates_missing', 'address.coordinates', 'Coordinates are required')
      )
    }

    const primaryCategory = revision.categories.find((category) => category.is_primary)
    if (!primaryCategory || !primaryCategory.category.is_active) {
      blocking.push(
        this.issue(
          primaryCategory ? 'category_inactive' : 'primary_category_missing',
          'categories',
          'An active primary category is required'
        )
      )
    } else {
      score += 10
      const effective = await this.effectiveAttributesService.resolve(
        tenantId,
        primaryCategory.category_id
      )
      const valuesByDefinition = new Map(
        revision.attribute_values.map((value) => [value.attribute_definition_id, value] as const)
      )
      const missingRequired = effective.filter(({ definition }) => {
        if (!definition.is_required) return false
        const value = valuesByDefinition.get(definition.id)
        if (!value) return true
        return !this.hasAttributeValue(value)
      })

      if (missingRequired.length === 0) {
        score += 5
      } else {
        for (const { definition } of missingRequired) {
          blocking.push(
            this.issue(
              'required_attribute_missing',
              `attributes.${definition.key}`,
              `${definition.name} is required`,
              { attribute_definition_id: definition.id }
            )
          )
        }
      }
    }

    if (!revision.availability_type) {
      blocking.push(
        this.issue('availability_missing', 'availability_type', 'Availability mode is required')
      )
    } else if (revision.availability_type === 'regular_hours') {
      if (revision.hours.length > 0) {
        score += 15
      } else {
        blocking.push(
          this.issue('weekly_hours_missing', 'hours', 'Regular availability requires weekly hours')
        )
      }
    } else if (revision.availability_type === 'appointment_only') {
      if (revision.public_phone || revision.whatsapp || revision.booking_url) {
        score += 15
      } else {
        blocking.push(
          this.issue(
            'appointment_contact_missing',
            'booking_url',
            'Appointment-only availability requires a booking contact'
          )
        )
      }
    } else if (primaryCategory) {
      const allowed = await this.effectiveAttributesService.allowsAlwaysOpen(
        tenantId,
        primaryCategory.category_id
      )
      if (allowed) {
        score += 15
      } else {
        blocking.push(
          this.issue(
            'always_open_not_allowed',
            'availability_type',
            'The primary category does not allow always-open availability'
          )
        )
      }
    }

    if (
      revision.public_email ||
      revision.public_phone ||
      revision.whatsapp ||
      revision.website ||
      revision.instagram ||
      revision.booking_url
    ) {
      score += 10
    } else {
      blocking.push(
        this.issue('contact_channel_missing', 'contacts', 'At least one public contact is required')
      )
    }

    const eligibleMedia = revision.media.filter((item) =>
      ['pending', 'approved'].includes(item.moderation_status)
    )
    const quarantinedMedia = revision.media.filter(
      (item) => item.moderation_status === 'quarantined'
    )
    let mediaComplete = true

    if (eligibleMedia.length === 0) {
      mediaComplete = false
      blocking.push(
        this.issue('media_missing', 'media', 'At least one pending or approved image is required')
      )
    } else {
      const coverCount = eligibleMedia.filter((item) => item.is_cover).length
      if (coverCount !== 1) {
        mediaComplete = false
        blocking.push(
          this.issue(
            'cover_image_missing',
            'media.cover',
            'Exactly one pending or approved cover image is required',
            { eligible_media_count: eligibleMedia.length, cover_count: coverCount }
          )
        )
      }
    }

    if (quarantinedMedia.length > 0) {
      mediaComplete = false
      blocking.push(
        this.issue(
          'media_quarantined',
          'media',
          'Quarantined media must be removed before submission',
          { media_ids: quarantinedMedia.map((item) => item.id) }
        )
      )
    }

    if (mediaComplete) {
      score += 10
    }

    return {
      eligible: blocking.length === 0,
      score,
      blocking_issues: blocking,
      warnings,
      checked_at: DateTime.utc().toISO()!,
      rules_version: revision.rules_version,
    }
  }

  private hasAttributeValue(value: {
    value_text: string | null
    value_boolean: boolean | null
    value_integer: number | null
    value_decimal: number | null
    value_url: string | null
    selected_options: unknown[]
  }): boolean {
    return (
      value.value_text !== null ||
      value.value_boolean !== null ||
      value.value_integer !== null ||
      value.value_decimal !== null ||
      value.value_url !== null ||
      value.selected_options.length > 0
    )
  }

  private issue(
    code: string,
    field: string,
    message: string,
    metadata?: Record<string, unknown>
  ): IEstablishment.CompletenessIssue {
    return {
      code,
      field,
      message,
      severity: 'blocking',
      metadata,
    }
  }
}
