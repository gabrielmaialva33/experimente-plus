import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import CatalogProjectionRepository from '#modules/catalog/repositories/catalog_projection_repository'
import Establishment from '#modules/establishments/models/establishment'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentRepository from '#modules/partner_content/repositories/partner_content_repository'
import AutomaticModerationService from '#modules/reviews/services/automatic_moderation_service'
import type User from '#modules/users/models/user'

/**
 * The lifecycle of partner-owned content — ADR-0028.
 *
 * Three rules carry most of this file:
 *
 *   - Content belongs to the stable establishment, not to a revision. A new
 *     published revision of the unit neither republishes nor invalidates it.
 *   - Whether publishing needs a human is tenant policy, not a fixed workflow.
 *     With approval off, the partner publishes. With it on, the item waits.
 *   - Nothing is ever deleted. "Desativar" and "excluir" are both archiving,
 *     and the database has a trigger that refuses a physical DELETE, so this is
 *     enforced a second time below the code that means it.
 */
@inject()
export default class PartnerContentService {
  constructor(
    private contentRepository: PartnerContentRepository,
    private policyRepository: PartnerContentPolicyRepository,
    private organizationPolicy: OrganizationPolicyService,
    private projectionRepository: CatalogProjectionRepository,
    private automod: AutomaticModerationService
  ) {}

  async create(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    actor: User,
    payload: IPartnerContent.CreatePayload
  ) {
    return db.transaction(async (client) => {
      const establishment = await this.authorizeEstablishment(
        tenantId,
        actor,
        payload.establishment_id,
        client
      )

      const attributes = this.attributesFor(kind, payload, {})

      return this.contentRepository.model(kind).create(
        {
          tenant_id: tenantId,
          establishment_id: establishment.id,
          created_by: actor.id,
          status: 'draft',
          ...attributes,
        } as never,
        { client }
      )
    })
  }

  /**
   * Editing in place.
   *
   * A published item under an approving policy does not leave the air while the
   * change waits: its approved snapshot stays, and only the live columns move.
   */
  async update(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    actor: User,
    payload: IPartnerContent.UpdatePayload
  ) {
    return db.transaction(async (client) => {
      const content = await this.requireContent(kind, tenantId, id, client, true)
      await this.authorizeEstablishment(tenantId, actor, content.establishment_id, client)

      if (content.status === 'archived') {
        throw new BadRequestException('Archived content cannot be edited')
      }

      const policy = await this.policyRepository.getForTenant(tenantId, client)
      const needsApproval = this.policyRepository.requiresApproval(policy, kind)

      content.useTransaction(client)
      content.merge(this.attributesFor(kind, payload, content) as never)

      if (content.status === 'published' && needsApproval) {
        content.status = 'pending_review'
      }

      this.assertEventWindow(kind, content, policy.min_event_notice_minutes)
      await content.save()
      return content
    })
  }

  /**
   * The partner asks for the item to become public.
   *
   * With approval off this publishes; with it on it joins the queue. The
   * snapshot is what the public will read, so it is taken at the moment the
   * version is approved, never before.
   */
  async submit(kind: IPartnerContent.ContentKind, tenantId: number, id: number, actor: User) {
    return db.transaction(async (client) => {
      const content = await this.requireContent(kind, tenantId, id, client, true)
      await this.authorizeEstablishment(tenantId, actor, content.establishment_id, client)

      if (content.status === 'archived') {
        throw new BadRequestException('Archived content cannot be published')
      }
      if (content.status === 'pending_review') {
        throw new BadRequestException('This content is already awaiting approval')
      }

      const policy = await this.policyRepository.getForTenant(tenantId, client)
      this.assertEventWindow(kind, content, policy.min_event_notice_minutes)

      content.useTransaction(client)

      // ADR-0031: a rule in `hold` mode sends the item to the approval queue that
      // already exists, instead of inventing a second waiting state. An edit of
      // published content keeps its approved snapshot public meanwhile.
      const assessment = await this.automod.assess(
        tenantId,
        [content.title, content.description],
        client
      )
      const requiresApproval =
        this.policyRepository.requiresApproval(policy, kind) || assessment.hold

      if (requiresApproval) {
        content.status = 'pending_review'
      } else {
        this.publish(content, kind)
      }

      await content.save()
      await this.automod.record(tenantId, kind, content.id, assessment, client)

      if (!requiresApproval) {
        await this.projectionRepository.bumpTenantVersion(tenantId, client)
      }

      return content
    })
  }

