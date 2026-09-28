import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentRevisionAddressRepository extends LucidRepository<
  typeof EstablishmentRevisionAddress
> {
  constructor() {
    super(EstablishmentRevisionAddress)
  }

  async findLockedForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionAddress | null> {
    return EstablishmentRevisionAddress.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .forUpdate()
      .first()
  }

  /** Copies the address of one revision into a freshly cloned revision. */
  async copyToRevision(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: TransactionClientContract
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
}
