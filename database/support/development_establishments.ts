import { createHash } from 'node:crypto'

import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'

import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import { ESTABLISHMENT_COMPLETENESS_RULES_VERSION } from '#modules/establishments/interfaces/establishment_interface'
import StoredFile from '#modules/files/models/file'
import City from '#modules/geography/models/city'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import MediaModerationEvent from '#modules/media/models/media_moderation_event'
import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import env from '#start/env'

type AttributeDataType =
  | 'text'
  | 'long_text'
  | 'boolean'
  | 'integer'
  | 'decimal'
  | 'single_select'
  | 'multi_select'
  | 'url'

interface AttributeOptionSeed {
  label: string
  value: string
}

interface AttributeSeed {
  key: string
  name: string
  description: string
  data_type: AttributeDataType
  is_required?: boolean
  is_filterable?: boolean
  validation_rules?: Record<string, unknown>
  options?: AttributeOptionSeed[]
  selected_option?: string
  value_text?: string
  value_boolean?: boolean
  value_integer?: number
  value_decimal?: number
  value_url?: string
}

interface HourSeed {
  weekday: number
  opens_at: string
  closes_at: string
  spans_next_day?: boolean
  sort_order?: number
}

interface VenueSeed {
  slug: string
  public_name: string
  short_description: string
  description: string
  city_slug: string
  category_slug: string
  public_phone: string
  whatsapp: string
  public_email: string
  website: string
  instagram: string
  postal_code: string
  street: string
  number: string
  district: string
  latitude: number
  longitude: number
  hours: HourSeed[]
  attributes: AttributeSeed[]
  media_base64: string
  media_checksum: string
  media_alt_text: string
  media_caption: string
}

const APPROVED_AT = DateTime.fromISO('2026-08-24T12:00:00.000Z')
const SPECIAL_CLOSURE_DATE = '2026-12-25'

