import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IEstablishment, {
  ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
} from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import EstablishmentRevisionEventService from '#modules/establishments/services/establishment_revision_event_service'
import City from '#modules/geography/models/city'
import Organization from '#modules/organizations/models/organization'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'
import { resolveUniqueSlug } from '#shared/utils/slug'

@inject()
export default class EstablishmentService {
  constructor(
    private establishmentRepository: EstablishmentRepository,
    private revisionRepository: EstablishmentRevisionRepository,
    private accessService: EstablishmentAccessService,
    private organizationPolicy: OrganizationPolicyService,
    private eventService: EstablishmentRevisionEventService,
    private auditService: EstablishmentAuditService
  ) {}

  async list(tenantId: number, organizationId: number, actor: User) {
    const organization = await Organization.query()
      .where('tenant_id', tenantId)
      .where('id', organizationId)
      .first()
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    await this.organizationPolicy.authorizeRead(actor, tenantId, organization.id)
    const establishments = await this.establishmentRepository.listByOrganization(
      tenantId,
      organization.id
    )

    return establishments.map((establishment) => {
      const openRevision = establishment.revisions[0] ?? null
      return {
        ...establishment.serialize(),
        revision:
          openRevision?.serialize() ?? establishment.published_revision?.serialize() ?? null,
      }
    })
  }

  async show(tenantId: number, establishmentId: number, actor: User) {
    const establishment = await this.accessService.getReadable(tenantId, establishmentId, actor)
    const openRevision = await this.revisionRepository.findOpenForEstablishment(
      tenantId,
      establishment.id
    )
    const revisionId = openRevision?.id ?? establishment.published_revision_id
    const revision = revisionId
      ? await this.revisionRepository.findAggregate(tenantId, revisionId)
      : null

    return this.serialize(establishment, revision)
  }

  async create(
    tenantId: number,
    organizationId: number,
    actor: User,
    payload: IEstablishment.RevisionIdentityPayload
  ) {
    const result = await db.transaction(async (client) => {
      const organization = await Organization.query({ client })
        .where('tenant_id', tenantId)
        .where('id', organizationId)
        .forUpdate()
        .first()
      if (!organization) {
        throw new NotFoundException('Organization not found')
      }

      await this.organizationPolicy.authorizeManageEstablishments(
        actor,
        tenantId,
        organization.id,
        client
      )
      this.ensureOrganizationAllowsManagement(organization)

      const cityId = payload.city_id ?? null
      await this.validateCity(tenantId, cityId, client)
      const publicName = payload.public_name.trim()
      const slug = await resolveUniqueSlug(publicName, (candidate) =>
        this.revisionRepository.isSlugTaken(tenantId, cityId, candidate)
      )

      const establishment = await this.establishmentRepository.create(
        {
          tenant_id: tenantId,
          organization_id: organization.id,
          lifecycle_status: 'active',
          business_status: 'open',
          created_by: actor.id,
        },
        { client }
      )
      const revision = await this.revisionRepository.create(
        {
          tenant_id: tenantId,
          establishment_id: establishment.id,
          version: 1,
          status: 'draft',
          public_name: publicName,
          slug,
          city_id: cityId,
          short_description: this.nullableText(payload.short_description),
          description: this.nullableText(payload.description),
          public_email: this.nullableEmail(payload.public_email),
          public_phone: this.nullablePhone(payload.public_phone),
          whatsapp: this.nullablePhone(payload.whatsapp),
          website: this.nullableText(payload.website),
          instagram: this.nullableInstagram(payload.instagram),
          booking_url: this.nullableText(payload.booking_url),
          availability_type: payload.availability_type ?? 'regular_hours',
          rules_version: ESTABLISHMENT_COMPLETENESS_RULES_VERSION,
          created_by: actor.id,
        },
        { client }
      )

      await this.eventService.record(
        revision,
        'created',
        actor.id,
        null,
        'draft',
        null,
        {
          organization_id: organization.id,
          rules_version: revision.rules_version,
        },
        client
      )

      return { establishment, revision }
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'create',
      resourceId: result.establishment.id,
      metadata: {
        organization_id: organizationId,
        revision_id: result.revision.id,
      },
    })

    return this.show(tenantId, result.establishment.id, actor)
  }

