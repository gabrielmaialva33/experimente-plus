import { DateTime } from 'luxon'

import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import City from '#modules/geography/models/city'
import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'

interface DevelopmentBenefitDefinition {
  city_slug: string
  edition_name: string
  edition_slug: string
  establishment_slug: string
  offer_title: string
  offer_description: string
  benefit_type: 'buy_one_get_one' | 'complimentary_item'
  terms: string
}

const DEVELOPMENT_BENEFITS: DevelopmentBenefitDefinition[] = [
  {
    city_slug: 'londrina',
    edition_name: 'Experimente Londrina — Piloto',
    edition_slug: 'experimente-londrina-piloto',
    establishment_slug: 'bar-estacao-43-londrina',
    offer_title: 'Peça um petisco e receba outro',
    offer_description:
      'Na compra de um petisco participante, receba outro de valor igual ou menor.',
    benefit_type: 'buy_one_get_one',
    terms: 'Válido para consumo no local, uma vez por acesso. Não cumulativo com outras promoções.',
  },
  {
    city_slug: 'cornelio-procopio',
    edition_name: 'Experimente Cornélio Procópio — Piloto',
    edition_slug: 'experimente-cornelio-procopio-piloto',
    establishment_slug: 'cafe-aurora-cornelio-procopio',
    offer_title: 'Café filtrado de cortesia',
    offer_description:
      'Receba um café filtrado da casa na compra de qualquer item da confeitaria artesanal.',
    benefit_type: 'complimentary_item',
    terms:
      'Válido para consumo no local, uma vez por acesso e sujeito à disponibilidade do grão do dia.',
  },
]

export async function seedDevelopmentBenefits(
  tenant: Tenant,
  administrator: User,
  partner: User,
  holder: User
): Promise<void> {
  const organization = await Organization.query()
    .where('tenant_id', tenant.id)
    .where('slug', 'grupo-experimente-norte')
    .firstOrFail()

  await OrganizationMember.updateOrCreate(
    {
      tenant_id: tenant.id,
      organization_id: organization.id,
      user_id: partner.id,
    },
    {
      tenant_id: tenant.id,
      organization_id: organization.id,
      user_id: partner.id,
      role: 'admin',
      status: 'active',
      invited_by: administrator.id,
      joined_at: DateTime.utc(),
      suspended_at: null,
      removed_at: null,
    }
  )

  const now = DateTime.utc().startOf('day')
  for (const definition of DEVELOPMENT_BENEFITS) {
    const city = await City.query()
      .where('tenant_id', tenant.id)
      .where('slug', definition.city_slug)
      .firstOrFail()
    const revision = await EstablishmentRevision.query()
      .where('tenant_id', tenant.id)
      .where('slug', definition.establishment_slug)
      .firstOrFail()
    const establishment = await Establishment.query()
      .where('tenant_id', tenant.id)
      .where('id', revision.establishment_id)
      .firstOrFail()

    const edition = await BenefitEdition.updateOrCreate(
      { tenant_id: tenant.id, slug: definition.edition_slug },
      {
        tenant_id: tenant.id,
        city_id: city.id,
        name: definition.edition_name,
        slug: definition.edition_slug,
        description: `Edição fictícia preparada para validar o piloto operacional em ${city.name}.`,
        price_cents: 0,
        currency: 'BRL',
        sales_starts_at: now.minus({ days: 30 }),
        sales_ends_at: now.plus({ months: 3 }),
        usage_starts_at: now.minus({ days: 1 }),
        usage_ends_at: now.plus({ months: 8 }),
        status: 'published',
        created_by: administrator.id,
        published_at: now,
        archived_at: null,
      }
    )

    await BenefitOffer.updateOrCreate(
      {
        tenant_id: tenant.id,
        edition_id: edition.id,
        establishment_id: establishment.id,
      },
      {
        tenant_id: tenant.id,
        edition_id: edition.id,
        establishment_id: establishment.id,
        title: definition.offer_title,
        description: definition.offer_description,
        benefit_type: definition.benefit_type,
        discount_percentage: null,
        discount_amount_cents: null,
        terms: definition.terms,
        available_weekdays_mask: 127,
        daily_start_time: null,
        daily_end_time: null,
        starts_at: null,
        ends_at: null,
        reservation_required: false,
        on_premise_only: true,
        minimum_party_size: 1,
        max_redemptions_per_access: 1,
        status: 'active',
        created_by: partner.id,
        activated_at: now,
        archived_at: null,
      }
    )

    await BenefitAccess.updateOrCreate(
      {
        tenant_id: tenant.id,
        source: 'courtesy',
        external_reference: `development:${definition.edition_slug}:${holder.id}`,
      },
      {
        tenant_id: tenant.id,
        edition_id: edition.id,
        user_id: holder.id,
        source: 'courtesy',
        status: 'active',
        external_reference: `development:${definition.edition_slug}:${holder.id}`,
        notes: 'Acesso fictício preparado para o piloto operacional local.',
        granted_by: administrator.id,
        granted_at: now,
        revoked_by: null,
        revoked_at: null,
        revocation_reason: null,
      }
    )
  }
}
