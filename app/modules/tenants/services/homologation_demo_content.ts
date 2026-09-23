import { createHash } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'

import {
  developmentIllustration,
  DEVELOPMENT_MEDIA_HEIGHT,
  DEVELOPMENT_MEDIA_WIDTH,
} from '#database/support/development_media'

import BaseException from '#exceptions/base_exception'
import AuditLog from '#modules/audits/models/audit_log'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import StoredFile from '#modules/files/models/file'
import City from '#modules/geography/models/city'
import MediaAsset from '#modules/media/models/media_asset'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentMedia from '#modules/partner_content/models/partner_content_media'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentRepository from '#modules/partner_content/repositories/partner_content_repository'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import { cityDayWindow } from '#modules/partner_content/services/city_day_window'
import ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ContentReportRepository from '#modules/reviews/repositories/content_report_repository'
import ContentReportService from '#modules/reviews/services/content_report_service'
import EstablishmentReviewReplyService from '#modules/reviews/services/establishment_review_reply_service'
import EstablishmentReviewService from '#modules/reviews/services/establishment_review_service'
import type { ProvisioningReceipt } from '#modules/tenants/services/homologation_provisioning_service'
import env from '#start/env'
import User from '#modules/users/models/user'

/**
 * Demonstration content for the features built after the baseline — the city
 * agenda, partner experiences, events and showcase items, reviews with a
 * partner reply, and one report so the moderation queue is not empty.
 *
 * It exists so the contracting party can see the product working in
 * homologation instead of empty screens. Everything is fictitious in the same
 * way the baseline establishments are: every title says "demonstração", every
 * description says it does not describe a real programme, and every author is
 * one of the provisioned accounts.
 *
 * Three rules govern it:
 *
 * - It goes through the domain services — the partner creates and submits,
 *   the administrator approves what the policy holds, the customer reviews and
 *   reports — so snapshots, automatic moderation, the projection and the
 *   aggregates stay what they would be if people had done it.
 * - Every item it creates is recorded once, append-only, under
 *   `homologation.demo-content.v1`. A recorded item is never created again and
 *   never restored: if a moderator archives a demo item, a later run leaves it
 *   archived. That is the baseline's own rule — a replay never resets an
 *   editorial decision.
 * - Events are keyed by their local date. A run guarantees one event happening
 *   today and two in the coming days, and a run on a later day adds that day's
 *   events rather than moving old ones: nothing already published is edited,
 *   and yesterday's events leave the agenda by their own window.
 */

export const DEMO_CONTENT_ACTION = 'homologation.demo-content.v1'

const FICTITIOUS =
  'Conteúdo fictício de demonstração da homologação; não descreve programação, produto ou preço reais.'

const VENUE_ATELIER = 'atelier-do-cafe-demo'
const VENUE_PETISCOS = 'casa-de-petiscos-demo'

/** The baseline's own original illustrations, one scene per venue. */
const SCENE: Record<string, 'coffee' | 'petiscos'> = {
  [VENUE_ATELIER]: 'coffee',
  [VENUE_PETISCOS]: 'petiscos',
}

interface StaticContent {
  key: string
  venue: string
  kind: 'experience' | 'showcase_item'
  title: string
  description: string
  informationalPriceCents?: number
}

const STATIC_CONTENT: StaticContent[] = [
  {
    key: 'experience:atelier:oficina',
    venue: VENUE_ATELIER,
    kind: 'experience',
    title: 'Oficina de métodos de preparo — demonstração',
    description: `Uma hora comparando coado, prensa e espresso com a equipe da casa. ${FICTITIOUS}`,
  },
  {
    key: 'experience:petiscos:mesa',
    venue: VENUE_PETISCOS,
    kind: 'experience',
    title: 'Mesa de petiscos para compartilhar — demonstração',
    description: `Seleção de porções servidas no centro da mesa, para grupos. ${FICTITIOUS}`,
  },
  {
    key: 'showcase:atelier:graos',
    venue: VENUE_ATELIER,
    kind: 'showcase_item',
    title: 'Café em grãos da casa — demonstração',
    description: `Pacote de grãos torrados na semana, exibido apenas como informação. ${FICTITIOUS}`,
    informationalPriceCents: 3900,
  },
  {
    key: 'showcase:petiscos:porcao',
    venue: VENUE_PETISCOS,
    kind: 'showcase_item',
    title: 'Porção da casa — demonstração',
    description: `Porção servida no balcão, exibida apenas como informação. ${FICTITIOUS}`,
    informationalPriceCents: 4500,
  },
]

