import type EstablishmentReview from '#modules/reviews/models/establishment_review'

/**
 * The reviews the public web page of a place shows — W10 of the web audit.
 *
 * Serialized into the SSR document of a page cached as `public`, so this type
 * is the contract: a display name, never the author's id or username, and only
 * the published reply. The list comes from the same public listing as
 * `GET /api/v1/catalog/establishments/:id/reviews`, so the page and the app
 * hide the same reviews (banned authors, places that left the catalogue).
 */
export type PublicReviewItem = {
  id: number
  rating: number
  comment: string | null
  created_at: string | null
  author_name: string
  reply: { comment: string; created_at: string | null } | null
  photos: { url: string; alt_text: string | null; width: number | null; height: number | null }[]
}

export type PublicReviewsPayload = {
  summary: { count: number; average: number | null }
  latest: PublicReviewItem[]
}

export function publicReviewItems(reviews: EstablishmentReview[]): PublicReviewItem[] {
  return reviews.map((review) => {
    const reply = review.reply ?? null
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? null,
      created_at: review.created_at?.toISO() ?? null,
      author_name: review.author?.full_name?.trim() || 'Visitante',
      reply: reply
        ? { comment: reply.comment, created_at: reply.created_at?.toISO() ?? null }
        : null,
      photos: (review.photos ?? []).flatMap((photo) => {
        const projection = photo.projection()
        return projection.url
          ? [
              {
                url: projection.url,
                alt_text: projection.alt_text,
                width: projection.width,
                height: projection.height,
              },
            ]
          : []
      }),
    }
  })
}