const VENUES: VenueSeed[] = [
  {
    slug: 'cafe-aurora-cornelio-procopio',
    public_name: 'Café Aurora',
    short_description: 'Cafeteria de bairro com cafés especiais e produção local.',
    description:
      'O Café Aurora reúne cafés especiais, confeitaria artesanal e ingredientes de produtores do Norte do Paraná em um ambiente acolhedor no centro de Cornélio Procópio.',
    city_slug: 'cornelio-procopio',
    category_slug: 'cafes',
    public_phone: '4335224100',
    whatsapp: '43999824100',
    public_email: 'contato@cafeaurora.local',
    website: 'https://cafeaurora.local',
    instagram: '@cafeaurora',
    postal_code: '86300000',
    street: 'Avenida XV de Novembro',
    number: '420',
    district: 'Centro',
    latitude: -23.1817,
    longitude: -50.6467,
    hours: [
      { weekday: 1, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
      { weekday: 1, opens_at: '14:00', closes_at: '19:00', sort_order: 1 },
      { weekday: 2, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
      { weekday: 2, opens_at: '14:00', closes_at: '19:00', sort_order: 1 },
      { weekday: 3, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
      { weekday: 3, opens_at: '14:00', closes_at: '19:00', sort_order: 1 },
      { weekday: 4, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
      { weekday: 4, opens_at: '14:00', closes_at: '19:00', sort_order: 1 },
      { weekday: 5, opens_at: '08:00', closes_at: '12:00', sort_order: 0 },
      { weekday: 5, opens_at: '14:00', closes_at: '19:00', sort_order: 1 },
      { weekday: 6, opens_at: '08:00', closes_at: '18:00', sort_order: 0 },
    ],
    attributes: [
      {
        key: 'specialty_coffee',
        name: 'Café especial',
        description: 'Informa se o estabelecimento trabalha com cafés especiais.',
        data_type: 'boolean',
        is_required: true,
        is_filterable: true,
        value_boolean: true,
      },
      {
        key: 'service_style',
        name: 'Estilo de atendimento',
        description: 'Principal formato de atendimento da unidade.',
        data_type: 'single_select',
        is_required: true,
        is_filterable: true,
        options: [
          { label: 'No balcão', value: 'counter' },
          { label: 'À mesa', value: 'table' },
          { label: 'Retirada', value: 'takeaway' },
        ],
        selected_option: 'table',
      },
      {
        key: 'average_ticket',
        name: 'Ticket médio',
        description: 'Valor médio por pessoa, em reais.',
        data_type: 'decimal',
        validation_rules: { minimum: 0, maximum: 500 },
        value_decimal: 42.5,
      },
    ],
    media_base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAFUlEQVR42mO82uLIgA0wMeAA9JAAAPG2AabwMWbPAAAAAElFTkSuQmCC',
    media_checksum: '6978382b237cb82dc4fd28216090139f0ba50c56e3cda890e38056eda8202bcb',
    media_alt_text: 'Fachada em tons quentes do Café Aurora em Cornélio Procópio',
    media_caption: 'Cafés especiais e confeitaria artesanal no centro da cidade.',
  },
  {
    slug: 'bar-estacao-43-londrina',
    public_name: 'Bar Estação 43',
    short_description: 'Bar regional com música ao vivo, petiscos e cervejas artesanais.',
    description:
      'O Bar Estação 43 combina receitas regionais, torneiras rotativas de cerveja artesanal e uma programação semanal de música ao vivo em Londrina.',
    city_slug: 'londrina',
    category_slug: 'bares',
    public_phone: '4333214343',
    whatsapp: '43999434343',
    public_email: 'reservas@estacao43.local',
    website: 'https://estacao43.local',
    instagram: '@estacao43',
    postal_code: '86020030',
    street: 'Rua Pernambuco',
    number: '743',
    district: 'Centro',
    latitude: -23.3103,
    longitude: -51.1628,
    hours: [
      { weekday: 3, opens_at: '17:00', closes_at: '23:59', sort_order: 0 },
      { weekday: 4, opens_at: '17:00', closes_at: '23:59', sort_order: 0 },
      { weekday: 5, opens_at: '17:00', closes_at: '02:00', spans_next_day: true, sort_order: 0 },
      { weekday: 6, opens_at: '12:00', closes_at: '16:00', sort_order: 0 },
      { weekday: 6, opens_at: '18:00', closes_at: '02:00', spans_next_day: true, sort_order: 1 },
      { weekday: 0, opens_at: '12:00', closes_at: '18:00', sort_order: 0 },
    ],
    attributes: [
      {
        key: 'live_music',
        name: 'Música ao vivo',
        description: 'Informa se a unidade possui programação de música ao vivo.',
        data_type: 'boolean',
        is_required: true,
        is_filterable: true,
        value_boolean: true,
      },
      {
        key: 'service_style',
        name: 'Estilo de atendimento',
        description: 'Principal formato de atendimento da unidade.',
        data_type: 'single_select',
        is_required: true,
        is_filterable: true,
        options: [
          { label: 'À mesa', value: 'table' },
          { label: 'No balcão', value: 'counter' },
          { label: 'Retirada', value: 'takeaway' },
        ],
        selected_option: 'table',
      },
      {
        key: 'minimum_age',
        name: 'Idade mínima',
        description: 'Idade mínima informada para eventos noturnos.',
        data_type: 'integer',
        validation_rules: { minimum: 0, maximum: 18 },
        value_integer: 18,
      },
    ],
    media_base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAFUlEQVR42mO0jy1mwAaYGHAAekgAAKCSARtNyVKtAAAAAElFTkSuQmCC',
    media_checksum: 'bdabe4bc9515194914d88a058e260db47cb7f93652afd62c206a6bf271af94a0',
    media_alt_text: 'Salão do Bar Estação 43 preparado para uma noite de música ao vivo',
    media_caption: 'Petiscos regionais, cervejas artesanais e música ao vivo.',
  },
  {
    slug: 'padaria-primavera-bandeirantes',
    public_name: 'Padaria Primavera',
    short_description: 'Panificação artesanal, café da manhã e encomendas em Bandeirantes.',
    description:
      'A Padaria Primavera serve pães de fermentação natural, café da manhã, confeitaria e encomendas para eventos, valorizando fornecedores da região.',
    city_slug: 'bandeirantes',
    category_slug: 'padarias',
    public_phone: '4335421200',
    whatsapp: '43999121200',
    public_email: 'atendimento@padariaprimavera.local',
    website: 'https://padariaprimavera.local',
    instagram: '@padariaprimavera',
    postal_code: '86360000',
    street: 'Avenida Bandeirantes',
    number: '315',
    district: 'Centro',
    latitude: -23.1078,
    longitude: -50.3671,
    hours: [
      { weekday: 1, opens_at: '06:30', closes_at: '19:30', sort_order: 0 },
      { weekday: 2, opens_at: '06:30', closes_at: '19:30', sort_order: 0 },
      { weekday: 3, opens_at: '06:30', closes_at: '19:30', sort_order: 0 },
      { weekday: 4, opens_at: '06:30', closes_at: '19:30', sort_order: 0 },
      { weekday: 5, opens_at: '06:30', closes_at: '19:30', sort_order: 0 },
      { weekday: 6, opens_at: '06:30', closes_at: '18:00', sort_order: 0 },
      { weekday: 0, opens_at: '07:00', closes_at: '12:30', sort_order: 0 },
    ],
    attributes: [
      {
        key: 'breakfast',
        name: 'Café da manhã',
        description: 'Informa se a unidade oferece café da manhã completo.',
        data_type: 'boolean',
        is_required: true,
        is_filterable: true,
        value_boolean: true,
      },
      {
        key: 'service_style',
        name: 'Estilo de atendimento',
        description: 'Principal formato de atendimento da unidade.',
        data_type: 'single_select',
        is_required: true,
        is_filterable: true,
        options: [
          { label: 'No balcão', value: 'counter' },
          { label: 'À mesa', value: 'table' },
          { label: 'Retirada', value: 'takeaway' },
        ],
        selected_option: 'counter',
      },
      {
        key: 'menu_url',
        name: 'Cardápio digital',
        description: 'Endereço público do cardápio da unidade.',
        data_type: 'url',
        value_url: 'https://padariaprimavera.local/cardapio',
      },
    ],
    media_base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAFUlEQVR42mOMdnZgwAaYGHAAekgAAISNAOrNAIELAAAAAElFTkSuQmCC',
    media_checksum: '76aed40130800102d6465a96415a33e34ec7ea5ec11a9c53a147640556994cc9',
    media_alt_text: 'Balcão da Padaria Primavera com pães artesanais recém-assados',
    media_caption: 'Panificação artesanal e café da manhã todos os dias.',
  },
]

export async function seedDevelopmentEstablishments(tenant: Tenant, rootUser: User): Promise<void> {
  const organization = await Organization.updateOrCreate(
    { tenant_id: tenant.id, slug: 'grupo-experimente-norte' },
    {
      tenant_id: tenant.id,
      legal_name: 'Experimente Norte Desenvolvimento Regional Ltda.',
      trade_name: 'Grupo Experimente Norte',
      slug: 'grupo-experimente-norte',
      tax_id: '12345678000195',
      email: 'contato@experimentenorte.local',
      phone: '4335224000',
      website: 'https://experimentenorte.local',
      status: 'active',
      created_by: rootUser.id,
      submitted_at: APPROVED_AT,
      reviewed_by: rootUser.id,
      reviewed_at: APPROVED_AT,
      review_notes: null,
      suspended_at: null,
      archived_at: null,
    }
  )

  await OrganizationMember.updateOrCreate(
    {
      tenant_id: tenant.id,
      organization_id: organization.id,
      user_id: rootUser.id,
    },
    {
      tenant_id: tenant.id,
      organization_id: organization.id,
      user_id: rootUser.id,
      role: 'owner',
      status: 'active',
      invited_by: null,
      joined_at: APPROVED_AT,
      suspended_at: null,
      removed_at: null,
    }
  )

  for (const venue of VENUES) {
    await seedVenue(tenant, rootUser, organization, venue)
  }
}

async function seedVenue(
  tenant: Tenant,
  rootUser: User,
  organization: Organization,
  venue: VenueSeed
): Promise<void> {
  const city = await City.query()
    .where('tenant_id', tenant.id)
    .where('slug', venue.city_slug)
    .firstOrFail()
  const category = await Category.query()
    .where('tenant_id', tenant.id)
    .where('slug', venue.category_slug)
    .firstOrFail()

  const existingRevision = await EstablishmentRevision.query()
    .where('tenant_id', tenant.id)
    .where('city_id', city.id)
    .where('slug', venue.slug)
    .first()

  const establishment = existingRevision
    ? await Establishment.findOrFail(existingRevision.establishment_id)
    : await Establishment.create({
        tenant_id: tenant.id,
        organization_id: organization.id,
        lifecycle_status: 'active',
        business_status: 'open',
        published_revision_id: null,
        created_by: rootUser.id,
      })

  establishment.organization_id = organization.id
  establishment.lifecycle_status = 'active'
  establishment.business_status = 'open'
  establishment.suspended_at = null
  establishment.archived_at = null
  await establishment.save()

  const revision = await EstablishmentRevision.updateOrCreate(
    {
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      version: 1,
    },
    {
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      version: 1,
      status: 'approved',
      city_id: city.id,
      public_name: venue.public_name,
      slug: venue.slug,
      short_description: venue.short_description,
      description: venue.description,
      public_phone: venue.public_phone,
      whatsapp: venue.whatsapp,
      public_email: venue.public_email,
      website: venue.website,
      instagram: venue.instagram,
      booking_url: null,
      availability_type: 'regular_hours',
      based_on_revision_id: null,
      created_by: rootUser.id,
      submitted_at: APPROVED_AT,
      reviewed_by: rootUser.id,
      reviewed_at: APPROVED_AT,
      review_notes: null,
      rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
    }
  )

  await EstablishmentRevisionAddress.updateOrCreate(
    { tenant_id: tenant.id, revision_id: revision.id },
    {
      tenant_id: tenant.id,
      revision_id: revision.id,
      postal_code: venue.postal_code,
      street: venue.street,
      number: venue.number,
      without_number: false,
      complement: null,
      district: venue.district,
      reference: null,
      latitude: venue.latitude,
      longitude: venue.longitude,
      coordinate_source: 'manual',
      geocoded_at: null,
    }
  )

  await EstablishmentRevisionCategory.query()
    .where('tenant_id', tenant.id)
    .where('revision_id', revision.id)
    .delete()
  await EstablishmentRevisionCategory.create({
    tenant_id: tenant.id,
    revision_id: revision.id,
    category_id: category.id,
    is_primary: true,
    sort_order: 0,
  })

  await seedAttributes(tenant, revision, category, venue.attributes)
  await seedHours(tenant, revision, venue.hours)
  await seedSpecialClosure(tenant, revision)
  await seedMedia(tenant, rootUser, establishment, revision, venue)

  establishment.published_revision_id = revision.id
  await establishment.save()
  await seedRevisionEvents(tenant, rootUser, establishment, revision)
}

async function seedAttributes(
  tenant: Tenant,
  revision: EstablishmentRevision,
  category: Category,
  attributes: AttributeSeed[]
): Promise<void> {
  await EstablishmentRevisionAttributeValue.query()
    .where('tenant_id', tenant.id)
    .where('revision_id', revision.id)
    .delete()

  for (const [index, attribute] of attributes.entries()) {
    const definition = await CategoryAttributeDefinition.updateOrCreate(
      {
        tenant_id: tenant.id,
        category_id: category.id,
        key: attribute.key,
      },
      {
        tenant_id: tenant.id,
        category_id: category.id,
        key: attribute.key,
        name: attribute.name,
        description: attribute.description,
        data_type: attribute.data_type,
        unit: attribute.data_type === 'decimal' ? 'BRL' : null,
        is_required: attribute.is_required ?? false,
        is_filterable: attribute.is_filterable ?? false,
        is_public: true,
        applies_to_descendants: false,
        sort_order: index,
        is_active: true,
        validation_rules: attribute.validation_rules ?? {},
      }
    )

    const options = new Map<string, CategoryAttributeOption>()
    for (const [optionIndex, optionSeed] of (attribute.options ?? []).entries()) {
      const option = await CategoryAttributeOption.updateOrCreate(
        {
          tenant_id: tenant.id,
          attribute_definition_id: definition.id,
          value: optionSeed.value,
        },
        {
          tenant_id: tenant.id,
          attribute_definition_id: definition.id,
          label: optionSeed.label,
          value: optionSeed.value,
          sort_order: optionIndex,
          is_active: true,
        }
      )
      options.set(option.value, option)
    }

    const value = await EstablishmentRevisionAttributeValue.create({
      tenant_id: tenant.id,
      revision_id: revision.id,
      attribute_definition_id: definition.id,
      value_text: attribute.value_text ?? null,
      value_boolean: attribute.value_boolean ?? null,
      value_integer: attribute.value_integer ?? null,
      value_decimal: attribute.value_decimal ?? null,
      value_url: attribute.value_url ?? null,
    })

    if (attribute.selected_option) {
      const selected = options.get(attribute.selected_option)
      if (!selected) {
        throw new Error(
          `Development seed option ${attribute.selected_option} is missing for ${attribute.key}`
        )
      }

      await EstablishmentRevisionAttributeValueOption.create({
        tenant_id: tenant.id,
        attribute_value_id: value.id,
        attribute_definition_id: definition.id,
        attribute_option_id: selected.id,
      })
    }
  }
}

async function seedHours(
  tenant: Tenant,
  revision: EstablishmentRevision,
  hours: HourSeed[]
): Promise<void> {
  await EstablishmentRevisionHour.query()
    .where('tenant_id', tenant.id)
    .where('revision_id', revision.id)
    .delete()

  await EstablishmentRevisionHour.createMany(
    hours.map((hour) => ({
      tenant_id: tenant.id,
      revision_id: revision.id,
      weekday: hour.weekday,
      opens_at: hour.opens_at,
      closes_at: hour.closes_at,
      spans_next_day: hour.spans_next_day ?? false,
      sort_order: hour.sort_order ?? 0,
    }))
  )
}

async function seedSpecialClosure(tenant: Tenant, revision: EstablishmentRevision): Promise<void> {
  await EstablishmentRevisionSpecialDay.query()
    .where('tenant_id', tenant.id)
    .where('revision_id', revision.id)
    .delete()

  await EstablishmentRevisionSpecialDay.create({
    tenant_id: tenant.id,
    revision_id: revision.id,
    date: SPECIAL_CLOSURE_DATE,
    status: 'closed',
    note: 'Fechado no feriado de Natal',
  })
}

async function seedRevisionEvents(
  tenant: Tenant,
  rootUser: User,
  establishment: Establishment,
  revision: EstablishmentRevision
): Promise<void> {
  const events = [
    {
      event_type: 'created' as const,
      from_status: null,
      to_status: 'draft' as const,
      reason: null,
      metadata: {
        source: 'development_seeder',
        rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
      },
    },
    {
      event_type: 'submitted' as const,
      from_status: 'draft' as const,
      to_status: 'pending_review' as const,
      reason: null,
      metadata: {
        source: 'development_seeder',
        score: 100,
        rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
      },
    },
    {
      event_type: 'approved' as const,
      from_status: 'pending_review' as const,
      to_status: 'approved' as const,
      reason: 'Ficha aprovada pelo seeder de desenvolvimento',
      metadata: {
        source: 'development_seeder',
        score: 100,
        rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
      },
    },
    {
      event_type: 'published' as const,
      from_status: 'approved' as const,
      to_status: 'approved' as const,
      reason: null,
      metadata: {
        source: 'development_seeder',
        published_revision_id: revision.id,
      },
    },
  ]

  for (const event of events) {
    await EstablishmentRevisionEvent.firstOrCreate(
      {
        tenant_id: tenant.id,
        establishment_id: establishment.id,
        revision_id: revision.id,
        event_type: event.event_type,
      },
      {
        tenant_id: tenant.id,
        establishment_id: establishment.id,
        revision_id: revision.id,
        event_type: event.event_type,
        from_status: event.from_status,
        to_status: event.to_status,
        actor_id: rootUser.id,
        reason: event.reason,
        metadata: event.metadata,
        created_at: APPROVED_AT,
      }
    )
  }
}

async function seedMedia(
  tenant: Tenant,
  rootUser: User,
  establishment: Establishment,
  revision: EstablishmentRevision,
  venue: VenueSeed
): Promise<void> {
  const buffer = Buffer.from(venue.media_base64, 'base64')
  const checksum = createHash('sha256').update(buffer).digest('hex')
  if (checksum !== venue.media_checksum) {
    throw new Error(`Development media checksum mismatch for ${venue.slug}`)
  }

  const disk = drive.use()
  const key = `seed/media/${tenant.id}/${venue.slug}/cover.png`
  await disk.put(key, buffer)
  const url = env.get('DRIVE_DISK') === 'fs' ? `/uploads/${key}` : await disk.getUrl(key)

  const storedFile = await StoredFile.updateOrCreate(
    { tenant_id: tenant.id, file_name: key },
    {
      tenant_id: tenant.id,
      owner_id: rootUser.id,
      client_name: `${venue.slug}-cover.png`,
      file_name: key,
      file_size: buffer.length,
      file_type: 'image/png',
      file_category: 'image',
      url,
    }
  )

  const asset = await MediaAsset.updateOrCreate(
    { file_id: storedFile.id },
    {
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      file_id: storedFile.id,
      media_type: 'image',
      file_extension: 'png',
      mime_type: 'image/png',
      checksum_sha256: checksum,
      width: 8,
      height: 6,
      created_by: rootUser.id,
    }
  )

  await EstablishmentRevisionMedia.query()
    .where('tenant_id', tenant.id)
    .where('revision_id', revision.id)
    .whereNot('media_asset_id', asset.id)
    .update({ is_cover: false })

  const media = await EstablishmentRevisionMedia.updateOrCreate(
    {
      tenant_id: tenant.id,
      revision_id: revision.id,
      media_asset_id: asset.id,
    },
    {
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      revision_id: revision.id,
      media_asset_id: asset.id,
      purpose: 'gallery',
      is_cover: true,
      sort_order: 0,
      alt_text: venue.media_alt_text,
      caption: venue.media_caption,
      moderation_status: 'approved',
      created_by: rootUser.id,
      reviewed_by: rootUser.id,
      reviewed_at: APPROVED_AT,
      review_notes: null,
    }
  )

  await MediaModerationEvent.firstOrCreate(
    {
      tenant_id: tenant.id,
      revision_media_id: media.id,
      to_status: 'approved',
    },
    {
      tenant_id: tenant.id,
      establishment_id: establishment.id,
      revision_id: revision.id,
      media_asset_id: asset.id,
      revision_media_id: media.id,
      from_status: 'pending',
      to_status: 'approved',
      actor_id: rootUser.id,
      reason: 'Mídia aprovada pelo seeder de desenvolvimento',
      metadata: { source: 'development_seeder' },
      created_at: APPROVED_AT,
    }
  )
}