  async updateRevision(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.RevisionIdentityUpdatePayload
  ) {
    const revision = await db.transaction(async (client) => {
      const context = await this.accessService.getEditable(tenantId, establishmentId, actor, client)
      const nextCityId =
        payload.city_id === undefined ? context.revision.city_id : (payload.city_id ?? null)
      await this.validateCity(tenantId, nextCityId, client)

      if (payload.public_name !== undefined) {
        context.revision.public_name = payload.public_name.trim()
      }
      if (payload.city_id !== undefined) {
        context.revision.city_id = payload.city_id ?? null
      }
      if (payload.short_description !== undefined) {
        context.revision.short_description = this.nullableText(payload.short_description)
      }
      if (payload.description !== undefined) {
        context.revision.description = this.nullableText(payload.description)
      }
      if (payload.public_email !== undefined) {
        context.revision.public_email = this.nullableEmail(payload.public_email)
      }
      if (payload.public_phone !== undefined) {
        context.revision.public_phone = this.nullablePhone(payload.public_phone)
      }
      if (payload.whatsapp !== undefined) {
        context.revision.whatsapp = this.nullablePhone(payload.whatsapp)
      }
      if (payload.website !== undefined) {
        context.revision.website = this.nullableText(payload.website)
      }
      if (payload.instagram !== undefined) {
        context.revision.instagram = this.nullableInstagram(payload.instagram)
      }
      if (payload.booking_url !== undefined) {
        context.revision.booking_url = this.nullableText(payload.booking_url)
      }
      if (payload.availability_type !== undefined) {
        context.revision.availability_type = payload.availability_type ?? 'regular_hours'
      }

      if (payload.public_name !== undefined || payload.city_id !== undefined) {
        const publicName = context.revision.public_name?.trim()
        if (!publicName) {
          throw new BadRequestException(
            'A public name is required to generate the establishment slug'
          )
        }

        context.revision.slug = await resolveUniqueSlug(publicName, (candidate) =>
          this.revisionRepository.isSlugTaken(
            tenantId,
            context.revision.city_id,
            candidate,
            context.establishment.id
          )
        )
      }

      await context.revision.save()
      return context.revision
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { revision_id: revision.id, section: 'identity' },
    })

    return this.show(tenantId, establishmentId, actor)
  }

  async updateBusinessStatus(
    tenantId: number,
    establishmentId: number,
    actor: User,
    businessStatus: IEstablishment.BusinessStatus
  ) {
    const establishment = await db.transaction(async (client) => {
      const current = await this.establishmentRepository.lockByIdForTenant(
        tenantId,
        establishmentId,
        client
      )
      if (!current) {
        throw new NotFoundException('Establishment not found')
      }
      if (current.lifecycle_status === 'archived') {
        throw new BadRequestException('Archived establishments cannot change business status')
      }

      if (
        businessStatus === 'permanently_closed' ||
        current.business_status === 'permanently_closed'
      ) {
        await this.organizationPolicy.authorizeManageEstablishmentLifecycle(
          actor,
          tenantId,
          current.organization_id,
          client
        )
      } else {
        await this.organizationPolicy.authorizeManageEstablishments(
          actor,
          tenantId,
          current.organization_id,
          client
        )
      }

      current.business_status = businessStatus
      await current.save()
      return current
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update_business_status',
      resourceId: establishment.id,
      metadata: { business_status: businessStatus },
    })

    return establishment
  }

  async archive(tenantId: number, establishmentId: number, actor: User): Promise<void> {
    await db.transaction(async (client) => {
      const { establishment } = await this.accessService.getForLifecycle(
        tenantId,
        establishmentId,
        actor,
        client
      )
      if (establishment.lifecycle_status === 'archived') {
        return
      }

      establishment.lifecycle_status = 'archived'
      establishment.suspended_at = null
      establishment.archived_at = DateTime.now()
      await establishment.save()
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'archive',
      resourceId: establishmentId,
    })
  }

  private serialize(establishment: Establishment, revision: EstablishmentRevision | null) {
    return {
      ...establishment.serialize(),
      revision: revision?.serialize() ?? null,
    }
  }

  private ensureOrganizationAllowsManagement(organization: Organization): void {
    if (!['draft', 'changes_requested', 'active'].includes(organization.status)) {
      throw new BadRequestException(
        `Organization cannot manage establishments while ${organization.status}`
      )
    }
  }

  private async validateCity(
    tenantId: number,
    cityId: number | null,
    client: TransactionClientContract
  ): Promise<void> {
    if (cityId === null) return

    const city = await City.query({ client })
      .where('tenant_id', tenantId)
      .where('id', cityId)
      .where('is_active', true)
      .first()
    if (!city) {
      throw new BadRequestException('City is inactive or does not belong to the active operation')
    }
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }

  private nullableEmail(value: string | null | undefined): string | null {
    return this.nullableText(value)?.toLowerCase() ?? null
  }

  private nullablePhone(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, '') ?? ''
    return digits || null
  }

  private nullableInstagram(value: string | null | undefined): string | null {
    const normalized = value?.trim().replace(/^@/, '')
    return normalized ? normalized.toLowerCase() : null
  }
}