  /** Moderation. `admin` reaches this by inheriting `moderator` (ADR-0007). */
  async approve(kind: IPartnerContent.ContentKind, tenantId: number, id: number, actor: User) {
    await this.organizationPolicy.requirePlatformModerator(actor)

    return db.transaction(async (client) => {
      const content = await this.requireContent(kind, tenantId, id, client, true)

      if (content.status !== 'pending_review') {
        throw new BadRequestException('Only content awaiting approval can be approved')
      }

      content.useTransaction(client)
      this.publish(content, kind)
      await content.save()
      await this.projectionRepository.bumpTenantVersion(tenantId, client)
      return content
    })
  }

  /**
   * Releasing what an automatic rule held — ADR-0031.
   *
   * Called when a person dismisses the rule's report. The item publishes only if
   * the rule was the sole reason it was waiting; if the operation's policy
   * requires approval for this kind anyway, it stays in that queue, because
   * dismissing a rule is not approving content.
   */
  async releaseHold(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ) {
    const content = await this.requireContent(kind, tenantId, id, client, true)
    if (content.status !== 'pending_review') return content

    const policy = await this.policyRepository.getForTenant(tenantId, client)
    if (this.policyRepository.requiresApproval(policy, kind)) return content

    content.useTransaction(client)
    this.publish(content, kind)
    await content.save()
    await this.projectionRepository.bumpTenantVersion(tenantId, client)
    return content
  }

  /**
   * Refusing a version.
   *
   * It returns to the partner as a draft. If a previously approved version
   * exists it stays public: refusing an edit is not a reason to take down what
   * was already accepted.
   */
  async reject(kind: IPartnerContent.ContentKind, tenantId: number, id: number, actor: User) {
    await this.organizationPolicy.requirePlatformModerator(actor)

    return db.transaction(async (client) => {
      const content = await this.requireContent(kind, tenantId, id, client, true)

      if (content.status !== 'pending_review') {
        throw new BadRequestException('Only content awaiting approval can be rejected')
      }

      content.useTransaction(client)
      content.status = content.published_snapshot ? 'published' : 'draft'
      await content.save()
      return content
    })
  }

  /**
   * Withdrawing content.
   *
   * This is what both "desativar" and "excluir" mean here: the item leaves the
   * public surfaces at once and stays referenceable for history and audit. A
   * moderator may withdraw anyone's; a partner only their own.
   */
  async archive(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    actor: User,
    {
      asModerator = false,
      client: outer,
    }: { asModerator?: boolean; client?: TransactionClientContract } = {}
  ) {
    if (asModerator) {
      await this.organizationPolicy.requirePlatformModerator(actor)
    }

    // Joins the caller's transaction when given one. Resolving a report with
    // `content_hidden` archives inside the resolution: two separate
    // transactions could record the content as hidden while it stays public.
    const run = async (client: TransactionClientContract) => {
      const content = await this.requireContent(kind, tenantId, id, client, true)

      if (!asModerator) {
        await this.authorizeEstablishment(tenantId, actor, content.establishment_id, client)
      }

      if (content.status === 'archived') {
        return content
      }

      content.useTransaction(client)
      content.status = 'archived'
      content.archived_by = actor.id
      content.archived_at = DateTime.utc()
      await content.save()
      await this.projectionRepository.bumpTenantVersion(tenantId, client)
      return content
    }

    return outer ? run(outer) : db.transaction(run)
  }

  async listForPartner(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    actor: User,
    query: IPartnerContent.ListQuery
  ) {
    const establishmentIds = await this.establishmentsOfActor(tenantId, actor)

    if (establishmentIds.length === 0) {
      throw new ForbiddenException('An active organization membership is required')
    }

    return this.contentRepository.paginateForEstablishments(kind, tenantId, establishmentIds, query)
  }

