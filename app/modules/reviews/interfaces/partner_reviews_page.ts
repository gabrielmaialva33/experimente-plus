import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * The portal's Avaliações page, as the server projects it — Anexo I items 3
 * and 8.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature, which would turn the page's props into `never`.
 */
export type PartnerReviewPlace = {
  id: number
  name: string
  unanswered: number
  /** The server's projection of the place's organization; the service still decides. */
  can_reply: boolean
}

export type PartnerReviewItem = {
  id: number
  rating: number
  comment: string | null
  created_at: string
  edited_at: string | null
  author_name: string
  photos: { url: string | null; alt_text: string | null }[]
  reply: {
    comment: string
    status: IReview.ReplyStatus
    created_at: string
    edited_at: string | null
  } | null
}

export type PartnerReviewsPageProps = {
  places: PartnerReviewPlace[]
  selected_place_id: number | null
  filter: IReview.PartnerReviewFilter
  counts: { unanswered: number; answered: number; all: number }
  average: number | null
  reviews: PartnerReviewItem[]
  meta: { current_page: number; last_page: number; total: number }
}
