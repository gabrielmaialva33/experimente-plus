import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentRevisionEventRepository extends LucidRepository<
  typeof EstablishmentRevisionEvent
> {
  constructor() {
    super(EstablishmentRevisionEvent)
  }

  async listForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number
  ): Promise<EstablishmentRevisionEvent[]> {
    return EstablishmentRevisionEvent.query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
  }
}