  async listForModeration(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    actor: User,
    query: IPartnerContent.ListQuery
  ) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.contentRepository.paginateForTenant(kind, tenantId, query)
  }

  /** Public discovery: no session, no membership (ADR-0003). */
  async listPublic(kind: IPartnerContent.ContentKind, tenantId: number, establishmentId: number) {
    return this.contentRepository.listPublished(kind, tenantId, establishmentId, new Date())
  }

  async getPolicy(tenantId: number, actor: User) {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policyRepository.getForTenant(tenantId)
  }

  async updatePolicy(tenantId: number, actor: User, payload: IPartnerContent.PolicyPayload) {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.policyRepository.updateForTenant(tenantId, payload)
  }

  /**
   * Shared authorization seam for media assigned to stable partner content.
   * Media is independent of an establishment revision but inherits the same
   * organization-management boundary as the content itself.
   */
  async requireForPartnerMedia(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    actor: User,
    client: TransactionClientContract,
    lock = true,
    allowArchived = false
  ): Promise<IPartnerContent.ContentRow> {
    const content = await this.requireContent(kind, tenantId, id, client, lock)
    await this.authorizeEstablishment(tenantId, actor, content.establishment_id, client)
    if (!allowArchived && content.status === 'archived') {
      throw new BadRequestException('Archived content cannot have its media changed')
    }
    return content
  }

  async requireForModeratorMedia(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    actor: User,
    client: TransactionClientContract
  ): Promise<IPartnerContent.ContentRow> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.requireContent(kind, tenantId, id, client, true)
  }

  /**
   * The snapshot is the published version.
   *
   * It is what the public reads, so it must be a copy rather than a reference:
   * the live columns keep moving while a later edit is drafted, and the public
   * must not follow them until the new version is approved.
   */
  private publish(content: IPartnerContent.ContentRow, kind: IPartnerContent.ContentKind): void {
    const snapshot: Record<string, unknown> = {
      title: content.title,
      description: content.description,
    }

    if (kind === 'event') {
      const event = content as { starts_at: DateTime; ends_at: DateTime }
      snapshot.starts_at = event.starts_at.toISO()
      snapshot.ends_at = event.ends_at.toISO()
    }

    if (kind === 'showcase_item') {
      snapshot.informational_price_cents = (
        content as { informational_price_cents: number | null }
      ).informational_price_cents
    }

    content.published_snapshot = snapshot
    content.published_at = DateTime.utc()
    content.status = 'published'
  }

  private attributesFor(
    kind: IPartnerContent.ContentKind,
    payload: IPartnerContent.CreatePayload | IPartnerContent.UpdatePayload,
    current: Partial<{ title: string }>
  ): Record<string, unknown> {
    const attributes: Record<string, unknown> = {}

    if (payload.title !== undefined) attributes.title = payload.title.trim()
    if (payload.description !== undefined) {
      const description = payload.description?.trim()
      attributes.description = description && description.length > 0 ? description : null
    }

    if (kind === 'event') {
      if (payload.starts_at !== undefined)
        attributes.starts_at = DateTime.fromISO(payload.starts_at)
      if (payload.ends_at !== undefined) attributes.ends_at = DateTime.fromISO(payload.ends_at)
      if (current.title === undefined && (!attributes.starts_at || !attributes.ends_at)) {
        throw new BadRequestException('An event needs a start and an end')
      }
    }

    if (kind === 'showcase_item' && payload.informational_price_cents !== undefined) {
      attributes.informational_price_cents = payload.informational_price_cents
    }

    return attributes
  }

  /**
   * The minimum notice is counted from now, and only for a version that is
   * about to become public: a draft may sit with any dates while it is written.
   */
  private assertEventWindow(
    kind: IPartnerContent.ContentKind,
    content: IPartnerContent.ContentRow,
    minimumNoticeMinutes: number
  ): void {
    if (kind !== 'event') return

    const event = content as { starts_at: DateTime; ends_at: DateTime }

    if (event.ends_at <= event.starts_at) {
      throw new BadRequestException('An event must end after it starts')
    }

    if (minimumNoticeMinutes > 0) {
      const earliest = DateTime.utc().plus({ minutes: minimumNoticeMinutes })
      if (event.starts_at < earliest) {
        throw new BadRequestException(
          `This operation requires an event to be announced at least ${minimumNoticeMinutes} minutes in advance`
        )
      }
    }
  }

  private async requireContent(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    id: number,
    client: Parameters<typeof this.contentRepository.findById>[3],
    lock = false
  ): Promise<IPartnerContent.ContentRow> {
    const content = await this.contentRepository.findById(kind, tenantId, id, client, lock)

    if (!content) {
      throw new NotFoundException('Content not found')
    }

    return content
  }

  private async authorizeEstablishment(
    tenantId: number,
    actor: User,
    establishmentId: number,
    client: Parameters<typeof this.contentRepository.findById>[3]
  ): Promise<Establishment> {
    const establishment = await Establishment.query({ client })
      .where('tenant_id', tenantId)
      .where('id', establishmentId)
      .first()

    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }

    const decision = await this.organizationPolicy.resolveAccess(
      actor,
      tenantId,
      establishment.organization_id,
      client
    )

    if (!decision.capabilities.manage_establishments) {
      throw new ForbiddenException(
        'An active organization membership with management privileges is required'
      )
    }

    return establishment
  }

  private async establishmentsOfActor(tenantId: number, actor: User): Promise<number[]> {
    const rows = await db
      .from('establishments')
      .join('organization_members', (join) => {
        join
          .on('organization_members.organization_id', 'establishments.organization_id')
          .andOn('organization_members.tenant_id', 'establishments.tenant_id')
      })
      .where('establishments.tenant_id', tenantId)
      .where('organization_members.user_id', actor.id)
      .where('organization_members.status', 'active')
      .select('establishments.id')

    return rows.map((row) => Number(row.id))
  }
}
