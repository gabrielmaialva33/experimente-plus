import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import type { EffectiveAttributeDefinition } from '#modules/establishments/services/effective_category_attributes_service'

export interface EstablishmentCompletenessEvaluationContext {
  revision: EstablishmentRevision
  organization_active: boolean
  city_active: boolean
  effective_attributes: readonly EffectiveAttributeDefinition[]
  allows_always_open: boolean
  checked_at: string
}

export function evaluateEstablishmentCompleteness({
  revision,
  organization_active: organizationActive,
  city_active: cityActive,
  effective_attributes: effectiveAttributes,
  allows_always_open: allowsAlwaysOpen,
  checked_at: checkedAt,
}: EstablishmentCompletenessEvaluationContext): IEstablishment.CompletenessResult {
  const blocking: IEstablishment.CompletenessIssue[] = []
  const warnings: IEstablishment.CompletenessIssue[] = []
  let score = 0

  if (organizationActive) {
    score += 15
  } else {
    blocking.push(
      issue(
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
      issue('public_identity_missing', 'public_name', 'Public name and a description are required')
    )
  }

  if (!cityActive) {
    blocking.push(issue('city_inactive', 'city_id', 'An active city is required'))
  }

  const address = revision.address
  const hasAddress = Boolean(
    address?.street?.trim() &&
    address.district?.trim() &&
    (address.without_number || address.number?.trim())
  )
  if (hasAddress && cityActive) {
    score += 10
  } else {
    blocking.push(issue('address_missing', 'address', 'Street, district and number are required'))
  }

  const hasLatitude = address?.latitude !== null && address?.latitude !== undefined
  const hasLongitude = address?.longitude !== null && address?.longitude !== undefined
  if (hasLatitude && hasLongitude) {
    score += 10
  } else {
    blocking.push(issue('coordinates_missing', 'address.coordinates', 'Coordinates are required'))
  }

  const primaryCategory = revision.categories.find((category) => category.is_primary)
  const primaryCategoryIsActive = Boolean(primaryCategory?.category?.is_active)
  if (!primaryCategory || !primaryCategoryIsActive) {
    blocking.push(
      issue(
        primaryCategory ? 'category_inactive' : 'primary_category_missing',
        'categories',
        'An active primary category is required'
      )
    )
  } else {
    score += 10
    const valuesByDefinition = new Map(
      revision.attribute_values.map((value) => [value.attribute_definition_id, value] as const)
    )
    const missingRequired = effectiveAttributes.filter(({ definition }) => {
      if (!definition.is_required) return false
      const value = valuesByDefinition.get(definition.id)
      if (!value) return true
      return !hasAttributeValue(value)
    })

    if (missingRequired.length === 0) {
      score += 5
    } else {
      for (const { definition } of missingRequired) {
        blocking.push(
          issue(
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
      issue('availability_missing', 'availability_type', 'Availability mode is required')
    )
  } else if (revision.availability_type === 'regular_hours') {
    if (revision.hours.length > 0) {
      score += 15
    } else {
      blocking.push(
        issue('weekly_hours_missing', 'hours', 'Regular availability requires weekly hours')
      )
    }
  } else if (revision.availability_type === 'appointment_only') {
    if (revision.public_phone || revision.whatsapp || revision.booking_url) {
      score += 15
    } else {
      blocking.push(
        issue(
          'appointment_contact_missing',
          'booking_url',
          'Appointment-only availability requires a booking contact'
        )
      )
    }
  } else if (primaryCategory && primaryCategoryIsActive) {
    if (allowsAlwaysOpen) {
      score += 15
    } else {
      blocking.push(
        issue(
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
      issue('contact_channel_missing', 'contacts', 'At least one public contact is required')
    )
  }

  const eligibleMedia = revision.media.filter((item) =>
    ['pending', 'approved'].includes(item.moderation_status)
  )
  const quarantinedMedia = revision.media.filter((item) => item.moderation_status === 'quarantined')
  let mediaComplete = true

  if (eligibleMedia.length === 0) {
    mediaComplete = false
    blocking.push(
      issue('media_missing', 'media', 'At least one pending or approved image is required')
    )
  } else {
    const coverCount = eligibleMedia.filter((item) => item.is_cover).length
    if (coverCount !== 1) {
      mediaComplete = false
      blocking.push(
        issue(
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
      issue('media_quarantined', 'media', 'Quarantined media must be removed before submission', {
        media_ids: quarantinedMedia.map((item) => item.id),
      })
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
    checked_at: checkedAt,
    rules_version: revision.rules_version,
  }
}

function hasAttributeValue(value: {
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

function issue(
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
