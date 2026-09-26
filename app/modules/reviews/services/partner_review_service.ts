import { inject } from '@adonisjs/core'

import NotFoundException from '#exceptions/not_found_exception'
import type {
  PartnerReviewItem,
  PartnerReviewsPageProps,
} from '#modules/reviews/interfaces/partner_reviews_page'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewRepository from '#modules/reviews/repositories/establishment_review_repository'

const PAGE_SIZE = 20

/** A place the partner may see, and whether the server projects that they may answer there. */
export type PartnerReviewScope = { id: number; name: string; can_reply: boolean }

/**
 * Reviews from the partner's side — Anexo I items 3 and 8.
 *
 * Which places a partner sees comes from the caller's authorization snapshot;
 * answering goes through `EstablishmentReviewReplyService`, which resolves the
 * organization policy again on every write. This service only reads.
 */
@inject()
export default class PartnerReviewService {
  constructor(private reviews: EstablishmentReviewRepository) {}

  /** Reviews waiting for an answer across these places: the overview's number. */
  async unansweredTotal(tenantId: number, establishmentIds: number[]): Promise<number> {
    const summaries = await this.reviews.partnerSummaries(tenantId, establishmentIds)
    let total = 0
    for (const summary of summaries.values()) total += summary.unanswered
    return total
  }

  async page(
    tenantId: number,
    scope: PartnerReviewScope[],
    query: { establishment?: number; filter?: IReview.PartnerReviewFilter; page?: number }
  ): Promise<PartnerReviewsPageProps> {
    // A place outside the partner's organizations answers like one that does
    // not exist, as the reply endpoint does.
    if (query.establishment !== undefined && !scope.some((p) => p.id === query.establishment)) {
      throw new NotFoundException('Establishment not found')
    }

    const summaries = await this.reviews.partnerSummaries(
      tenantId,
      scope.map((place) => place.id)
    )
    const places = scope.map((place) => ({
      ...place,
      unanswered: summaries.get(place.id)?.unanswered ?? 0,
    }))
    // Open where the work is: the first place with a review waiting.
    const selected =
      query.establishment ?? (places.find((place) => place.unanswered > 0) ?? places[0])?.id

    if (selected === undefined) {
      return {
        places,
        selected_place_id: null,
        filter: query.filter ?? 'all',
        counts: { unanswered: 0, answered: 0, all: 0 },
        average: null,
        reviews: [],
        meta: { current_page: 1, last_page: 1, total: 0 },
      }
    }

    const summary = summaries.get(selected)
    const filter = query.filter ?? ((summary?.unanswered ?? 0) > 0 ? 'unanswered' : 'all')
    const page = await this.reviews.paginateForPartner(
      tenantId,
      [selected],
      filter,
      query.page ?? 1,
      PAGE_SIZE
    )
    const meta = page.getMeta()

    return {
      places,
      selected_place_id: selected,
      filter,
      counts: {
        unanswered: summary?.unanswered ?? 0,
        answered: summary?.answered ?? 0,
        all: summary?.total ?? 0,
      },
      average: summary?.average ?? null,
      reviews: page.all().map((review) => this.item(review)),
      meta: {
        current_page: Number(meta.currentPage),
        last_page: Number(meta.lastPage),
        total: Number(meta.total),
      },
    }
  }

  private item(review: EstablishmentReview): PartnerReviewItem {
    const reply = review.reply ?? null
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at.toISO() ?? '',
      edited_at: review.edited_at?.toISO() ?? null,
      // A deleted author's row is skipped by the soft-delete scope, so it
      // arrives empty; the app names such a review the same way.
      author_name: review.author?.full_name?.trim() || 'Visitante',
      photos: (review.photos ?? []).map((photo) => {
        const projected = photo.serialize()
        return { url: projected.url, alt_text: projected.alt_text }
      }),
      reply: reply
        ? {
            comment: reply.comment,
            status: reply.status,
            created_at: reply.created_at.toISO() ?? '',
            edited_at: reply.edited_at?.toISO() ?? null,
          }
        : null,
    }
  }
}
