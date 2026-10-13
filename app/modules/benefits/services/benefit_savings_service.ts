import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import IBenefitSavings, {
  AVERAGE_TICKET_ATTRIBUTE_KEY,
  SAVINGS_TOP_PLACES_LIMIT,
} from '#modules/benefits/interfaces/benefit_savings_interface'
import BenefitRedemptionRepository from '#modules/benefits/repositories/benefit_redemption_repository'
import EstablishmentRevisionAttributeValueRepository from '#modules/establishments/repositories/establishment_revision_attribute_value_repository'

type Row = IBenefitSavings.RedemptionRow

/** What one use is worth, or why it has no value. */
type UseValue =
  | { kind: 'exact'; cents: number }
  | { kind: 'estimated'; cents: number }
  | { kind: 'without_estimate' }
  | { kind: 'no_money' }

/**
 * The money a person saved with their benefits and the places they visited.
 *
 * Every use counts as a visit, whatever happened to its access afterwards: a
 * use is an immutable receipt of a discount the place gave, so a refund or a
 * revocation that came later takes away what is left, not what was used. The
 * receipts themselves stay in the person's history for the same reason.
 *
 * - A fixed-amount discount is exact. The use keeps the type it had
 *   (`benefit_type_snapshot`) but no copy of the amount, so the amount is read
 *   from the offer. An offer can only change while paused; if its amount was
 *   edited after a use, that use counts at the new amount, and if its type
 *   changed, the use has no value and counts in `uses_without_estimate`.
 * - A percentage discount is an estimate: the percentage of the place's
 *   "Ticket médio" (reais per person, from its published page), once per use,
 *   whatever the party size. A place without one adds nothing and the use
 *   counts in `uses_without_estimate`. The ticket is the place's current one.
 * - Every other type (buy one get one, courtesy item, custom) has no money
 *   value and counts only as a use.
 *
 * An edition is past once its usage window closed; the rest are current.
 */
@inject()
export default class BenefitSavingsService {
  constructor(
    private redemptions: BenefitRedemptionRepository,
    private attributeValues: EstablishmentRevisionAttributeValueRepository
  ) {}

  async forHolder(
    tenantId: number,
    userId: number,
    now: DateTime = DateTime.utc()
  ): Promise<IBenefitSavings.Projection> {
    const rows = await this.redemptions.listSavingsRowsForHolder(tenantId, userId)
    const ticketsInReais = await this.attributeValues.listPublishedNumericValues(
      tenantId,
      [...new Set(rows.map((row) => Number(row.establishment_id)))],
      AVERAGE_TICKET_ATTRIBUTE_KEY
    )

    const current: Row[] = []
    const pastByEdition = new Map<number, Row[]>()
    for (const row of rows) {
      if (DateTime.fromJSDate(row.edition_usage_ends_at) < now) {
        const matches = pastByEdition.get(row.edition_id) ?? []
        matches.push(row)
        pastByEdition.set(row.edition_id, matches)
      } else {
        current.push(row)
      }
    }

    const editionsOf = (group: Row[]) =>
      [...new Map(group.map((row) => [row.edition_id, editionReference(row)])).values()].sort(
        (left, right) => right.year - left.year || left.name.localeCompare(right.name, 'pt-BR')
      )

    const past = [...pastByEdition.values()]
      .map((group) => ({ edition: editionReference(group[0]), ...totals(group, ticketsInReais) }))
      .sort(
        (left, right) =>
          right.edition.year - left.edition.year ||
          // Rows arrive newest first, so the latest use of each edition is its first row.
          lastUse(pastByEdition, right.edition.id) - lastUse(pastByEdition, left.edition.id)
      )

    return {
      currency: 'BRL',
      current: { editions: editionsOf(current), ...totals(current, ticketsInReais) },
      past,
    }
  }
}

/** Every operation of the pilot is in Paraná; the city's own zone wins when it is valid. */
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

function editionReference(row: Row): IBenefitSavings.EditionReference {
  const opens = DateTime.fromJSDate(row.edition_usage_starts_at)
  const local = opens.setZone(row.city_timezone)
  return {
    id: Number(row.edition_id),
    name: row.edition_name,
    year: (local.isValid ? local : opens.setZone(DEFAULT_TIME_ZONE)).year,
  }
}

function lastUse(groups: Map<number, Row[]>, editionId: number): number {
  return groups.get(editionId)?.[0]?.redeemed_at.getTime() ?? 0
}

/** The value of one use, from the type it had when it happened. */
export function valueOfUse(row: Row, ticketsInReais: Map<number, number>): UseValue {
  if (row.benefit_type_snapshot === 'fixed_amount') {
    const amount = Number(row.discount_amount_cents)
    return row.offer_benefit_type === 'fixed_amount' && amount > 0
      ? { kind: 'exact', cents: amount }
      : { kind: 'without_estimate' }
  }

  if (row.benefit_type_snapshot === 'percentage') {
    const percentage = Number(row.discount_percentage)
    const ticket = ticketsInReais.get(Number(row.establishment_id)) ?? 0
    if (row.offer_benefit_type !== 'percentage' || !(percentage > 0) || !(ticket > 0)) {
      return { kind: 'without_estimate' }
    }
    return {
      kind: 'estimated',
      cents: Math.round((ticket * 100 * Math.min(percentage, 100)) / 100),
    }
  }

  return { kind: 'no_money' }
}

export function totals(rows: Row[], ticketsInReais: Map<number, number>): IBenefitSavings.Totals {
  const visits = new Map<number, { name: string; visits: number }>()
  let exact = 0
  let estimated = 0
  let withoutEstimate = 0

  for (const row of rows) {
    const value = valueOfUse(row, ticketsInReais)
    if (value.kind === 'exact') exact += value.cents
    if (value.kind === 'estimated') estimated += value.cents
    if (value.kind === 'without_estimate') withoutEstimate += 1

    // Rows are newest first: a place is named as it was at its latest use.
    const place = visits.get(Number(row.establishment_id))
    if (place) place.visits += 1
    else
      visits.set(Number(row.establishment_id), { name: row.establishment_name_snapshot, visits: 1 })
  }

  return {
    places_visited: visits.size,
    benefits_used: rows.length,
    savings_exact_cents: exact,
    savings_estimated_cents: estimated,
    uses_without_estimate: withoutEstimate,
    top_places: [...visits.values()]
      .sort(
        (left, right) => right.visits - left.visits || left.name.localeCompare(right.name, 'pt-BR')
      )
      .slice(0, SAVINGS_TOP_PLACES_LIMIT),
  }
}