interface EventContent {
  slug: string
  venue: string
  title: string
  description: string
  /** Days after today, in the city's calendar. Zero means "happening today". */
  daysAhead: number
  /** Local start hour for future days; today's event is placed around now. */
  localHour: number
  durationHours: number
}

const EVENT_CONTENT: EventContent[] = [
  {
    slug: 'samba',
    venue: VENUE_PETISCOS,
    title: 'Noite de samba ao vivo — demonstração',
    description: `Roda de samba no salão, com mesas por ordem de chegada. ${FICTITIOUS}`,
    daysAhead: 0,
    localHour: 19,
    durationHours: 4,
  },
  {
    slug: 'degustacao',
    venue: VENUE_ATELIER,
    title: 'Tarde de degustação de cafés — demonstração',
    description: `Prova guiada de três cafés com notas sensoriais diferentes. ${FICTITIOUS}`,
    daysAhead: 2,
    localHour: 16,
    durationHours: 3,
  },
  {
    slug: 'festival',
    venue: VENUE_PETISCOS,
    title: 'Festival de petiscos — demonstração',
    description: `Cardápio especial de petiscos durante a noite. ${FICTITIOUS}`,
    daysAhead: 5,
    localHour: 20,
    durationHours: 3,
  },
]

const REVIEWS = [
  {
    key: 'review:atelier',
    venue: VENUE_ATELIER,
    rating: 5,
    comment:
      'Avaliação de demonstração: atendimento atencioso e café bem preparado. Texto fictício escrito pelo provisionamento da homologação.',
    reply:
      'Resposta de demonstração do parceiro: obrigado pela visita. Texto fictício escrito pelo provisionamento da homologação.',
  },
  {
    key: 'review:petiscos',
    venue: VENUE_PETISCOS,
    rating: 4,
    comment:
      'Avaliação de demonstração: porções generosas e ambiente animado, com fila no fim de semana. Texto fictício da homologação.',
    reply:
      'Resposta de demonstração do parceiro: agradecemos o retorno sobre a fila. Texto fictício escrito pelo provisionamento da homologação.',
  },
] as const

export interface DemoContentOutcome {
  created: string[]
  alreadyPresent: string[]
  notCreated: Array<{ key: string; reason: string }>
}

interface Actors {
  administrator: User
  partner: User
  customer: User
}

export default class HomologationDemoContent {
  private outcome: DemoContentOutcome = { created: [], alreadyPresent: [], notCreated: [] }

  constructor(
    private receipt: ProvisioningReceipt,
    private tenantSlug: string,
    private now: DateTime
  ) {}

