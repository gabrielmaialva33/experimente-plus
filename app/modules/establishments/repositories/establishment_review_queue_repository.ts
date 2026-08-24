import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'

export default class EstablishmentReviewQueueRepository {
  async listPending(tenantId: number, query: IEstablishmentReview.QueueQuery) {
    const revisions = EstablishmentRevision.query()
      .where('tenant_id', tenantId)
      .where('status', 'pending_review')
      .whereHas('establishment', (establishmentQuery) => {
        establishmentQuery.where('tenant_id', tenantId)

        if (query.organization_id !== undefined) {
          establishmentQuery.where('organization_id', query.organization_id)
        }
      })
      .preload('establishment', (establishmentQuery) => {
        establishmentQuery.preload('organization')
      })
      .preload('city')
      .orderBy('submitted_at', 'asc')
      .orderBy('id', 'asc')

    if (query.city_id !== undefined) {
      revisions.where('city_id', query.city_id)
    }

    return revisions.paginate(query.page, query.per_page)
  }
}
