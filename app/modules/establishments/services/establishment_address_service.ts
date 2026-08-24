import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentAddressService {
  constructor(
    private accessService: EstablishmentAccessService,
    private auditService: EstablishmentAuditService
  ) {}

  async replace(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.AddressPayload
  ): Promise<EstablishmentRevisionAddress> {
    const address = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )

      const existing = await EstablishmentRevisionAddress.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .forUpdate()
        .first()
      const hasLatitude = typeof payload.latitude === 'number'
      const hasLongitude = typeof payload.longitude === 'number'
      if (hasLatitude !== hasLongitude) {
        throw new BadRequestException('Latitude and longitude must be provided together')
      }

      const coordinatesPresent = hasLatitude && hasLongitude
      const values = {
        tenant_id: tenantId,
        revision_id: revision.id,
        postal_code: this.nullablePostalCode(payload.postal_code),
        street: this.nullableText(payload.street),
        number: payload.without_number ? null : this.nullableText(payload.number),
        without_number: payload.without_number ?? false,
        complement: this.nullableText(payload.complement),
        district: this.nullableText(payload.district),
        reference: this.nullableText(payload.reference),
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        coordinate_source: coordinatesPresent ? (payload.coordinate_source ?? 'manual') : null,
        geocoded_at:
          coordinatesPresent && payload.coordinate_source === 'geocoded' ? DateTime.now() : null,
      }

      if (existing) {
        existing.merge(values)
        await existing.save()
        return existing
      }

      return EstablishmentRevisionAddress.create(values, { client })
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { section: 'address', revision_id: address.revision_id },
    })

    return address
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }

  private nullablePostalCode(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, '') ?? ''
    return digits || null
  }
}