  async provision(): Promise<DemoContentOutcome> {
    const tenantId = this.receipt.tenantId
    const actors: Actors = {
      administrator: await User.findOrFail(this.receipt.accounts.administrator),
      partner: await User.findOrFail(this.receipt.accounts.partner),
      customer: await User.findOrFail(this.receipt.accounts.customer),
    }
    const venues = await this.venues(tenantId)
    const recorded = await this.recordedKeys(tenantId)

    const content = await app.container.make(PartnerContentService)
    const contentRepository = new PartnerContentRepository()
    const policies = new PartnerContentPolicyRepository()
    const policy = await policies.getForTenant(tenantId)

    for (const item of STATIC_CONTENT) {
      const establishment = venues.get(item.venue)
      if (!establishment) continue
      await this.once(item.key, recorded, actors, async () => {
        const adopted = await this.existingContent(
          contentRepository,
          item.kind,
          tenantId,
          establishment.id,
          item.title
        )
        if (adopted) return { kind: item.kind, id: adopted, adopted: true }
        const id = await this.publishContent(
          content,
          policies,
          policy,
          tenantId,
          actors,
          item.kind,
          {
            establishment_id: establishment.id,
            title: item.title,
            description: item.description,
            ...(item.informationalPriceCents === undefined
              ? {}
              : { informational_price_cents: item.informationalPriceCents }),
          }
        )
        // The agenda's "Novidades" band lists only experiences with an approved
        // image — it is a visual strip — so a demo experience without a cover
        // would never appear there.
        if (item.kind === 'experience')
          await this.attachCover(tenantId, establishment.id, id, item, actors)
        return { kind: item.kind, id }
      })
    }

    for (const event of EVENT_CONTENT) {
      const establishment = venues.get(event.venue)
      if (!establishment) continue
      const window = this.eventWindow(
        event,
        establishment.timezone,
        policy.min_event_notice_minutes
      )
      if (!window) {
        this.outcome.notCreated.push({
          key: `event:${event.slug}:today`,
          reason:
            'a antecedência mínima da operação empurra o início para depois da meia-noite local; rode de novo mais cedo',
        })
        continue
      }
      const key = `event:${event.slug}:${window.localDate}`
      const title = `${event.title} (${window.label})`
      await this.once(key, recorded, actors, async () => {
        const adopted = await this.existingContent(
          contentRepository,
          'event',
          tenantId,
          establishment.id,
          title
        )
        if (adopted) return { kind: 'event', id: adopted, adopted: true }
        const id = await this.publishContent(content, policies, policy, tenantId, actors, 'event', {
          establishment_id: establishment.id,
          title,
          description: event.description,
          starts_at: window.startsAt,
          ends_at: window.endsAt,
        })
        return { kind: 'event', id }
      })
    }

    const reviews = await app.container.make(EstablishmentReviewService)
    const replies = await app.container.make(EstablishmentReviewReplyService)
    for (const item of REVIEWS) {
      const establishment = venues.get(item.venue)
      if (!establishment) continue
      await this.once(item.key, recorded, actors, async () => {
        const existing = await EstablishmentReview.query()
          .where('tenant_id', tenantId)
          .where('establishment_id', establishment.id)
          .where('user_id', actors.customer.id)
          .first()
        const review =
          existing ??
          (await reviews.create(tenantId, actors.customer, {
            establishment_id: establishment.id,
            rating: item.rating,
            comment: item.comment,
          }))
        const replied = await EstablishmentReviewReply.query()
          .where('tenant_id', tenantId)
          .where('review_id', review.id)
          .first()
        if (!replied)
          await replies.reply(tenantId, review.id, actors.partner, { comment: item.reply })
        return { kind: 'review', id: review.id, adopted: Boolean(existing) }
      })
    }

    // One pending case, so the moderation queue shows what it is for. It is
    // filed by the provisioned customer against a demo showcase item and says
    // in its own text that it is a demonstration.
    const reported = venues.get(VENUE_PETISCOS)
    if (reported) {
      await this.once('report:showcase', recorded, actors, async () => {
        const target = await this.existingContent(
          contentRepository,
          'showcase_item',
          tenantId,
          reported.id,
          'Porção da casa — demonstração'
        )
        if (!target) throw new DemoSkip('o item de vitrine denunciado não está publicado')
        const existing = await new ContentReportRepository().findByTargetAndReporter(
          tenantId,
          'showcase_item',
          target,
          actors.customer.id
        )
        if (existing) return { kind: 'report', id: existing.id, adopted: true }
        const reports = await app.container.make(ContentReportService)
        const report = await reports.createReport(tenantId, actors.customer, {
          target_type: 'showcase_item',
          target_id: target,
          reason: 'other',
          details:
            'Denúncia de demonstração: existe para a fila de moderação não aparecer vazia na homologação.',
        })
        return { kind: 'report', id: report.id }
      })
    }

    return this.outcome
  }

