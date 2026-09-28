import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'
import PartnerContentMedia from '#modules/partner_content/models/partner_content_media'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import PartnerContentMediaRepository from '#modules/partner_content/repositories/partner_content_media_repository'

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

/**
 * An image of a piece of partner content, pending moderation. It belongs to
 * an experience by default; merge `experience_id: null` with `event_id` or
 * `showcase_item_id` to attach it elsewhere (the table takes exactly one
 * target, of the same establishment as the asset). Without an explicit
 * `sort_order` it goes after the target's other images, as
 * `PartnerContentMediaService` appends.
 */
export const PartnerContentMediaFactory = factory
  .define(PartnerContentMedia, () => ({
    tenant_id: 1,
    establishment_id: 1,
    experience_id: 1,
    event_id: null,
    showcase_item_id: null,
    media_asset_id: 1,
    is_cover: false,
    alt_text: 'Ilustração original de uma experiência fictícia',
    caption: null,
    moderation_status: 'pending' as const,
    created_by: 1,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  }))
  .state('cover', (media) => {
    media.is_cover = true
  })
  .state('approved', (media) => {
    media.moderation_status = 'approved'
    media.reviewed_by ??= media.created_by
    media.reviewed_at = DateTime.utc()
  })
  .state('rejected', (media) => {
    media.moderation_status = 'rejected'
    media.is_cover = false
    media.reviewed_by ??= media.created_by
    media.reviewed_at = DateTime.utc()
    media.review_notes = 'A imagem não corresponde ao conteúdo publicado.'
  })
  .state('quarantined', (media) => {
    media.moderation_status = 'quarantined'
    media.is_cover = false
    media.reviewed_by ??= media.created_by
    media.reviewed_at = DateTime.utc()
    media.review_notes = 'Imagem retida pelo cenário de teste.'
  })
  .before('create', async (_builder, media, { $trx }) => {
    if (media.sort_order !== undefined) return
    const [kind, contentId] =
      media.experience_id !== null
        ? (['experience', media.experience_id] as const)
        : media.event_id !== null
          ? (['event', media.event_id] as const)
          : (['showcase_item', media.showcase_item_id!] as const)
    media.sort_order = await new PartnerContentMediaRepository().nextSortOrder(
      kind,
      media.tenant_id,
      contentId,
      $trx!
    )
  })
  .build()

/**
 * The partner-content rules of an operation, one row per tenant. The
 * defaults live in the table (ADR-0028), so the factory inserts only what a
 * state sets and reads the row back, as `PartnerContentPolicyRepository`
 * does.
 */
export const PartnerContentPolicyFactory = factory
  .define(PartnerContentPolicy, () => ({
    tenant_id: 1,
  }))
  .state('approvalRequired', (policy) => {
    policy.require_experience_approval = true
    policy.require_event_approval = true
    policy.require_showcase_item_approval = true
  })
  .state('noApproval', (policy) => {
    policy.require_experience_approval = false
    policy.require_event_approval = false
    policy.require_showcase_item_approval = false
  })
  .state('eventNotice', (policy) => {
    // A day ahead: an event starting sooner is refused.
    policy.min_event_notice_minutes = 24 * 60
  })
  .after('create', async (_builder, policy, { $trx }) => {
    if ($trx) policy.useTransaction($trx)
    await policy.refresh()
  })
  .build()
