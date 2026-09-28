import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddressRepository from '#modules/establishments/repositories/establishment_revision_address_repository'
import EstablishmentRevisionAttributeValueRepository from '#modules/establishments/repositories/establishment_revision_attribute_value_repository'
import EstablishmentRevisionCategoryRepository from '#modules/establishments/repositories/establishment_revision_category_repository'
import EstablishmentRevisionHourRepository from '#modules/establishments/repositories/establishment_revision_hour_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentRevisionSpecialDayRepository from '#modules/establishments/repositories/establishment_revision_special_day_repository'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import EstablishmentRevisionEventService from '#modules/establishments/services/establishment_revision_event_service'
import EstablishmentRevisionMediaRepository from '#modules/media/repositories/establishment_revision_media_repository'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentRevisionCloneService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private eventService: EstablishmentRevisionEventService,
    private auditService: EstablishmentAuditService,
    private organizationRepository: OrganizationRepository,
    private addressRepository: EstablishmentRevisionAddressRepository,
    private categoryRepository: EstablishmentRevisionCategoryRepository,
    private attributeValueRepository: EstablishmentRevisionAttributeValueRepository,
    private hourRepository: EstablishmentRevisionHourRepository,
    private specialDayRepository: EstablishmentRevisionSpecialDayRepository,
    private mediaRepository: EstablishmentRevisionMediaRepository
  ) {}

  async create(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishmentReview.CreateRevisionPayload
  ) {
    const result = await db.transaction(async (client) => {
      const establishment = await this.accessService.authorizeManage(
        actor,
        tenantId,
        establishmentId,
        client
      )

      if (establishment.lifecycle_status === 'archived') {
        throw new BadRequestException('Archived establishments cannot receive new revisions')
      }

      const organization = await this.organizationRepository.findByIdForTenant(
        tenantId,
        establishment.organization_id,
        client,
        true
      )
      if (!organization) {
        throw new NotFoundException('Organization not found')
      }
      if (!['draft', 'changes_requested', 'active'].includes(organization.status)) {
        throw new BadRequestException(
          `Organization cannot manage establishment revisions while ${organization.status}`
        )
      }

      const openRevision = await this.revisionRepository.findLockedForEstablishment(
        tenantId,
        establishmentId,
        client
      )
      if (openRevision) {
        throw new BadRequestException(
          `An open revision already exists with status ${openRevision.status}`
        )
      }

      const source = await this.resolveSource(
        tenantId,
        establishmentId,
        establishment.published_revision_id,
        payload.source ?? 'published',
        client
      )
      const version = await this.revisionRepository.nextVersion(establishmentId, client)
      const revision = await this.revisionRepository.create(
        {
          tenant_id: tenantId,
          establishment_id: establishmentId,
          version,
          status: 'draft',
          city_id: source.city_id,
          public_name: source.public_name,
          slug: source.slug,
          short_description: source.short_description,
          description: source.description,
          public_phone: source.public_phone,
          whatsapp: source.whatsapp,
          public_email: source.public_email,
          website: source.website,
          instagram: source.instagram,
          booking_url: source.booking_url,
          availability_type: source.availability_type,
          based_on_revision_id: source.id,
          created_by: actor.id,
          submitted_at: null,
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          rules_version: source.rules_version,
        },
        { client }
      )

      await this.addressRepository.copyToRevision(source.id, revision.id, tenantId, client)
      await this.categoryRepository.copyToRevision(source.id, revision.id, tenantId, client)
      await this.attributeValueRepository.copyToRevision(source.id, revision.id, tenantId, client)
      await this.hourRepository.copyToRevision(source.id, revision.id, tenantId, client)
      await this.specialDayRepository.copyToRevision(source.id, revision.id, tenantId, client)
      await this.copyMedia(source.id, revision.id, tenantId, establishmentId, actor.id, client)

      await this.eventService.record(
        revision,
        'draft_cloned',
        actor.id,
        source.status,
        'draft',
        null,
        {
          source_revision_id: source.id,
          source_revision_version: source.version,
          source_revision_status: source.status,
        },
        client
      )

      return {
        id: revision.id,
        establishment_id: revision.establishment_id,
        version: revision.version,
        status: revision.status,
        based_on_revision_id: revision.based_on_revision_id,
      }
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'create_revision',
      resourceId: establishmentId,
      metadata: {
        tenant_id: tenantId,
        establishment_id: establishmentId,
        revision_id: result.id,
        revision_version: result.version,
        based_on_revision_id: result.based_on_revision_id,
      },
    })

    return result
  }

  private async resolveSource(
    tenantId: number,
    establishmentId: number,
    publishedRevisionId: number | null,
    sourceMode: NonNullable<IEstablishmentReview.CreateRevisionPayload['source']>,
    client: TransactionClientContract
  ): Promise<EstablishmentRevision> {
    if (publishedRevisionId && sourceMode !== 'published') {
      throw new BadRequestException(
        'The published revision is the required source while a publication exists'
      )
    }

    if (sourceMode === 'published') {
      if (!publishedRevisionId) {
        throw new BadRequestException(
          'A published revision is required; use latest_terminal when no publication exists'
        )
      }
      const published = await this.revisionRepository.findLocked(
        tenantId,
        publishedRevisionId,
        client
      )
      if (!published || published.establishment_id !== establishmentId) {
        throw new NotFoundException('Published establishment revision not found')
      }
      if (published.status !== 'approved') {
        throw new BadRequestException('The published revision must be approved')
      }
      return published
    }

    const terminal = await this.revisionRepository.findLatestRejectedLocked(
      tenantId,
      establishmentId,
      client
    )

    if (!terminal) {
      throw new NotFoundException('No rejected revision is available to clone')
    }
    return terminal
  }

  private async copyMedia(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    establishmentId: number,
    actorId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const rows = await this.mediaRepository.listRowsForCopy(
      tenantId,
      establishmentId,
      sourceRevisionId,
      client
    )

    if (rows.length === 0) return
    await this.mediaRepository.insertRows(
      rows.map((row) => {
        const approved = row.moderation_status === 'approved'
        return {
          tenant_id: tenantId,
          establishment_id: establishmentId,
          revision_id: targetRevisionId,
          media_asset_id: row.media_asset_id,
          purpose: row.purpose,
          is_cover: approved ? row.is_cover : false,
          sort_order: row.sort_order,
          alt_text: row.alt_text,
          caption: row.caption,
          moderation_status: approved ? 'approved' : 'pending',
          created_by: actorId,
          reviewed_by: approved ? row.reviewed_by : null,
          reviewed_at: approved ? row.reviewed_at : null,
          review_notes: approved ? row.review_notes : null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      }),
      client
    )
  }
}