  /**
   * Runs a step at most once per key.
   *
   * A domain refusal — a policy that requires proof of visit, a text limit the
   * operation changed, a daily limit already spent — is reported and the run
   * goes on: a partial demo with a named reason is more useful than none, and
   * the next run tries the missing step again. Anything else is not a refusal
   * and stops the run.
   */
  private async once(
    key: string,
    recorded: Set<string>,
    actors: Actors,
    step: () => Promise<{ kind: string; id: number; adopted?: boolean }>
  ): Promise<void> {
    if (recorded.has(key)) {
      this.outcome.alreadyPresent.push(key)
      return
    }
    try {
      const result = await step()
      await AuditLog.create({
        user_id: actors.administrator.id,
        resource: 'tenants',
        resource_id: this.receipt.tenantId,
        action: DEMO_CONTENT_ACTION,
        context: 'console',
        result: 'granted',
        reason: 'Conteúdo fictício de demonstração provisionado em homologação',
        metadata: { key, kind: result.kind, id: result.id },
      })
      recorded.add(key)
      if (result.adopted) this.outcome.alreadyPresent.push(key)
      else this.outcome.created.push(key)
    } catch (error) {
      if (error instanceof DemoSkip) {
        this.outcome.notCreated.push({ key, reason: error.message })
        return
      }
      if (error instanceof BaseException && (error.status ?? 500) < 500) {
        this.outcome.notCreated.push({ key, reason: error.message })
        return
      }
      throw error
    }
  }

  /**
   * Creates as the partner, submits as the partner, and approves as the
   * administrator only when the operation's own policy is why the item waits.
   *
   * An item held by an automatic rule is left where the rule put it: approving
   * it here would be the script overruling ADR-0031, and the demo texts are
   * written not to trip any rule, so a hold means something worth seeing.
   */
  private async publishContent(
    content: PartnerContentService,
    policies: PartnerContentPolicyRepository,
    policy: Awaited<ReturnType<PartnerContentPolicyRepository['getForTenant']>>,
    tenantId: number,
    actors: Actors,
    kind: IPartnerContent.ContentKind,
    payload: IPartnerContent.CreatePayload
  ): Promise<number> {
    const created = await content.create(kind, tenantId, actors.partner, payload)
    const submitted = await content.submit(kind, tenantId, created.id, actors.partner)
    if (submitted.status === 'pending_review' && policies.requiresApproval(policy, kind)) {
      const held = await this.heldByRule(tenantId, kind, created.id)
      if (!held) await content.approve(kind, tenantId, created.id, actors.administrator)
    }
    return created.id
  }

  /**
   * An approved cover for a demo experience, from the baseline's own original
   * illustration.
   *
   * It gets its own stored object and its own asset rather than reusing the
   * establishment's: removing a content's media deletes the asset and the file
   * behind it, so a shared one would let a moderator tidying a demo experience
   * take down the establishment's cover. The object key is checksummed and
   * scoped to the step, so a retry writes the same object again.
   *
   * It is written through the models, as the baseline writes its own media: the
   * upload service expects a multipart file from a person, and approval here
   * is the administrator's act on material the provisioner itself generated.
   */
  private async attachCover(
    tenantId: number,
    establishmentId: number,
    experienceId: number,
    item: StaticContent,
    actors: Actors
  ): Promise<void> {
    const buffer = developmentIllustration(SCENE[item.venue])
    const checksum = createHash('sha256').update(buffer).digest('hex')
    const name = item.key.replaceAll(':', '-')
    const key = `homologation/media/v1/${env.get('DRIVE_DISK')}/${this.tenantSlug}/demo-content/${name}/${checksum}.png`
    await drive.use().put(key, buffer, { contentType: 'image/png' })

    const file = await StoredFile.create({
      tenant_id: tenantId,
      owner_id: actors.partner.id,
      client_name: `${name}.png`,
      file_name: key,
      file_size: buffer.length,
      file_type: 'image/png',
      file_category: 'image',
      url: await drive.use().getUrl(key),
    })
    const asset = await MediaAsset.create({
      tenant_id: tenantId,
      establishment_id: establishmentId,
      file_id: file.id,
      media_type: 'image',
      file_extension: 'png',
      mime_type: 'image/png',
      checksum_sha256: checksum,
      width: DEVELOPMENT_MEDIA_WIDTH,
      height: DEVELOPMENT_MEDIA_HEIGHT,
      created_by: actors.partner.id,
    })
    await PartnerContentMedia.create({
      tenant_id: tenantId,
      establishment_id: establishmentId,
      experience_id: experienceId,
      media_asset_id: asset.id,
      is_cover: true,
      sort_order: 0,
      alt_text: `Ilustração original para ${item.title}; conteúdo fictício de homologação`,
      caption: null,
      moderation_status: 'approved',
      created_by: actors.partner.id,
      reviewed_by: actors.administrator.id,
      reviewed_at: DateTime.utc(),
      review_notes: 'Ilustração original gerada pelo provisionamento de homologação',
    })
  }

