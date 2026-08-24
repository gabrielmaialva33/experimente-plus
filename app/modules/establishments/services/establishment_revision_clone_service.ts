import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import EstablishmentRevisionEventService from '#modules/establishments/services/establishment_revision_event_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentRevisionCloneService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private eventService: EstablishmentRevisionEventService,
    private auditService: EstablishmentAuditService
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
      const revision = await EstablishmentRevision.create(
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

      await this.copyAddress(source.id, revision.id, tenantId, client)
      await this.copyCategories(source.id, revision.id, tenantId, client)
      await this.copyAttributeValues(source.id, revision.id, tenantId, client)
      await this.copyHours(source.id, revision.id, tenantId, client)
      await this.copySpecialDays(source.id, revision.id, tenantId, client)
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
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<EstablishmentRevision> {
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

    const terminal = await EstablishmentRevision.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .whereIn('status', ['approved', 'rejected'])
      .orderBy('version', 'desc')
      .forUpdate()
      .first()

    if (!terminal) {
      throw new NotFoundException('No terminal revision is available to clone')
    }
    return terminal
  }

  private async copyAddress(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const source = await client
      .from('establishment_revision_addresses')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .first()
    if (!source) return

    await client.table('establishment_revision_addresses').insert({
      tenant_id: tenantId,
      revision_id: targetRevisionId,
      postal_code: source.postal_code,
      street: source.street,
      number: source.number,
      without_number: source.without_number,
      complement: source.complement,
      district: source.district,
      reference: source.reference,
      latitude: source.latitude,
      longitude: source.longitude,
      coordinate_source: source.coordinate_source,
      geocoded_at: source.geocoded_at,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  private async copyCategories(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const rows = await client
      .from('establishment_revision_categories')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('sort_order', 'asc')

    if (rows.length === 0) return
    await client.table('establishment_revision_categories').insert(
      rows.map((row) => ({
        tenant_id: tenantId,
        revision_id: targetRevisionId,
        category_id: row.category_id,
        is_primary: row.is_primary,
        sort_order: row.sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    )
  }

  private async copyAttributeValues(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const values = await client
      .from('establishment_revision_attribute_values')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('id', 'asc')

    for (const value of values) {
      const [created] = await client
        .table('establishment_revision_attribute_values')
        .insert({
          tenant_id: tenantId,
          revision_id: targetRevisionId,
          attribute_definition_id: value.attribute_definition_id,
          value_text: value.value_text,
          value_boolean: value.value_boolean,
          value_integer: value.value_integer,
          value_decimal: value.value_decimal,
          value_url: value.value_url,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      const options = await client
        .from('establishment_revision_attribute_value_options')
        .where('tenant_id', tenantId)
        .where('attribute_value_id', value.id)
        .orderBy('id', 'asc')

      if (options.length > 0) {
        await client.table('establishment_revision_attribute_value_options').insert(
          options.map((option) => ({
            tenant_id: tenantId,
            attribute_value_id: Number(created.id),
            attribute_definition_id: option.attribute_definition_id,
            attribute_option_id: option.attribute_option_id,
            created_at: new Date(),
          }))
        )
      }
    }
  }

  private async copyHours(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const rows = await client
      .from('establishment_revision_hours')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('weekday', 'asc')
      .orderBy('sort_order', 'asc')

    if (rows.length === 0) return
    await client.table('establishment_revision_hours').insert(
      rows.map((row) => ({
        tenant_id: tenantId,
        revision_id: targetRevisionId,
        weekday: row.weekday,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        spans_next_day: row.spans_next_day,
        sort_order: row.sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    )
  }

  private async copySpecialDays(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const days = await client
      .from('establishment_revision_special_days')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('date', 'asc')

    for (const day of days) {
      const [created] = await client
        .table('establishment_revision_special_days')
        .insert({
          tenant_id: tenantId,
          revision_id: targetRevisionId,
          date: day.date,
          status: day.status,
          note: day.note,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')

      const intervals = await client
        .from('establishment_revision_special_hours')
        .where('tenant_id', tenantId)
        .where('special_day_id', day.id)
        .orderBy('sort_order', 'asc')

      if (intervals.length > 0) {
        await client.table('establishment_revision_special_hours').insert(
          intervals.map((interval) => ({
            tenant_id: tenantId,
            special_day_id: Number(created.id),
            revision_id: targetRevisionId,
            opens_at: interval.opens_at,
            closes_at: interval.closes_at,
            spans_next_day: interval.spans_next_day,
            sort_order: interval.sort_order,
            created_at: new Date(),
            updated_at: new Date(),
          }))
        )
      }
    }
  }

  private async copyMedia(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    establishmentId: number,
    actorId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ): Promise<void> {
    const rows = await client
      .from('establishment_revision_media')
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', sourceRevisionId)
      .orderBy('sort_order', 'asc')

    if (rows.length === 0) return
    await client.table('establishment_revision_media').insert(
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
      })
    )
  }
}
