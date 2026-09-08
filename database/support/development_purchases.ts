import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import City from '#modules/geography/models/city'
import Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'

export const DEVELOPMENT_PURCHASE_EDITION_SLUG = 'experimente-londrina-compra-local'

/** Additional paid edition; never grants courtesy access or rewrites purchased terms. */
export async function seedDevelopmentPurchases(tenant: Tenant, administrator: User, partner: User) {
  return db.transaction(async (client) => {
    await Tenant.query({ client }).where('id', tenant.id).forUpdate().firstOrFail()
    const city = await City.query({ client })
      .where('tenant_id', tenant.id)
      .where('slug', 'londrina')
      .firstOrFail()
    const revision = await EstablishmentRevision.query({ client })
      .where('tenant_id', tenant.id)
      .where('slug', 'bar-estacao-43-londrina')
      .firstOrFail()
    const now = DateTime.utc().startOf('day')
    // Stable identity and create-only terms: rerunning after payment must preserve the sale.
    const edition = await BenefitEdition.firstOrCreate(
      { tenant_id: tenant.id, slug: DEVELOPMENT_PURCHASE_EDITION_SLUG },
      {
        tenant_id: tenant.id,
        city_id: city.id,
        slug: DEVELOPMENT_PURCHASE_EDITION_SLUG,
        name: 'Experimente Londrina — Compra local EP-14',
        description:
          'Edição fictícia adicional para demonstrar compra, pagamento simulado e uso. Sem cobrança real no adaptador falso.',
        price_cents: 4990,
        currency: 'BRL',
        sales_starts_at: now.minus({ days: 1 }),
        sales_ends_at: now.plus({ months: 3 }),
        usage_starts_at: now,
        usage_ends_at: now.plus({ months: 8 }),
        status: 'published',
        created_by: administrator.id,
        published_at: now,
        archived_at: null,
      },
      { client }
    )
    await BenefitOffer.firstOrCreate(
      { tenant_id: tenant.id, edition_id: edition.id, establishment_id: revision.establishment_id },
      {
        tenant_id: tenant.id,
        edition_id: edition.id,
        establishment_id: revision.establishment_id,
        standalone_price_cents: 1490,
        title: 'Petisco em dobro — edição de compra local',
        description: 'Peça um petisco participante e receba outro de valor igual ou menor.',
        benefit_type: 'buy_one_get_one',
        terms: 'Oferta fictícia para demonstração local. Consumo no local, não cumulativa.',
        available_weekdays_mask: 127,
        reservation_required: false,
        on_premise_only: true,
        minimum_party_size: 1,
        max_redemptions_per_access: 2,
        status: 'active',
        created_by: partner.id,
        activated_at: edition.published_at,
      },
      { client }
    )
    return edition
  })
}