  /** An open automatic report holding this item means a rule put it on hold. */
  private async heldByRule(tenantId: number, kind: string, id: number): Promise<boolean> {
    const report = await ContentReport.query()
      .where('tenant_id', tenantId)
      .where('target_type', kind)
      .where('target_id', id)
      .where('origin', 'automatic')
      .where('holds_content', true)
      .whereIn('status', ['pending', 'under_review'])
      .first()
    return Boolean(report)
  }

  /** A demo item that exists under its exact title heals a run that stopped mid-way. */
  private async existingContent(
    repository: PartnerContentRepository,
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentId: number,
    title: string
  ): Promise<number | null> {
    const row = await repository
      .model(kind)
      .query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('title', title)
      .first()
    return row ? row.id : null
  }

  /**
   * Where an event sits in the city's own calendar.
   *
   * Today's event starts an hour ago when the operation asks for no notice —
   * so it is "acontecendo hoje" the moment the run ends — or as soon as the
   * notice allows. If the notice pushes it past local midnight there is no
   * honest way to call it today, and the step is reported instead.
   */
  private eventWindow(
    event: EventContent,
    timezone: string,
    noticeMinutes: number
  ): { startsAt: string; endsAt: string; localDate: string; label: string } | null {
    const day = cityDayWindow(this.now, timezone)
    const zone = day.timezone
    let start: DateTime
    if (event.daysAhead === 0) {
      start =
        noticeMinutes > 0
          ? this.now.plus({ minutes: noticeMinutes + 15 }).startOf('minute')
          : this.now.minus({ hours: 1 }).startOf('minute')
      if (start >= DateTime.fromISO(day.day_end)) return null
    } else {
      start = this.now
        .setZone(zone)
        .startOf('day')
        .plus({ days: event.daysAhead })
        .set({ hour: event.localHour, minute: 0 })
    }
    const local = start.setZone(zone)
    return {
      startsAt: start.toUTC().toISO()!,
      endsAt: start.plus({ hours: event.durationHours }).toUTC().toISO()!,
      localDate: local.toISODate()!,
      label: local.setLocale('pt-BR').toFormat('dd/LL'),
    }
  }

  private async venues(tenantId: number) {
    const venues = new Map<string, { id: number; timezone: string }>()
    const establishments = await Establishment.query()
      .where('tenant_id', tenantId)
      .whereIn('id', this.receipt.establishmentIds)
      .whereNotNull('published_revision_id')
    for (const establishment of establishments) {
      const revision = await EstablishmentRevision.findOrFail(establishment.published_revision_id)
      const city = await City.findOrFail(revision.city_id)
      if (revision.slug)
        venues.set(revision.slug, { id: establishment.id, timezone: city.timezone })
    }
    return venues
  }

  private async recordedKeys(tenantId: number): Promise<Set<string>> {
    const rows = await AuditLog.query()
      .where('resource', 'tenants')
      .where('resource_id', tenantId)
      .where('action', DEMO_CONTENT_ACTION)
    return new Set(
      rows
        .map((row) => (row.metadata as { key?: unknown } | null)?.key)
        .filter((key): key is string => typeof key === 'string')
    )
  }
}

class DemoSkip extends Error {}
