import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'

/**
 * Partner content rows (ADR-0028). Drafts by default; `published` takes the
 * snapshot exactly as `PartnerContentService` does, so public reads see the
 * item. Prefer the service in tests about the lifecycle itself.
 */
const EXPERIENCES = [
  'Aula de massa fresca em família',
  'Degustação guiada de cafés da região',
  'Oficina de cerâmica no torno',
  'Caminhada de observação de aves',
] as const

const EVENTS = [
  'Roda de samba ao vivo',
  'Noite de jazz instrumental',
  'Mostra de cinema paranaense',
  'Feira de artistas locais',
] as const

const SHOWCASE = [
  ['Café coado da semana', 1200],
  ['Pão de fermentação natural', 2400],
  ['Porção de mandioca frita', 3200],
  ['Caneca de cerâmica artesanal', 6500],
] as const

const NOTICE = 'Conteúdo fictício para cenários de teste.'

export const EstablishmentExperienceFactory = factory
  .define(EstablishmentExperience, ({ faker }) => ({
    tenant_id: 1,
    establishment_id: 1,
    created_by: 1,
    title: faker.helpers.arrayElement(EXPERIENCES),
    description: `Uma experiência para aproveitar sem pressa. ${NOTICE}`,
    status: 'draft' as const,
    published_snapshot: null,
    published_at: null,
  }))
  .state('published', (content) => {
    content.status = 'published'
    content.published_at = DateTime.utc()
    content.published_snapshot = { title: content.title, description: content.description }
  })
  .state('archived', (content) => {
    content.status = 'archived'
    content.archived_at = DateTime.utc()
  })
  .build()

/** An event starting tomorrow at 19:00 in São Paulo time, for three hours. */
export const EstablishmentEventFactory = factory
  .define(EstablishmentEvent, ({ faker }) => {
    const startsAt = DateTime.now()
      .setZone('America/Sao_Paulo')
      .plus({ days: 1 })
      .set({ hour: 19, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
    return {
      tenant_id: 1,
      establishment_id: 1,
      created_by: 1,
      title: faker.helpers.arrayElement(EVENTS),
      description: `Programação aberta ao público. ${NOTICE}`,
      status: 'draft' as const,
      starts_at: startsAt,
      ends_at: startsAt.plus({ hours: 3 }),
      published_snapshot: null,
      published_at: null,
    }
  })
  .state('happeningNow', (event) => {
    event.starts_at = DateTime.utc().minus({ hours: 1 })
    event.ends_at = DateTime.utc().plus({ hours: 2 })
  })
  .state('published', (event) => {
    event.status = 'published'
    event.published_at = DateTime.utc()
    event.published_snapshot = {
      title: event.title,
      description: event.description,
      starts_at: event.starts_at.toISO(),
      ends_at: event.ends_at.toISO(),
    }
  })
  .build()

export const EstablishmentShowcaseItemFactory = factory
  .define(EstablishmentShowcaseItem, ({ faker }) => {
    const [title, price] = faker.helpers.arrayElement(SHOWCASE)
    return {
      tenant_id: 1,
      establishment_id: 1,
      created_by: 1,
      title,
      description: `Preço apenas informativo. ${NOTICE}`,
      status: 'draft' as const,
      informational_price_cents: price,
      published_snapshot: null,
      published_at: null,
    }
  })
  .state('published', (item) => {
    item.status = 'published'
    item.published_at = DateTime.utc()
    item.published_snapshot = {
      title: item.title,
      description: item.description,
      informational_price_cents: item.informational_price_cents,
    }
  })
  .build()
