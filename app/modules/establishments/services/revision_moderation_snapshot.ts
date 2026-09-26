import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'

/**
 * What a moderator reads to decide — ADR-0012, audit finding W2 (26/09/2026).
 *
 * One flat map of display values per field of a revision, from the aggregate
 * `findAggregate` already loads. The same shape for the submitted revision and
 * for the one on the public page lets the screen mark what changed without any
 * rule of its own: a field changed when its value differs. `null` means empty.
 * Keys are stable; the labels belong to the screen.
 */
export type ModerationSnapshot = Record<string, string | null>

const WEEKDAYS = 7

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function hoursFor(revision: EstablishmentRevision, weekday: number): string | null {
  const intervals = revision.hours
    .filter((hour) => hour.weekday === weekday)
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
    .map((hour) => {
      const opens = hour.opens_at.slice(0, 5)
      const closes = hour.closes_at.slice(0, 5)
      return hour.spans_next_day ? `${opens}–${closes} (+1 dia)` : `${opens}–${closes}`
    })

  return intervals.length > 0 ? intervals.join(', ') : null
}

function attributeValue(value: EstablishmentRevision['attribute_values'][number]): string | null {
  const selected = (value.selected_options ?? [])
    .map((selectedOption) => selectedOption.option?.label)
    .filter((label): label is string => Boolean(label))
  if (selected.length > 0) return selected.sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ')
  if (value.value_boolean !== null && value.value_boolean !== undefined) {
    return value.value_boolean ? 'Sim' : 'Não'
  }
  if (value.value_integer !== null && value.value_integer !== undefined) {
    return String(value.value_integer)
  }
  if (value.value_decimal !== null && value.value_decimal !== undefined) {
    return String(value.value_decimal).replace('.', ',')
  }
  return clean(value.value_url) ?? clean(value.value_text)
}

export function moderationSnapshot(revision: EstablishmentRevision): ModerationSnapshot {
  const address = revision.address
  const snapshot: ModerationSnapshot = {
    'identity.public_name': clean(revision.public_name),
    'identity.city': clean(revision.city?.name),
    'identity.short_description': clean(revision.short_description),
    'identity.description': clean(revision.description),
    'identity.availability_type': clean(revision.availability_type),
    'contacts.public_phone': clean(revision.public_phone),
    'contacts.whatsapp': clean(revision.whatsapp),
    'contacts.public_email': clean(revision.public_email),
    'contacts.website': clean(revision.website),
    'contacts.instagram': clean(revision.instagram),
    'contacts.booking_url': clean(revision.booking_url),
    'address.street': clean(address?.street),
    'address.number': address?.without_number ? 's/n' : clean(address?.number),
    'address.complement': clean(address?.complement),
    'address.district': clean(address?.district),
    'address.postal_code': clean(address?.postal_code),
    'address.reference': clean(address?.reference),
    'address.coordinates':
      address && address.latitude !== null && address.longitude !== null
        ? `${Number(address.latitude).toFixed(5)}, ${Number(address.longitude).toFixed(5)}`
        : null,
  }

  for (let weekday = 0; weekday < WEEKDAYS; weekday++) {
    snapshot[`hours.${weekday}`] = hoursFor(revision, weekday)
  }

  const categories = [...revision.categories].sort(
    (left, right) =>
      Number(right.is_primary) - Number(left.is_primary) ||
      left.sort_order - right.sort_order ||
      left.id - right.id
  )
  snapshot['categories.primary'] = clean(categories.find((item) => item.is_primary)?.category?.name)
  snapshot['categories.all'] =
    categories
      .map((item) => item.category?.name)
      .filter((name): name is string => Boolean(name))
      .join(', ') || null

  for (const value of revision.attribute_values) {
    const name = value.definition?.name
    const key = value.definition?.key
    if (!name || !key) continue
    snapshot[`attributes.${key}`] = attributeValue(value)
  }

  const covers = revision.media.filter((item) => item.is_cover)
  snapshot['media.cover'] = covers.length > 0 ? `Mídia ${covers[0].media_asset_id}` : null
  snapshot['media.count'] = revision.media.length > 0 ? String(revision.media.length) : null

  return snapshot
}

/** Readable names for attribute keys, which only the aggregate knows. */
export function attributeLabels(revision: EstablishmentRevision): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const value of revision.attribute_values) {
    if (value.definition?.key && value.definition?.name) {
      labels[`attributes.${value.definition.key}`] = value.definition.name
    }
  }
  return labels
}
